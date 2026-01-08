import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, Client, InventoryItem } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';

const EventsView: React.FC = () => {
  const [events, setEvents] = useState<EventOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [newEvent, setNewEvent] = useState<any>({ items: [], executionDate: new Date().toISOString().split('T')[0], rentalDays: 1, status: EventStatus.CONFIRMED });

  useEffect(() => {
    const unsub = storageService.subscribeToEvents((all) => {
        setEvents(all.filter(e => e.status === EventStatus.CONFIRMED));
    });
    storageService.subscribeToClients(setClients);
    storageService.subscribeToInventory(setInventory);
    return () => unsub();
  }, []);

  const handleSave = async () => {
      if (!newEvent.clientId || !newEvent.items.length) return uiService.alert("Error", "Faltan datos.");
      await storageService.saveEvent({ ...newEvent, status: EventStatus.CONFIRMED });
      uiService.alert("Éxito", "Pedido confirmado y registrado en el sistema.");
      setViewMode('list');
  };

  const filtered = events.filter(e => e.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || String(e.orderNumber).includes(searchQuery));
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-brand-900 uppercase">Pedidos Confirmados</h2>
            <button onClick={() => setViewMode('create')} className="px-6 py-3 bg-brand-900 text-white rounded-xl text-[10px] font-black uppercase shadow-lg">+ Nuevo Registro</button>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-soft border border-zinc-100">
            <div className="relative">
                <input className="w-full bg-zinc-50 border-none p-3 pl-12 rounded-xl text-xs font-bold outline-none" placeholder="Buscar pedidos por cliente o número de orden..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
            {filtered.map(e => {
                const isOverdue = e.executionDate < today;
                return (
                    <div key={e.id} className="bg-white p-6 rounded-[2rem] shadow-soft border border-zinc-100 flex flex-col">
                        <div className="flex justify-between mb-4">
                            <span className="text-[10px] font-black text-zinc-300">ORD-{e.orderNumber}</span>
                            <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${isOverdue ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-900'}`}>
                                {isOverdue ? 'Pendiente Retiro' : 'Vigente'}
                            </span>
                        </div>
                        <h3 className="text-xs font-black text-zinc-800 uppercase truncate mb-1">{e.clientName}</h3>
                        <p className={`text-[9px] font-bold uppercase mb-4 ${isOverdue ? 'text-amber-600 animate-pulse' : 'text-zinc-400'}`}>🗓️ {e.executionDate}</p>
                        <div className="mt-auto bg-zinc-50 p-3 rounded-xl flex justify-between items-center">
                            <span className="text-sm font-black text-zinc-950">$ {e.total.toFixed(2)}</span>
                            <button className="text-[9px] font-black text-brand-600 uppercase underline">Ver Ficha</button>
                        </div>
                    </div>
                );
            })}
            {filtered.length === 0 && <div className="col-span-full py-20 text-center opacity-20 uppercase font-black text-xs">No hay pedidos registrados</div>}
        </div>
    </div>
  );
};

export default EventsView;