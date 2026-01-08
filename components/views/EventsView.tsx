
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
    case EventStatus.TO_PICKUP: return 'bg-orange-100 text-orange-700 border-orange-200';
    case EventStatus.PARTIAL_RETURN: return 'bg-rose-100 text-rose-700 border-rose-200';
    case EventStatus.FINISHED: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case EventStatus.CANCELLED: return 'bg-zinc-100 text-zinc-500 border-zinc-200';
    case EventStatus.RETURNED: return 'bg-teal-100 text-teal-700 border-teal-200';
    case EventStatus.QUOTE: return 'bg-violet-100 text-violet-700 border-violet-200';
    default: return 'bg-zinc-50 text-zinc-400 border-zinc-100';
  }
};

const EventsView: React.FC = () => {
  const [view, setView] = useState<'LIST' | 'FORM'>('LIST');
  const [showArchive, setShowArchive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
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
    paymentMethod: PaymentMethod.CASH
  });

  useEffect(() => {
    storageService.subscribeToClients(setClients);
    storageService.subscribeToInventory(setInventory);
    storageService.subscribeToEvents(setOrders);
  }, []);

  const handleAddItem = (item: InventoryItem) => {
    const exists = selectedItems.find(i => i.id === item.id);
    if (exists) {
      setSelectedItems(selectedItems.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setSelectedItems([...selectedItems, { ...item, quantity: 1, price: item.price }]);
    }
  };

  const handleRemoveItem = (id: string) => setSelectedItems(selectedItems.filter(i => i.id !== id));

  const handleUpdateQty = (id: string, qty: number) => {
    setSelectedItems(selectedItems.map(i => i.id === id ? { ...i, quantity: Math.max(1, qty) } : i));
  };

  const calculateTotal = () => {
    const itemsSub = selectedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) * (orderData.rentalDays || 1);
    const disc = orderData.discountType === 'PERCENT' ? (itemsSub * (orderData.discountValue / 100)) : (orderData.discountValue || 0);
    const iva = orderData.hasInvoice ? ((itemsSub - disc) * 0.15) : 0;
    return itemsSub - disc + iva + (parseFloat(orderData.deliveryCost) || 0);
  };

  const handleSave = async () => {
    if (!orderData.clientId || selectedItems.length === 0) return uiService.alert("Faltan Datos", "Seleccione cliente y productos.");
    setLoading(true);
    const total = calculateTotal();
    const orderNumber = editingId ? orders.find(o => o.id === editingId)?.orderNumber || 0 : await storageService.generateOrderNumber();
    
    const order: EventOrder = {
      ...orderData,
      id: editingId || '',
      orderNumber,
      warehouseExitNumber: parseInt(orderData.warehouseExitNumber) || undefined,
      clientName: clients.find(c => c.id === orderData.clientId)?.name || 'Cliente',
      status: editingId ? orders.find(o => o.id === editingId)?.status || EventStatus.CONFIRMED : EventStatus.CONFIRMED,
      paymentStatus: orderData.paymentAmount >= total ? PaymentStatus.PAID : (orderData.paymentAmount > 0 ? PaymentStatus.PARTIAL : PaymentStatus.CREDIT),
      paidAmount: parseFloat(orderData.paymentAmount) || 0,
      total,
      items: selectedItems.map(i => ({ itemId: i.id, quantity: i.quantity, priceAtBooking: i.price }))
    };

    await storageService.saveEvent(order);
    setLoading(false);
    uiService.alert("Éxito", `Pedido #${orderNumber} guardado correctamente.`);
    resetForm();
  };

  const resetForm = () => {
    setView('LIST');
    setEditingId(null);
    setSelectedItems([]);
    setOrderData({
      clientId: '', warehouseExitNumber: '', executionDate: new Date().toISOString().split('T')[0],
      rentalDays: 1, requiresDelivery: false, deliveryCost: 0, deliveryAddress: '',
      hasInvoice: false, discountValue: 0, discountType: 'VALUE', notes: '',
      paymentAmount: 0, paymentMethod: PaymentMethod.CASH
    });
  };

  const handleEdit = (o: EventOrder) => {
    setEditingId(o.id);
    const itemsWithData = o.items.map(oi => {
        const inv = inventory.find(i => i.id === oi.itemId);
        return { ...inv, quantity: oi.quantity, price: oi.priceAtBooking };
    });
    setSelectedItems(itemsWithData);
    setOrderData({ ...o, warehouseExitNumber: o.warehouseExitNumber || '', paymentAmount: o.paidAmount });
    setView('FORM');
  };

  const filteredOrders = orders.filter(o => o.status !== EventStatus.QUOTE && (showArchive || (new Date(o.executionDate).getMonth() === new Date().getMonth())));
  const filteredInventory = inventory.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-brand-950 uppercase tracking-tighter">Pedidos Confirmados</h2>
          <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest">Ventas y Reservas Operativas</p>
        </div>
        <button onClick={() => view === 'LIST' ? setView('FORM') : resetForm()} className="px-6 h-10 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] shadow-lg">
          {view === 'LIST' ? '+ Nuevo Pedido' : 'Volver'}
        </button>
      </div>

      {view === 'LIST' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredOrders.map(o => (
            <div key={o.id} className="bg-white p-3 rounded-xl shadow-soft border border-zinc-100 flex flex-col hover:border-brand-100 transition-all">
              <div className="flex justify-between mb-1">
                <span className="text-[7px] font-black text-zinc-300">#ORD-{o.orderNumber}</span>
                <span className={`px-1.5 py-0.5 rounded border text-[7px] font-black uppercase ${getStatusStyle(o.status)}`}>{o.status}</span>
              </div>
              <h3 className="text-[10px] font-black text-zinc-950 uppercase truncate">{o.clientName}</h3>
              <p className="text-[8px] font-bold text-zinc-400 uppercase">🗓️ {o.executionDate}</p>
              <div className="mt-auto pt-3 flex gap-1">
                <button onClick={() => handleEdit(o)} className="flex-1 py-1.5 bg-zinc-900 text-white rounded-lg text-[8px] font-black uppercase">Editar</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-soft grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase px-2">Cliente *</label>
                <select className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={orderData.clientId} onChange={e => setOrderData({...orderData, clientId: e.target.value})}>
                  <option value="">Seleccionar...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase px-2">EB N° (Egreso Bodega) *</label>
                <input required type="number" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={orderData.warehouseExitNumber} onChange={e => setOrderData({...orderData, warehouseExitNumber: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase px-2">Fecha Evento</label>
                <input type="date" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={orderData.executionDate} onChange={e => setOrderData({...orderData, executionDate: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase px-2">Días de Renta</label>
                <input type="number" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={orderData.rentalDays} onChange={e => setOrderData({...orderData, rentalDays: parseInt(e.target.value)})} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-soft">
              <h3 className="text-[10px] font-black text-zinc-400 uppercase mb-4 px-2">Ítems Seleccionados</h3>
              <div className="space-y-2">
                {selectedItems.map(item => (
                  <div key={item.id} className="flex items-center gap-4 bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                    <div className="flex-1">
                      <p className="text-[10px] font-black uppercase text-zinc-950">{item.name}</p>
                      <p className="text-[8px] font-bold text-zinc-400">$ {item.price.toFixed(2)} c/u</p>
                    </div>
                    <input type="number" className="w-16 h-8 bg-white border border-zinc-200 rounded-lg text-center text-xs font-black" value={item.quantity} onChange={e => handleUpdateQty(item.id, parseInt(e.target.value))} />
                    <button onClick={() => handleRemoveItem(item.id)} className="text-rose-300 hover:text-rose-600">✕</button>
                  </div>
                ))}
                {selectedItems.length === 0 && <p className="text-center py-10 text-zinc-300 font-bold text-[10px] uppercase">No hay productos añadidos</p>}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-soft space-y-4">
              <input type="text" placeholder="🔍 Buscar productos..." className="w-full h-10 bg-zinc-50 rounded-xl px-4 text-[10px] font-bold" value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
              <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                {filteredInventory.map(item => (
                  <button key={item.id} onClick={() => handleAddItem(item)} className="w-full flex justify-between items-center p-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl border border-zinc-100 text-left">
                    <span className="text-[9px] font-black uppercase text-zinc-800">{item.name}</span>
                    <span className="text-[9px] font-black text-brand-600">$ {item.price.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 text-white p-8 rounded-[2.5rem] shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <span className="text-[10px] font-black uppercase opacity-50">Subtotal</span>
                <span className="text-xl font-black">$ {(selectedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) * (orderData.rentalDays || 1)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-brand-400">
                <span className="text-[10px] font-black uppercase">Total a Pagar</span>
                <span className="text-3xl font-black">$ {calculateTotal().toFixed(2)}</span>
              </div>
              <div className="pt-4 space-y-3">
                <label className="text-[8px] font-black text-zinc-500 uppercase px-2">Abono Inicial</label>
                <input type="number" className="w-full h-12 bg-white/10 rounded-xl px-4 text-xl font-black text-center" value={orderData.paymentAmount} onChange={e => setOrderData({...orderData, paymentAmount: e.target.value})} />
                <button onClick={handleSave} className="w-full h-14 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all">
                  Finalizar Pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsView;
