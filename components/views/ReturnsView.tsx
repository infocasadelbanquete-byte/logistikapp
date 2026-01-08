
import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';

const getStatusStyle = (status: EventStatus) => {
  switch (status) {
    case EventStatus.DELIVERED: return 'bg-cyan-100 text-cyan-700 border-cyan-200';
    case EventStatus.IN_PROGRESS: return 'bg-amber-100 text-amber-700 border-amber-200';
    case EventStatus.PARTIAL_RETURN: return 'bg-rose-100 text-rose-700 border-rose-200';
    default: return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  }
};

const ReturnsView: React.FC = () => {
  const [orders, setOrders] = useState<EventOrder[]>([]);

  useEffect(() => {
    storageService.subscribeToEvents(setOrders);
  }, []);

  const activeOrders = orders.filter(o => 
    o.status === EventStatus.DELIVERED || o.status === EventStatus.IN_PROGRESS || o.status === EventStatus.PARTIAL_RETURN
  );

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-black text-brand-950 uppercase tracking-tighter">Logística: Ingresos</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {activeOrders.map(o => (
          <div key={o.id} className="bg-white p-6 rounded-3xl shadow-premium border border-zinc-100">
            <div className="flex justify-between items-start mb-4">
               <span className="text-[10px] font-black text-zinc-300">#ORD-{o.orderNumber}</span>
               <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase border ${getStatusStyle(o.status)}`}>{o.status}</span>
            </div>
            <h3 className="text-sm font-black text-zinc-950 uppercase">{o.clientName}</h3>
            {o.warehouseExitNumber && <p className="text-[9px] font-black text-brand-600 mt-2">EB N°: {o.warehouseExitNumber}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReturnsView;
