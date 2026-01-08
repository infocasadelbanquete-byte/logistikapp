import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, Client, InventoryItem, PaymentStatus, UserRole, CompanySettings, PaymentMethod, PaymentTransaction } from '../../types';
import { storageService, DRAFT_KEYS } from '../../services/storageService';
import { uiService } from '../../services/uiService';

const EventsView: React.FC = () => {
  const [events, setEvents] = useState<EventOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showQuickClientModal, setShowQuickClientModal] = useState(false);
  const [step, setStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientResults, setShowClientResults] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [quickClientForm, setQuickClientForm] = useState<Partial<Client>>({ name: '', documentId: '', phone: '', address: '' });
  const [immediatePayment, setImmediatePayment] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paymentBank, setPaymentBank] = useState<string>('');

  const defaultEventState: Partial<EventOrder> = {
    items: [], status: EventStatus.RESERVED, paymentStatus: PaymentStatus.CREDIT, paidAmount: 0, transactions: [], 
    requiresDelivery: false, deliveryCost: '0' as any, deliveryAddress: '', hasInvoice: false, rentalDays: 1, 
    discountPercentage: 0, discountType: 'PERCENT', executionDates: [new Date().toISOString().split('T')[0]],
    total: 0, executionDate: new Date().toISOString().split('T')[0], notes: '', warehouseExitId: ''
  };

  const [newEvent, setNewEvent] = useState<Partial<EventOrder>>(defaultEventState);

  useEffect(() => {
    const session = storageService.getCurrentSession();
    setCurrentUser(session);
    const unsubEvents = storageService.subscribeToEvents((all) => {
        // FILTRADO ROBUSTO: Asegura visibilidad de estados de reserva (RESERVED o similares)
        setEvents(all.filter(e => {
            const s = String(e.status).toUpperCase();
            return s === 'RESERVED' || s === 'RESERVADO' || s === 'CONFIRMADO';
        }));
    });
    storageService.subscribeToClients(setClients);
    storageService.subscribeToInventory(setInventory);
    storageService.subscribeToSettings(setSettings);
    if (storageService.hasDraft(DRAFT_KEYS.EVENT) && viewMode === 'list') { setShowDraftModal(true); }
    return () => unsubEvents();
  }, [viewMode]);

  useEffect(() => {
    const isActuallyWorking = viewMode === 'create' && !editingId && (newEvent.clientId || newEvent.items?.length);
    if (isActuallyWorking) { storageService.saveDraft(DRAFT_KEYS.EVENT, { ...newEvent, step, clientSearch }); }
  }, [newEvent, step, viewMode, editingId, clientSearch]);

  const parseAmount = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    const sanitized = val.toString().replace(',', '.');
    const num = parseFloat(sanitized);
    return isNaN(num) ? 0 : num;
  };

  const calculateTotal = (updates: Partial<EventOrder> = {}) => {
    setNewEvent(prevState => {
        const state = { ...prevState, ...updates }; 
        const items = state.items || []; 
        const selectedDates = state.executionDates || [state.executionDate || new Date().toISOString().split('T')[0]];
        const days = Math.max(1, selectedDates.length); 
        const delivery = parseAmount(state.deliveryCost); 
        const discValue = parseFloat(String(state.discountPercentage || 0).replace(',', '.')) || 0;
        const discType = state.discountType || 'PERCENT';
        let subtotal15Raw = items.reduce((acc, i) => acc + (parseAmount(i.priceAtBooking) * i.quantity * days), 0);
        let discountAmount = discType === 'PERCENT' ? subtotal15Raw * (discValue / 100) : discValue;
        const netSubtotal15 = subtotal15Raw - discountAmount;
        const tax = state.hasInvoice ? netSubtotal15 * 0.15 : 0; 
        return { ...state, rentalDays: days, executionDate: selectedDates[0], total: netSubtotal15 + tax + delivery, taxAmount: tax };
    });
  };

  const addItemToOrder = (item: InventoryItem) => {
    const current = [...(newEvent.items || [])]; 
    const idx = current.findIndex(i => i.itemId === item.id); 
    if (idx >= 0) current[idx].quantity += 1; 
    else current.push({ itemId: item.id, quantity: 1, priceAtBooking: item.price as any });
    calculateTotal({ items: current });
  };

  const saveEvent = async () => {
    if (!newEvent.clientId) return uiService.alert("Requerido", 'Seleccione un cliente.');
    if (!newEvent.items?.length) return uiService.alert("Vacio", 'Agregue mobiliario.');
    setIsSaving(true);
    try {
        const orderNumberRes = editingId ? (newEvent.orderNumber || 0) : await storageService.generateEventNumber(false);
        const orderData = { ...newEvent as EventOrder, orderNumber: orderNumberRes, id: editingId || '', status: EventStatus.RESERVED };
        await storageService.saveEvent(orderData);
        storageService.removeDraft(DRAFT_KEYS.EVENT);
        uiService.alert("Guardado", `Pedido ORD-${orderNumberRes} sellado.`);
        setViewMode('list');
    } catch (e: any) { uiService.alert("Error", e.message); } finally { setIsSaving(false); }
  };

  const filteredEvents = events.filter(e => (e.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || String(e.orderNumber).includes(searchQuery)) && (!dateFilter || e.executionDates?.includes(dateFilter)));

  return (
    <div className="space-y-6 animate-fade-in h-full">
        {viewMode === 'list' && (
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-4">
                <div className="flex-1 w-full space-y-2">
                    <h2 className="text-lg font-black text-brand-900 uppercase tracking-tight">Pedidos por Despachar</h2>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1 relative">
                            <input type="text" placeholder="Buscar pedido..." className="w-full h-10 bg-white border border-zinc-100 rounded-xl px-10 text-[10px] font-bold shadow-soft outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 grayscale opacity-30 text-sm">🔍</span>
                        </div>
                        <input type="date" className="h-10 bg-white border border-zinc-100 rounded-xl px-3 text-[10px] font-bold shadow-soft" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
                    </div>
                </div>
                <button onClick={() => { setEditingId(null); setNewEvent(defaultEventState); setStep(1); setViewMode('create'); }} className="h-10 px-6 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] shadow-premium">+ Nuevo Pedido</button>
            </div>
        )}

        {viewMode === 'list' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                {filteredEvents.map(event => (
                    <div key={event.id} className="bg-rose-50/60 rounded-[1.5rem] shadow-soft p-4 border border-rose-100/50 flex flex-col hover:shadow-premium transition-all">
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-[8px] font-black text-brand-800/40 bg-white px-2 py-0.5 rounded-lg border border-rose-100 uppercase">ORD-{String(event.orderNumber).padStart(4, '0')}</span>
                            <span className="px-2 py-0.5 rounded-lg text-[7px] font-black uppercase bg-amber-100 text-amber-700">Reservado</span>
                        </div>
                        <h3 className="text-xs font-black text-zinc-800 uppercase truncate mb-1">{event.clientName}</h3>
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-4">🗓️ {event.executionDate}</p>
                        <div className="flex justify-between items-center bg-white/80 p-3 rounded-xl mt-auto">
                            <span className="text-xs font-black text-brand-900 tracking-tight">$ {event.total.toFixed(2)}</span>
                            <button onClick={() => { setEditingId(event.id); setNewEvent(event); setClientSearch(event.clientName); setStep(1); setViewMode('create'); }} className="py-1 px-3 bg-zinc-50 text-zinc-500 rounded-lg text-[8px] font-black uppercase hover:bg-zinc-100">EDIT</button>
                        </div>
                    </div>
                ))}
                {filteredEvents.length === 0 && <div className="col-span-full py-20 text-center opacity-20 uppercase font-black text-xs">No hay pedidos pendientes de despacho</div>}
            </div>
        ) : (
            <div className="bg-white/70 rounded-[2rem] shadow-premium border border-zinc-100 flex flex-col h-[calc(100vh-140px)] min-h-[500px]">
                <div className="p-4 border-b flex justify-between items-center bg-white/50 backdrop-blur-sm rounded-t-[2rem]">
                    <div>
                        <h2 className="text-lg font-black text-brand-900 uppercase tracking-tighter">{editingId ? 'Editando Pedido' : 'Nuevo Pedido'}</h2>
                        <p className="text-zinc-400 text-[8px] font-bold uppercase tracking-[0.3em]">Paso {step} de 3</p>
                    </div>
                    <button onClick={() => setViewMode('list')} className="w-8 h-8 bg-white rounded-full shadow-soft flex items-center justify-center text-zinc-400 hover:text-zinc-950 border transition-all">✕</button>
                </div>
                
                <div className="flex-1 overflow-hidden">
                    {step === 1 && (
                        <div className="max-w-4xl mx-auto space-y-6 p-6 h-full overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-2">Cliente *</label>
                                    <div className="relative">
                                        <input type="text" className="w-full h-12 bg-white border border-zinc-100 rounded-xl px-5 text-xs font-bold" placeholder="Buscar..." value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setShowClientResults(true); }} onFocus={() => setShowClientResults(true)} />
                                        {showClientResults && (
                                            <div className="absolute top-full left-0 w-full bg-white border shadow-premium rounded-xl mt-1 z-50 max-h-48 overflow-y-auto">
                                                {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                                                    <button key={c.id} onClick={() => { setNewEvent(p => ({...p, clientId: c.id, clientName: c.name})); setClientSearch(c.name); setShowClientResults(false); }} className="w-full text-left p-3 hover:bg-rose-50 text-[10px] font-black uppercase border-b last:border-0">{c.name}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-2">Fecha Principal</label>
                                    <input type="date" className="w-full h-12 bg-white border border-zinc-100 rounded-xl px-4 text-[10px] font-bold" value={newEvent.executionDate} onChange={e => calculateTotal({ executionDate: e.target.value, executionDates: [e.target.value] })} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-6 border-t">
                                <button onClick={() => setViewMode('list')} className="px-6 py-3 text-zinc-400 font-black uppercase text-[9px]">Cancelar</button>
                                <button onClick={() => setStep(2)} className="px-10 py-3 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] shadow-premium">Siguiente Catálogo ❯</button>
                            </div>
                        </div>
                    )}
                    {step === 2 && (
                        <div className="flex flex-col lg:flex-row h-full">
                            <div className="lg:flex-1 bg-zinc-50/50 flex flex-col border-r border-zinc-100 overflow-hidden">
                                <div className="p-4 bg-white border-b">
                                    <input className="w-full h-10 bg-zinc-50 rounded-xl px-4 text-[10px] font-bold outline-none" placeholder="Filtrar catálogo..." value={itemSearchQuery} onChange={e => setItemSearchQuery(e.target.value)} />
                                </div>
                                <div className="overflow-y-auto flex-1 p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {inventory.filter(i => i.name.toLowerCase().includes(itemSearchQuery.toLowerCase())).map(item => (
                                        <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-xl border shadow-sm">
                                            <div className="min-w-0 pr-2">
                                                <div className="text-left font-black text-[10px] uppercase truncate">{item.name}</div>
                                                <div className="text-[8px] font-bold text-brand-700 opacity-60 uppercase">$ {item.price.toFixed(2)}</div>
                                            </div>
                                            <button onClick={() => addItemToOrder(item)} className="w-8 h-8 bg-zinc-950 text-white rounded-lg shadow font-black">+</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="lg:w-[400px] bg-white flex flex-col shadow-2xl overflow-hidden">
                                <div className="p-5 bg-brand-950 text-white flex justify-between items-center">
                                    <h3 className="text-[10px] font-black uppercase">Artículos del Pedido</h3>
                                    <div className="text-right"><span className="text-lg font-black tracking-tighter text-white">$ {newEvent.total?.toFixed(2)}</span></div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-zinc-50/30">
                                    {newEvent.items?.map(i => {
                                        const inv = inventory.find(it => it.id === i.itemId);
                                        return (
                                            <div key={i.itemId} className="bg-white p-3 rounded-xl border shadow-sm flex flex-col gap-2">
                                                <div className="flex justify-between items-start"><span className="text-[10px] font-black uppercase truncate flex-1">{inv?.name}</span><button onClick={() => { const c = [...(newEvent.items||[])].filter(it => it.itemId !== i.itemId); calculateTotal({items:c}); }} className="text-rose-300 ml-2">✕</button></div>
                                                <div className="flex items-center gap-2">
                                                    <input type="number" className="w-16 bg-zinc-50 border-none rounded-lg h-8 text-center text-xs font-black" value={i.quantity} onChange={e => { const v = parseInt(e.target.value) || 0; const c = [...(newEvent.items||[])]; const idx = c.findIndex(it => it.itemId === i.itemId); if(idx>=0){ c[idx].quantity = v; calculateTotal({items:c}); } }} />
                                                    <span className="text-[10px] font-black text-brand-900 ml-auto">$ {(i.quantity * parseAmount(i.priceAtBooking) * (newEvent.rentalDays || 1)).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="p-4 border-t bg-white flex gap-3">
                                    <button onClick={() => setStep(1)} className="flex-1 py-3 text-zinc-400 font-black uppercase text-[9px]">Atrás</button>
                                    <button onClick={() => setStep(3)} disabled={!newEvent.items?.length} className="flex-[2] py-3 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] shadow-md">Siguiente ❯</button>
                                </div>
                            </div>
                        </div>
                    )}
                    {step === 3 && (
                        <div className="max-w-xl mx-auto space-y-8 p-10 h-full overflow-y-auto text-center">
                            <div className="bg-brand-900 p-10 rounded-[2.5rem] shadow-premium text-white">
                                <span className="text-[8px] font-black uppercase tracking-[0.3em] opacity-50 block mb-2">Total del Pedido</span>
                                <div className="text-5xl font-black tracking-tighter">$ {newEvent.total?.toFixed(2)}</div>
                            </div>
                            <div className="flex flex-col sm:flex-row justify-center gap-4">
                                <button onClick={() => setStep(2)} className="h-12 px-10 text-zinc-400 font-black uppercase text-[9px]">Revisar Items</button>
                                <button onClick={saveEvent} disabled={isSaving} className="h-12 px-16 bg-emerald-600 text-white rounded-xl font-black shadow-premium uppercase text-[9px] tracking-widest">{isSaving ? 'Guardando...' : '💾 Sellar y Reservar'}</button>
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