import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, Client, InventoryItem, PaymentMethod, PaymentStatus, UserRole } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';
import { COMPANY_LOGO, COMPANY_NAME } from '../../constants';

const DRAFT_KEY = 'logistik_order_draft';

const EventsView: React.FC = () => {
  const [view, setView] = useState<'LIST' | 'FORM'>('LIST');
  const [showArchive, setShowArchive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [catalogQuantities, setCatalogQuantities] = useState<{ [key: string]: number }>({});
  const [userRole, setUserRole] = useState<UserRole>(UserRole.STAFF);
  
  // Form State
  const [orderData, setOrderData] = useState<any>({
    clientId: '',
    warehouseExitNumber: '',
    executionDate: new Date().toISOString().split('T')[0],
    rentalDays: 1,
    requiresDelivery: false,
    deliveryCost: 0,
    deliveryAddress: '',
    hasInvoice: false,
    discountValue: 0,
    discountType: 'VALUE',
    notes: '',
    paymentAmount: 0,
    paymentMethod: PaymentMethod.CASH,
    bankName: '',
    checkNumber: ''
  });

  const [newClient, setNewClient] = useState<Partial<Client>>({ name: '', documentId: '', phone: '', address: '' });

  useEffect(() => {
    storageService.subscribeToClients(setClients);
    storageService.subscribeToInventory(setInventory);
    storageService.subscribeToEvents(setOrders);
    const session = storageService.getCurrentSession();
    if (session) setUserRole(session.role);

    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      const { data, items } = JSON.parse(savedDraft);
      setOrderData(data);
      setSelectedItems(items);
      setView('FORM');
    }
  }, []);

  useEffect(() => {
    if (view === 'FORM' && !editingId && (orderData.clientId || selectedItems.length > 0)) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: orderData, items: selectedItems }));
    }
  }, [orderData, selectedItems, view, editingId]);

  const handleDecimalInput = (val: string, field: string) => {
    const sanitized = val.replace(',', '.');
    if (sanitized === '' || /^\d*\.?\d*$/.test(sanitized)) {
      setOrderData({ ...orderData, [field]: sanitized });
    }
  };

  const calculateSubtotalItems = () => {
    return selectedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) * (orderData.rentalDays || 1);
  };

  const calculateDiscountableBase = () => {
    return selectedItems
      .filter(i => !i.name.toLowerCase().includes('salonero'))
      .reduce((acc, i) => acc + (i.price * i.quantity), 0) * (orderData.rentalDays || 1);
  };

  const calculateDiscountValue = () => {
    const base = calculateDiscountableBase();
    const dVal = parseFloat(String(orderData.discountValue)) || 0;
    if (orderData.discountType === 'PERCENT') {
      return base * (dVal / 100);
    }
    return dVal;
  };

  const calculateTotal = () => {
    const itemsSubtotal = calculateSubtotalItems();
    const discount = calculateDiscountValue();
    const subtotalAfterDiscount = itemsSubtotal - discount;
    const iva = orderData.hasInvoice ? (subtotalAfterDiscount * 0.15) : 0;
    const delivery = parseFloat(String(orderData.deliveryCost)) || 0;
    return subtotalAfterDiscount + iva + delivery;
  };

  const handleSave = async () => {
    if (!orderData.clientId || selectedItems.length === 0) return uiService.alert("Faltan Datos", "Seleccione cliente y productos.");
    if (orderData.requiresDelivery && !orderData.deliveryAddress) return uiService.alert("Dato Requerido", "Por favor ingrese la dirección de entrega.");
    
    if (userRole === UserRole.STAFF) {
      const base = calculateDiscountableBase();
      const dVal = parseFloat(String(orderData.discountValue)) || 0;
      if (orderData.discountType === 'PERCENT' && dVal > 10) return uiService.alert("Acceso Restringido", "Como STAFF, el descuento máximo permitido es 10%.");
      if (orderData.discountType === 'VALUE' && dVal > (base * 0.10)) return uiService.alert("Acceso Restringido", `Máximo permitido: $${(base * 0.10).toFixed(2)}.`);
    }

    setLoading(true);
    const total = calculateTotal();
    const orderNumber = editingId ? orders.find(o => o.id === editingId)?.orderNumber || 0 : await storageService.generateOrderNumber();
    
    const order: EventOrder = {
      id: editingId || '',
      orderNumber,
      warehouseExitNumber: parseInt(orderData.warehouseExitNumber) || undefined,
      clientId: orderData.clientId,
      clientName: clients.find(c => c.id === orderData.clientId)?.name || 'Consumidor Final',
      orderDate: new Date().toISOString(),
      executionDate: orderData.executionDate,
      rentalDays: orderData.rentalDays,
      status: EventStatus.CONFIRMED,
      paymentStatus: orderData.paymentAmount >= total ? PaymentStatus.PAID : (orderData.paymentAmount > 0 ? PaymentStatus.PARTIAL : PaymentStatus.CREDIT),
      paidAmount: orderData.paymentAmount,
      total,
      items: selectedItems.map(i => ({ itemId: i.id, quantity: i.quantity, priceAtBooking: i.price })),
      requiresDelivery: orderData.requiresDelivery,
      deliveryCost: parseFloat(String(orderData.deliveryCost)) || 0,
      deliveryAddress: orderData.deliveryAddress,
      hasInvoice: orderData.hasInvoice,
      discountValue: parseFloat(String(orderData.discountValue)) || 0,
      discountType: orderData.discountType,
      notes: orderData.notes,
      transactions: orderData.paymentAmount > 0 ? [{
        id: Date.now().toString(),
        date: new Date().toISOString(),
        amount: orderData.paymentAmount,
        method: orderData.paymentMethod,
        bankName: orderData.bankName,
        checkNumber: orderData.checkNumber,
        recordedBy: 'Admin',
        orderNumber
      }] : []
    };

    await storageService.saveEvent(order);
    if (!editingId) {
        for (const item of selectedItems) {
          if (item.type === 'PRODUCT') await storageService.updateStock(item.id, -item.quantity);
        }
    }
    localStorage.removeItem(DRAFT_KEY);
    setLoading(false);
    uiService.alert("Éxito", `Pedido #${orderNumber} registrado.`);
    resetForm();
  };

  const resetForm = () => {
    setView('LIST');
    setEditingId(null);
    setSelectedItems([]);
    setCatalogQuantities({});
    localStorage.removeItem(DRAFT_KEY);
    setOrderData({
        clientId: '',
        warehouseExitNumber: '',
        executionDate: new Date().toISOString().split('T')[0],
        rentalDays: 1,
        requiresDelivery: false,
        deliveryCost: 0,
        deliveryAddress: '',
        hasInvoice: false,
        discountValue: 0,
        discountType: 'VALUE',
        notes: '',
        paymentAmount: 0,
        paymentMethod: PaymentMethod.CASH,
        bankName: '',
        checkNumber: ''
    });
  };

  const handleEdit = (o: EventOrder) => {
    localStorage.removeItem(DRAFT_KEY);
    setEditingId(o.id);
    const itemsWithData = o.items.map(oi => {
        const inv = inventory.find(i => i.id === oi.itemId);
        return { ...inv, quantity: oi.quantity, price: oi.priceAtBooking };
    });
    setSelectedItems(itemsWithData);
    setOrderData({ 
        ...o, 
        warehouseExitNumber: o.warehouseExitNumber || '',
        paymentAmount: o.paidAmount 
    });
    setView('FORM');
  };

  const handleSaveQuickClient = async () => {
    if (!newClient.name) return uiService.alert("Faltan Datos", "El nombre es obligatorio.");
    setLoading(true);
    try {
      const clientToSave: Client = {
        id: '',
        name: newClient.name,
        documentId: newClient.documentId || '',
        email: '',
        phone: newClient.phone || '',
        mobilePhone: newClient.phone || '',
        address: newClient.address || ''
      };
      await storageService.saveClient(clientToSave);
      setShowClientModal(false);
      setNewClient({ name: '', documentId: '', phone: '', address: '' });
      uiService.alert("Éxito", "Cliente registrado exitosamente.");
    } catch (e: any) {
      uiService.alert("Error", "Error al guardar cliente: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (o.status === EventStatus.QUOTE) return false;
    const orderDate = new Date(o.executionDate);
    const now = new Date();
    const isCurrentMonth = orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
    const hasPendingBalance = (o.total - o.paidAmount) > 0.05;
    const hasIssues = o.status === EventStatus.PARTIAL_RETURN;
    const matchesSearch = o.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || String(o.orderNumber).includes(searchQuery);

    if (showArchive) return matchesSearch;
    return matchesSearch && (isCurrentMonth || hasPendingBalance || hasIssues);
  });

  const handleUpdateItemQuantity = (itemId: string, qty: string) => {
    const val = parseInt(qty) || 1;
    setCatalogQuantities(prev => ({ ...prev, [itemId]: val }));
  };

  const addItemToOrder = (item: InventoryItem) => {
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
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div className="flex items-center gap-4">
          {view === 'FORM' && (
            <button onClick={resetForm} className="w-10 h-10 bg-white shadow-soft rounded-full flex items-center justify-center text-zinc-400 hover:text-brand-900 transition-all">←</button>
          )}
          <div>
            <h2 className="text-2xl font-black text-brand-950 uppercase tracking-tighter">Venta Directa</h2>
            <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest">Gestión operativa de pedidos</p>
          </div>
        </div>
        <button onClick={() => setView(view === 'LIST' ? 'FORM' : 'LIST')} className="px-6 h-10 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] shadow-lg">
          {view === 'LIST' ? '+ Nuevo Pedido' : 'Cancelar'}
        </button>
      </div>

      {view === 'LIST' ? (
        <>
          <div className="flex flex-col md:flex-row gap-4 mb-2">
            <div className="flex-1 relative">
              <input 
                className="w-full h-12 bg-white border border-zinc-100 rounded-2xl px-12 text-xs font-bold shadow-soft outline-none focus:ring-2 focus:ring-brand-50" 
                placeholder="Buscar por cliente o folio..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 grayscale opacity-30">🔍</span>
            </div>
            <button 
              onClick={() => setShowArchive(!showArchive)}
              className={`px-6 rounded-2xl font-black text-[9px] uppercase border transition-all ${showArchive ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-400 border-zinc-200'}`}
            >
              {showArchive ? '📁 Ver Actuales' : '📂 Ver Histórico'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pb-20">
            {filteredOrders.map(o => (
              <div key={o.id} className="bg-white p-3 rounded-xl shadow-soft border border-zinc-100 flex flex-col hover:border-brand-100 transition-all group">
                <div className="flex justify-between mb-1">
                  <span className="text-[7px] font-black text-zinc-300">#ORD-{o.orderNumber}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${o.status === EventStatus.CANCELLED ? 'bg-zinc-100 text-zinc-400' : 'bg-emerald-50 text-emerald-600'}`}>{o.status}</span>
                </div>
                <h3 className="text-[10px] font-black text-zinc-950 uppercase truncate mb-0.5">{o.clientName}</h3>
                <p className="text-[8px] font-bold text-zinc-400 uppercase">🗓️ {o.executionDate}</p>
                {o.warehouseExitNumber && <p className="text-[7px] font-black text-brand-600 mt-1 uppercase">EB N°: {o.warehouseExitNumber}</p>}
                <div className="mt-auto space-y-1 pt-3">
                  <div className="flex gap-1">
                      <button onClick={() => handleEdit(o)} className="w-full py-1.5 bg-zinc-50 text-brand-900 rounded-lg text-[8px] font-black uppercase">Detalles</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-premium border border-zinc-100 animate-slide-up">
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 space-y-4">
                <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-3">
                   <h3 className="text-[10px] font-black text-brand-900 uppercase tracking-widest">1. Configuración</h3>
                   <div className="flex gap-2">
                       <select className="flex-1 h-10 bg-white rounded-xl px-4 text-[10px] font-black outline-none border border-zinc-200" value={orderData.clientId} onChange={e => setOrderData({...orderData, clientId: e.target.value})}>
                          <option value="">Cliente...</option>
                          {clients.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
                       </select>
                       <button onClick={() => setShowClientModal(true)} className="w-10 h-10 bg-brand-900 text-white rounded-xl font-black text-xl">+</button>
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                         <label className="text-[7px] font-black text-zinc-400 px-2 uppercase">EB N° (Egreso)</label>
                         <input type="number" className="w-full h-10 bg-white rounded-xl px-3 text-[10px] font-black border border-zinc-200" value={orderData.warehouseExitNumber || ''} onChange={e => setOrderData({...orderData, warehouseExitNumber: e.target.value})} placeholder="0000" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[7px] font-black text-zinc-400 px-2 uppercase">Fecha Evento</label>
                        <input type="date" className="w-full h-10 bg-white rounded-xl px-3 text-[10px] font-black border border-zinc-200" value={orderData.executionDate} onChange={e => setOrderData({...orderData, executionDate: e.target.value})} />
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[7px] font-black text-zinc-400 px-2 uppercase">Días Renta</label>
                        <input type="number" min="1" className="w-full h-10 bg-white rounded-xl px-3 text-[10px] font-black border border-zinc-200" value={orderData.rentalDays} onChange={e => setOrderData({...orderData, rentalDays: parseInt(e.target.value) || 1})} placeholder="Días" />
                      </div>
                   </div>
                   <div className="flex items-center gap-2 bg-white px-4 rounded-xl border border-zinc-200 h-10">
                      <input type="checkbox" checked={orderData.requiresDelivery} onChange={e => setOrderData({...orderData, requiresDelivery: e.target.checked})} />
                      <span className="text-[8px] font-black uppercase">Servicio de Transporte</span>
                   </div>
                   {orderData.requiresDelivery && (
                     <div className="space-y-2 animate-fade-in">
                        <input type="text" inputMode="decimal" placeholder="Valor Transporte $" className="w-full h-10 bg-white rounded-xl px-4 text-[10px] font-black border border-zinc-200" value={orderData.deliveryCost || ''} onChange={e => handleDecimalInput(e.target.value, 'deliveryCost')} />
                        <input type="text" placeholder="Dirección Exacta de Entrega *" className="w-full h-10 bg-white rounded-xl px-4 text-[10px] font-black border border-zinc-200" value={orderData.deliveryAddress || ''} onChange={e => setOrderData({...orderData, deliveryAddress: e.target.value})} />
                     </div>
                   )}
                </div>

                <div className="p-5 bg-zinc-50 border border-zinc-100 rounded-2xl space-y-3">
                   <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">2. Catálogo</h3>
                   <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1 scrollbar-hide">
                      {inventory.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded-xl border border-zinc-100">
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
                              <button onClick={() => addItemToOrder(item)} className="w-8 h-8 bg-zinc-100 text-brand-900 rounded-lg font-black hover:bg-brand-900 hover:text-white transition-all">+</button>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-4">
                 <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-inner min-h-[400px] flex flex-col">
                    <h3 className="text-[11px] font-black text-zinc-900 uppercase mb-4 tracking-widest border-b pb-2">3. Detalle de Cobro</h3>
                    <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[250px] mb-4 pr-2">
                       {selectedItems.map(i => (
                         <div key={i.id} className="flex justify-between items-center text-[10px] bg-zinc-50/50 p-2 rounded-lg group">
                            <span className="uppercase font-bold text-zinc-500"><span className="text-zinc-950 font-black">{i.quantity}x</span> {i.name}</span>
                            <div className="flex items-center gap-4">
                                <span className="font-black">$ {(i.price * i.quantity * (orderData.rentalDays || 1)).toFixed(2)}</span>
                                <button onClick={() => setSelectedItems(selectedItems.filter(si => si.id !== i.id))} className="text-rose-300 opacity-0 group-hover:opacity-100">✕</button>
                            </div>
                         </div>
                       ))}
                    </div>
                    
                    <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <div className="flex items-center gap-2">
                             <input type="checkbox" checked={orderData.hasInvoice} onChange={e => setOrderData({...orderData, hasInvoice: e.target.checked})} />
                             <span className="text-[9px] font-black uppercase text-zinc-500">Factura (IVA 15%)</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                             <div className="space-y-1">
                                 <label className="text-[7px] font-black text-zinc-400 uppercase">Descuento</label>
                                 <input type="text" inputMode="decimal" className="w-full h-8 bg-zinc-50 rounded px-2 text-[10px] font-black border-none" value={orderData.discountValue} onChange={e => handleDecimalInput(e.target.value, 'discountValue')} />
                             </div>
                             <div className="space-y-1">
                                 <label className="text-[7px] font-black text-zinc-400 uppercase">Tipo</label>
                                 <select className="w-full h-8 bg-zinc-50 rounded px-1 text-[9px] font-black border-none" value={orderData.discountType} onChange={e => setOrderData({...orderData, discountType: e.target.value})}>
                                    <option value="VALUE">$ Valor</option>
                                    <option value="PERCENT">% Porc</option>
                                 </select>
                             </div>
                          </div>
                       </div>
                       
                       <div className="bg-brand-50/50 p-4 rounded-xl flex flex-col justify-center border border-brand-100 text-right">
                          <p className="text-[8px] font-black text-zinc-400 uppercase">Subtotal: $ {calculateSubtotalItems().toFixed(2)}</p>
                          <p className="text-[8px] font-black text-rose-500 uppercase">Desc: - $ {calculateDiscountValue().toFixed(2)}</p>
                          <p className="text-2xl font-black text-brand-950 tracking-tighter mt-1">$ {calculateTotal().toFixed(2)}</p>
                       </div>
                    </div>
                 </div>

                 <button onClick={handleSave} disabled={loading} className="w-full h-14 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-2xl active:scale-95 transition-all">
                    {loading ? 'Sincronizando...' : 'Finalizar Pedido'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {showClientModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
              <div className="bg-white rounded-3xl p-6 w-full max-sm shadow-premium border border-white animate-slide-up">
                  <h3 className="text-lg font-black text-brand-900 uppercase mb-4 tracking-tighter">Nuevo Cliente</h3>
                  <div className="space-y-3">
                      <input placeholder="Razón Social" className="w-full h-10 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} />
                      <input placeholder="RUC / Cédula" className="w-full h-10 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={newClient.documentId} onChange={e => setNewClient({...newClient, documentId: e.target.value})} />
                      <input placeholder="Teléfono" className="w-full h-10 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} />
                      <input placeholder="Dirección" className="w-full h-10 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={newClient.address} onChange={e => setNewClient({...newClient, address: e.target.value})} />
                      <div className="flex gap-2 pt-2">
                          <button onClick={() => setShowClientModal(false)} className="flex-1 py-3 text-zinc-300 font-black uppercase text-[9px]">Atrás</button>
                          <button onClick={handleSaveQuickClient} className="flex-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-black uppercase text-[9px]">Guardar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default EventsView;
