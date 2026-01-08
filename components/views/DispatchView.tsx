import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';

const DispatchView: React.FC = () => {
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'CT' | 'ST'>('CT');
  const [search, setSearch] = useState('');

  useEffect(() => {
    storageService.subscribeToEvents(setOrders);
  }, []);

  const filtered = orders.filter(o => 
    (o.status === EventStatus.CONFIRMED || o.status === EventStatus.DISPATCHED) &&
    (activeTab === 'CT' ? o.requiresDelivery : !o.requiresDelivery) &&
    o.clientName.toLowerCase().includes(search.toLowerCase())
  );

  const handleDispatch = async (o: EventOrder) => {
    if (await uiService.confirm("Confirmar Despacho", `¿Desea marcar el pedido #${o.orderNumber} como DESPACHADO?`)) {
      await storageService.saveEvent({ ...o, status: EventStatus.DISPATCHED });
      uiService.alert("Éxito", "Estado actualizado.");
    }
  };

  const handleDeliver = async (o: EventOrder) => {
    await storageService.saveEvent({ ...o, status: EventStatus.DELIVERED });
    uiService.alert("Logística", "Pedido marcado como ENTREGADO.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-brand-950 uppercase tracking-tighter">Gestión de Logística</h2>
          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mt-1">Control de salidas de bodega y entregas</p>
        </div>
        <div className="flex bg-zinc-100 p-1.5 rounded-2xl shadow-inner gap-1">
          <button onClick={() => setActiveTab('CT')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'CT' ? 'bg-white text-brand-900 shadow-md' : 'text-zinc-400'}`}>🚚 Con Transporte (C/T)</button>
          <button onClick={() => setActiveTab('ST')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'ST' ? 'bg-white text-brand-900 shadow-md' : 'text-zinc-400'}`}>🏠 Retiro en Local (S/T)</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-soft border border-zinc-100">
         <input className="w-full bg-zinc-50 border-none h-12 px-6 rounded-xl text-xs font-bold outline-none" placeholder="Buscar por cliente o número de orden..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(o => (
          <div key={o.id} className="bg-white rounded-[2.5rem] p-8 shadow-premium border border-zinc-100 flex flex-col relative overflow-hidden">
            <div className={`absolute top-0 right-0 h-2 w-full ${o.status === EventStatus.CONFIRMED ? 'bg-amber-400' : 'bg-blue-500'}`}></div>
            <div className="flex justify-between items-start mb-6">
               <span className="text-[10px] font-black text-zinc-300">ORD-#{o.orderNumber}</span>
               <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase ${o.status === EventStatus.CONFIRMED ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>{o.status}</span>
            </div>
            <h3 className="text-sm font-black text-zinc-950 uppercase mb-1">{o.clientName}</h3>
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-4">📍 {o.deliveryAddress || 'Retiro en Local'}</p>
            <div className="bg-zinc-50 p-4 rounded-2xl mb-8">
               <p className="text-[8px] font-black text-zinc-400 uppercase mb-2">Items a Despachar:</p>
               <div className="text-[10px] font-bold text-zinc-700 space-y-1">
                  {o.items.length} artículos en lista.
               </div>
            </div>
            <div className="mt-auto flex gap-2">
              {o.status === EventStatus.CONFIRMED ? (
                <button onClick={() => handleDispatch(o)} className="flex-1 py-3 bg-zinc-950 text-white rounded-xl font-black uppercase text-[8px] shadow-lg">📦 Marcar Despachado</button>
              ) : (
                <button onClick={() => handleDeliver(o)} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-[8px] shadow-lg">✅ Confirmar Entrega</button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full py-20 text-center opacity-20 font-black uppercase text-xs">Sin logística pendiente en esta sección</div>}
      </div>
    </div>
  );
};

export default DispatchView;