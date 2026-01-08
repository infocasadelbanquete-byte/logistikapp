
import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, Client, InventoryItem, PaymentStatus, CompanySettings, UserRole } from '../../types';
import { storageService, DRAFT_KEYS } from '../../services/storageService';
import { uiService } from '../../services/uiService'; 
import { COMPANY_LOGO, COMPANY_NAME } from '../../constants';

const SERVICE_CONDITIONS = `
<div style="margin-top:20px; font-size:8px; line-height:1.2; text-align:justify; border-top:1px solid #eee; padding-top:10px;">
  <strong>CONDICIONES DEL SERVICIO:</strong><br/>
  a) El cliente lee y acepta los servicios tal y como se detallan en la presente cotización, al igual en la forma indicada por el personal de La Casa del Banquete.<br/>
  b) El cliente acuerda conjuntamente con La Casa del Banquete la forma y momento de entrega de los servicios contratados.<br/>
  c) En caso de que la entrega no se la realice el momento acordado, una vez estando nuestro personal en el sitio señalado para el montaje del servicio, el cliente asumirá un costo adicional por motivos de un nuevo traslado.<br/>
  d) En caso de que la entrega no se la realice en el lugar acordado, una vez estando nuestro personal en el sitio señalado para el montaje del servicio, el cliente asumirá un costo adicional por motivos de un nuevo traslado.<br/>
  e) En caso que el cliente requiera adicionar más servicios o implementos una vez estando el personal de La Casa del Banquete en el lugar del montaje, el cliente asumirá un costo adicional por traslado del o los servicios adicionales.<br/>
  f) El cliente es responsable de recibir y revisar detalladamente los artículos contratados para el servicio acordado, con el fin de verificar el estado en el que se entregan los mismos.<br/>
  g) El servicio de saloneros es de máximo 5 horas, en caso de requerir mas tiempo de servicio, se deberá cubrir un valor adicional de $8.00 por hora por salonero y un valor adicional de transporte de $5.00 de igual manera por cada salonero.<br/>
  h) Todo articulo como vajilla, cristalería, cubertería, fuentes, samovares, bandejas, y otros que ameriten, deben regresar lavados, caso contrario no se procederá la recepción de los mismos el momento de retirar los implementos solicitados para el servicio.<br/>
  i) Todo articulo o implemento que presente roturas, fisuras o pérdida al momento del retiro del servicio, será asumido por el cliente con el valor respectivo a cada implemento, al igual que la mantelería o lonas que presenten manchas que representen un daño permanente al artículo referido.<br/>
  <br/>
  <strong>FORMA DE PAGO:</strong> 50 % anticipo 50% contra entrega a excepción de empresas o instituciones (crédito directo). El pago puede ser en efectivo, cheque o transferencia bancaria.
</div>`;

