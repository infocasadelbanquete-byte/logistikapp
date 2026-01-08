
import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, Client, InventoryItem, PaymentMethod, PaymentStatus } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';

const getStatusStyle = (status: EventStatus) => {
  switch (status) {
    case EventStatus.QUOTE: return 'bg-violet-100 text-violet-700 border-violet-200';
    case EventStatus.CONFIRMED: return 'bg-blue-100 text-blue-700 border-blue-200';
    case EventStatus.DISPATCHED: return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    case EventStatus.DELIVERED: return 'bg-cyan-100 text-cyan-700 border-cyan-200';
    case EventStatus.IN_PROGRESS: return 'bg-amber-100 text-amber-700 border-amber-200';
    case EventStatus.FINISHED: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case EventStatus.CANCELLED: return 'bg-zinc-100 text-zinc-500 border-zinc-200';
    default: return 'bg-zinc-50 text-zinc-400 border-zinc-100';
  }
};

const EventsView: React.FC = () => {
  const [view, setView] = useState<'LIST' | 'FORM'>('LIST');
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'QUOTES'>('ORDERS');
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Express Client States
  const [isExpressModalOpen, setIsExpressModalOpen] = useState(false);
  const [expressClientData, setExpressClientData] = useState({ name: '', documentId: '', mobilePhone: '' });

  const initialForm = {
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
    paymentAmount: 0
  };

  const [formData, setFormData] = useState<any>(initialForm);

  useEffect(() => {
    const unsub = storageService.subscribeToEvents(all => {
      setOrders(all);
    });
    storageService.subscribeToClients(setClients);
    storageService.subscribeToInventory(setInventory);
    return () => unsub();
  }, []);

  const handleAddItem = (item: InventoryItem) => {
    const exists = selectedItems.find(i => i.id === item.id);
    if (exists) {
      setSelectedItems(selectedItems.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setSelectedItems([...selectedItems, { ...item, quantity: 1, price: item.price }]);
    }
  };

  const calculateTotal = () => {
    const itemsSub = selectedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) * (formData.rentalDays || 1);
    const disc = formData.discountType === 'PERCENT' ? (itemsSub * (formData.discountValue / 100)) : (formData.discountValue || 0);
    const base = itemsSub - disc;
    const iva = formData.hasInvoice ? (base * 0.15) : 0;
    const delivery = formData.requiresDelivery ? (parseFloat(formData.deliveryCost) || 0) : 0;
    return base + iva + delivery;
  };

  const handleSave = async (asQuote: boolean = false) => {
    if (!formData.clientId || selectedItems.length === 0) return uiService.alert("Faltan Datos", "Seleccione cliente e ítems.");
    const total = calculateTotal();
    const orderNumber = editingId ? orders.find(o => o.id === editingId)?.orderNumber || 0 : await storageService.generateOrderNumber();
    
    const order: EventOrder = {
      ...formData,
      id: editingId || '',
      orderNumber,
      warehouseExitNumber: formData.warehouseExitNumber ? parseInt(formData.warehouseExitNumber) : undefined,
      clientName: clients.find(c => c.id === formData.clientId)?.name || 'Cliente',
      status: asQuote ? EventStatus.QUOTE : (editingId ? orders.find(o => o.id === editingId)?.status || EventStatus.CONFIRMED : EventStatus.CONFIRMED),
      paymentStatus: formData.paymentAmount >= total ? PaymentStatus.PAID : (formData.paymentAmount > 0 ? PaymentStatus.PARTIAL : PaymentStatus.CREDIT),
      paidAmount: parseFloat(formData.paymentAmount) || 0,
      total,
      items: selectedItems.map(i => ({ itemId: i.id, quantity: i.quantity, priceAtBooking: i.price }))
    };

    await storageService.saveEvent(order);
    uiService.alert("Éxito", asQuote ? "Proforma guardada." : "Pedido guardado.");
    resetForm();
  };

  const handleSaveExpressClient = async () => {
    if (!expressClientData.name) return uiService.alert("Faltan Datos", "El nombre es obligatorio.");
    const newClient: Client = {
      id: '',
      name: expressClientData.name,
      documentId: expressClientData.documentId,
      email: '',
      phone: '',
      mobilePhone: expressClientData.mobilePhone,
      address: ''
    };
    try {
        await storageService.saveClient(newClient);
        setIsExpressModalOpen(false);
        setExpressClientData({ name: '', documentId: '', mobilePhone: '' });
        uiService.alert("Éxito", "Cliente registrado.");
    } catch (e) {
        uiService.alert("Error", "No se pudo registrar al cliente.");
    }
  };

  const handleSendToDispatch = async (o: EventOrder) => {
      if (await uiService.confirm("Enviar a Despacho", `¿Autorizar el despacho del pedido #${o.orderNumber}?`)) {
          await storageService.saveEvent({ ...o, status: EventStatus.DISPATCHED });
          uiService.alert("Enviado", "El pedido ya está disponible en el módulo de Despachos.");
      }
  };

  const handleEdit = (o: EventOrder) => {
    setEditingId(o.id);
    const itemsWithData = o.items.map(oi => {
      const inv = inventory.find(i => i.id === oi.itemId);
      return { ...inv, quantity: oi.quantity, price: oi.priceAtBooking };
    });
    setSelectedItems(itemsWithData);
    setFormData({ ...o, warehouseExitNumber: o.warehouseExitNumber || '', paymentAmount: o.paidAmount });
    setView('FORM');
  };

  const resetForm = () => {
    setView('LIST');
    setEditingId(null);
    setSelectedItems([]);
    setFormData(initialForm);
  };

  const handleConfirmQuote = async (o: EventOrder) => {
      if (await uiService.confirm("Confirmar Pedido", `¿Desea convertir la proforma #${o.orderNumber} en un pedido confirmado?`)) {
          const ebNum = await uiService.prompt("Número de Egreso", "Ingrese el EB N° para este pedido (Opcional):");
          const updated: EventOrder = {
              ...o,
              status: EventStatus.CONFIRMED,
              warehouseExitNumber: ebNum ? parseInt(ebNum) : undefined
          };
          await storageService.saveEvent(updated);
          uiService.alert("Confirmado", "Pedido creado satisfactoriamente.");
      }
  };

  const handleCancelOrder = async (o: EventOrder) => {
      if (await uiService.confirm("Anular", "¿Anular el registro?")) {
          await storageService.saveEvent({...o, status: EventStatus.CANCELLED});
      }
  };

  const filteredData = orders.filter(o => {
    const matchesSearch = o.clientName.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === 'QUOTES') return matchesSearch && o.status === EventStatus.QUOTE;
    return matchesSearch && o.status !== EventStatus.QUOTE;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-brand-950 uppercase">Gestión Comercial</h2>
          <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest">Pedidos y Presupuestos</p>
        </div>
        <div className="flex bg-zinc-100 p-1 rounded-2xl shadow-inner gap-1">
            <button 
                onClick={() => { setActiveTab('ORDERS'); resetForm(); }}
                className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'ORDERS' && view === 'LIST' ? 'bg-white text-brand-900 shadow-md' : 'text-zinc-400'}`}
            >
                🛒 Pedidos
            </button>
            <button 
                onClick={() => { setActiveTab('QUOTES'); resetForm(); }}
                className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'QUOTES' && view === 'LIST' ? 'bg-white text-brand-900 shadow-md' : 'text-zinc-400'}`}
            >
                📝 Proformas
            </button>
            <button onClick={() => setView('FORM')} className="px-6 py-2 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] shadow-lg ml-2">
                + Nuevo
            </button>
        </div>
      </div>

      {view === 'LIST' ? (
        <>
          <div className="bg-white p-4 rounded-2xl shadow-soft border border-zinc-100">
            <input type="text" placeholder="Filtrar por cliente..." className="w-full h-10 bg-zinc-50 rounded-xl px-4 text-xs font-bold outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredData.map(o => (
              <div key={o.id} className={`bg-white p-3 rounded-xl shadow-soft border-t-2 flex flex-col hover:shadow-premium transition-all ${o.status === EventStatus.QUOTE ? 'border-violet-500' : 'border-brand-500'}`}>
                <div className="flex justify-between mb-1">
                  <span className="text-[7px] font-black text-zinc-300">#{o.status === EventStatus.QUOTE ? 'PRO' : 'ORD'}-{o.orderNumber}</span>
                  <span className={`px-1.5 py-0.5 rounded border text-[7px] font-black uppercase ${getStatusStyle(o.status)}`}>{o.status}</span>
                </div>
                <h3 className="text-[10px] font-black text-zinc-950 uppercase truncate">{o.clientName}</h3>
                <p className="text-[8px] font-bold text-zinc-400 uppercase">🗓️ {o.executionDate}</p>
                {o.warehouseExitNumber && <p className="text-[7px] font-black text-brand-600 mt-1 uppercase">EB N°: {o.warehouseExitNumber}</p>}
                
                <div className="mt-auto pt-3 flex flex-col gap-1">
                  {o.status === EventStatus.QUOTE && (
                      <button onClick={() => handleConfirmQuote(o)} className="w-full py-1.5 bg-emerald-600 text-white rounded-lg text-[8px] font-black uppercase">Confirmar Pedido</button>
                  )}
                  {o.status === EventStatus.CONFIRMED && (
                      <button onClick={() => handleSendToDispatch(o)} className="w-full py-1.5 bg-brand-900 text-white rounded-lg text-[8px] font-black uppercase">🚚 Enviar a Despacho</button>
                  )}
                  <div className="flex gap-1">
                      <button onClick={() => handleEdit(o)} className="flex-1 py-1.5 bg-zinc-100 text-zinc-600 rounded-lg text-[8px] font-black uppercase">Editar</button>
                      <button onClick={() => handleCancelOrder(o)} className="flex-1 py-1.5 bg-rose-50 text-rose-300 rounded-lg text-[8px] font-black uppercase">Anular</button>
                  </div>
                </div>
              </div>
            ))}
            {filteredData.length === 0 && <div className="col-span-full py-20 text-center opacity-20 font-black uppercase text-xs">Sin registros</div>}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-soft grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase px-2">Cliente *</label>
                <div className="flex gap-2">
                    <select className="flex-1 h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={formData.clientId} onChange={e => setFormData({...formData, clientId: e.target.value})}>
                      <option value="">Seleccionar...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
                    </select>
                    <button 
                        type="button" 
                        onClick={() => setIsExpressModalOpen(true)}
                        className="w-12 h-12 bg-brand-900 text-white rounded-xl flex items-center justify-center font-black text-lg shadow-md"
                        title="Cliente Nuevo (Express)"
                    >
                        +
                    </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase px-2">EB N° (Opcional)</label>
                <input type="number" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={formData.warehouseExitNumber} onChange={e => setFormData({...formData, warehouseExitNumber: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase px-2">Fecha Evento</label>
                <input type="date" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={formData.executionDate} onChange={e => setFormData({...formData, executionDate: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase px-2">Días Alquiler</label>
                <input type="number" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={formData.rentalDays} onChange={e => setFormData({...formData, rentalDays: parseInt(e.target.value)})} />
              </div>
              <div className="flex items-center gap-4 bg-zinc-50 p-3 rounded-xl">
                 <label className="text-[9px] font-black text-zinc-400 uppercase">¿Factura?</label>
                 <input type="checkbox" className="w-5 h-5" checked={formData.hasInvoice} onChange={e => setFormData({...formData, hasInvoice: e.target.checked})} />
              </div>
              <div className="flex items-center gap-4 bg-zinc-50 p-3 rounded-xl">
                 <label className="text-[9px] font-black text-zinc-400 uppercase">¿Transporte?</label>
                 <input type="checkbox" className="w-5 h-5" checked={formData.requiresDelivery} onChange={e => setFormData({...formData, requiresDelivery: e.target.checked})} />
              </div>
              {formData.requiresDelivery && (
                <>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-zinc-400 uppercase px-2">Costo Envío $</label>
                    <input type="number" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={formData.deliveryCost} onChange={e => setFormData({...formData, deliveryCost: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-zinc-400 uppercase px-2">Dirección Entrega</label>
                    <input type="text" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={formData.deliveryAddress} onChange={e => setFormData({...formData, deliveryAddress: e.target.value})} />
                  </div>
                </>
              )}
            </div>
            <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-soft">
              <h3 className="text-[10px] font-black text-zinc-400 uppercase mb-4 px-2 tracking-widest">Detalle de Selección</h3>
              <div className="space-y-2">
                {selectedItems.map(item => (
                  <div key={item.id} className="flex items-center gap-4 bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                    <div className="flex-1">
                      <p className="text-[10px] font-black uppercase text-zinc-950">{item.name}</p>
                      <p className="text-[8px] font-bold text-zinc-400">$ {item.price.toFixed(2)}</p>
                    </div>
                    <input type="number" className="w-16 h-8 bg-white border border-zinc-200 rounded-lg text-center text-xs font-black" value={item.quantity} onChange={e => setSelectedItems(selectedItems.map(si => si.id === item.id ? {...si, quantity: parseInt(e.target.value)} : si))} />
                    <button onClick={() => setSelectedItems(selectedItems.filter(si => si.id !== item.id))} className="text-rose-300">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-soft space-y-4">
              <input type="text" placeholder="🔍 Buscar catálogo..." className="w-full h-10 bg-zinc-50 rounded-xl px-4 text-[10px] font-bold" value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
              <div className="max-h-60 overflow-y-auto space-y-2">
                {inventory.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase())).map(item => (
                  <button key={item.id} onClick={() => handleAddItem(item)} className="w-full flex justify-between items-center p-3 bg-zinc-50 hover:bg-brand-50 rounded-xl border border-zinc-100">
                    <span className="text-[9px] font-black uppercase text-zinc-800">{item.name}</span>
                    <span className="text-[9px] font-black text-brand-600">$ {item.price.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-zinc-900 text-white p-8 rounded-[2.5rem] shadow-xl space-y-6">
              <div className="flex gap-2">
                <input type="number" placeholder="Desc." className="flex-1 bg-white/10 rounded-lg h-10 px-3 text-xs font-black" value={formData.discountValue} onChange={e => setFormData({...formData, discountValue: parseFloat(e.target.value) || 0})} />
                <select className="bg-white/10 rounded-lg h-10 px-2 text-[10px] font-black" value={formData.discountType} onChange={e => setFormData({...formData, discountType: e.target.value})}>
                   <option value="VALUE">$</option><option value="PERCENT">%</option>
                </select>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <span className="text-[10px] font-black uppercase opacity-50">Total</span>
                <span className="text-3xl font-black tracking-tighter">$ {calculateTotal().toFixed(2)}</span>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleSave(true)} className="py-4 bg-white/10 text-white rounded-xl font-black uppercase text-[8px] tracking-widest border border-white/10">💾 Proforma</button>
                    <button onClick={() => handleSave(false)} className="py-4 bg-brand-600 text-white rounded-xl font-black uppercase text-[8px] tracking-widest">🚀 Pedido</button>
                </div>
                <button onClick={resetForm} className="w-full py-2 text-zinc-500 font-black uppercase text-[8px]">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Express Client Modal */}
      {isExpressModalOpen && (
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-md flex items-center justify-center p-4 z-[200] animate-fade-in">
              <div className="bg-white rounded-[2rem] shadow-premium p-8 w-full max-w-sm border border-white animate-slide-up">
                  <h3 className="text-lg font-black text-brand-950 uppercase mb-4 border-b pb-3 tracking-tighter">Cliente Express</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="text-[8px] font-black text-zinc-400 uppercase px-2 mb-1 block">Nombre / Razón Social *</label>
                          <input 
                              autoFocus
                              type="text" 
                              className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold outline-none"
                              value={expressClientData.name}
                              onChange={e => setExpressClientData({...expressClientData, name: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="text-[8px] font-black text-zinc-400 uppercase px-2 mb-1 block">Identificación (C.I. / RUC)</label>
                          <input 
                              type="text" 
                              className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold outline-none"
                              value={expressClientData.documentId}
                              onChange={e => setExpressClientData({...expressClientData, documentId: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="text-[8px] font-black text-zinc-400 uppercase px-2 mb-1 block">Celular de Contacto</label>
                          <input 
                              type="text" 
                              className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold outline-none"
                              value={expressClientData.mobilePhone}
                              onChange={e => setExpressClientData({...expressClientData, mobilePhone: e.target.value})}
                          />
                      </div>
                      <div className="flex gap-2 pt-4">
                          <button onClick={() => setIsExpressModalOpen(false)} className="flex-1 py-3 text-zinc-400 font-black uppercase text-[8px]">Cancelar</button>
                          <button onClick={handleSaveExpressClient} className="flex-[2] py-4 bg-brand-900 text-white rounded-xl font-black uppercase text-[8px] tracking-widest shadow-lg">Guardar y Usar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default EventsView;
