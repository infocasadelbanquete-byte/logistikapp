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

  const getStatusDisplay = (status: any) => {
    const s = String(status).toUpperCase();
    if (s === 'RESERVED' || s === 'RESERVADO' || s === 'CONFIRMADO') return { label: 'Reservado', color: 'bg-amber-100 text-amber-700 border-amber-200' };
    if (s === 'DELIVERED' || s === 'ENTREGADO' || s === 'DESPACHADO') return { label: 'Entregado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    if (s === 'IN_PROGRESS' || s === 'EN CURSO') return { label: 'En Curso', color: 'bg-sky-100 text-sky-700 border-sky-200' };
    if (s === 'FINISHED' || s === 'FINALIZADO') return { label: 'Finalizado', color: 'bg-rose-100 text-rose-700 border-rose-200' };
    if (s === 'WITH_ISSUES' || s === 'NOVEDADES') return { label: 'Novedades', color: 'bg-red-100 text-red-700 border-red-200' };
    if (s === 'RETURNED' || s === 'RETIRADO') return { label: 'Retirado', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' };
    return { label: status, color: 'bg-gray-100 text-gray-700 border-gray-200' };
  };

  useEffect(() => {
    const session = storageService.getCurrentSession();
    setCurrentUser(session);
    const unsubEvents = storageService.subscribeToEvents((all) => {
        // RESTITUCIÓN: Se incluyen estados equivalentes a Reservado para no perder registros previos
        setEvents(all.filter(e => {
            const s = String(e.status).toUpperCase();
            return s === 'RESERVED' || s === 'RESERVADO' || s === 'CONFIRMADO';
        }));
    });
    const unsubClients = storageService.subscribeToClients(setClients);
    const unsubInventory = storageService.subscribeToInventory(setInventory);
    const unsubSettings = storageService.subscribeToSettings(setSettings);
    if (storageService.hasDraft(DRAFT_KEYS.EVENT) && viewMode === 'list') { setShowDraftModal(true); }
    return () => { unsubEvents(); unsubClients(); unsubInventory(); unsubSettings(); }
  }, [viewMode]);

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
        const invoice = state.hasInvoice || false; 
        const discValue = parseFloat(String(state.discountPercentage || 0).replace(',', '.')) || 0;
        const discType = state.discountType || 'PERCENT';
        let subtotal15Raw = items.reduce((acc, i) => acc + (parseAmount(i.priceAtBooking) * i.quantity * days), 0);
        let discountAmount = discType === 'PERCENT' ? subtotal15Raw * (discValue / 100) : discValue;
        const netSubtotal15 = subtotal15Raw - discountAmount;
        const tax = invoice ? netSubtotal15 * 0.15 : 0; 
        return { ...state, rentalDays: days, executionDate: selectedDates[0], total: netSubtotal15 + tax + delivery, taxAmount: tax };
    });
  };

  const handleSave = async () => {
    if (!newEvent.clientId) return uiService.alert("Requerido", 'Seleccione un cliente.');
    if (!newEvent.items?.length) return uiService.alert("Vacio", 'Agregue mobiliario.');
    setIsSaving(true);
    try {
        const orderNumberRes = editingId ? (newEvent.orderNumber || 0) : await storageService.generateEventNumber(false);
        const orderData = { ...newEvent as EventOrder, orderNumber: orderNumberRes, id: editingId || '', status: EventStatus.RESERVED };
        await storageService.saveEvent(orderData);
        storageService.removeDraft(DRAFT_KEYS.EVENT);
        uiService.alert("Guardado", `Pedido ORD-${orderNumberRes} registrado.`);
        setViewMode('list');
    } catch (e: any) { uiService.alert("Error", e.message); } finally { setIsSaving(false); }
  };

  const filteredEvents = events.filter(e => (e.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || String(e.orderNumber).includes(searchQuery)) && (!dateFilter || e.executionDates?.includes(dateFilter) || e.executionDate === dateFilter));

  return (
    <div className="space-y-6 animate-fade-in h-full">
        {viewMode === 'list' && (
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-4">
                <div className="flex-1 w-full space-y-2">
                    <h2 className="text-lg font-black text-brand-900 uppercase tracking-tight">Pedidos por Despachar</h2>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1 relative">
                            <input type="text" placeholder="Buscar..." className="w-full h-10 bg-white border border-zinc-100 rounded-xl px-10 text-[10px] font-bold shadow-soft outline-none focus:border-brand-200" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 grayscale opacity-30 text-sm">🔍</span>
                        </div>
                        <input type="date" className="h-10 bg-white border border-zinc-100 rounded-xl px-3 text-[10px] font-bold shadow-soft" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
                    </div>
                </div>
                <button onClick={() => { setEditingId(null); setNewEvent(defaultEventState); setViewMode('create'); }} className="h-10 px-6 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] shadow-premium">+ Nuevo Pedido</button>
            </div>
        )}

        {viewMode === 'list' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                {filteredEvents.map(event => {
                    const statusInfo = getStatusDisplay(event.status);
                    return (
                        <div key={event.id} className="bg-rose-50/60 rounded-[1.5rem] shadow-soft p-4 border border-rose-100/50 flex flex-col hover:shadow-premium transition-all group">
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-[8px] font-black text-brand-800/40 bg-white px-2 py-0.5 rounded-lg border border-rose-100 shadow-sm uppercase">ORD-{String(event.orderNumber).padStart(4, '0')}</span>
                                <span className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase border shadow-sm ${statusInfo.color}`}>{statusInfo.label}</span>
                            </div>
                            <h3 className="text-xs font-black text-zinc-800 uppercase truncate mb-1">{event.clientName}</h3>
                            <div className="flex justify-between items-center bg-white/80 p-3 rounded-xl mt-auto border border-white">
                                <span className="text-xs font-black text-brand-900 tracking-tight">$ {event.total.toFixed(2)}</span>
                                <button onClick={() => { setEditingId(event.id); setNewEvent(event); setClientSearch(event.clientName); setViewMode('create'); }} className="py-1 px-3 bg-zinc-50 text-zinc-500 rounded-lg text-[8px] font-black uppercase">EDIT</button>
                            </div>
                        </div>
                    );
                })}
                {filteredEvents.length === 0 && (
                    <div className="col-span-full py-20 text-center opacity-20 uppercase font-black tracking-[0.5em] text-xs">Sin pedidos pendientes</div>
                )}
            </div>
        ) : (
             <div className="bg-white/70 rounded-[2rem] p-10 h-full flex flex-col items-center justify-center animate-fade-in text-center">
                <div className="text-4xl mb-4">📝</div>
                <h3 className="text-xl font-black text-zinc-900 mb-2 uppercase">Gestión de Pedido</h3>
                <p className="text-zinc-400 text-xs mb-6 max-w-xs uppercase font-bold tracking-widest">Utilice el asistente para registrar mobiliario y fechas de ejecución.</p>
                <button onClick={() => setViewMode('list')} className="px-10 py-3 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] tracking-[0.3em] shadow-premium">Cerrar Asistente</button>
             </div>
        )}
    </div>
  );
};

export default EventsView;