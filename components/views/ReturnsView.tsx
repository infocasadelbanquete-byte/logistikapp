
import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, InventoryItem, MissingItem, PaymentMethod, PaymentTransaction, ReturnReport, Client, UserRole } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';
import { COMPANY_LOGO, COMPANY_NAME } from '../../constants';

const ReturnsView: React.FC = () => {
  const [events, setEvents] = useState<EventOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<EventOrder | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<{[itemId: string]: number}>({});
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [missingItems, setMissingItems] = useState<{item: InventoryItem, missing: number, cost: number}[]>([]);
  const [resolutionAction, setResolutionAction] = useState<'PAY' | 'REPLACE'>('REPLACE');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paymentBank, setBank] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const BANK_OPTIONS = ["Banco del Austro", "Banco Guayaquil", "Banco Pichincha", "Produbanco"];

  const getCalculatedStatus = (event: EventOrder): string => {
      const todayStr = new Date().toISOString().split('T')[0];
      if (event.status === EventStatus.DELIVERED) {
          if (event.executionDate === todayStr) return EventStatus.IN_PROGRESS;
          if (event.executionDate < todayStr) return EventStatus.FINISHED;
      }
      return event.status;
  };

  useEffect(() => {
    const session = storageService.getCurrentSession();
    setCurrentUser(session);
    const unsubEvents = storageService.subscribeToEvents((all) => {
        const relevant = all.filter(e => 
            e.status === EventStatus.DELIVERED || 
            e.status === EventStatus.WITH_ISSUES
        );
        relevant.sort((a,b) => b.executionDate.localeCompare(a.executionDate));
        setEvents(relevant);
    });
    storageService.subscribeToInventory(setInventory);
    storageService.subscribeToClients(setClients);
    return () => { unsubEvents(); };
  }, []);

  const handleSelectEvent = (event: EventOrder) => { 
      setSelectedEvent(event); 
      const initialQtys: any = {}; 
      event.items.forEach(i => initialQtys[i.itemId] = i.quantity); 
      setReturnQuantities(initialQtys); 
      setNotes(''); 
      setMissingItems([]); 
      setResolutionAction('REPLACE'); 
      setPaymentMethod(PaymentMethod.CASH); 
      setBank(''); 
  };

  const handleQtyChange = (itemId: string, val: number) => { 
      setReturnQuantities(prev => ({...prev, [itemId]: val})); 
  };

  const calculateMissing = () => {
      if (!selectedEvent) return;
      const missingList: {item: InventoryItem, missing: number, cost: number}[] = [];
      selectedEvent.items.forEach(orderItem => {
          const invItem = inventory.find(i => i.id === orderItem.itemId);
          if (invItem && invItem.type === 'PRODUCT') { 
              const returned = returnQuantities[orderItem.itemId] ?? orderItem.quantity; 
              const diff = orderItem.quantity - returned; 
              if (diff > 0) { 
                  const cost = diff * (invItem.replacementPrice || invItem.price * 5); 
                  missingList.push({ item: invItem, missing: diff, cost }); 
              } 
          }
      });
      setMissingItems(missingList);
  };

  useEffect(() => { calculateMissing(); }, [returnQuantities, selectedEvent]);
  const totalReplacementCost = missingItems.reduce((acc, curr) => acc + curr.cost, 0);

  const handleProcessReturn = async () => {
      if (!selectedEvent) return;
      
      if (missingItems.length > 0 && resolutionAction === 'PAY' && (paymentMethod === PaymentMethod.TRANSFER || paymentMethod === PaymentMethod.DEPOSIT) && !paymentBank) {
          await uiService.alert("Falta Banco", "Seleccione banco para el pago de reposición.");
          return;
      }

      const confirmMsg = missingItems.length > 0 
        ? `Se han detectado faltantes. ¿Deseas marcar como "Con novedades, revisar pedido"?` 
        : "¿Confirmas el retorno sin novedades?";

      if (!(await uiService.confirm("Confirmar Retiro", confirmMsg))) return;

      setIsProcessing(true);
      try {
          const currentUserSession = storageService.getCurrentSession();
          let finalStatus = EventStatus.RETURNED;
          let transaction: PaymentTransaction | undefined = undefined;
          let reportMissingItems: MissingItem[] = [];

          if (missingItems.length > 0) {
              reportMissingItems = missingItems.map(m => ({ itemId: m.item.id, itemName: m.item.name, missingQuantity: m.missing, replacementCost: m.cost }));
              
              if (resolutionAction === 'PAY') {
                  finalStatus = EventStatus.RETURNED; 
                  const receiptCode = await storageService.generateReceiptCode();
                  transaction = { 
                      id: Date.now().toString(), 
                      receiptCode, 
                      date: new Date().toISOString(), 
                      amount: totalReplacementCost, 
                      method: paymentMethod, 
                      recordedBy: currentUserSession?.name || 'Sistema', 
                      orderNumber: selectedEvent.orderNumber, 
                      notes: 'Pago reposición' 
                  };
                  if (paymentMethod === PaymentMethod.TRANSFER || paymentMethod === PaymentMethod.DEPOSIT) { transaction.bankName = paymentBank; }
                  // Solo sumamos lo que regresó
                  for (const orderItem of selectedEvent.items) {
                    const returned = returnQuantities[orderItem.itemId] ?? orderItem.quantity;
                    await storageService.updateStock(orderItem.itemId, returned);
                  }
              } else {
                  finalStatus = EventStatus.WITH_ISSUES; 
                  // En caso de novedades sin pago, solo sumamos lo que regresó ahora
                  for (const orderItem of selectedEvent.items) {
                    const returned = returnQuantities[orderItem.itemId] ?? orderItem.quantity;
                    await storageService.updateStock(orderItem.itemId, returned);
                  }
              }
          } else {
              // Retorno total sin novedades
              for (const item of selectedEvent.items) {
                  await storageService.updateStock(item.itemId, item.quantity);
              }
          }

          const returnReport: ReturnReport = { 
              date: new Date().toLocaleString(), 
              observations: notes, 
              missingItems: reportMissingItems, 
              totalReplacementCost: totalReplacementCost, 
              reportedBy: currentUserSession?.name || 'Sistema' 
          };

          const updatedEvent: EventOrder = { 
              ...selectedEvent, 
              status: finalStatus, 
              returnReport, 
              transactions: transaction ? [...(selectedEvent.transactions || []), transaction] : selectedEvent.transactions, 
              paidAmount: transaction ? selectedEvent.paidAmount + transaction.amount : selectedEvent.paidAmount 
          };

          await storageService.saveEvent(updatedEvent);
          await uiService.alert("Registro Exitoso", `Pedido actualizado a: ${finalStatus}`);
          setSelectedEvent(null);
      } catch (error) {
          uiService.alert("Error", "No se pudo procesar la devolución.");
      } finally {
          setIsProcessing(false);
      }
  };

  const filteredEvents = events.filter(e => 
      e.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      String(e.orderNumber).includes(searchQuery)
  );

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-black text-brand-900 uppercase tracking-tight">Módulo de Retornos</h2>
          <div className="flex flex-wrap gap-2">
              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase">Pendientes: {events.length}</span>
          </div>
      </div>
      
      {!selectedEvent ? ( 
        <div className="flex-1 flex flex-col animate-fade-in">
          <div className="bg-white p-4 rounded-[1.5rem] shadow-premium border border-zinc-100 mb-6">
            <input className="w-full border-none p-3 rounded-xl text-sm font-bold bg-zinc-50" placeholder="Buscar pedido para retirar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pb-10">
            {filteredEvents.map(event => (
                <div key={event.id} className="bg-white p-3 rounded-[1rem] shadow-soft border-t-2 border-brand-900 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                        <span className="font-mono font-black text-zinc-300 text-[7px]">#${event.orderNumber}</span>
                        <div className={`w-2 h-2 rounded-full ${event.status === EventStatus.WITH_ISSUES ? 'bg-orange-500' : 'bg-emerald-500'}`}></div>
                    </div>
                    <h3 className="text-[9px] font-black text-zinc-950 truncate uppercase mb-1">{event.clientName}</h3>
                    <p className="text-[7px] font-bold text-zinc-400 uppercase mb-3">{getCalculatedStatus(event)}</p>
                    <button onClick={() => handleSelectEvent(event)} className="mt-auto w-full py-1.5 bg-zinc-900 text-white font-black text-[7px] uppercase rounded-lg">Procesar Retiro</button>
                </div>
            ))}
          </div>
        </div>
      ) : ( 
        <div className="flex-1 flex flex-col bg-white rounded-[2rem] shadow-premium h-full overflow-hidden animate-slide-up">
          <div className="p-6 bg-zinc-50 border-b flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black text-zinc-900 uppercase">Orden #{selectedEvent.orderNumber}</h3>
              <p className="text-[9px] font-bold text-zinc-400 uppercase">{selectedEvent.clientName}</p>
            </div>
            <button onClick={() => setSelectedEvent(null)} className="w-10 h-10 bg-white rounded-full shadow-soft flex items-center justify-center text-zinc-300 hover:text-zinc-950">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <table className="w-full">
                <thead><tr className="text-left text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b"><th className="pb-3">Mobiliario</th><th className="pb-3 text-center">Salida</th><th className="pb-3 text-center">Regresa</th><th className="pb-3 text-right">Estado</th></tr></thead>
                <tbody className="divide-y divide-zinc-50">
                    {selectedEvent.items.map(item => { 
                        const invItem = inventory.find(i => i.id === item.itemId); 
                        const returned = returnQuantities[item.itemId] ?? item.quantity; 
                        const missing = Math.max(0, item.quantity - returned); 
                        return (
                            <tr key={item.itemId}>
                                <td className="py-4 font-black text-xs text-zinc-800 uppercase">{invItem?.name || 'Item'}</td>
                                <td className="py-4 text-center font-black text-zinc-400">{item.quantity}</td>
                                <td className="py-4 text-center">
                                    <input type="number" min="0" max={item.quantity} className={`w-16 h-10 bg-zinc-50 rounded-lg text-center font-black ${missing > 0 ? 'text-rose-600' : 'text-emerald-600'}`} value={returned} onChange={(e) => handleQtyChange(item.itemId, parseInt(e.target.value) || 0)} />
                                </td>
                                <td className="py-4 text-right">{missing > 0 ? <span className="text-rose-600 font-bold text-[8px]">-{missing} NOVEDAD</span> : <span className="text-emerald-500 font-bold text-[8px]">OK</span>}</td>
                            </tr>
                        ); 
                    })}
                </tbody>
            </table>
            <div className="pt-6 border-t"><label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-2">Notas</label><textarea className="w-full bg-zinc-50 border-none rounded-2xl p-4 text-xs font-bold" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detalle novedades..." /></div>
            {missingItems.length > 0 && (
                <div className="bg-rose-50 rounded-[2rem] p-6 border-2 border-rose-100 animate-slide-up space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h4 className="text-rose-900 font-black uppercase text-base tracking-tighter">⚠️ Faltantes Detectados</h4>
                            <p className="text-rose-600 text-[8px] font-black uppercase">Reposición: $ {totalReplacementCost.toFixed(2)}</p>
                        </div>
                        <div className="flex bg-white/50 p-1 rounded-xl">
                            <button onClick={() => setResolutionAction('REPLACE')} className={`px-4 py-2 rounded-lg font-black text-[9px] uppercase ${resolutionAction === 'REPLACE' ? 'bg-white text-rose-600 shadow-md' : 'text-zinc-400'}`}>Pendiente</button>
                            <button onClick={() => setResolutionAction('PAY')} className={`px-4 py-2 rounded-lg font-black text-[9px] uppercase ${resolutionAction === 'PAY' ? 'bg-white text-emerald-600 shadow-md' : 'text-zinc-400'}`}>Pagado</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex justify-end gap-4 shadow-2xl pt-6">
                <button onClick={() => setSelectedEvent(null)} disabled={isProcessing} className="px-6 text-zinc-400 font-black uppercase text-[9px]">Volver</button>
                <button onClick={handleProcessReturn} disabled={isProcessing} className="h-14 px-10 bg-brand-950 text-white rounded-2xl font-black shadow-premium uppercase text-[9px] tracking-[0.2em]">💾 Sellar Retiro</button>
            </div>
          </div>
        </div> 
      )}
    </div>
  );
};

export default ReturnsView;
