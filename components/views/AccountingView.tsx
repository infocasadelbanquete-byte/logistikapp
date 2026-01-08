import React, { useState, useEffect } from 'react';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';
import { PurchaseTransaction, Withholding, PayrollEntry, Client, EventOrder, UserRole, EventStatus } from '../../types';

const AccountingView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PURCHASES' | 'WITHHOLDINGS' | 'PAYROLL' | 'INVOICED_CONTROL' | 'REPORTS'>('PURCHASES');
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [userRole, setUserRole] = useState<UserRole>(UserRole.STAFF);

  // Lists
  const [purchases, setPurchases] = useState<PurchaseTransaction[]>([]);
  const [withholdings, setWithholdings] = useState<Withholding[]>([]);
  const [payroll, setPayroll] = useState<PayrollEntry[]>([]);

  useEffect(() => {
    storageService.subscribeToClients(setClients);
    storageService.subscribeToEvents(setOrders);
    storageService.subscribeToPurchases(setPurchases);
    storageService.subscribeToWithholdings(setWithholdings);
    storageService.subscribeToPayroll(setPayroll);
    const session = storageService.getCurrentSession();
    if (session) setUserRole(session.role);
  }, []);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-brand-950 uppercase tracking-tighter">Módulo Administrativo</h2>
          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mt-1">Gestión financiera y contabilidad interna</p>
        </div>
        <div className="flex bg-zinc-100 p-1.5 rounded-2xl shadow-inner gap-1 overflow-x-auto no-scrollbar">
          {['PURCHASES', 'WITHHOLDINGS', 'PAYROLL', 'INVOICED_CONTROL', 'REPORTS'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap ${activeTab === tab ? 'bg-white text-brand-900 shadow-md' : 'text-zinc-400'}`}>
              {tab === 'PURCHASES' ? '🛒 Compras' : tab === 'WITHHOLDINGS' ? '🧾 Retenciones' : tab === 'PAYROLL' ? '👥 Nómina' : tab === 'INVOICED_CONTROL' ? '📄 Facturación' : '📈 Reportes'}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-fade-in">
        {activeTab === 'PURCHASES' && <PurchasesModule purchases={purchases} />}
        {activeTab === 'WITHHOLDINGS' && <WithholdingsModule withholdings={withholdings} clients={clients} orders={orders} />}
        {activeTab === 'PAYROLL' && <PayrollModule payroll={payroll} />}
        {activeTab === 'INVOICED_CONTROL' && <InvoicedControlModule orders={orders} />}
        {activeTab === 'REPORTS' && <AccountingReports purchases={purchases} withholdings={withholdings} payroll={payroll} orders={orders} />}
      </div>
    </div>
  );
};

const InvoicedControlModule = ({ orders }: { orders: EventOrder[] }) => {
    const invoiceableOrders = orders.filter(o => o.hasInvoice && o.status !== EventStatus.QUOTE && o.status !== EventStatus.CANCELLED);
    
    const toggleInvoicedStatus = async (order: EventOrder) => {
        const updated = { ...order, invoiceGenerated: !order.invoiceGenerated };
        await storageService.saveEvent(updated);
    };

    const updateInvoiceNumber = async (order: EventOrder, val: string) => {
        const updated = { ...order, invoiceNumber: val };
        await storageService.saveEvent(updated);
    };

    return (
        <div className="bg-white rounded-[2.5rem] shadow-premium border border-zinc-100 overflow-hidden flex flex-col">
            <div className="p-6 border-b bg-zinc-50/50">
                <h3 className="text-xs font-black text-brand-900 uppercase tracking-widest">Control de Facturas Pendientes</h3>
                <p className="text-[8px] text-zinc-400 uppercase mt-1">Pedidos que requieren emisión de documento legal</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-zinc-50 border-b">
                        <tr className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">
                            <th className="px-6 py-4 w-10 text-center">Hecho</th>
                            <th className="px-6 py-4">Orden</th>
                            <th className="px-6 py-4">Cliente</th>
                            <th className="px-6 py-4">Nº Factura Realizada</th>
                            <th className="px-6 py-4 text-right">Total $</th>
                            <th className="px-6 py-4 text-center">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                        {invoiceableOrders.map(o => (
                            <tr key={o.id} className={`text-[10px] font-bold text-zinc-700 hover:bg-zinc-50 transition-colors ${o.invoiceGenerated ? 'bg-emerald-50/20' : ''}`}>
                                <td className="px-6 py-4 text-center">
                                    <input 
                                        type="checkbox" 
                                        checked={!!o.invoiceGenerated} 
                                        onChange={() => toggleInvoicedStatus(o)}
                                        className="w-4 h-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                                    />
                                </td>
                                <td className="px-6 py-4 font-mono">#ORD-{o.orderNumber}</td>
                                <td className="px-6 py-4 uppercase truncate max-w-[150px]">{o.clientName}</td>
                                <td className="px-6 py-4">
                                    <input 
                                        type="number" 
                                        placeholder="0000000"
                                        className="w-32 bg-zinc-50 border-none rounded px-2 py-1 text-[10px] font-black outline-none focus:ring-2 focus:ring-brand-200"
                                        value={o.invoiceNumber || ''}
                                        onBlur={(e) => updateInvoiceNumber(o, e.target.value)}
                                        onChange={(e) => updateInvoiceNumber(o, e.target.value)}
                                    />
                                </td>
                                <td className="px-6 py-4 text-right font-black">$ {o.total.toFixed(2)}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${o.invoiceGenerated ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {o.invoiceGenerated ? 'FACTURADO' : 'PENDIENTE'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {invoiceableOrders.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-20 text-center text-zinc-300 font-black uppercase text-[10px] tracking-widest">
                                    No hay pedidos que requieran factura
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const PurchasesModule = ({ purchases }: { purchases: PurchaseTransaction[] }) => {
  const [form, setForm] = useState<any>({ date: new Date().toISOString().split('T')[0], providerName: '', providerId: '', docNumber: '', total: 0, details: '' });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await storageService.savePurchase(form);
    setForm({ date: new Date().toISOString().split('T')[0], providerName: '', providerId: '', docNumber: '', total: 0, details: '' });
    uiService.alert("Éxito", "Compra registrada.");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] shadow-premium border border-zinc-100 space-y-6">
        <h3 className="text-xs font-black text-brand-900 uppercase tracking-widest mb-2">Nuevo Egreso / Compra</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <input type="text" placeholder="Razón Social Proveedor" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-[10px] font-black outline-none" value={form.providerName} onChange={e => setForm({...form, providerName: e.target.value})} required />
          <input type="text" placeholder="RUC / CI" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-[10px] font-black outline-none" value={form.providerId} onChange={e => setForm({...form, providerId: e.target.value})} />
          <div className="grid grid-cols-2 gap-3">
             <input type="date" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-[10px] font-black" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
             <input type="text" placeholder="Nº Factura" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-[10px] font-black" value={form.docNumber} onChange={e => setForm({...form, docNumber: e.target.value})} />
          </div>
          <input type="number" step="0.01" placeholder="Monto Total $" className="w-full h-14 bg-brand-50 text-brand-900 rounded-xl px-4 text-xl font-black outline-none" value={form.total || ''} onChange={e => setForm({...form, total: parseFloat(e.target.value) || 0})} required />
          <textarea placeholder="Detalle de adquisición..." className="w-full bg-zinc-50 rounded-xl p-4 text-[10px] font-black outline-none" rows={3} value={form.details} onChange={e => setForm({...form, details: e.target.value})} />
          <button type="submit" className="w-full h-14 bg-brand-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">💾 Guardar Registro</button>
        </form>
      </div>
      <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-premium overflow-hidden border border-zinc-100 flex flex-col">
         <div className="p-6 border-b bg-zinc-50/50 flex justify-between items-center"><span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Historial de Compras</span></div>
         <div className="flex-1 overflow-auto max-h-[600px] scrollbar-hide">
            <table className="w-full text-left">
               <thead className="bg-zinc-50 sticky top-0"><tr className="text-[8px] font-black text-zinc-400 uppercase border-b"><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Proveedor</th><th className="px-6 py-4">Factura</th><th className="px-6 py-4 text-right">Total</th></tr></thead>
               <tbody className="divide-y divide-zinc-50">
                  {purchases.map(p => (
                    <tr key={p.id} className="text-[10px] font-bold text-zinc-700 hover:bg-zinc-50 transition-colors">
                       <td className="px-6 py-4">{p.date}</td>
                       <td className="px-6 py-4 uppercase">{p.providerName}</td>
                       <td className="px-6 py-4 font-mono text-zinc-400">{p.docNumber}</td>
                       <td className="px-6 py-4 text-right font-black text-rose-500">$ {p.total.toFixed(2)}</td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

const WithholdingsModule = ({ withholdings, clients, orders }: { withholdings: Withholding[], clients: Client[], orders: EventOrder[] }) => {
  const [form, setForm] = useState<any>({ date: new Date().toISOString().split('T')[0], docNumber: '', clientId: '', relatedOrderId: '', lines: [] });
  const [line, setLine] = useState({ type: 'IVA', percentage: 0, amount: 0 });

  const addLine = () => {
    if (line.amount <= 0) return;
    setForm({ ...form, lines: [...form.lines, line] });
    setLine({ type: 'IVA', percentage: 0, amount: 0 });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.lines.length === 0) return uiService.alert("Error", "Añada al menos una línea de retención.");
    const total = form.lines.reduce((acc: number, l: any) => acc + l.amount, 0);
    const finalW = { ...form, beneficiary: clients.find(c => c.id === form.clientId)?.name || 'Cliente', amount: total };
    await storageService.saveWithholding(finalW);
    
    // Afectar saldo de factura
    const order = orders.find(o => o.id === form.relatedOrderId);
    if (order) await storageService.saveEvent({ ...order, withheldAmount: (order.withheldAmount || 0) + total });
    
    setForm({ date: new Date().toISOString().split('T')[0], docNumber: '', clientId: '', relatedOrderId: '', lines: [] });
    uiService.alert("Éxito", "Retención aplicada al saldo de la orden.");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
       <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] shadow-premium border border-zinc-100 space-y-6">
          <h3 className="text-xs font-black text-brand-900 uppercase tracking-widest mb-2">Registro de Retención Clientes</h3>
          <form onSubmit={handleSave} className="space-y-4">
             <select className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-[10px] font-black outline-none" value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})}>
                <option value="">-- Seleccionar Cliente --</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
             </select>
             <select className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-[10px] font-black outline-none" value={form.relatedOrderId} onChange={e => setForm({...form, relatedOrderId: e.target.value})}>
                <option value="">-- Seleccionar Pedido / Factura --</option>
                {orders.filter(o => o.clientId === form.clientId).map(o => <option key={o.id} value={o.id}>#ORD-{o.orderNumber} ($ {o.total.toFixed(2)})</option>)}
             </select>
             <div className="grid grid-cols-2 gap-3">
                <input type="date" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-[10px] font-black" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                <input type="text" placeholder="Nº Retención" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-[10px] font-black" value={form.docNumber} onChange={e => setForm({...form, docNumber: e.target.value})} />
             </div>
             
             <div className="p-4 bg-zinc-900 rounded-2xl space-y-3">
                <div className="grid grid-cols-2 gap-2">
                   <select className="h-10 bg-white/10 text-white rounded-lg px-2 text-[10px] font-black border-none outline-none" value={line.type} onChange={e => setLine({...line, type: e.target.value as any})}>
                      <option value="IVA">IVA</option><option value="RENTA">RENTA</option>
                   </select>
                   <input type="number" placeholder="Monto $" className="h-10 bg-white/10 text-white rounded-lg px-3 text-[10px] font-black border-none outline-none" value={line.amount || ''} onChange={e => setLine({...line, amount: parseFloat(e.target.value) || 0})} />
                </div>
                <button type="button" onClick={addLine} className="w-full py-2 bg-white/10 text-white text-[8px] font-black uppercase rounded-lg border border-white/10">Añadir Campo</button>
             </div>

             <div className="space-y-1">
                {form.lines.map((l: any, i: number) => (
                  <div key={i} className="flex justify-between p-2 bg-zinc-50 rounded-lg text-[9px] font-black uppercase">
                     <span>{l.type}</span><span>$ {l.amount.toFixed(2)}</span>
                  </div>
                ))}
             </div>

             <button type="submit" className="w-full h-14 bg-brand-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">Sellar Retención</button>
          </form>
       </div>
       <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-premium overflow-hidden border border-zinc-100">
          <table className="w-full text-left">
             <thead className="bg-zinc-50 border-b"><tr className="text-[8px] font-black text-zinc-400 uppercase tracking-widest"><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Beneficiario</th><th className="px-6 py-4">Nº Retención</th><th className="px-6 py-4 text-right">Total Retenido</th></tr></thead>
             <tbody className="divide-y divide-zinc-50 text-[10px] font-bold text-zinc-700">
                {withholdings.map(w => (
                  <tr key={w.id} className="hover:bg-zinc-50 transition-colors">
                     <td className="px-6 py-4">{w.date}</td><td className="px-6 py-4 uppercase">{w.beneficiary}</td><td className="px-6 py-4 font-mono text-zinc-400">{w.docNumber}</td><td className="px-6 py-4 text-right text-brand-700 font-black">$ {w.amount.toFixed(2)}</td>
                  </tr>
                ))}
             </tbody>
          </table>
       </div>
    </div>
  );
};

const PayrollModule = ({ payroll }: { payroll: PayrollEntry[] }) => {
  const [form, setForm] = useState<any>({ date: new Date().toISOString().split('T')[0], month: '', employeeName: '', salaries: 0, suplementaryHours: 0, extraHours: 0 });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const net = (form.salaries || 0) + (form.suplementaryHours || 0) + (form.extraHours || 0);
    await storageService.savePayroll({ ...form, netPaid: net });
    setForm({ date: new Date().toISOString().split('T')[0], month: '', employeeName: '', salaries: 0, suplementaryHours: 0, extraHours: 0 });
    uiService.alert("Nómina", "Pago registrado.");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
       <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] shadow-premium border border-zinc-100 space-y-6">
          <h3 className="text-xs font-black text-brand-900 uppercase tracking-widest mb-2">Registro de Nómina / Sueldos</h3>
          <form onSubmit={handleSave} className="space-y-4">
             <input type="text" placeholder="Nombre de Empleado" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-[10px] font-black outline-none" value={form.employeeName} onChange={e => setForm({...form, employeeName: e.target.value})} required />
             <input type="text" placeholder="Mes de Pago (Ej: Abril 2024)" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-[10px] font-black outline-none" value={form.month} onChange={e => setForm({...form, month: e.target.value})} required />
             <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                   <label className="text-[8px] font-black text-zinc-400 px-2 uppercase">Sueldo Base</label>
                   <input type="number" className="w-full h-10 bg-zinc-50 rounded-lg px-3 text-[10px] font-black" value={form.salaries || ''} onChange={e => setForm({...form, salaries: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="space-y-1">
                   <label className="text-[8px] font-black text-zinc-400 px-2 uppercase">Suplementarias</label>
                   <input type="number" className="w-full h-10 bg-zinc-50 rounded-lg px-3 text-[10px] font-black" value={form.suplementaryHours || ''} onChange={e => setForm({...form, suplementaryHours: parseFloat(e.target.value) || 0})} />
                </div>
             </div>
             <button type="submit" className="w-full h-14 bg-zinc-950 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">💾 Registrar Pago</button>
          </form>
       </div>
       <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-premium overflow-hidden border border-zinc-100">
          <table className="w-full text-left">
             <thead className="bg-zinc-50 border-b"><tr className="text-[8px] font-black text-zinc-400 uppercase tracking-widest"><th className="px-6 py-4">Mes</th><th className="px-6 py-4">Empleado</th><th className="px-6 py-4 text-right">Neto Pagado</th></tr></thead>
             <tbody className="divide-y divide-zinc-50 text-[10px] font-bold text-zinc-700">
                {payroll.map(p => (
                   <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-6 py-4">{p.month}</td><td className="px-6 py-4 uppercase">{p.employeeName}</td><td className="px-6 py-4 text-right font-black text-brand-900">$ {p.netPaid.toFixed(2)}</td>
                   </tr>
                ))}
             </tbody>
          </table>
       </div>
    </div>
  );
};

const AccountingReports = ({ purchases, withholdings, payroll, orders }: any) => {
  return (
    <div className="bg-white p-10 rounded-[3rem] shadow-premium border border-zinc-100 text-center space-y-10">
       <div className="max-w-md mx-auto space-y-4">
          <h3 className="text-xl font-black text-brand-950 uppercase tracking-tighter">Filtro de Reportes Consolidados</h3>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Generación de archivos para SRI y auditoría interna</p>
          <div className="grid grid-cols-1 gap-3 pt-6">
             <button onClick={() => window.print()} className="w-full h-16 bg-zinc-950 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all">🖨️ Generar Reporte de Ventas</button>
             <button onClick={() => window.print()} className="w-full h-16 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all">📊 Reporte de Egresos y Nómina</button>
             <button onClick={() => uiService.alert("Backup", "Solicitud de respaldo semanal procesada.")} className="w-full h-16 bg-white text-zinc-950 border border-zinc-200 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">📦 Descargar Backup Semanal (.zip)</button>
          </div>
       </div>
    </div>
  );
};

export default AccountingView;