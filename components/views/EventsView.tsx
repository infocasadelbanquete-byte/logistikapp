
import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, Client, InventoryItem, PaymentStatus, UserRole, CompanySettings, PaymentMethod, PaymentTransaction } from '../../types';
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

  const parseAmount = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    const sanitized = val.toString().replace(',', '.');
    const num = parseFloat(sanitized);
    return isNaN(num) ? 0 : num;
  };

  const getCalculatedStatus = (event: EventOrder): string => {
      const todayStr = new Date().toISOString().split('T')[0];
      if (event.status === EventStatus.DELIVERED) {
          if (event.executionDates?.includes(todayStr) || event.executionDate === todayStr) return EventStatus.IN_PROGRESS;
          const lastDate = event.executionDates ? [...event.executionDates].sort().pop() : event.executionDate;
          if (lastDate && lastDate < todayStr) return EventStatus.FINISHED;
      }
      return event.status;
  };

  useEffect(() => {
    const session = storageService.getCurrentSession();
    setCurrentUser(session);
    const unsubEvents = storageService.subscribeToEvents((all) => setEvents(all.filter(e => 
        e.status !== EventStatus.QUOTE && 
        e.status !== EventStatus.RETURNED && 
        e.status !== EventStatus.CANCELLED
    )));
    const unsubClients = storageService.subscribeToClients(setClients);
    const unsubInventory = storageService.subscribeToInventory(setInventory);
    const unsubSettings = storageService.subscribeToSettings(setSettings);
    if (storageService.hasDraft(DRAFT_KEYS.EVENT) && viewMode === 'list') { setShowDraftModal(true); }
    return () => { unsubEvents(); unsubClients(); unsubInventory(); unsubSettings(); }
  }, []);

  useEffect(() => {
    const isActuallyWorking = viewMode === 'create' && !editingId && (newEvent.clientId || newEvent.items?.length || (newEvent.notes && newEvent.notes.length > 2) || newEvent.requiresDelivery);
    if (isActuallyWorking) { storageService.saveDraft(DRAFT_KEYS.EVENT, { ...newEvent, step, clientSearch }); }
  }, [newEvent, step, viewMode, editingId, clientSearch]);

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
          executionDate: selectedDates[0], // Siempre guardamos la primera como principal
          total: netSubtotal15 + tax + delivery, 
          taxAmount: tax 
        };
    });
  };

  const handleResumeDraft = () => {
    const draft = storageService.getDraft(DRAFT_KEYS.EVENT);
    if (draft) { setNewEvent(draft); setStep(draft.step || 1); setClientSearch(draft.clientSearch || ''); setViewMode('create'); }
    setShowDraftModal(false);
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setNewEvent(defaultEventState);
    setClientSearch('');
    setImmediatePayment('');
    setStep(1);
    setViewMode('create');
  };

  const addDate = (date: string) => {
    if (!date) return;
    const current = [...(newEvent.executionDates || [])];
    if (!current.includes(date)) {
        current.push(date);
        current.sort();
        calculateTotal({ executionDates: current });
    }
  };

  const removeDate = (date: string) => {
    const current = (newEvent.executionDates || []).filter(d => d !== date);
    if (current.length === 0) return; // Al menos una fecha requerida
    calculateTotal({ executionDates: current });
  };

  const handleQuickClientSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!quickClientForm.name?.trim() || !quickClientForm.address?.trim() || !quickClientForm.phone?.trim()) {
          uiService.alert("Faltan datos", "Complete Nombre, Dirección y Teléfono obligatoriamente.");
          return;
      }
      try {
          const id = await storageService.saveClient(quickClientForm as Client);
          setNewEvent(p => ({...p, clientId: id, clientName: quickClientForm.name}));
          setClientSearch(quickClientForm.name || '');
          setShowQuickClientModal(false);
          setQuickClientForm({ name: '', documentId: '', phone: '', address: '' });
          uiService.alert("Éxito", "Cliente registrado y seleccionado.");
      } catch (err) { uiService.alert("Error", "No se pudo registrar cliente."); }
  };

  const addItemToOrder = (item: InventoryItem) => {
    const current = [...(newEvent.items || [])]; 
    const idx = current.findIndex(i => i.itemId === item.id); 
    if (idx >= 0) current[idx].quantity += 1; 
    else current.push({ itemId: item.id, quantity: 1, priceAtBooking: item.price as any });
    calculateTotal({ items: current });
  };

  const saveEventAndPrint = async () => {
    if (!newEvent.clientId) return uiService.alert("Requerido", 'Seleccione un cliente.');
    if (!newEvent.items?.length) return uiService.alert("Vacio", 'Agregue mobiliario.');
    
    const paymentVal = parseAmount(immediatePayment);
    if ((paymentMethod === PaymentMethod.TRANSFER || paymentMethod === PaymentMethod.DEPOSIT) && paymentVal > 0 && !paymentBank) {
        return uiService.alert("Falta Banco", "Debe seleccionar banco para el abono inicial.");
    }

    setIsSaving(true);
    try {
        const orderNumberRes = editingId ? (newEvent.orderNumber || 0) : await storageService.generateEventNumber(false);
        
        let initialTransactions: PaymentTransaction[] = editingId ? (newEvent.transactions || []) : [];
        let finalPaidAmount = editingId ? (newEvent.paidAmount || 0) : 0;
        
        if (paymentVal > 0) {
            const receiptCode = await storageService.generateReceiptCode();
            const newTrans: PaymentTransaction = {
                id: Date.now().toString(),
                receiptCode,
                date: new Date().toISOString(),
                amount: paymentVal,
                method: paymentMethod,
                bankName: (paymentMethod === PaymentMethod.TRANSFER || paymentMethod === PaymentMethod.DEPOSIT) ? paymentBank : undefined,
                recordedBy: currentUser?.name || 'Sistema',
                orderNumber: orderNumberRes
            };
            initialTransactions = [...initialTransactions, newTrans];
            finalPaidAmount += paymentVal;
        }

        const orderTotal = newEvent.total || 0;
        let paymentStatus = PaymentStatus.CREDIT;
        if (finalPaidAmount >= orderTotal - 0.05 && orderTotal > 0) paymentStatus = PaymentStatus.PAID;
        else if (finalPaidAmount > 0) paymentStatus = PaymentStatus.PARTIAL;

        const orderData = {
            ...newEvent as EventOrder, 
            orderNumber: orderNumberRes, 
            id: editingId || '', 
            status: editingId ? (newEvent.status || EventStatus.RESERVED) : EventStatus.RESERVED,
            deliveryCost: parseAmount(newEvent.deliveryCost),
            items: (newEvent.items || []).map(i => ({...i, priceAtBooking: parseAmount(i.priceAtBooking)})),
            transactions: initialTransactions,
            paidAmount: finalPaidAmount,
            paymentStatus: paymentStatus
        };

        const result = await storageService.saveEvent(orderData);
        storageService.removeDraft(DRAFT_KEYS.EVENT);
        await uiService.alert("Guardado", `Orden ORD-${orderNumberRes} sellada exitosamente.`);
        if (await uiService.confirm("Impresión", "¿Deseas imprimir el comprobante?")) printOrder({ ...orderData, id: result.id });
        setViewMode('list');
    } catch (e: any) { uiService.alert("Error", e.message); } finally { setIsSaving(false); }
  };

  const printOrder = (order: EventOrder) => {
    const win = window.open('', '_blank');
    if (!win) return uiService.alert("Bloqueo", "Habilite los popups.");
    const logo = settings?.logoUrl || COMPANY_LOGO;
    const name = settings?.name || COMPANY_NAME;
    const client = clients.find(c => c.id === order.clientId);
    const days = order.rentalDays || 1;
    const delivCost = parseAmount(order.deliveryCost);
    const discValue = order.discountPercentage || 0;
    const discType = order.discountType || 'PERCENT';
    const taxAmt = Number(order.taxAmount) || 0;
    const totalAmt = Number(order.total) || 0;
    
    const subtotal15Raw = order.items.reduce((acc, i) => acc + (parseAmount(i.priceAtBooking) * i.quantity * days), 0);
    
    let discountAmount = 0;
    if (discType === 'PERCENT') {
        discountAmount = subtotal15Raw * (discValue / 100);
    } else {
        discountAmount = discValue;
    }
    const netSubtotal15 = subtotal15Raw - discountAmount;

    const itemsTable = order.items.map(i => {
        const inv = inventory.find(inv => inv.id === i.itemId);
        const pUnit = parseAmount(i.priceAtBooking);
        return `<tr><td style="text-align:center; border: 1px solid #000; padding: 5px;">${i.quantity}</td><td style="border: 1px solid #000; padding: 5px; text-transform: uppercase;">${inv?.name || 'MOBILIARIO'}</td><td style="text-align:right; border: 1px solid #000; padding: 5px;">$ ${pUnit.toFixed(2)}</td><td style="text-align:right; border: 1px solid #000; padding: 5px;">$ ${(pUnit * i.quantity * days).toFixed(2)}</td></tr>`;
    }).join('');

    const html = `<html><head><title>ORD-${order.orderNumber}</title><style>@page { size: A4; margin: 1cm; } body{font-family:sans-serif;font-size:11px;padding:20px; color: #000;}.header{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:8px}.totals{float:right;width:280px;margin-top:15px;border:1px solid #000;padding:10px;background:#f9f9f9}.totals div{display:flex;justify-content:space-between;margin-bottom:3px}.grand{font-weight:bold;border-top:1px solid #000;padding-top:5px;font-size:13px; color: #4c0519;}.company-footer { margin-top: 30px; border-top: 1px solid #4c0519; padding-top: 15px; font-size: 9px; color: #444; text-align: center; clear: both; }</style></head><body><div class="header"><img src="${logo}" style="height:60px" /><div><div style="font-size: 18px;font-weight:bold">${name}</div><b>ORDEN DE RESERVA # ORD-${String(order.orderNumber).padStart(4, '0')}</b></div></div><div><b>CLIENTE:</b> ${order.clientName.toUpperCase()} | <b>TELÉFONO:</b> ${client?.mobilePhone || client?.phone || 'N/A'}<br/><b>FECHAS:</b> ${order.executionDates?.join(', ') || order.executionDate} | <b>DÍAS:</b> ${days}<br/><b>LUGAR:</b> ${order.requiresDelivery ? (order.deliveryAddress || 'NO ESPECIFICADO').toUpperCase() : 'RETIRO EN BODEGA'}</div><table><thead><tr><th>CANT</th><th>DETALLE</th><th>P.U.</th><th>TOTAL</th></tr></thead><tbody>${itemsTable}${order.requiresDelivery ? `<tr><td style="text-align:center">1</td><td style="text-transform:uppercase">SERVICIO DE LOGÍSTICA (IVA 0%)</td><td style="text-align:right">$ ${delivCost.toFixed(2)}</td><td style="text-align:right">$ ${delivCost.toFixed(2)}</td></tr>` : ''}</tbody></table><div class="totals"><div><span>SUBTOTAL 15%:</span><span>$ ${subtotal15Raw.toFixed(2)}</span></div>${discountAmount > 0 ? `<div style="color:red"><span>DESC. ${discType === 'PERCENT' ? discValue + '%' : '$' + discValue}:</span><span>- $ ${discountAmount.toFixed(2)}</span></div>` : ''}<div><span>BASE 15%:</span><span>$ ${netSubtotal15.toFixed(2)}</span></div><div><span>BASE 0% (LOGÍSTICA):</span><span>$ ${delivCost.toFixed(2)}</span></div><div><span>IVA 15%:</span><span>$ ${taxAmt.toFixed(2)}</span></div><div class="grand"><span>TOTAL GENERAL:</span><span>$ ${totalAmt.toFixed(2)}</span></div></div><div style="clear:both;"></div>${SERVICE_CONDITIONS}<div class="company-footer"><span style="margin-right: 15px;"><strong>📱</strong> 0998 858 204</span><span style="margin-right: 15px;"><strong>📍</strong> Cornelio Crespo y Manuel Ignacio Ochoa</span><span><strong>✉️</strong> infocasadelbanquete@gmail.com</span></div><script>window.onload=function(){setTimeout(()=>window.print(),500)}</script></body></html>`;
    win.document.write(html); win.document.close();
  };

  const filteredEvents = events.filter(e => (e.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || String(e.orderNumber).includes(searchQuery)) && (!dateFilter || e.executionDates?.includes(dateFilter) || e.executionDate === dateFilter));
  const canDelete = currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.ADMIN;

  return (
    <div className="space-y-6 animate-fade-in h-full">
        {viewMode === 'list' && (
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-4">
                <div className="flex-1 w-full space-y-2">
                    <h2 className="text-lg font-black text-brand-900 uppercase tracking-tight">Registro de Reservas</h2>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1 relative">
                            <input type="text" placeholder="Buscar..." className="w-full h-10 bg-white border border-zinc-100 rounded-xl px-10 text-[10px] font-bold shadow-soft outline-none focus:border-brand-200" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 grayscale opacity-30 text-sm">🔍</span>
                        </div>
                        <input type="date" className="h-10 bg-white border border-zinc-100 rounded-xl px-3 text-[10px] font-bold shadow-soft" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
                    </div>
                </div>
                <button onClick={handleCreateNew} className="h-10 px-6 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] shadow-premium">+ Nuevo Registro</button>
            </div>
        )}

        {viewMode === 'list' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                {filteredEvents.map(event => (
                    <div key={event.id} className="bg-rose-50/60 rounded-[1.5rem] shadow-soft p-4 border border-rose-100/50 flex flex-col hover:shadow-premium transition-all group">
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-[8px] font-black text-brand-800/40 bg-white px-2 py-0.5 rounded-lg border border-rose-100 shadow-sm uppercase">ORD-{String(event.orderNumber).padStart(4, '0')}</span>
                            <span className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-tighter ${event.status === EventStatus.RESERVED ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{getCalculatedStatus(event)}</span>
                        </div>
                        <h3 className="text-xs font-black text-zinc-800 uppercase truncate mb-1">{event.clientName}</h3>
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-4">🗓️ {event.executionDates?.length || 1} día(s) desde {event.executionDate}</p>
                        <div className="flex justify-between items-center bg-white/80 p-3 rounded-xl mb-4 mt-auto border border-white">
                            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Total:</span>
                            <span className="text-xs font-black text-brand-900 tracking-tight">$ {event.total.toFixed(2)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                            <button onClick={() => printOrder(event)} className="py-2 bg-zinc-950 text-white rounded-lg text-[8px] font-black uppercase">📄</button>
                            <button onClick={() => { setEditingId(event.id); setNewEvent(event); setClientSearch(event.clientName); setStep(1); setViewMode('create'); }} className="py-2 bg-white text-zinc-500 border border-rose-100 rounded-lg text-[8px] font-black uppercase">EDIT</button>
                            {canDelete && <button onClick={async () => { if (await uiService.confirm("Eliminar", "¿Eliminar pedido?")) storageService.deleteEvent(event.id); }} className="py-2 bg-white text-rose-300 border border-rose-100 rounded-lg text-[8px] font-black uppercase">🗑️</button>}
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="bg-white/70 rounded-[2rem] md:rounded-[2.5rem] shadow-premium border border-zinc-100 animate-fade-in relative flex flex-col h-[calc(100vh-140px)] min-h-[500px]">
                <div className="p-4 md:p-6 border-b border-zinc-100 flex justify-between items-center bg-white/50 backdrop-blur-sm rounded-t-[2.5rem]">
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-brand-950 uppercase tracking-tighter">{editingId ? 'Editando reserva' : 'Nueva reserva'}</h2>
                        <p className="text-zinc-400 text-[8px] md:text-[9px] font-bold uppercase tracking-[0.3em] mt-0.5">Paso {step} de 3</p>
                    </div>
                    <div className="flex items-center gap-4">
                         <button onClick={async () => { if (await uiService.confirm("Salir", "¿Deseas salir? Se guardará borrador.")) setViewMode('list'); }} className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-full shadow-soft flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all text-sm md:text-lg border">✕</button>
                    </div>
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
                                                    <button key={c.id} onClick={() => { setNewEvent(p => ({...p, clientId: c.id, clientName: c.name})); setClientSearch(c.name); setShowClientResults(false); }} className="w-full text-left p-3 hover:bg-rose-50 text-[10px] font-black uppercase border-b border-zinc-50 last:border-0">{c.name}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => { setQuickClientForm({ name: clientSearch, address: '', phone: '', documentId: '' }); setShowQuickClientModal(true); }} className="h-12 w-12 bg-brand-900 text-white rounded-xl text-xl font-black shadow-premium flex-shrink-0">+</button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-2">Fecha(s) del Evento ({newEvent.rentalDays} día(s))</label>
                                <div className="flex flex-col gap-3">
                                    <div className="flex gap-2">
                                        <input type="date" className="flex-1 h-12 bg-white border border-zinc-100 rounded-xl px-4 text-[10px] font-bold shadow-soft outline-none" onChange={e => addDate(e.target.value)} />
                                        <div className="h-12 w-12 bg-zinc-100 rounded-xl flex items-center justify-center text-xl">📅</div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 min-h-10 p-2 bg-zinc-50/50 rounded-xl border border-zinc-100 shadow-inner">
                                        {newEvent.executionDates?.map(d => (
                                            <span key={d} className="bg-white px-3 py-1 rounded-lg border border-zinc-200 text-[9px] font-black text-brand-900 flex items-center gap-2 shadow-sm uppercase animate-fade-in">
                                                {d} <button type="button" onClick={() => removeDate(d)} className="text-rose-400 hover:text-rose-600">✕</button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 border-t border-zinc-100 pt-6 md:pt-8">
                            <div className={`p-4 md:p-6 rounded-[1.5rem] border-2 transition-all ${newEvent.requiresDelivery ? 'bg-white border-rose-200 shadow-soft' : 'bg-zinc-100/50 border-transparent shadow-inner'}`}>
                                <label className="flex items-center gap-3 cursor-pointer mb-4">
                                    <input type="checkbox" checked={newEvent.requiresDelivery} onChange={e => calculateTotal({ requiresDelivery: e.target.checked })} className="w-5 h-5 rounded text-brand-600" />
                                    <span className="font-black text-zinc-700 uppercase tracking-widest text-[10px]">Añadir Transporte</span>
                                </label>
                                {newEvent.requiresDelivery && (
                                    <div className="space-y-3 animate-fade-in">
                                        <input type="text" placeholder="Dirección" className="w-full h-10 bg-white border border-zinc-100 rounded-lg px-3 text-[10px] font-bold" value={newEvent.deliveryAddress || ''} onChange={e => setNewEvent({...newEvent, deliveryAddress: e.target.value})} />
                                        <input type="text" placeholder="Costo $" className="w-full h-10 bg-white border border-zinc-100 rounded-lg px-3 text-[10px] font-black" value={newEvent.deliveryCost || ''} onChange={e => {
                                            const val = e.target.value.replace(',', '.');
                                            if (val === '' || /^\d*\.?\d*$/.test(val)) calculateTotal({ deliveryCost: val as any });
                                        }} />
                                    </div>
                                )}
                            </div>
                            <div className="bg-zinc-100/50 p-4 md:p-6 rounded-[1.5rem] space-y-4 shadow-inner">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={newEvent.hasInvoice} onChange={e => calculateTotal({ hasInvoice: e.target.checked })} className="w-5 h-5 rounded text-brand-900" />
                                    <span className="font-black text-zinc-700 uppercase tracking-widest text-[10px]">Incluir IVA 15%</span>
                                </label>
                                <div className="pt-1">
                                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-2 block mb-1.5">Descuento Especial</label>
                                  <div className="flex gap-2">
                                      <input type="number" step="0.01" className="flex-1 h-10 bg-white border border-zinc-100 rounded-lg px-3 text-[10px] font-black shadow-sm" value={newEvent.discountPercentage} onChange={e => calculateTotal({discountPercentage: parseFloat(e.target.value) || 0})} />
                                      <select className="bg-white border border-zinc-100 rounded-lg px-2 text-[8px] font-black uppercase outline-none shadow-sm" value={newEvent.discountType} onChange={e => calculateTotal({discountType: e.target.value as any})}>
                                          <option value="PERCENT">Porcentaje (%)</option>
                                          <option value="VALUE">Valor Fijo ($)</option>
                                      </select>
                                  </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-2">EB N° (Egreso Bodega)</label>
                                <input type="text" className="w-full h-12 bg-white border border-zinc-100 rounded-xl px-4 text-[10px] font-bold shadow-soft outline-none" value={newEvent.warehouseExitId} onChange={e => setNewEvent({...newEvent, warehouseExitId: e.target.value})} placeholder="Ej. 00231" />
                            </div>
                        </div>

                        <div className="space-y-2 pt-2"><label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-2">✍️ Notas</label><textarea className="w-full bg-white border border-zinc-100 rounded-2xl p-4 text-xs font-bold shadow-soft outline-none focus:ring-4 focus:ring-brand-50" rows={2} placeholder="Instrucciones..." value={newEvent.notes || ''} onChange={e => setNewEvent({...newEvent, notes: e.target.value})} /></div>
                        <div className="flex justify-between pt-6 border-t border-zinc-100 mt-auto"><button onClick={async () => { if (await uiService.confirm("Abandonar", "¿Salir?")) setViewMode('list'); }} className="px-2 md:px-4 text-zinc-400 font-black uppercase text-[8px] md:text-[9px] tracking-widest hover:text-zinc-600 transition-colors">Volver al Listado</button><button onClick={() => setStep(2)} className="h-12 px-6 md:px-10 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] md:text-[10px] tracking-widest active:scale-95 transition-all">Continuar al Catálogo ❯</button></div>
                    </div>
                )}
                {step === 2 && (
                    <div className="flex flex-col lg:flex-row h-full animate-fade-in overflow-hidden">
                        <div className="lg:flex-1 bg-zinc-50/50 flex flex-col border-r border-zinc-100 overflow-hidden">
                             <div className="p-4 bg-white border-b sticky top-0 z-10">
                                <div className="relative">
                                    <input className="w-full h-12 bg-zinc-50 border-none rounded-xl pl-10 pr-4 text-[10px] font-bold outline-none focus:ring-4 focus:ring-brand-50 shadow-inner" placeholder="Filtrar catálogo por nombre..." value={itemSearchQuery} onChange={e => setItemSearchQuery(e.target.value)} />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 text-xs">🔍</span>
                                </div>
                             </div>
                             <div className="overflow-y-auto flex-1 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 scrollbar-hide">
                                {inventory.filter(i => i.name.toLowerCase().includes(itemSearchQuery.toLowerCase())).map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-zinc-100 shadow-sm hover:border-brand-200 transition-all group">
                                        <div className="min-w-0 pr-2">
                                            <div className="text-left font-black text-[10px] text-zinc-900 uppercase truncate mb-0.5">{item.name}</div>
                                            <div className="text-[8px] font-bold text-brand-700 opacity-60 uppercase tracking-widest">$ {item.price.toFixed(2)} • Disp: {item.stock}</div>
                                        </div>
                                        <button onClick={() => addItemToOrder(item)} className="w-9 h-9 bg-zinc-950 text-white rounded-xl shadow-lg active:scale-90 flex-shrink-0 flex items-center justify-center font-black group-hover:bg-brand-900 transition-colors">
                                            +
                                        </button>
                                    </div>
                                ))}
                             </div>
                        </div>
                        <div className="lg:w-[450px] bg-white flex flex-col shadow-2xl relative z-20 overflow-hidden">
                            <div className="p-5 bg-brand-950 text-white flex justify-between items-center">
                                <div><h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-0.5">Artículos en Reserva</h3><p className="text-xs font-black tracking-tight">{newEvent.items?.length || 0} productos seleccionados</p></div>
                                <div className="text-right"><span className="text-[8px] font-bold text-brand-300 uppercase block">Total Parcial</span><span className="text-lg font-black tracking-tighter text-white">$ {newEvent.total?.toFixed(2)}</span></div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide bg-zinc-50/30">
                                {newEvent.items?.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center py-20 opacity-20 text-center px-10"><span className="text-5xl mb-4">🛒</span><p className="font-black text-[10px] uppercase tracking-widest">Su lista está vacía.<br/>Seleccione artículos del catálogo.</p></div>
                                ) : (
                                    newEvent.items?.map(i => {
                                        const inv = inventory.find(it => it.id === i.itemId);
                                        const rentalDays = newEvent.rentalDays || 1;
                                        const itemSubtotal = (parseAmount(i.priceAtBooking) * i.quantity * rentalDays);
                                        return (
                                            <div key={i.itemId} className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm flex flex-col gap-3 relative group">
                                                <div className="flex justify-between items-start"><div className="min-w-0 pr-6"><span className="text-[10px] font-black uppercase text-zinc-900 leading-tight block truncate">{inv?.name}</span><span className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">Precio Unit: $ {parseAmount(i.priceAtBooking).toFixed(2)}</span></div><button onClick={() => { const c = [...(newEvent.items||[])].filter(it => it.itemId !== i.itemId); calculateTotal({items:c}); }} className="absolute top-4 right-4 w-6 h-6 flex items-center justify-center text-rose-300 hover:text-rose-600">✕</button></div>
                                                <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-2 rounded-xl border border-zinc-100">
                                                    <div><label className="text-[7px] font-black text-zinc-400 block mb-1 uppercase text-center">Cant.</label><input type="number" className="w-full bg-white border-none rounded-lg h-10 text-center text-xs font-black shadow-soft" value={i.quantity} onChange={e => { const v = parseInt(e.target.value) || 0; const c = [...(newEvent.items||[])]; const idx = c.findIndex(it => it.itemId === i.itemId); if(idx>=0){ c[idx].quantity = v; calculateTotal({items:c}); } }} /></div>
                                                    <div className="flex flex-col justify-center text-right"><label className="text-[7px] font-black text-zinc-400 block mb-1 uppercase">Subtotal</label><span className="text-[11px] font-black text-brand-900">$ {itemSubtotal.toFixed(2)}</span></div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                            <div className="p-5 border-t bg-white shadow-2xl">
                                <div className="flex gap-3">
                                    <button onClick={() => setStep(1)} className="flex-1 py-4 text-zinc-400 font-black uppercase text-[9px] tracking-widest bg-zinc-50 rounded-xl">Atrás</button>
                                    <button onClick={() => setStep(3)} disabled={!newEvent.items?.length} className="flex-[2] py-4 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-premium active:scale-95 transition-all">Sellar Pedido ❯</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {step === 3 && (
                    <div className="max-w-xl mx-auto space-y-8 p-6 md:p-10 h-full overflow-y-auto animate-fade-in text-center">
                        <div className="bg-brand-900 p-8 md:p-12 rounded-[2rem] md:rounded-[3rem] shadow-premium text-white">
                            <span className="text-[8px] font-black uppercase tracking-[0.3em] opacity-50 block mb-2">Resumen Total a Pagar</span>
                            <div className="text-4xl md:text-6xl font-black tracking-tighter">$ {newEvent.total?.toFixed(2)}</div>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-zinc-100 text-left">
                             <h4 className="text-[10px] font-black text-brand-900 uppercase tracking-[0.3em] mb-6 flex items-center gap-2"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span>Registrar Pago Inmediato</h4>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-zinc-400 uppercase ml-2">Abono ($)</label>
                                    <input type="text" inputMode="decimal" className="w-full h-14 bg-zinc-50 border-none rounded-2xl px-6 text-xl font-black text-emerald-600 outline-none shadow-inner" value={immediatePayment} onChange={e => { const val = e.target.value.replace(',', '.'); if (val === '' || /^\d*\.?\d*$/.test(val)) setImmediatePayment(val); }} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-zinc-400 uppercase ml-2">Método</label>
                                    <select className="w-full h-14 bg-zinc-50 border-none rounded-2xl px-5 text-xs font-black outline-none" value={paymentMethod} onChange={e => { setPaymentMethod(e.target.value as any); setPaymentBank(''); }}>
                                        {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                             </div>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <button onClick={() => setStep(2)} className="h-12 md:h-14 px-10 text-zinc-400 font-black uppercase text-[9px] tracking-widest hover:text-zinc-900">Revisar Artículos</button>
                            <button onClick={saveEventAndPrint} disabled={isSaving} className="h-12 md:h-14 px-8 md:px-16 bg-emerald-600 text-white rounded-xl font-black shadow-premium hover:bg-emerald-700 transition-all uppercase text-[9px] tracking-widest">{isSaving ? 'Guardando...' : '💾 Sellar y Reservar'}</button>
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
                    <p className="text-zinc-400 text-xs mb-6 font-medium">¿Deseas recuperar los datos de la última sesión?</p>
                    <div className="flex flex-col gap-2">
                        <button onClick={handleResumeDraft} className="w-full py-3.5 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] tracking-widest">Recuperar</button>
                        <button onClick={() => { storageService.removeDraft(DRAFT_KEYS.EVENT); setShowDraftModal(false); }} className="w-full py-2.5 text-zinc-300 font-bold uppercase text-[8px]">Nuevo</button>
                    </div>
                </div>
            </div>
        )}
        {showQuickClientModal && (
            <div className="fixed inset-0 bg-zinc-950/40 flex items-center justify-center z-[200] backdrop-blur-md p-4 animate-fade-in">
                <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-premium max-sm w-full animate-slide-up overflow-y-auto max-h-[90vh]">
                    <h3 className="font-black text-brand-900 text-xl uppercase tracking-tighter mb-6">Registro Express</h3>
                    <form onSubmit={handleQuickClientSubmit} className="space-y-4">
                        <div><label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 block px-2">Nombre *</label><input required className="w-full h-12 border-2 border-zinc-50 bg-zinc-50/50 rounded-xl px-4 text-xs font-bold focus:border-brand-500 outline-none transition-all shadow-inner" value={quickClientForm.name} onChange={e => setQuickClientForm({...quickClientForm, name: e.target.value})} /></div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div><label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 block px-2">Celular *</label><input required className="w-full h-12 border-2 border-zinc-50 bg-zinc-50/50 rounded-xl px-4 text-xs font-bold focus:border-brand-500 outline-none shadow-inner" value={quickClientForm.phone} onChange={e => setQuickClientForm({...quickClientForm, phone: e.target.value})} /></div>
                          <div><label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 block px-2">Cédula/RUC</label><input className="w-full h-12 border-2 border-zinc-50 bg-zinc-50/50 rounded-xl px-4 text-xs font-bold focus:border-brand-500 outline-none shadow-inner" value={quickClientForm.documentId} onChange={e => setQuickClientForm({...quickClientForm, documentId: e.target.value})} /></div>
                        </div>
                        <div><label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 block px-2">Dirección *</label><input required className="w-full h-12 border-2 border-zinc-50 bg-zinc-50/50 rounded-xl px-4 text-xs font-bold focus:border-brand-500 outline-none shadow-inner" value={quickClientForm.address} onChange={e => setQuickClientForm({...quickClientForm, address: e.target.value})} /></div>
                        <div className="flex flex-col sm:flex-row gap-3 pt-4"><button type="button" onClick={() => setShowQuickClientModal(false)} className="py-2 font-black uppercase text-[9px] text-zinc-400 order-2 sm:order-1">Volver</button><button type="submit" className="py-4 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] shadow-premium active:scale-95 transition-all flex-1 order-1 sm:order-2">Guardar y Seleccionar</button></div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default EventsView;
