import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, Client, InventoryItem, PaymentMethod, PaymentStatus } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';

const getStatusStyle = (status: EventStatus) => {
  switch (status) {
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
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

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
      setOrders(all.filter(e => e.status !== EventStatus.QUOTE));
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

  const handleSave = async () => {
    if (!formData.clientId || selectedItems.length === 0) return uiService.alert("Faltan Datos", "Seleccione cliente e ítems.");
    const total = calculateTotal();
    const orderNumber = editingId ? orders.find(o => o.id === editingId)?.orderNumber || 0 : await storageService.generateOrderNumber();
    
    const order: EventOrder = {
      ...formData,
      id: editingId || '',
      orderNumber,
      warehouseExitNumber: formData.warehouseExitNumber ? parseInt(formData.warehouseExitNumber) : undefined,
      clientName: clients.find(c => c.id === formData.clientId)?.name || 'Cliente',
      status: editingId ? orders.find(o => o.id === editingId)?.status || EventStatus.CONFIRMED : EventStatus.CONFIRMED,
      paymentStatus: formData.paymentAmount >= total ? PaymentStatus.PAID : (formData.paymentAmount > 0 ? PaymentStatus.PARTIAL : PaymentStatus.CREDIT),
      paidAmount: parseFloat(formData.paymentAmount) || 0,
      total,
      items: selectedItems.map(i => ({ itemId: i.id, quantity: i.quantity, priceAtBooking: i.price }))
    };

    await storageService.saveEvent(order);
    uiService.alert("Éxito", "Pedido guardado.");
    resetForm();
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

  const handleCancelOrder = async (o: EventOrder) => {
      if (await uiService.confirm("Anular", "¿Anular el pedido?")) {
          await storageService.saveEvent({...o, status: EventStatus.CANCELLED});
      }
  };

  const filteredOrders = orders.filter(o => o.clientName.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-brand-950 uppercase">Pedidos Operativos</h2>
          <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest">Gestión de Ventas y Despachos</p>
        </div>
        <button onClick={() => view === 'LIST' ? setView('FORM') : resetForm()} className="px-6 h-12 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] shadow-lg">
          {view === 'LIST' ? '+ Nuevo Pedido' : 'Cancelar'}
        </button>
      </div>

      {view === 'LIST' ? (
        <>
          <div className="bg-white p-4 rounded-2xl shadow-soft border border-zinc-100">
            <input type="text" placeholder="Filtrar pedidos..." className="w-full h-10 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredOrders.map(o => (
              <div key={o.id} className="bg-white p-3 rounded-xl shadow-soft border border-zinc-100 flex flex-col hover:border-brand-100 transition-all">
                <div className="flex justify-between mb-1">
                  <span className="text-[7px] font-black text-zinc-300">#ORD-{o.orderNumber}</span>
                  <span className={`px-1.5 py-0.5 rounded border text-[7px] font-black uppercase ${getStatusStyle(o.status)}`}>{o.status}</span>
                </div>
                <h3 className="text-[10px] font-black text-zinc-950 uppercase truncate">{o.clientName}</h3>
                <p className="text-[8px] font-bold text-zinc-400 uppercase">🗓️ {o.executionDate}</p>
                {o.warehouseExitNumber && <p className="text-[7px] font-black text-brand-600 mt-1 uppercase">EB N°: {o.warehouseExitNumber}</p>}
                <div className="mt-auto pt-3 flex gap-1">
                  <button onClick={() => handleEdit(o)} className="flex-1 py-1.5 bg-zinc-900 text-white rounded-lg text-[8px] font-black uppercase">Editar</button>
                  <button onClick={() => handleCancelOrder(o)} className="flex-1 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[8px] font-black uppercase">Anular</button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-soft grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase px-2">Cliente *</label>
                <select className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={formData.clientId} onChange={e => setFormData({...formData, clientId: e.target.value})}>
                  <option value="">Seleccionar...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
                </select>
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
              <h3 className="text-[10px] font-black text-zinc-400 uppercase mb-4 px-2 tracking-widest">Detalle del Pedido</h3>
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
                <span className="text-[10px] font-black uppercase opacity-50">Total Venta</span>
                <span className="text-3xl font-black tracking-tighter">$ {calculateTotal().toFixed(2)}</span>
              </div>
              <div className="space-y-3">
                <label className="text-[8px] font-black text-zinc-500 uppercase px-2">Abono Inicial ($)</label>
                <input type="number" className="w-full h-12 bg-white/10 rounded-xl px-4 text-xl font-black text-center" value={formData.paymentAmount} onChange={e => setFormData({...formData, paymentAmount: e.target.value})} />
                <button onClick={handleSave} className="w-full h-14 bg-brand-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Confirmar Venta</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsView;