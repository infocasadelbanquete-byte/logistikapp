import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, Client } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';

const ReturnsView: React.FC = () => {
  const [events, setEvents] = useState<EventOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsubEvents = storageService.subscribeToEvents((all) => {
        // VISIBILIDAD: Registros ya despachados o con novedades
        const relevant = all.filter(e => 
            e.status === EventStatus.DELIVERED || 
            e.status === EventStatus.WITH_ISSUES || 
            (e.status as any) === 'DELIVERED' || 
            (e.status as any) === 'Entregado'
        );
        relevant.sort((a,b) => b.executionDate.localeCompare(a.executionDate));
        setEvents(relevant);
    });
    return () => { unsubEvents(); };
  }, []);

  const filteredEvents = events.filter(e => 
      e.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      String(e.orderNumber).includes(searchQuery)
  );

  return (
    <div className="h-full flex flex-col space-y-6">
      <h2 className="text-xl font-black text-brand-900 uppercase">Módulo de Retornos</h2>
      <div className="bg-white p-4 rounded-[1.5rem] shadow-premium border border-zinc-100 mb-6">
        <input className="w-full border-none p-3 rounded-xl text-sm font-bold bg-zinc-50" placeholder="Buscar pedido para retirar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 pb-10">
        {filteredEvents.map(event => (
            <div key={event.id} className="bg-white p-3 rounded-[1rem] shadow-soft border-t-2 border-brand-900 flex flex-col">
                <span className="font-mono font-black text-zinc-300 text-[7px]">#ORD-${event.orderNumber}</span>
                <h3 className="text-[9px] font-black text-zinc-950 truncate uppercase my-1">{event.clientName}</h3>
                <span className="text-[7px] font-bold text-orange-400 uppercase mb-2">Despachado</span>
                <button className="mt-auto w-full py-1.5 bg-zinc-900 text-white font-black text-[7px] uppercase rounded-lg">Procesar Retiro</button>
            </div>
        ))}
        {filteredEvents.length === 0 && <div className="col-span-full py-20 text-center opacity-20 uppercase font-black text-xs">Sin retornos pendientes</div>}
      </div>
    </div>
  );
};

export default ReturnsView;