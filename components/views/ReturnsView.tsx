import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';

const ReturnsView: React.FC = () => {
  const [events, setEvents] = useState<EventOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsub = storageService.subscribeToEvents((all) => {
        // VISIBILIDAD ROBUSTA: Incluye todos los estados de pedidos que están fuera de bodega
        const relevant = all.filter(e => {
            const s = String(e.status).toUpperCase();
            return s === 'DELIVERED' || s === 'ENTREGADO' || s === 'DESPACHADO' || 
                   s === 'IN_PROGRESS' || s === 'EN CURSO' || 
                   s === 'FINISHED' || s === 'FINALIZADO' || 
                   s === 'WITH_ISSUES' || s === 'NOVEDADES';
        });
        relevant.sort((a,b) => b.executionDate.localeCompare(a.executionDate));
        setEvents(relevant);
    });
    return () => unsub();
  }, []);

  return (
    <div className="h-full flex flex-col space-y-6 animate-fade-in p-2 md:p-6">
      <h2 className="text-2xl font-black text-brand-900 uppercase tracking-tighter">Retorno de Mobiliario</h2>
      <div className="bg-white p-4 rounded-3xl shadow-soft border border-zinc-100 mb-6">
        <div className="relative">
            <input className="w-full border-none p-3 pl-12 rounded-xl text-xs font-bold bg-zinc-50 focus:ring-4 focus:ring-brand-50 outline-none" placeholder="Buscar pedido por nombre o número..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 grayscale opacity-30 text-xl">🔍</span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
        {events.filter(e => e.clientName.toLowerCase().includes(searchQuery.toLowerCase())).map(event => {
            const s = String(event.status).toUpperCase();
            const hasIssues = s === 'WITH_ISSUES' || s === 'NOVEDADES';

            return (
                <div key={event.id} className="bg-white p-6 rounded-[2rem] shadow-soft border-t-8 border-brand-950 flex flex-col hover:shadow-premium transition-all">
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-mono font-black text-zinc-300 text-[10px]">#ORD-{event.orderNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase ${hasIssues ? 'bg-rose-50 text-rose-600' : 'bg-orange-50 text-orange-600'}`}>{hasIssues ? 'Novedades' : 'En Campo'}</span>
                    </div>
                    <h3 className="text-xs font-black text-zinc-950 truncate uppercase mb-1">{event.clientName}</h3>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase mb-6 tracking-widest">🗓️ {event.executionDate}</p>
                    <button className="mt-auto w-full py-3 bg-zinc-950 text-white font-black text-[10px] uppercase rounded-xl shadow-lg active:scale-95 transition-all">Procesar Ingreso</button>
                </div>
            );
        })}
        {events.length === 0 && <div className="col-span-full py-20 text-center opacity-20 uppercase font-black text-xs">Sin registros por recuperar</div>}
      </div>
    </div>
  );
};

export default ReturnsView;