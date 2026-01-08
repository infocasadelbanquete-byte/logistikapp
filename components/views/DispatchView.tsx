
import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';

const getStatusStyle = (status: EventStatus) => {
  switch (status) {
    case EventStatus.CONFIRMED: return 'bg-blue-100 text-blue-700 border-blue-200';
    case EventStatus.DISPATCHED: return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    case EventStatus.DELIVERED: return 'bg-cyan-100 text-cyan-700 border-cyan-200';
    default: return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  }
};

const DispatchView: React.FC = () => {
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'CT' | 'ST'>('CT');

  useEffect(() => {
    storageService.subscribeToEvents(all => {
        // Mostramos solo los que han sido explícitamente enviados a despacho
        setOrders(all.filter(o => o.status === EventStatus.DISPATCHED));
    });
  }, []);

  const handleRegisterExit = async (o: EventOrder) => {
      if (await uiService.confirm("Registrar Salida", `¿Desea marcar el pedido #${o.orderNumber} como entregado y fuera de bodega?`)) {
          await storageService.saveEvent({ ...o, status: EventStatus.DELIVERED });
          uiService.alert("Éxito", "Salida registrada. El pedido ahora está en fase de ejecución.");
      }
  };

  const filtered = orders.filter(o => 
    (activeTab === 'CT' ? o.requiresDelivery : !o.requiresDelivery)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-3xl font-black text-brand-950 uppercase tracking-tighter">Salidas de Bodega</h2>
        <div className="flex bg-zinc-100 p-1 rounded-2xl">
          <button onClick={() => setActiveTab('CT')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'CT' ? 'bg-white text-brand-900 shadow-md' : 'text-zinc-400'}`}>🚚 Con Transporte</button>
          <button onClick={() => setActiveTab('ST')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'ST' ? 'bg-white text-brand-900 shadow-md' : 'text-zinc-400'}`}>🏠 Retiro Local</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filtered.map(o => (
          <div key={o.id} className="bg-white rounded-3xl p-6 shadow-premium border border-zinc-100">
            <div className="flex justify-between items-start mb-4">
               <span className="text-[10px] font-black text-zinc-300">#ORD-{o.orderNumber}</span>
               <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase border ${getStatusStyle(o.status)}`}>{o.status}</span>
            </div>
            <h3 className="text-sm font-black text-zinc-950 uppercase truncate leading-tight">{o.clientName}</h3>
            <div className="mt-4 space-y-2">
                {o.warehouseExitNumber && (
                    <div className="mb-2">
                        <span className="text-[9px] font-black text-brand-700 bg-brand-50 px-2 py-1 rounded-lg uppercase tracking-widest border border-brand-100">EB N°: {o.warehouseExitNumber}</span>
                    </div>
                )}
                <div className="text-[10px] font-bold text-zinc-400 uppercase">
                    📦 {o.items.length} Tipos de Artículos
                </div>
            </div>
            <div className="mt-6 flex gap-2">
                <button onClick={() => handleRegisterExit(o)} className="flex-1 py-2 bg-zinc-950 text-white rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Registrar Salida</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
            <div className="col-span-full py-20 text-center opacity-20 font-black uppercase text-xs tracking-widest">No hay despachos listos en esta categoría</div>
        )}
      </div>
    </div>
  );
};

export default DispatchView;
