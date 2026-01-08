import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, Client, InventoryItem, PaymentStatus, UserRole } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService'; 

const QUOTE_DRAFT_KEY = 'logistik_quote_draft';

const QuotesView: React.FC = () => {
  const [quotes, setQuotes] = useState<EventOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [catalogQuantities, setCatalogQuantities] = useState<{ [key: string]: number }>({});
  const [userRole, setUserRole] = useState<UserRole>(UserRole.STAFF);

  const [quoteData, setQuoteData] = useState<any>({
    clientId: '',
    executionDate: new Date().toISOString().split('T')[0],
    rentalDays: 1,
    hasInvoice: false,
    deliveryCost: 0,
    deliveryAddress: '',
    discountValue: 0,
    discountType: 'VALUE'
  });

  useEffect(() => {
    const unsub = storageService.subscribeToEvents((all) => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        all.forEach(q => {
          if (q.status === EventStatus.QUOTE && q.executionDate) {
            const execDate = new Date(q.executionDate + 'T00:00:00');
            const expiryDate = new Date(execDate);
            expiryDate.setDate(expiryDate.getDate() + 3);
            if (now > expiryDate) storageService.deleteEvent(q.id);
          }
        });

        setQuotes(all.filter(e => e.status === EventStatus.QUOTE));
    });
    storageService.subscribeToInventory(setInventory);
    storageService.subscribeToClients(setClients);
    const session = storageService.getCurrentSession();
    if (session) setUserRole(session.role);

    const savedDraft = localStorage.getItem(QUOTE_DRAFT_KEY);
    if (savedDraft) {
      const { data, items } = JSON.parse(savedDraft);
      setQuoteData(data);
      setSelectedItems(items);
      setViewMode('create');
    }

    return () => unsub();
  }, []);

  useEffect(() => {
    if (viewMode === 'create' && !editingId && (quoteData.clientId || selectedItems.length > 0)) {
      localStorage.setItem(QUOTE_DRAFT_KEY, JSON.stringify({ data: quoteData, items: selectedItems }));
    }
  }, [quoteData, selectedItems, viewMode, editingId]);

  const handleDecimalInput = (val: string, field: string) => {
    const sanitized = val.replace(',', '.');
    if (sanitized === '' || /^\d*\.?\d*$/.test(sanitized)) {
      setQuoteData({ ...quoteData, [field]: sanitized });
    }
  };

  const calculateSubtotalItems = () => {
    return selectedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) * (quoteData.rentalDays || 1);
  };

  const calculateDiscountableBase = () => {
    return selectedItems
      .filter(i => !i.name.toLowerCase().includes('salonero'))
      .reduce((acc, i) => acc + (i.price * i.quantity), 0) * (quoteData.rentalDays || 1);
  };

  const calculateDiscountValue = () => {
    const base = calculateDiscountableBase();
    const dVal = parseFloat(String(quoteData.discountValue)) || 0;
    if (quoteData.discountType === 'PERCENT') return base * (dVal / 100);
    return dVal;
  };

  const calculateTotal = () => {
    const itemsSubtotal = calculateSubtotalItems();
    const discount = calculateDiscountValue();
    const subtotalAfterDiscount = itemsSubtotal - discount;
    const iva = quoteData.hasInvoice ? (subtotalAfterDiscount * 0.15) : 0;
    const delivery = parseFloat(String(quoteData.deliveryCost)) || 0;
    return subtotalAfterDiscount + iva + delivery;
  };

  const handleConfirmOrder = async (q: EventOrder) => {
      if (await uiService.confirm("Confirmar", `¿Convertir PRO-${q.orderNumber} en Pedido?`)) {
          const ebNumStr = await uiService.prompt("Egreso de Bodega", "Ingrese el número de Egreso de Bodega (EB N°):", String(q.warehouseExitNumber || ''));
          const ebNum = parseInt(ebNumStr || '');
          
          await storageService.saveEvent({ 
            ...q, 
            status: EventStatus.CONFIRMED,
            warehouseExitNumber: isNaN(ebNum) ? q.warehouseExitNumber : ebNum
          });
          uiService.alert("Listo", "Proforma confirmada y convertida en pedido.");
      }
  };

  const handleSave = async () => {
      if (!quoteData.clientId || selectedItems.length === 0) return uiService.alert("Error", "Faltan datos");
      if (quoteData.deliveryCost > 0 && !quoteData.deliveryAddress) return uiService.alert("Falta Dirección", "Debe indicar dónde se entregará el mobiliario.");
      
      if (userRole === UserRole.STAFF) {
        const base = calculateDiscountableBase();
        const dVal = parseFloat(String(quoteData.discountValue)) || 0;
        if (quoteData.discountType === 'PERCENT' && dVal > 10) return uiService.alert("Acceso Restringido", "Como STAFF, el descuento máximo permitido es 10%.");
        if (quoteData.discountType === 'VALUE' && dVal > (base * 0.10)) return uiService.alert("Acceso Restringido", `Descuento excesivo para su rol.`);
      }

      setLoading(true);
      const orderNumber = editingId ? quotes.find(q => q.id === editingId)?.orderNumber || 0 : await storageService.generateOrderNumber();
      const total = calculateTotal();
      
      const quote: EventOrder = {
          id: editingId || '',
          orderNumber,
          clientId: quoteData.clientId,
          clientName: clients.find(c => c.id === quoteData.clientId)?.name || 'Cliente',
          orderDate: new Date().toISOString(),
          executionDate: quoteData.executionDate,
          rentalDays: quoteData.rentalDays,
          status: EventStatus.QUOTE,
          paymentStatus: PaymentStatus.CREDIT,
          paidAmount: 0,
          total,
          items: selectedItems.map(i => ({ itemId: i.id, quantity: i.quantity, priceAtBooking: i.price })),
          hasInvoice: quoteData.hasInvoice,
          discountValue: parseFloat(String(quoteData.discountValue)) || 0,
          discountType: quoteData.discountType,
          deliveryCost: parseFloat(String(quoteData.deliveryCost)) || 0,
          deliveryAddress: quoteData.deliveryAddress
      };

      await storageService.saveEvent(quote);
      localStorage.removeItem(QUOTE_DRAFT_KEY);
      setLoading(false);
      uiService.alert("Éxito", "Proforma guardada.");
      resetForm();
  };

  const resetForm = () => {
      setViewMode('list');
      setEditingId(null);
      setSelectedItems([]);
      setCatalogQuantities({});
      localStorage.removeItem(QUOTE_DRAFT_KEY);
      setQuoteData({
        clientId: '',
        executionDate: new Date().toISOString().split('T')[0],
        rentalDays: 1,
        hasInvoice: false,
        deliveryCost: 0,
        deliveryAddress: '',
        discountValue: 0,
        discountType: 'VALUE'
      });
  };

  const handleEdit = (q: EventOrder) => {
    localStorage.removeItem(QUOTE_DRAFT_KEY);
    setEditingId(q.id);
    const itemsWithData = q.items.map(oi => {
        const inv = inventory.find(i => i.id === oi.itemId);
        return { ...inv, quantity: oi.quantity, price: oi.priceAtBooking };
    });
    setSelectedItems(itemsWithData);
    setQuoteData({ ...q });
    setViewMode('create');
  };

  const filteredQuotes = quotes.filter(q => {
    const matchesSearch = q.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || String(q.orderNumber).includes(searchQuery);
    const orderDate = new Date(q.executionDate);
    const now = new Date();
    const isCurrentMonth = orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
    
    if (showArchive) return matchesSearch;
    return matchesSearch && isCurrentMonth;
  });

  const handleUpdateItemQuantity = (itemId: string, qty: string) => {
    const val = parseInt(qty) || 1;
    setCatalogQuantities(prev => ({ ...prev, [itemId]: val }));
  };

  const addItemToQuote = (item: InventoryItem) => {
    const qtyToAdd = catalogQuantities[item.id] || 1;
    const existing = selectedItems.find(i => i.id === item.id);
    if (existing) {
      setSelectedItems(selectedItems.map(i => i.id === item.id ? { ...i, quantity: i.quantity + qtyToAdd } : i));
    } else {
      setSelectedItems([...selectedItems, { ...item, quantity: qtyToAdd }]);
    }
    setCatalogQuantities(prev => ({ ...prev, [item.id]: 1 }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              {viewMode === 'create' && (
                <button onClick={resetForm} className="w-10 h-10 bg-white shadow-soft rounded-full flex items-center justify-center text-zinc-400 hover:text-brand-900 transition-all">←</button>
              )}
              <h2 className="text-2xl font-black text-brand-900 uppercase">Proformas</h2>
            </div>
            <button onClick={() => setViewMode('create')} className="px-6 py-2 bg-zinc-950 text-white rounded-xl text-[9px] font-black uppercase tracking-widest">+ Nueva Proforma</button>
        </div>

        {viewMode === 'list' ? (
          <>
            <div className="flex flex-col md:flex-row gap-4 mb-3">
              <div className="flex-1 relative">
                  <input className="w-full bg-white border border-zinc-100 p-2.5 pl-12 rounded-xl text-xs font-bold outline-none shadow-soft" placeholder="Buscar cotización..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 grayscale opacity-30">🔍</span>
              </div>
              <button 
                onClick={() => setShowArchive(!showArchive)}
                className={`px-6 rounded-xl font-black text-[9px] uppercase border transition-all ${showArchive ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-400'}`}
              >
                {showArchive ? '📁 Ver Mes Actual' : '📂 Ver Histórico'}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pb-20">
                {filteredQuotes.map(q => (
                    <div key={q.id} className="bg-white p-3 rounded-xl shadow-soft border border-zinc-100 flex flex-col h-full group hover:border-brand-200 transition-all">
                        <div className="flex justify-between mb-1">
                            <span className="text-[7px] font-black text-zinc-300">PRO-{q.orderNumber}</span>
                            <span className="text-[9px] font-black text-brand-900">$ {q.total.toFixed(2)}</span>
                        </div>
                        <h3 className="text-[10px] font-black text-zinc-800 uppercase truncate mb-1">{q.clientName}</h3>
                        <div className="mt-auto space-y-1 pt-2">
                            <button onClick={() => handleConfirmOrder(q)} className="w-full py-1 bg-emerald-600 text-white rounded text-[8px] font-black uppercase">Confirmar</button>
                            <div className="flex gap-1">
                                <button onClick={() => handleEdit(q)} className="flex-1 py-1 bg-zinc-50 text-blue-500 rounded text-[8px] font-black uppercase">Edit</button>
                                <button onClick={() => storageService.deleteEvent(q.id)} className="w-8 h-8 bg-zinc-50 text-rose-300 rounded flex items-center justify-center hover:text-rose-600">✕</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
          </>
        ) : (
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-premium border border-zinc-100 animate-slide-up">
                 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-4 space-y-4">
                        <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-3">
                            <h3 className="text-[10px] font-black text-brand-900 uppercase tracking-widest">Configuración</h3>
                            <select className="w-full h-10 bg-white rounded-xl px-4 text-[10px] font-black outline-none border border-zinc-200" value={quoteData.clientId} onChange={e => setQuoteData({...quoteData, clientId: e.target.value})}>
                                <option value="">Cliente...</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
                            </select>
                            <div className="grid grid-cols-2 gap-2">
                               <div className="space-y-1">
                                   <label className="text-[7px] font-black text-zinc-400 px-2 uppercase">Fecha Evento</label>
                                   <input type="date" className="w-full h-10 bg-white rounded-xl px-3 text-[10px] font-black border border-zinc-200" value={quoteData.executionDate} onChange={e => setQuoteData({...quoteData, executionDate: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                   <label className="text-[7px] font-black text-zinc-400 px-2 uppercase">Días Renta</label>
                                   <input type="number" min="1" className="w-full h-10 bg-white rounded-xl px-3 text-[10px] font-black border border-zinc-200" value={quoteData.rentalDays} onChange={e => setQuoteData({...quoteData, rentalDays: parseInt(e.target.value) || 1})} placeholder="Días" />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={quoteData.deliveryCost > 0} onChange={e => setQuoteData({...quoteData, deliveryCost: e.target.checked ? 10 : 0})} />
                                <span className="text-[8px] font-black uppercase">¿Añadir Transporte?</span>
                            </div>
                            {quoteData.deliveryCost > 0 && (
                              <div className="space-y-2 animate-fade-in">
                                <input type="text" inputMode="decimal" className="w-full h-10 bg-white rounded-xl px-4 text-[10px] font-black border border-zinc-200" value={quoteData.deliveryCost} onChange={e => handleDecimalInput(e.target.value, 'deliveryCost')} placeholder="Costo $" />
                                <input type="text" className="w-full h-10 bg-white rounded-xl px-4 text-[10px] font-black border border-zinc-200" value={quoteData.deliveryAddress || ''} onChange={e => setQuoteData({...quoteData, deliveryAddress: e.target.value})} placeholder="Dirección de Entrega *" />
                              </div>
                            )}
                        </div>

                        <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-2">
                            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Catálogo</h3>
                            <div className="max-h-[300px] overflow-y-auto space-y-1.5 scrollbar-hide">
                                {inventory.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-2 bg-white rounded-lg border border-zinc-100">
                                        <div className="flex-1 truncate mr-2">
                                            <p className="text-[9px] font-black text-zinc-800 uppercase truncate">{item.name}</p>
                                            <p className="text-[7px] text-zinc-400 font-bold">$ {item.price.toFixed(2)}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <input 
                                            type="number" 
                                            min="1" 
                                            className="w-10 h-8 bg-zinc-50 border border-zinc-200 rounded text-center text-[10px] font-black"
                                            value={catalogQuantities[item.id] || 1}
                                            onChange={(e) => handleUpdateItemQuantity(item.id, e.target.value)}
                                          />
                                          <button onClick={() => addItemToQuote(item)} className="w-8 h-8 bg-zinc-100 text-brand-900 rounded-lg font-black hover:bg-brand-900 hover:text-white transition-all">+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-8 flex flex-col space-y-4">
                        <div className="flex-1 bg-white border border-zinc-100 rounded-2xl p-6 shadow-inner overflow-y-auto max-h-[350px]">
                            <h3 className="text-[11px] font-black text-zinc-900 uppercase border-b pb-2 mb-2">Cesta de Proforma</h3>
                            {selectedItems.map(i => (
                                <div key={i.id} className="flex justify-between items-center py-1.5 border-b border-zinc-50 group">
                                    <span className="text-[10px] font-bold text-zinc-600 uppercase"><span className="text-zinc-950 font-black">{i.quantity}x</span> {i.name}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] font-black">$ {(i.price * i.quantity * (quoteData.rentalDays || 1)).toFixed(2)}</span>
                                        <button onClick={() => setSelectedItems(selectedItems.filter(si => si.id !== i.id))} className="text-rose-300 opacity-0 group-hover:opacity-100">✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={quoteData.hasInvoice} onChange={e => setQuoteData({...quoteData, hasInvoice: e.target.checked})} />
                                    <span className="text-[9px] font-black uppercase text-zinc-500">¿Aplica IVA?</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[7px] font-black text-zinc-400 uppercase">Descuento</label>
                                        <input type="text" inputMode="decimal" className="w-full h-8 bg-white rounded px-2 text-[10px] font-black border border-zinc-200" value={quoteData.discountValue} onChange={e => handleDecimalInput(e.target.value, 'discountValue')} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[7px] font-black text-zinc-400 uppercase">Tipo</label>
                                        <select className="w-full h-8 bg-white rounded px-1 text-[9px] font-black border border-zinc-200" value={quoteData.discountType} onChange={e => setQuoteData({...quoteData, discountType: e.target.value})}>
                                            <option value="VALUE">$ Valor</option>
                                            <option value="PERCENT">% Porc</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right flex flex-col justify-center">
                                <p className="text-[8px] font-black text-zinc-400 uppercase">Items ({quoteData.rentalDays}d): $ {calculateSubtotalItems().toFixed(2)}</p>
                                <p className="text-[8px] font-black text-rose-500 uppercase">Desc: - $ {calculateDiscountValue().toFixed(2)}</p>
                                <p className="text-2xl font-black text-brand-900 tracking-tighter">$ {calculateTotal().toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button onClick={resetForm} className="flex-1 py-3 text-zinc-400 font-black uppercase text-[10px]">Cerrar</button>
                            <button onClick={handleSave} disabled={loading} className="flex-[3] py-3 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">
                                {loading ? 'Guardando...' : '💾 Guardar Proforma'}
                            </button>
                        </div>
                    </div>
                 </div>
            </div>
        )}
    </div>
  );
};

export default QuotesView;