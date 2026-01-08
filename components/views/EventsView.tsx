
import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, Client, InventoryItem, PaymentStatus } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';

const EventsView: React.FC = () => {
  const [events, setEvents] = useState<EventOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [showClientResults, setShowClientResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const initialState: Partial<EventOrder> = {
    items: [], status: EventStatus.RESERVED, paymentStatus: PaymentStatus.CREDIT, paidAmount: 0, 
    requiresDelivery: false, deliveryCost: 0, deliveryAddress: '', hasInvoice: false, 
    rentalDays: 1, discountPercentage: 0, discountType: 'PERCENT', 
    executionDate: new Date().toISOString().split('T')[0], title: '', notes: ''
  };

  const [newEvent, setNewEvent] = useState<Partial<EventOrder>>(initialState);

  useEffect(() => {
    const unsub = storageService.subscribeToEvents((all) => {
        // RESTITUCIÓN: Reconocimiento de estados en español e inglés
        const relevantEvents = all.filter(e => {
            const s = String(e.status).toUpperCase();
            return s === 'RESERVED' || s === 'RESERVADO' || s === 'CONFIRMADO' || s === 'PEDIDO';
        });
        setEvents(relevantEvents);

        // Lógica de redirección desde Reportes
        const targetOrderId = localStorage.getItem('logistik_goto_order');
        if (targetOrderId) {
            const target = relevantEvents.find(ev => ev.id === targetOrderId);
            if (target) {
                setEditingId(target.id);
                setNewEvent(target);
                setClientSearch(target.clientName);
                setStep(1);
                setViewMode('create');
            }
            localStorage.removeItem('logistik_goto_order');
        }
    });
    storageService.subscribeToClients(setClients);
    storageService.subscribeToInventory(setInventory);
    return () => unsub();
  }, []);

  const calculateTotal = (updates: Partial<EventOrder> = {}) => {
    setNewEvent(prev => {
        const s = { ...prev, ...updates };
        const days = Math.max(1, s.rentalDays || 1);
        const subtotal = (s.items || []).reduce((acc, i) => acc + (i.priceAtBooking * i.quantity * days), 0);
        const disc = s.discountType === 'PERCENT' ? (subtotal * (s.discountPercentage || 0) / 100) : (s.discountPercentage || 0);
        const net = Math.max(0, subtotal - disc);
        const tax = s.hasInvoice ? (net * 0.15) : 0;
        return { ...s, total: net + tax + (s.requiresDelivery ? (s.deliveryCost || 0) : 0), taxAmount: tax };
    });
  };

  const handleSave = async () => {
    if (!newEvent.clientId || !newEvent.items?.length) return uiService.alert("Faltan Datos", "Seleccione cliente y mobiliario.");
    setIsSaving(true);
    try {
        await storageService.saveEvent({ ...newEvent as EventOrder, id: editingId || '', status: EventStatus.RESERVED });
        await uiService.alert("Éxito", "Pedido registrado y stock reservado.");
        setViewMode('list'); setEditingId(null);
    } catch (e: any) { uiService.alert("Error", e.message); } finally { setIsSaving(false); }
  };

  return (
    <div className="h-full animate-fade-in flex flex-col">
        {viewMode === 'list' ? (
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h2 className="text-2xl font-black text-brand-900 uppercase tracking-tighter">Pedidos Registrados</h2>
                    <button onClick={() => { setNewEvent(initialState); setEditingId(null); setStep(1); setViewMode('create'); }} className="w-full sm:w-auto h-12 px-8 bg-brand-900 text-white rounded-xl font-black uppercase text-[10px] shadow-premium">+ Nuevo Pedido</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                    {events.filter(e => e.clientName.toLowerCase().includes(searchQuery.toLowerCase())).map(e => (
                        <div key={e.id} className="bg-white p-5 rounded-[2rem] shadow-soft border border-zinc-100 flex flex-col hover:shadow-premium transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-[10px] font-black text-zinc-300">ORD-{e.orderNumber}</span>
                                <span className="text-xs font-black text-brand-900 uppercase bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">Reservado</span>
                            </div>
                            <h3 className="text-xs font-black text-zinc-800 uppercase truncate mb-1">{e.clientName}</h3>
                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-4">🗓️ {e.executionDate}</p>
                            <div className="mt-auto bg-zinc-50 p-3 rounded-xl flex justify-between items-center">
                                <span className="text-sm font-black text-zinc-950">$ {e.total.toFixed(2)}</span>
                                <button onClick={() => { setEditingId(e.id); setNewEvent(e); setClientSearch(e.clientName); setStep(1); setViewMode('create'); }} className="text-[9px] font-black text-brand-600 uppercase">Editar</button>
                            </div>
                        </div>
                    ))}
                    {events.length === 0 && <div className="col-span-full py-20 text-center opacity-20 uppercase font-black text-xs">Sin pedidos por procesar</div>}
                </div>
            </div>
        ) : (
            <div className="flex-1 bg-white rounded-[2.5rem] shadow-premium border border-zinc-100 flex flex-col overflow-hidden animate-slide-up">
                <div className="p-6 border-b flex justify-between items-center bg-zinc-50/50">
                    <div>
                        <h3 className="font-black text-brand-900 uppercase tracking-tighter">{editingId ? 'Actualizar Pedido' : 'Registro de Evento'}</h3>
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Paso {step} de 3</p>
                    </div>
                    <button onClick={() => setViewMode('list')} className="text-zinc-400 hover:text-zinc-950 font-black">✕</button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 scrollbar-hide">
                    {step === 1 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-fade-in">
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase px-2 mb-1 block">Cliente *</label>
                                    <div className="relative">
                                        <input className="w-full h-12 bg-zinc-50 border-none rounded-xl px-4 font-bold uppercase text-xs" placeholder="Buscar..." value={clientSearch} onChange={e => { setClientSearch(e.target.value); setShowClientResults(true); }} onFocus={() => setShowClientResults(true)} />
                                        {showClientResults && (
                                            <div className="absolute top-full left-0 w-full bg-white border shadow-2xl rounded-xl z-50 max-h-48 overflow-auto">
                                                {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                                                    <button key={c.id} onClick={() => { setNewEvent({...newEvent, clientId: c.id, clientName: c.name}); setClientSearch(c.name); setShowClientResults(false); }} className="w-full text-left p-3 hover:bg-zinc-50 border-b last:border-0 font-bold text-[10px] uppercase">{c.name}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-[10px] font-black text-zinc-400 uppercase px-2 mb-1 block">Fecha Evento</label><input type="date" className="w-full h-12 bg-zinc-50 rounded-xl px-4 font-bold text-xs" value={newEvent.executionDate} onChange={e => setNewEvent({...newEvent, executionDate: e.target.value})} /></div>
                                    <div><label className="text-[10px] font-black text-zinc-400 uppercase px-2 mb-1 block">Días Servicio</label><input type="number" min="1" className="w-full h-12 bg-zinc-50 rounded-xl px-4 font-black" value={newEvent.rentalDays} onChange={e => calculateTotal({ rentalDays: parseInt(e.target.value) || 1 })} /></div>
                                </div>
                                <div className="p-4 bg-zinc-50 rounded-2xl flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase text-zinc-600">Incluir IVA (+15%)</span>
                                    <input type="checkbox" checked={newEvent.hasInvoice} onChange={e => calculateTotal({ hasInvoice: e.target.checked })} className="w-6 h-6 rounded text-brand-900" />
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div className="bg-zinc-950 p-6 rounded-3xl text-white space-y-4 shadow-xl">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={newEvent.requiresDelivery} onChange={e => calculateTotal({ requiresDelivery: e.target.checked })} className="w-5 h-5" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Servicio de Transporte</span>
                                    </label>
                                    {newEvent.requiresDelivery && (
                                        <div className="space-y-3 animate-slide-up">
                                            <input className="w-full h-11 bg-white/10 rounded-xl px-4 text-xs" placeholder="Dirección de descarga" value={newEvent.deliveryAddress} onChange={e => setNewEvent({...newEvent, deliveryAddress: e.target.value})} />
                                            <input type="number" className="w-full h-11 bg-white/10 rounded-xl px-4 text-xs font-black" placeholder="Valor Logística $" value={newEvent.deliveryCost || ''} onChange={e => calculateTotal({ deliveryCost: parseFloat(e.target.value) || 0 })} />
                                        </div>
                                    )}
                                </div>
                                <div className="p-6 bg-brand-50 rounded-3xl border border-brand-100 space-y-3">
                                    <label className="text-[10px] font-black text-brand-900 uppercase px-2 block">Descuento Especial</label>
                                    <div className="flex gap-2">
                                        <input type="number" className="w-full h-12 bg-white rounded-xl px-4 font-black" value={newEvent.discountPercentage} onChange={e => calculateTotal({ discountPercentage: parseFloat(e.target.value) || 0 })} />
                                        <select className="h-12 bg-white rounded-xl px-2 text-[10px] font-black" value={newEvent.discountType} onChange={e => calculateTotal({ discountType: e.target.value as any })}>
                                            <option value="PERCENT">%</option><option value="VALUE">$</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {step === 2 && (
                        <div className="flex flex-col lg:flex-row gap-6 h-full animate-fade-in overflow-hidden">
                            <div className="flex-1 bg-zinc-50 rounded-[2rem] p-4 flex flex-col overflow-hidden">
                                <input className="w-full h-12 bg-white border-none rounded-xl px-6 mb-4 font-bold shadow-sm" placeholder="🔍 Mobiliario / Menaje..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
                                <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 scrollbar-hide">
                                    {inventory.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase())).map(item => (
                                        <div key={item.id} className="bg-white p-3 rounded-xl flex justify-between items-center shadow-sm">
                                            <div className="min-w-0 pr-2"><p className="text-[10px] font-black uppercase truncate">{item.name}</p><p className="text-[8px] font-bold text-brand-600">Disp: {item.stock}</p></div>
                                            <button onClick={() => {
                                                const current = [...(newEvent.items || [])];
                                                const idx = current.findIndex(it => it.itemId === item.id);
                                                if (idx >= 0) current[idx].quantity += 1;
                                                else current.push({ itemId: item.id, quantity: 1, priceAtBooking: item.price });
                                                calculateTotal({ items: current });
                                            }} className="w-9 h-9 bg-brand-900 text-white rounded-xl font-black shadow-lg">+</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="lg:w-80 bg-white border border-zinc-100 rounded-[2rem] p-6 flex flex-col shadow-2xl overflow-hidden">
                                <h4 className="text-[10px] font-black uppercase text-zinc-400 mb-4 tracking-widest text-center">Items del Pedido</h4>
                                <div className="flex-1 overflow-y-auto space-y-2 mb-6 scrollbar-hide">
                                    {newEvent.items?.map(i => {
                                        const inv = inventory.find(it => it.id === i.itemId);
                                        return (
                                            <div key={i.itemId} className="bg-zinc-50 p-3 rounded-xl border border-zinc-100 flex justify-between items-center">
                                                <span className="text-[9px] font-bold uppercase truncate max-w-[120px]">{inv?.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <input type="number" className="w-10 h-7 bg-white rounded-lg text-center text-xs font-black shadow-sm" value={i.quantity} onChange={e => {
                                                        const qty = parseInt(e.target.value) || 0;
                                                        const its = [...(newEvent.items || [])];
                                                        const ix = its.findIndex(it => it.itemId === i.itemId);
                                                        if (ix >= 0) its[ix].quantity = qty;
                                                        calculateTotal({ items: its });
                                                    }} />
                                                    <button onClick={() => calculateTotal({ items: newEvent.items?.filter(it => it.itemId !== i.itemId) })} className="text-rose-300">✕</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="border-t pt-4 flex justify-between items-center"><span className="text-[10px] font-black text-zinc-400 uppercase">Total Final</span><span className="text-lg font-black text-brand-900">$ {newEvent.total?.toFixed(2)}</span></div>
                            </div>
                        </div>
                    )}
                    {step === 3 && (
                        <div className="max-w-xl mx-auto space-y-8 p-6 text-center animate-fade-in overflow-y-auto scrollbar-hide">
                            <div className="bg-brand-900 p-10 rounded-[3rem] shadow-premium text-white">
                                <span className="text-[9px] font-black uppercase tracking-[0.4em] opacity-40 block mb-2">Total a Pagar</span>
                                <div className="text-5xl font-black tracking-tighter">$ {newEvent.total?.toFixed(2)}</div>
                            </div>
                            <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100 text-left space-y-3">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center border-b pb-2">Confirmación de Reserva</p>
                                <div className="flex justify-between text-xs font-black uppercase"><span>Cliente:</span> <span className="text-brand-900 truncate ml-2">{newEvent.clientName}</span></div>
                                <div className="flex justify-between text-xs font-black uppercase"><span>Fecha Evento:</span> <span>{newEvent.executionDate}</span></div>
                                <div className="flex justify-between text-xs font-black uppercase"><span>Días Renta:</span> <span>{newEvent.rentalDays}</span></div>
                                <div className="flex justify-between text-xs font-black uppercase"><span>Transporte:</span> <span>{newEvent.requiresDelivery ? `$ ${newEvent.deliveryCost}` : 'Retiro en Bodega'}</span></div>
                            </div>
                            <button onClick={handleSave} disabled={isSaving} className="w-full h-16 bg-brand-950 text-white rounded-2xl font-black shadow-premium uppercase text-[11px] tracking-widest">{isSaving ? 'Registrando...' : '💾 Sellar y Confirmar'}</button>
                        </div>
                    )}
                </div>
                <div className="p-6 bg-zinc-50 border-t flex justify-between">
                    {step > 1 && <button onClick={() => setStep(step - 1)} className="px-6 text-zinc-400 font-bold text-[10px] uppercase">Anterior</button>}
                    {step < 3 && <button onClick={() => setStep(step + 1)} disabled={step === 1 && !newEvent.clientId} className="ml-auto px-10 py-3 bg-brand-900 text-white rounded-xl font-black text-[10px] uppercase shadow-lg disabled:opacity-30">Continuar ❯</button>}
                </div>
            </div>
        )}
    </div>
  );
};

export default EventsView;
