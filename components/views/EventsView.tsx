import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, Client, InventoryItem, PaymentStatus } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';

const EventsView: React.FC = () => {
  const [events, setEvents] = useState<EventOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [step, setStep] = useState(1);
  const [newEvent, setNewEvent] = useState<any>({ items: [], executionDate: new Date().toISOString().split('T')[0], rentalDays: 1, status: EventStatus.CONFIRMED });

  useEffect(() => {
    const unsub = storageService.subscribeToEvents((all) => {
        // Muestra confirmados y los antiguos 'RESERVED' mapeados
        setEvents(all.filter(e => {
            const s = String(e.status).toUpperCase();
            return s === 'CONFIRMADO' || s === 'RESERVED' || s === 'RESERVADO';
        }));
    });
    storageService.subscribeToClients(setClients);
    storageService.subscribeToInventory(setInventory);
    return () => unsub();
  }, []);

  const calculateTotal = () => {
      const days = Math.max(1, newEvent.rentalDays || 1);
      const subtotal = newEvent.items.reduce((acc: number, i: any) => acc + (i.priceAtBooking * i.quantity * days), 0);
      setNewEvent({ ...newEvent, total: subtotal });
  };

  const handleSave = async () => {
      if (!newEvent.clientId || !newEvent.items.length) return uiService.alert("Error", "Faltan datos.");
      await storageService.saveEvent({ ...newEvent, status: EventStatus.CONFIRMED });
      uiService.alert("Éxito", "Pedido confirmado registrado.");
      setViewMode('list');
  };

  const filtered = events.filter(e => e.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || String(e.orderNumber).includes(searchQuery));

  return (
    <div className="space-y-6 animate-fade-in">
        {viewMode === 'list' ? (
            <>
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-black text-brand-900 uppercase">Pedidos Confirmados</h2>
                    <button onClick={() => setViewMode('create')} className="px-6 py-3 bg-brand-900 text-white rounded-xl text-[10px] font-black uppercase shadow-lg">+ Nuevo Pedido</button>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-soft border border-zinc-100">
                    <div className="relative">
                        <input className="w-full bg-zinc-50 border-none p-3 pl-12 rounded-xl text-xs font-bold outline-none" placeholder="Buscar pedido..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(e => (
                        <div key={e.id} className="bg-white p-6 rounded-[2rem] shadow-soft border border-zinc-100">
                            <div className="flex justify-between mb-2">
                                <span className="text-[10px] font-black text-zinc-300">ORD-{e.orderNumber}</span>
                                <span className="text-xs font-black text-brand-900 uppercase bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">Confirmado</span>
                            </div>
                            <h3 className="text-xs font-black text-zinc-800 uppercase truncate mb-1">{e.clientName}</h3>
                            <p className="text-[9px] font-bold text-zinc-400 uppercase mb-4">🗓️ {e.executionDate}</p>
                            <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-xl">
                                <span className="text-sm font-black text-zinc-950">$ {e.total.toFixed(2)}</span>
                                <button className="text-[9px] font-black text-brand-600 uppercase underline">Editar</button>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        ) : (
            <div className="bg-white rounded-[2.5rem] p-8 shadow-premium border border-zinc-100 animate-slide-up">
                <div className="flex justify-between mb-8">
                    <h3 className="text-xl font-black uppercase text-brand-900">Registro de Evento</h3>
                    <button onClick={() => setViewMode('list')} className="text-zinc-300">✕</button>
                </div>
                {/* Simplified Flow Steps (Step 1 Client/Date, Step 2 Items) */}
                <div className="space-y-6">
                    {step === 1 ? (
                        <div className="space-y-4">
                            <select className="w-full h-12 bg-zinc-50 rounded-xl px-4 font-black" onChange={e => setNewEvent({...newEvent, clientId: e.target.value, clientName: clients.find(c=>c.id===e.target.value)?.name})}>
                                <option value="">Seleccionar Cliente</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <input type="date" className="w-full h-12 bg-zinc-50 rounded-xl px-4 font-black" value={newEvent.executionDate} onChange={e => setNewEvent({...newEvent, executionDate: e.target.value})} />
                            <input type="number" className="w-full h-12 bg-zinc-50 rounded-xl px-4 font-black" placeholder="Días Alquiler" value={newEvent.rentalDays} onChange={e => setNewEvent({...newEvent, rentalDays: parseInt(e.target.value)})} />
                            <button onClick={() => setStep(2)} className="w-full py-4 bg-brand-900 text-white rounded-xl font-black uppercase">Siguiente</button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="max-h-60 overflow-y-auto space-y-2">
                                {inventory.map(item => (
                                    <div key={item.id} className="flex justify-between p-3 bg-zinc-50 rounded-xl items-center">
                                        <span className="text-[10px] font-black uppercase">{item.name}</span>
                                        <button onClick={() => {
                                            const its = [...newEvent.items, { itemId: item.id, quantity: 1, priceAtBooking: item.price }];
                                            setNewEvent({...newEvent, items: its});
                                        }} className="w-8 h-8 bg-zinc-950 text-white rounded-lg">+</button>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-6 border-t">
                                <button onClick={handleSave} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase">Finalizar y Confirmar</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};

export default EventsView;