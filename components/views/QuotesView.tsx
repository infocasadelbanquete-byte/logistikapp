import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, Client, InventoryItem, PaymentStatus } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService'; 

const QuotesView: React.FC = () => {
  const [quotes, setQuotes] = useState<EventOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [step, setStep] = useState(1);
  const [newQuote, setNewQuote] = useState<any>({ items: [], executionDate: new Date().toISOString().split('T')[0], rentalDays: 1 });

  useEffect(() => {
    const unsub = storageService.subscribeToEvents((all) => {
        setQuotes(all.filter(e => e.status === EventStatus.QUOTE));
    });
    storageService.subscribeToInventory(setInventory);
    storageService.subscribeToClients(setClients);
    return () => unsub();
  }, []);

  const handleConfirmOrder = async (q: EventOrder) => {
      if (await uiService.confirm("Confirmar Pedido", `¿Convertir PRO-${q.orderNumber} en un pedido confirmado? Se reservará stock.`)) {
          await storageService.saveEvent({ ...q, status: EventStatus.CONFIRMED });
          uiService.alert("Éxito", "Cotización convertida en Pedido Confirmado.");
      }
  };

  const filtered = quotes.filter(q => q.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || String(q.orderNumber).includes(searchQuery));

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-brand-900 uppercase">Proformas</h2>
            <button onClick={() => setViewMode('create')} className="px-6 py-3 bg-zinc-950 text-white rounded-xl text-[10px] font-black uppercase shadow-lg">+ Nueva Proforma</button>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-soft border border-zinc-100">
            <div className="relative">
                <input className="w-full bg-zinc-50 border-none p-3 pl-12 rounded-xl text-xs font-bold outline-none" placeholder="Buscar por cliente o número de proforma..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
            {filtered.map(q => (
                <div key={q.id} className="bg-white p-6 rounded-[2rem] shadow-soft border border-zinc-100 group hover:shadow-premium transition-all">
                    <div className="flex justify-between mb-4">
                        <span className="text-[10px] font-black text-zinc-300">PRO-{q.orderNumber}</span>
                        <span className="text-sm font-black text-brand-900">$ {q.total.toFixed(2)}</span>
                    </div>
                    <h3 className="text-xs font-black text-zinc-800 uppercase truncate mb-4">{q.clientName}</h3>
                    <div className="flex gap-2">
                        <button onClick={() => handleConfirmOrder(q)} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase shadow-md active:scale-95 transition-transform">Confirmar</button>
                        <button className="w-10 h-10 bg-zinc-50 rounded-lg flex items-center justify-center text-zinc-400">✏️</button>
                    </div>
                </div>
            ))}
            {filtered.length === 0 && <div className="col-span-full py-20 text-center opacity-20 uppercase font-black text-xs">No hay proformas que coincidan</div>}
        </div>
    </div>
  );
};

export default QuotesView;