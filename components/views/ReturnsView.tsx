import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, InventoryItem } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';

const ReturnsView: React.FC = () => {
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<EventOrder | null>(null);
  const [issueNotes, setIssueNotes] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    storageService.subscribeToEvents(setOrders);
    storageService.subscribeToInventory(setInventory);
  }, []);

  const activeOrders = orders.filter(o => 
    (o.status === EventStatus.DELIVERED || o.status === EventStatus.IN_PROGRESS || o.status === EventStatus.TO_PICKUP || o.status === EventStatus.PARTIAL_RETURN) &&
    (o.clientName.toLowerCase().includes(search.toLowerCase()) || String(o.orderNumber).includes(search))
  );

  const handleCloseSuccess = async (o: EventOrder) => {
    if (await uiService.confirm("Ingreso Sin Novedad", "¿Todo el mobiliario regresó conforme? El inventario se repondrá automáticamente.")) {
      for (const oi of o.items) {
        await storageService.updateStock(oi.itemId, oi.quantity);
      }
      await storageService.saveEvent({ ...o, status: EventStatus.FINISHED });
      uiService.alert("Éxito", "Pedido finalizado y stock repuesto.");
    }
  };

  const handleReportIssues = async () => {
    if (!selectedOrder || !issueNotes.trim()) return;
    await storageService.saveEvent({ ...selectedOrder, status: EventStatus.PARTIAL_RETURN, returnNotes: issueNotes });
    uiService.alert("Novedades", "Pedido marcado con ingreso parcial.");
    setSelectedOrder(null);
    setIssueNotes('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-brand-950 uppercase tracking-tighter">Retorno e Ingresos</h2>
          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mt-1">Control de mobiliario que regresa a bodega</p>
        </div>
      </div>

      <div className="relative">
         <input 
           className="w-full bg-white border border-zinc-100 h-12 px-12 rounded-2xl text-xs font-bold shadow-soft outline-none focus:ring-2 focus:ring-brand-50" 
           placeholder="Filtrar pedidos por cobrar o recibir..." 
           value={search} 
           onChange={e => setSearch(e.target.value)} 
         />
         <span className="absolute left-4 top-1/2 -translate-y-1/2 grayscale opacity-30">🔍</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeOrders.map(o => {
          const balance = o.total - o.paidAmount;
          return (
            <div key={o.id} className="bg-white p-8 rounded-[2.5rem] shadow-premium border border-zinc-100 flex flex-col hover:border-brand-100 transition-all">
              <div className="flex justify-between items-start mb-6">
                 <span className="text-[10px] font-black text-zinc-300">ORD-#{o.orderNumber}</span>
                 <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase ${o.status === EventStatus.PARTIAL_RETURN ? 'bg-rose-50 text-rose-600' : 'bg-orange-50 text-orange-600'}`}>{o.status}</span>
              </div>
              <h3 className="text-sm font-black text-zinc-950 uppercase mb-1">{o.clientName}</h3>
              <div className="flex items-center gap-2 mb-6">
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">🗓️ Fin: {o.executionDate}</p>
                {balance > 0.05 && (
                  <span className="text-[8px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded">SALDO: $ {balance.toFixed(2)}</span>
                )}
              </div>
              
              <div className="mt-auto space-y-2">
                 <button onClick={() => handleCloseSuccess(o)} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-[8px] shadow-lg">✅ Ingresar Conforme</button>
                 <button onClick={() => setSelectedOrder(o)} className="w-full py-3 bg-white text-rose-500 rounded-xl font-black uppercase text-[8px] border border-rose-100 hover:bg-rose-50 transition-colors">⚠️ Reportar Novedades</button>
              </div>
            </div>
          );
        })}
        {activeOrders.length === 0 && <div className="col-span-full py-20 text-center opacity-20 font-black uppercase text-xs">Sin registros pendientes</div>}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fade-in">
           <div className="bg-white rounded-[3rem] p-10 shadow-premium w-full max-w-md border border-white animate-slide-up">
              <h3 className="text-xl font-black text-brand-950 uppercase mb-2 tracking-tighter">Reportar Daños / Faltantes</h3>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-8">Pedido #{selectedOrder.orderNumber} - {selectedOrder.clientName}</p>
              
              <div className="space-y-4">
                 <textarea className="w-full bg-zinc-50 border-none rounded-[1.5rem] p-6 text-xs font-bold outline-none focus:ring-8 focus:ring-brand-50 shadow-inner" rows={4} placeholder="Detalle roturas o pérdidas..." value={issueNotes} onChange={e => setIssueNotes(e.target.value)} />
                 <div className="flex flex-col gap-2 pt-4">
                    <button onClick={handleReportIssues} className="w-full h-14 bg-rose-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg">💾 Sellar Novedad</button>
                    <button onClick={() => setSelectedOrder(null)} className="w-full py-2 text-zinc-300 font-bold uppercase text-[8px]">Regresar</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ReturnsView;