
import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, PaymentMethod, PaymentStatus, PaymentTransaction, UserRole } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';
import { COMPANY_LOGO, COMPANY_NAME } from '../../constants';

const PaymentsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'REGISTER' | 'REPORT'>('REGISTER');
  const [events, setEvents] = useState<EventOrder[]>([]);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEvents, setFilteredEvents] = useState<EventOrder[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventOrder | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [bank, setBank] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<{event: EventOrder, transaction: PaymentTransaction} | null>(null);
  const [editMode, setEditMode] = useState<'EDIT' | 'VOID' | 'DELETE' | null>(null);
  const [reason, setReason] = useState(''); 
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("Cobro generado con éxito");
  const [reportRange, setReportRange] = useState<'day' | 'month' | 'year' | 'custom'>('day');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [reportTransactions, setReportTransactions] = useState<any[]>([]);

  const BANK_OPTIONS = ["Banco del Austro", "Banco Guayaquil", "Banco Pichincha", "Produbanco"];

  useEffect(() => {
    const session = storageService.getCurrentSession();
    setCurrentUser(session);
    if (session) setUserRole(session.role);
    const unsub = storageService.subscribeToEvents((allEvents) => setEvents(allEvents));
    return () => unsub();
  }, []);

  useEffect(() => {
      const q = searchQuery.toLowerCase();
      const results = events.filter(e => {
          const pending = e.total - e.paidAmount - (e.withheldAmount || 0);
          return e.status !== EventStatus.QUOTE && 
                 e.status !== EventStatus.CANCELLED && 
                 (pending > 0.05) &&
                 (!searchQuery.trim() || (e.clientName.toLowerCase().includes(q) || String(e.orderNumber).includes(q)))
      });
      results.sort((a, b) => b.orderNumber - a.orderNumber);
      setFilteredEvents(results);
  }, [searchQuery, events]);

  useEffect(() => { 
    if (activeTab === 'REPORT') processReport(); 
  }, [activeTab, reportRange, customStartDate, customEndDate, events]);

  const processReport = () => {
      const now = new Date();
      let transactions: any[] = [];
      const todayStr = now.toISOString().split('T')[0];
      events.forEach(e => { 
          if (e.transactions) { 
              e.transactions.forEach(t => { 
                  const tDate = new Date(t.date); 
                  const tDateStr = tDate.toISOString().split('T')[0];
                  let include = false; 
                  if (reportRange === 'day') { if (tDateStr === todayStr) include = true; } 
                  else if (reportRange === 'month') { if (tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear()) include = true; } 
                  else if (reportRange === 'year') { if (tDate.getFullYear() === now.getFullYear()) include = true; } 
                  else if (reportRange === 'custom') { if ((!customStartDate || tDateStr >= customStartDate) && (!customEndDate || tDateStr <= customEndDate)) include = true; } 
                  if (include) { 
                      transactions.push({ ...t, clientName: e.clientName, orderId: e.orderNumber, orderTotal: e.total, orderBalance: e.total - e.paidAmount - (e.withheldAmount || 0) }); 
                  } 
              }); 
          } 
      });
      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setReportTransactions(transactions);
  };

  const handleOpenPayment = (event: EventOrder) => { setSelectedEvent(event); setAmount(''); setMethod(PaymentMethod.CASH); setBank(''); };

  const handleProcessPayment = async () => {
      if (!selectedEvent || !amount) return;
      const valAmount = parseFloat(amount.replace(',', '.'));
      if (isNaN(valAmount) || valAmount <= 0) { await uiService.alert("Error", "Ingrese un monto válido."); return; }
      const pending = selectedEvent.total - selectedEvent.paidAmount - (selectedEvent.withheldAmount || 0);
      if (valAmount > pending + 0.05) { if (!(await uiService.confirm("Aviso", "El monto ingresado es mayor al saldo. ¿Deseas aplicar el pago completo?"))) return; }
      setIsProcessing(true);
      try {
          const receiptCode = await storageService.generateReceiptCode();
          const newTransaction: PaymentTransaction = { id: Date.now().toString(), receiptCode, date: new Date().toISOString(), amount: valAmount, method, recordedBy: currentUser?.name || 'Sistema', orderNumber: selectedEvent.orderNumber };
          if (method === PaymentMethod.TRANSFER || method === PaymentMethod.DEPOSIT) newTransaction.bankName = bank;
          const newPaidAmount = selectedEvent.paidAmount + valAmount;
          let newStatus = selectedEvent.paymentStatus;
          if (newPaidAmount + (selectedEvent.withheldAmount || 0) >= selectedEvent.total - 0.05) newStatus = PaymentStatus.PAID;
          else if (newPaidAmount > 0) newStatus = PaymentStatus.PARTIAL;
          const updatedEvent: EventOrder = { ...selectedEvent, paidAmount: newPaidAmount, paymentStatus: newStatus, transactions: [...(selectedEvent.transactions || []), newTransaction] };
          await storageService.saveEvent(updatedEvent);
          handlePrintReceiptData(updatedEvent, newTransaction, updatedEvent.total - newPaidAmount - (updatedEvent.withheldAmount || 0));
          setSelectedEvent(null); setAmount(''); setSuccessMessage("Cobro registrado."); setShowSuccess(true);
      } catch (error) { uiService.alert("Error", "Fallo al registrar."); } finally { setIsProcessing(false); }
  };

  const handlePrintReceiptData = async (event: EventOrder, transaction: PaymentTransaction, newBalance: number) => {
      const settings = await storageService.getSettings();
      const win = window.open('', '_blank'); if (!win) return;
      const receiptContent = (typeLabel: string) => `
        <div style="border: 1px solid #eee; padding: 15px; margin-bottom: 20px; position: relative;">
          <div style="text-align: right; font-size: 8px; font-weight: bold; position: absolute; top: 5px; right: 5px; color: #999;">${typeLabel}</div>
          <div style="text-align:center;">
            <img src="${settings?.logoUrl || COMPANY_LOGO}" style="height:45px;" />
            <div style="font-weight: 800; font-size: 14px; color: #4c0519;">${settings?.name || COMPANY_NAME}</div>
            <div style="font-size: 10px; font-weight: bold; margin-bottom: 5px;">COMPROBANTE DE ABONO</div>
            <div style="font-weight: 800; font-size: 12px; color: #000;">${transaction.receiptCode || transaction.id.slice(-8)}</div>
          </div>
          <div style="border-bottom: 1px dashed #ccc; margin: 8px 0;"></div>
          <div style="display: flex; justify-content: space-between;"><span>Orden:</span><span style="font-weight: 800;">#${event.orderNumber}</span></div>
          <div style="display: flex; justify-content: space-between;"><span>Cliente:</span><span style="font-weight: bold;">${event.clientName.toUpperCase()}</span></div>
          <div style="display: flex; justify-content: space-between; font-size: 16px; margin-top: 10px; border-top: 2px solid #000; padding-top: 5px;"><span style="font-weight: 800;">ABONO:</span><span style="font-weight: 800;">$${transaction.amount.toFixed(2)}</span></div>
          <div style="display: flex; justify-content: space-between;"><span>Saldo Restante:</span><span style="color:red; font-weight:bold;">$${Math.max(0, newBalance).toFixed(2)}</span></div>
        </div>`;
      win.document.write(`<html><head><style>body { font-family: sans-serif; font-size: 11px; width: 120mm; margin: 0 auto; }</style></head><body>${receiptContent('ORIGINAL')}<br/>${receiptContent('COPIA')}<script>window.onload=function(){window.print()}</script></body></html>`);
      win.document.close();
  };

  const handleOpenEditTransaction = (item: any, type: 'VOID' | 'DELETE') => {
      const parentEvent = events.find(e => e.orderNumber === item.orderId);
      if (!parentEvent) return;
      const transaction = parentEvent.transactions?.find(t => t.id === item.id);
      if (!transaction) return;
      setTransactionToEdit({ event: parentEvent, transaction }); setEditMode(type); setReason(''); 
  };

  const handleVoidTransaction = async () => {
      if (!transactionToEdit || !reason.trim()) return uiService.alert("Error", "Explique el motivo.");
      const { event, transaction } = transactionToEdit;
      const updatedTransactions = (event.transactions || []).map(t => t.id === transaction.id ? { ...t, isVoid: true, voidReason: reason } : t);
      const newPaidAmount = event.paidAmount - transaction.amount;
      await storageService.saveEvent({ ...event, transactions: updatedTransactions, paidAmount: Math.max(0, newPaidAmount) });
      setSuccessMessage("Cobro anulado."); setEditMode(null); setShowSuccess(true);
  };

  const handleDeleteTransaction = async () => {
      if (!transactionToEdit) return;
      const { event, transaction } = transactionToEdit;
      const updatedTransactions = (event.transactions || []).filter(t => t.id !== transaction.id);
      const newPaidAmount = event.paidAmount - transaction.amount;
      await storageService.saveEvent({ ...event, transactions: updatedTransactions, paidAmount: Math.max(0, newPaidAmount) });
      setSuccessMessage("Registro borrado."); setEditMode(null); setShowSuccess(true);
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-2xl font-black text-brand-900 tracking-tighter uppercase">Caja y Cobranzas</h2>
          <div className="flex bg-zinc-100 p-1 rounded-2xl shadow-inner">
              <button onClick={() => setActiveTab('REGISTER')} className={`px-4 py-1.5 rounded-xl font-black text-[9px] uppercase transition-all ${activeTab === 'REGISTER' ? 'bg-white text-brand-900 shadow-md scale-105' : 'text-zinc-400'}`}>Cartera Pendiente</button>
              {userRole !== UserRole.STAFF && <button onClick={() => setActiveTab('REPORT')} className={`px-4 py-1.5 rounded-xl font-black text-[9px] uppercase transition-all ${activeTab === 'REPORT' ? 'bg-white text-brand-900 shadow-md scale-105' : 'text-zinc-400'}`}>Libro Diario</button>}
          </div>
      </div>

      {activeTab === 'REGISTER' ? (
          <div className="flex-1 flex flex-col animate-fade-in">
              <div className="bg-white p-4 rounded-[1.5rem] shadow-premium mb-6 border border-zinc-100">
                  <div className="relative group">
                      <input className="w-full border-none bg-zinc-50 p-3 pl-12 rounded-xl text-sm font-black focus:ring-4 focus:ring-brand-50 outline-none" placeholder="Filtrar por cliente..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 grayscale opacity-30 text-lg">🔍</span>
                  </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pb-20">
                  {filteredEvents.map(event => { 
                      const pending = event.total - event.paidAmount - (event.withheldAmount || 0); 
                      return (
                        <div key={event.id} className="bg-white p-3 rounded-[1rem] shadow-soft border-t-2 border-rose-500 flex flex-col">
                            <div className="flex justify-between items-start mb-2"><span className="font-mono font-black text-zinc-300 bg-zinc-50 px-1 py-0.5 rounded text-[7px]">ORD-#{event.orderNumber}</span></div>
                            <h3 className="font-black text-[9px] text-brand-950 uppercase truncate mb-1">{event.clientName}</h3>
                            {event.withheldAmount && <div className="text-[6px] font-black text-zinc-400 uppercase">Retenido: $ {event.withheldAmount.toFixed(2)}</div>}
                            <div className="bg-zinc-50/50 p-2 rounded-lg my-2 border border-zinc-50">
                                <div className="text-rose-600 font-black text-xs">$ {Math.max(0, pending).toFixed(2)}</div>
                            </div>
                            <button onClick={() => handleOpenPayment(event)} className="mt-auto w-full py-1.5 bg-brand-900 text-white rounded-lg font-black uppercase text-[7px] tracking-widest shadow-md">💰 Cobrar</button>
                        </div>
                      ); 
                  })}
              </div>
          </div>
      ) : (
          <div className="bg-white rounded-[2rem] shadow-premium flex flex-col h-full overflow-hidden border border-zinc-100 animate-fade-in">
              {/* Report Tab JSX remains similar but uses processed transactions with updated balance calculations */}
              <div className="p-4 border-b bg-zinc-50/50 flex justify-between items-center gap-4">
                  <select value={reportRange} onChange={(e) => setReportRange(e.target.value as any)} className="bg-white border px-3 h-10 rounded-lg text-[10px] font-black outline-none">
                      <option value="day">Diario</option><option value="month">Este Mes</option><option value="year">Este Año</option><option value="custom">Rango...</option>
                  </select>
                  <button onClick={() => window.print()} className="h-10 px-4 bg-zinc-950 text-white rounded-lg font-black text-[8px] uppercase tracking-[0.2em]">🖨️ Reporte</button>
              </div>
              <div className="flex-1 overflow-auto">
                  <table className="w-full border-collapse">
                      <thead><tr className="text-left text-[8px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-50/80 border-b"><th className="px-6 py-3">Orden</th><th className="px-6 py-3">Cliente</th><th className="px-6 py-3 text-right">Abono</th><th className="px-6 py-3 text-center">Acción</th></tr></thead>
                      <tbody className="divide-y divide-zinc-50">
                          {reportTransactions.map((t, idx) => (
                              <tr key={idx} className={t.isVoid ? 'opacity-30 line-through' : ''}>
                                  <td className="px-6 py-3 font-mono text-zinc-400 text-[10px]">#ORD-${t.orderId}</td>
                                  <td className="px-6 py-3 text-[10px] font-black text-brand-950 uppercase">{t.clientName}</td>
                                  <td className="px-6 py-3 text-xs font-black text-emerald-600 text-right">$ {t.amount.toFixed(2)}</td>
                                  <td className="px-6 py-3 text-center">
                                      <button onClick={() => handleOpenEditTransaction(t, 'VOID')} className="text-rose-300 p-1 text-[10px]">Anular</button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {selectedEvent && (
          <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-[2rem] shadow-premium w-full max-w-sm p-8 border border-white">
                  <h3 className="text-lg font-black text-brand-950 uppercase mb-6 border-b pb-3">Registrar Cobro</h3>
                  <div className="text-center mb-8">
                      <label className="text-[9px] font-black text-zinc-300 uppercase block mb-2">Monto ($)</label>
                      <input autoFocus type="text" inputMode="decimal" className="w-full h-16 bg-zinc-50 border-none rounded-2xl text-center text-4xl font-black text-brand-900 outline-none" value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                  <div className="flex gap-3">
                      <button onClick={() => setSelectedEvent(null)} className="flex-1 py-3 text-zinc-300 font-black uppercase text-[9px]">Cerrar</button>
                      <button onClick={handleProcessPayment} disabled={isProcessing} className="flex-[2] h-14 bg-brand-900 text-white rounded-xl font-black shadow-premium uppercase text-[9px]">{isProcessing ? 'Sincronizando...' : '💾 Sellar Pago'}</button>
                  </div>
              </div>
          </div>
      )}
      
      {showSuccess && (
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fade-in"><div className="bg-white rounded-[2rem] shadow-premium p-10 text-center animate-bounce-up max-w-xs"><div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner">✅</div><h4 className="text-lg font-black text-brand-950 uppercase mb-6">{successMessage}</h4><button onClick={() => setShowSuccess(false)} className="w-full h-12 bg-zinc-950 text-white rounded-xl font-black uppercase text-[9px] tracking-widest">Entendido</button></div></div>
      )}
    </div>
  );
};

export default PaymentsView;