const QuotesView: React.FC = () => {
  const [quotes, setQuotes] = useState<EventOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [step, setStep] = useState(1);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showQuickClientModal, setShowQuickClientModal] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState<Partial<Client>>({ name: '', documentId: '', phone: '', address: '' });
  const [clientSearch, setClientSearch] = useState('');
  const [showClientResults, setShowClientResults] = useState(false);

  const defaultQuoteState: Partial<EventOrder> = {
    items: [], status: EventStatus.QUOTE, paymentStatus: PaymentStatus.CREDIT, paidAmount: 0, 
    requiresDelivery: false, deliveryCost: '0' as any, deliveryAddress: '', hasInvoice: false, 
    rentalDays: 1, discountPercentage: 0, discountType: 'PERCENT', 
    executionDates: [new Date().toISOString().split('T')[0]],
    total: 0, executionDate: new Date().toISOString().split('T')[0], 
    title: '', notes: ''
  };

  const [newQuote, setNewQuote] = useState<Partial<EventOrder>>(defaultQuoteState);

  const parseAmount = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    const sanitized = val.toString().replace(',', '.');
    const num = parseFloat(sanitized);
    return isNaN(num) ? 0 : num;
  };

  useEffect(() => {
    const session = storageService.getCurrentSession();
    setCurrentUser(session);
    const unsubEvents = storageService.subscribeToEvents((all) => {
        setQuotes(all.filter(e => e.status === EventStatus.QUOTE));
    });
    const unsubClients = storageService.subscribeToClients(setClients);
    const unsubInventory = storageService.subscribeToInventory(setInventory);
    const unsubSettings = storageService.subscribeToSettings(setSettings);
    if (storageService.hasDraft(DRAFT_KEYS.QUOTE) && viewMode === 'list') { setShowDraftModal(true); }
    return () => { unsubEvents(); unsubClients(); unsubInventory(); unsubSettings(); }
  }, []);

  useEffect(() => {
    const hasProgress = viewMode === 'create' && !editingId && (newQuote.clientId || newQuote.items?.length || (newQuote.notes && newQuote.notes.length > 3));
    if (hasProgress) { storageService.saveDraft(DRAFT_KEYS.QUOTE, { ...newQuote, step, clientSearch }); }
  }, [newQuote, step, viewMode, editingId, clientSearch]);

  const calculateTotal = (updates: Partial<EventOrder> = {}) => {
    setNewQuote(prevState => {
        const state = { ...prevState, ...updates }; 
        const items = state.items || []; 
        const selectedDates = state.executionDates || [state.executionDate || new Date().toISOString().split('T')[0]];
        const days = Math.max(1, selectedDates.length); 
        const delivery = parseAmount(state.deliveryCost); 
        const invoice = state.hasInvoice || false; 
        const discValue = parseFloat(String(state.discountPercentage || 0).replace(',', '.')) || 0;
        const discType = state.discountType || 'PERCENT';

        let subtotal15Raw = items.reduce((acc, i) => acc + (parseAmount(i.priceAtBooking) * i.quantity * days), 0);
        
        let discountAmount = 0;
        if (discType === 'PERCENT') {
            discountAmount = subtotal15Raw * (Math.min(100, Math.max(0, discValue)) / 100);
        } else {
            discountAmount = Math.min(subtotal15Raw, Math.max(0, discValue));
        }

        const netSubtotal15 = subtotal15Raw - discountAmount;
        const tax = invoice ? netSubtotal15 * 0.15 : 0; 
        
        return { 
          ...state, 
          rentalDays: days,
          executionDate: selectedDates[0],
          total: netSubtotal15 + tax + delivery, 
          taxAmount: tax 
        };
    });
  };

  const handleResumeDraft = () => {
    const draft = storageService.getDraft(DRAFT_KEYS.QUOTE);
    if (draft) { setNewQuote(draft); setStep(draft.step || 1); setClientSearch(draft.clientSearch || ''); setViewMode('create'); }
    setShowDraftModal(false);
  };

  const addDate = (date: string) => {
    if (!date) return;
    const current = [...(newQuote.executionDates || [])];
    if (!current.includes(date)) {
        current.push(date);
        current.sort();
        calculateTotal({ executionDates: current });
    }
  };

  const removeDate = (date: string) => {
    const current = (newQuote.executionDates || []).filter(d => d !== date);
    if (current.length === 0) return;
    calculateTotal({ executionDates: current });
  };

  const handleQuickClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickClientForm.name?.trim() || !quickClientForm.address?.trim() || !quickClientForm.phone?.trim()) {
        uiService.alert("Campos Obligatorios", "Nombre, Dirección y Teléfono son requeridos.");
        return;
    }
    try {
        const id = await storageService.saveClient(quickClientForm as Client);
        setNewQuote(p => ({...p, clientId: id, clientName: quickClientForm.name}));
        setClientSearch(quickClientForm.name || '');
        setShowQuickClientModal(false);
        setQuickClientForm({ name: '', documentId: '', phone: '', address: '' });
    } catch (err) { uiService.alert("Error", "No se pudo registrar el cliente."); }
  };

  const addItemToOrder = (item: InventoryItem) => {
    const current = [...(newQuote.items || [])]; 
    const idx = current.findIndex(i => i.itemId === item.id); 
    if (idx >= 0) current[idx].quantity += 1; 
    else current.push({ itemId: item.id, quantity: 1, priceAtBooking: item.price as any });
    calculateTotal({ items: current });
  };

  const handleSave = async () => {
    if (!newQuote.clientId) return uiService.alert("Faltan datos", 'Seleccione un cliente.');
    if(!newQuote.items?.length) return uiService.alert("Carrito Vacío", 'Agregue mobiliario.');
    setIsSaving(true);
    try {
        const orderNumberResult = editingId ? (newQuote.orderNumber || 0) : await storageService.generateEventNumber(true);
        const q: EventOrder = { 
            ...newQuote as EventOrder, id: editingId || '', orderNumber: orderNumberResult, status: EventStatus.QUOTE,
            deliveryCost: parseAmount(newQuote.deliveryCost),
            items: (newQuote.items || []).map(i => ({...i, priceAtBooking: parseAmount(i.priceAtBooking)}))
        };
        await storageService.saveEvent(q);
        storageService.removeDraft(DRAFT_KEYS.QUOTE);
        await uiService.alert("Guardado", `Proforma PRO-${orderNumberResult} generada.`);
        setViewMode('list'); setEditingId(null);
    } catch (e: any) { uiService.alert("Error", e.message); } finally { setIsSaving(false); }
  };

  const handleConfirmQuote = async (quote: EventOrder) => {
    if (await uiService.confirm("Confirmar Pedido", `¿Convertir PRO-${quote.orderNumber} en Pedido? Se descontará stock de inventario.`)) {
        try { 
            await storageService.saveEvent({ ...quote, status: EventStatus.RESERVED, orderNumber: 0 }); 
            uiService.alert("Éxito", "Proforma convertida en Pedido exitosamente."); 
        } catch (e) { 
            uiService.alert("Error", "No se pudo procesar la conversión."); 
        }
    }
  };

  const filteredQuotes = quotes.filter(q => (q.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || String(q.orderNumber).includes(searchQuery)) && (!dateFilter || q.executionDates?.includes(dateFilter) || q.executionDate === dateFilter));
  const canDelete = currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.ADMIN;

  return (
    <div className="space-y-6 animate-fade-in h-full">
        {viewMode === 'list' && (
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-4">
                <div className="flex-1 w-full space-y-2">
                    <h2 className="text-lg font-black text-brand-900 uppercase tracking-tight">Presupuestos Emitidos</h2>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1 relative">
                            <input type="text" placeholder="Buscar..." className="w-full h-10 bg-white border border-zinc-100 rounded-xl px-10 text-[10px] font-bold shadow-soft outline-none focus:border-brand-200" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 grayscale opacity-30 text-sm">🔍</span>
                        </div>
                        <input type="date" className="h-10 bg-white border border-zinc-100 rounded-xl px-3 text-[10px] font-bold shadow-soft" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
                    </div>
                </div>
                <button onClick={() => { setEditingId(null); setNewQuote(defaultQuoteState); setClientSearch(''); setStep(1); setViewMode('create'); }} className="h-10 px-6 bg-zinc-950 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-premium">+ Nueva Proforma</button>
            </div>
        )}
      
        {viewMode === 'list' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                {filteredQuotes.map(q => (
                    <div key={q.id} className="bg-sky-50/60 rounded-[1.5rem] shadow-soft p-4 border border-sky-100/50 flex flex-col hover:shadow-premium transition-all group">
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-[8px] font-black text-blue-800/40 bg-white px-2 py-0.5 rounded-lg border border-sky-100 shadow-sm uppercase">PRO-{String(q.orderNumber).padStart(4, '0')}</span>
                            <span className="text-xs font-black text-blue-950 tracking-tight">$ {Number(q.total).toFixed(2)}</span>
                        </div>
                        <div className="text-zinc-800 font-black text-[10px] mb-1 truncate uppercase">{q.clientName}</div>
                        <div className="mt-auto pt-4 border-t border-sky-100/50 flex items-center justify-between">
                            <div className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">📅 {q.executionDates?.length || 1} días</div>
                            <div className="flex gap-1.5">
                                <button onClick={() => handleConfirmQuote(q)} className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase shadow-md active:scale-90">Confirmar</button>
                                <button onClick={() => { setEditingId(q.id); setNewQuote(q); setClientSearch(q.clientName); setStep(1); setViewMode('create'); }} className="w-8 h-8 bg-white text-zinc-400 border border-sky-100 rounded-lg flex items-center justify-center">✏️</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
             <div className="bg-white/70 rounded-[2rem] md:rounded-[2.5rem] shadow-premium border border-zinc-100 animate-fade-in relative flex flex-col h-[calc(100vh-140px)] min-h-[500px]">
                <div className="p-4 md:p-6 border-b border-zinc-100 flex justify-between items-center bg-white/50 backdrop-blur-sm rounded-t-[2.5rem]">
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-brand-900 uppercase tracking-tighter">{editingId ? 'Editando Proforma' : 'Nueva Cotización'}</h2>
                        <p className="text-zinc-400 text-[8px] md:text-[9px] font-bold uppercase tracking-[0.3em] mt-0.5">Paso {step} de 3</p>
                    </div>
                    <button onClick={async () => { if (await uiService.confirm("Salir", "¿Deseas salir? Se guardará un borrador.")) setViewMode('list'); }} className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-full shadow-soft flex items-center justify-center text-zinc-400 hover:text-zinc-950 border transition-all text-sm md:text-lg">✕</button>
                </div>
                <div className="flex-1 overflow-hidden relative">
                    {step === 1 && (
                        <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 p-6 md:p-10 h-full overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-2">Cliente *</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input type="text" className="w-full h-12 bg-white border border-zinc-100 rounded-xl px-5 text-xs font-bold shadow-soft outline-none focus:ring-4 focus:ring-brand-50" placeholder="Buscar..." value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setShowClientResults(true); }} onFocus={() => setShowClientResults(true)} />
                                            {showClientResults && (
                                                <div className="absolute top-full left-0 w-full bg-white border shadow-premium rounded-xl mt-1 z-50 max-h-48 overflow-y-auto">
                                                    {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                                                        <button key={c.id} onClick={() => { setNewQuote(p => ({...p, clientId: c.id, clientName: c.name})); setClientSearch(c.name); setShowClientResults(false); }} className="w-full text-left p-3 hover:bg-sky-50 text-[10px] font-black uppercase border-b border-zinc-50 last:border-0">{c.name}</button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => { setQuickClientForm({ name: clientSearch, address: '', phone: '', documentId: '' }); setShowQuickClientModal(true); }} className="h-12 w-12 bg-brand-900 text-white rounded-xl text-xl font-black shadow-premium flex-shrink-0">+</button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-2">Fecha(s) del Evento ({newQuote.rentalDays} día(s))</label>
                                    <div className="flex flex-col gap-3">
                                        <input type="date" className="h-12 bg-white border border-zinc-100 rounded-xl px-4 text-[10px] font-bold outline-none" onChange={e => addDate(e.target.value)} />
                                        <div className="flex flex-wrap gap-2 min-h-10 p-2 bg-zinc-50/50 rounded-xl border border-zinc-100">
                                            {newQuote.executionDates?.map(d => (
                                                <span key={d} className="bg-white px-3 py-1 rounded-lg border border-zinc-200 text-[9px] font-black text-brand-900 flex items-center gap-2 shadow-sm uppercase">
                                                    {d} <button type="button" onClick={() => removeDate(d)} className="text-rose-400 hover:text-rose-600">✕</button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between pt-6 border-t border-zinc-100 mt-auto">
                                <button onClick={async () => { if (await uiService.confirm("Abandonar", "¿Deseas salir?")) setViewMode('list'); }} className="px-2 md:px-4 text-zinc-400 font-black uppercase text-[8px] md:text-[9px] tracking-widest hover:text-zinc-600">Regresar</button>
                                <button onClick={() => setStep(2)} className="h-12 px-6 md:px-10 bg-zinc-950 text-white rounded-xl font-black uppercase text-[9px] md:text-[10px] tracking-widest shadow-premium active:scale-95 transition-all">Siguiente ❯</button>
                            </div>
                        </div>
                    )}
                    {step === 2 && (
                        <div className="flex flex-col lg:flex-row h-full animate-fade-in overflow-hidden">
                            <div className="lg:flex-1 bg-zinc-50/50 flex flex-col border-r border-zinc-100 overflow-hidden">
                                <div className="p-4 bg-white border-b sticky top-0 z-10">
                                    <div className="relative">
                                        <input className="w-full h-12 bg-zinc-50 rounded-xl px-10 text-[10px] font-bold outline-none border-none focus:ring-4 focus:ring-brand-50 shadow-inner" placeholder="Filtrar catálogo..." value={itemSearchQuery} onChange={e => setItemSearchQuery(e.target.value)} />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 text-xs">🔍</span>
                                    </div>
                                </div>
                                <div className="overflow-y-auto flex-1 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 scrollbar-hide">
                                    {inventory.filter(i => i.name.toLowerCase().includes(itemSearchQuery.toLowerCase())).map(item => (
                                        <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-zinc-100 shadow-sm group">
                                            <div className="min-w-0 pr-2">
                                                <div className="text-left font-black text-[10px] text-zinc-900 uppercase truncate mb-0.5">{item.name}</div>
                                                <div className="text-[8px] font-bold text-brand-700 opacity-60 uppercase tracking-widest">$ {item.price.toFixed(2)}</div>
                                            </div>
                                            <button onClick={() => addItemToOrder(item)} className="w-9 h-9 bg-zinc-950 text-white rounded-xl shadow-lg font-black">+</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="lg:w-[450px] bg-white flex flex-col shadow-2xl relative z-20 overflow-hidden">
                                <div className="p-5 bg-zinc-900 text-white flex justify-between items-center">
                                    <div><h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-0.5">Carrito Proforma</h3><p className="text-xs font-black tracking-tight">{newQuote.items?.length || 0} artículos</p></div>
                                    <div className="text-right"><span className="text-[8px] font-bold text-zinc-400 uppercase block">Total</span><span className="text-lg font-black tracking-tighter text-white">$ {Number(newQuote.total).toFixed(2)}</span></div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide bg-zinc-50/30">
                                    {newQuote.items?.length === 0 ? (<div className="h-full flex flex-col items-center justify-center py-20 opacity-20 text-center px-10"><span className="text-5xl mb-4">📝</span><p className="font-black text-[10px] uppercase tracking-widest">Carrito vacío.</p></div>) : (
                                        newQuote.items?.map(i => {
                                            const inv = inventory.find(it => it.id === i.itemId);
                                            return (
                                                <div key={i.itemId} className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm flex flex-col gap-3 relative">
                                                    <div className="flex justify-between items-start"><div className="min-w-0 pr-6"><span className="text-[10px] font-black uppercase text-zinc-900 leading-tight block truncate">{inv?.name}</span></div><button onClick={() => { const c = [...(newQuote.items||[])].filter(it => it.itemId !== i.itemId); calculateTotal({items:c}); }} className="absolute top-4 right-4 text-rose-300">✕</button></div>
                                                    <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-2 rounded-xl">
                                                        <div><label className="text-[7px] font-black text-zinc-400 block mb-1 uppercase text-center">Cant.</label><input type="number" className="w-full bg-white border-none rounded-lg h-10 text-center text-xs font-black shadow-soft" value={i.quantity} onChange={e => { const v = parseInt(e.target.value) || 0; const c = [...(newQuote.items||[])]; const idx = c.findIndex(it => it.itemId === i.itemId); if(idx>=0){ c[idx].quantity = v; calculateTotal({items:c}); } }} /></div>
                                                        <div className="flex flex-col justify-center text-right"><label className="text-[7px] font-black text-zinc-400 block mb-1 uppercase">Subtotal</label>
                                                        <span className="text-[11px] font-black text-brand-900">$ {(i.quantity * parseAmount(i.priceAtBooking) * (newQuote.rentalDays || 1)).toFixed(2)}</span></div>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                                <div className="p-5 border-t bg-white shadow-2xl"><div className="flex gap-3"><button onClick={() => setStep(1)} className="flex-1 py-4 text-zinc-400 font-black uppercase text-[9px] bg-zinc-50 rounded-xl">Atrás</button><button onClick={() => setStep(3)} disabled={!newQuote.items?.length} className="flex-[2] py-4 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px]">Siguiente ❯</button></div></div>
                            </div>
                        </div>
                    )}
                    {step === 3 && (
                        <div className="max-w-xl mx-auto py-8 md:py-12 p-6 md:p-10 h-full overflow-y-auto text-center animate-fade-in">
                            <div className="bg-brand-900 p-8 md:p-12 rounded-[2rem] md:rounded-[3rem] text-white shadow-premium">
                                <span className="text-brand-300 uppercase text-[8px] md:text-[9px] font-black block mb-2 tracking-[0.3em]">Monto Estimado</span>
                                <div className="text-4xl md:text-6xl font-black tracking-tighter">$ {Number(newQuote.total).toFixed(2)}</div>
                            </div>

                            <div className="mt-8 bg-white p-6 rounded-2xl shadow-soft border border-zinc-100 text-left">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2 block mb-2">Descuento Especial</label>
                                <div className="flex gap-4">
                                    <input type="number" className="flex-1 h-12 bg-zinc-50 rounded-xl px-4 font-black" value={newQuote.discountPercentage} onChange={e => calculateTotal({discountPercentage: parseFloat(e.target.value) || 0})} />
                                    <select className="bg-zinc-50 rounded-xl px-4 text-[10px] font-black uppercase outline-none" value={newQuote.discountType} onChange={e => calculateTotal({discountType: e.target.value as any})}>
                                        <option value="PERCENT">Porcentaje (%)</option>
                                        <option value="VALUE">Valor Fijo ($)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8 md:mt-10">
                                <button onClick={() => setStep(2)} className="h-12 md:h-14 px-10 text-zinc-400 font-black uppercase text-[9px] tracking-widest hover:text-zinc-900">Revisar Artículos</button>
                                <button onClick={handleSave} disabled={isSaving} className="h-12 md:h-14 px-8 md:px-16 bg-emerald-600 text-white rounded-xl font-black uppercase text-[9px] shadow-premium">{isSaving ? 'Guardando...' : '💾 Generar Proforma'}</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
        {showDraftModal && (
            <div className="fixed inset-0 bg-zinc-950/40 flex items-center justify-center z-[200] backdrop-blur-md p-4 animate-fade-in">
                <div className="bg-white p-8 rounded-[2rem] shadow-premium max-w-sm w-full text-center">
                    <div className="w-16 h-16 bg-brand-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 text-3xl">📝</div>
                    <h3 className="font-black text-brand-900 text-lg uppercase mb-1">Borrador Detectado</h3>
                    <p className="text-zinc-400 text-xs mb-6 font-medium">¿Deseas recuperar los datos de la última proforma?</p>
                    <div className="flex flex-col gap-2">
                        <button onClick={handleResumeDraft} className="w-full py-3.5 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-premium">Recuperar Trabajo</button>
                        <button onClick={() => { storageService.removeDraft(DRAFT_KEYS.QUOTE); setShowDraftModal(false); }} className="w-full py-2.5 text-zinc-300 font-bold uppercase text-[8px]">Empezar de Cero</button>
                    </div>
                </div>
            </div>
        )}
        {showQuickClientModal && (
            <div className="fixed inset-0 bg-zinc-950/40 flex items-center justify-center z-[200] backdrop-blur-md p-4 animate-fade-in">
                <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-premium max-sm w-full animate-slide-up overflow-y-auto max-h-[90vh]">
                    <h3 className="font-black text-brand-900 text-xl uppercase tracking-tighter mb-6">Registro Express</h3>
                    <form onSubmit={handleQuickClientSubmit} className="space-y-4">
                        <div><label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 block px-2">Nombre *</label><input required className="w-full h-12 border-2 border-zinc-50 bg-zinc-50/50 rounded-xl px-4 text-xs font-bold focus:border-brand-500 outline-none shadow-inner" value={quickClientForm.name} onChange={e => setQuickClientForm({...quickClientForm, name: e.target.value})} /></div>
                        <div><label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 block px-2">Celular *</label><input required className="w-full h-12 border-2 border-zinc-50 bg-zinc-50/50 rounded-xl px-4 text-xs font-bold focus:border-brand-500 outline-none shadow-inner" value={quickClientForm.phone} onChange={e => setQuickClientForm({...quickClientForm, phone: e.target.value})} /></div>
                        <div className="flex flex-col sm:flex-row gap-3 pt-4"><button type="button" onClick={() => setShowQuickClientModal(false)} className="py-2 font-black uppercase text-[9px] text-zinc-400">Volver</button><button type="submit" className="py-4 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] shadow-premium flex-1">Guardar y Seleccionar</button></div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default QuotesView;
