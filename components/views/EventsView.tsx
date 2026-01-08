import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, Client, InventoryItem, PaymentMethod, PaymentStatus, UserRole } from '../../types';
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
    paymentMethod: PaymentMethod.CASH,
    bankName: '',
    checkNumber: ''
  });

  useEffect(() => {
    storageService.subscribeToClients(setClients);
    storageService.subscribeToInventory(setInventory);
    storageService.subscribeToEvents(setOrders);
  }, []);

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
      total,
      paidAmount: orderData.paymentAmount,
      items: selectedItems.map(i => ({ itemId: i.id, quantity: i.quantity, priceAtBooking: i.price }))
    };

    await storageService.saveEvent(order);
    setLoading(false);
    uiService.alert("Éxito", `Pedido #${orderNumber} guardado correctamente.`);
    resetForm();
  };

  const handleCancelOrder = async (order: EventOrder) => {
    if (await uiService.confirm("Anular Pedido", `¿Está seguro de anular el pedido #ORD-${order.orderNumber}? El stock será liberado.`)) {
      await storageService.saveEvent({ ...order, status: EventStatus.CANCELLED });
      uiService.alert("Anulado", "El pedido ha sido marcado como CANCELADO.");
    }
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

  const resetForm = () => {
    setView('LIST');
    setEditingId(null);
    setSelectedItems([]);
    setOrderData({
        clientId: '', warehouseExitNumber: '', executionDate: new Date().toISOString().split('T')[0], rentalDays: 1,
        requiresDelivery: false, deliveryCost: 0, deliveryAddress: '', hasInvoice: false, discountValue: 0, discountType: 'VALUE',
        notes: '', paymentAmount: 0, paymentMethod: PaymentMethod.CASH, bankName: '', checkNumber: ''
    });
  };

  const calculateTotal = () => {
    const itemsSub = selectedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) * (orderData.rentalDays || 1);
    const disc = orderData.discountType === 'PERCENT' ? (itemsSub * (orderData.discountValue / 100)) : (orderData.discountValue || 0);
    const iva = orderData.hasInvoice ? ((itemsSub - disc) * 0.15) : 0;
    return itemsSub - disc + iva + (parseFloat(orderData.deliveryCost) || 0);
  };

  const filteredOrders = orders.filter(o => {
    // ESTRICTO: Excluir proformas de este módulo
    if (o.status === EventStatus.QUOTE) return false;
    
    const matchesSearch = o.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || String(o.orderNumber).includes(searchQuery);
    if (showArchive) return matchesSearch;
    
    const orderDate = new Date(o.executionDate);
    const now = new Date();
    // Mostrar mes actual por defecto
    return matchesSearch && (orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear());
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-brand-950 uppercase tracking-tighter">Pedidos Confirmados</h2>
          <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest">Gestión operativa de ventas directas</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowArchive(!showArchive)} className={`px-4 h-10 rounded-xl font-black uppercase text-[8px] border transition-all ${showArchive ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-400 border-zinc-200'}`}>
                {showArchive ? 'Ver Actuales' : 'Ver Todo'}
            </button>
            <button onClick={() => setView(view === 'LIST' ? 'FORM' : 'LIST')} className="px-6 h-10 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] shadow-lg">
                {view === 'LIST' ? '+ Nuevo Pedido' : 'Volver al Listado'}
            </button>
        </div>
      </div>

      {view === 'LIST' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredOrders.map(o => (
            <div key={o.id} className="bg-white p-3 rounded-xl shadow-soft border border-zinc-100 flex flex-col hover:border-brand-100 transition-all group">
              <div className="flex justify-between mb-1">
                <span className="text-[7px] font-black text-zinc-300">#ORD-{o.orderNumber}</span>
                <span className={`px-1.5 py-0.5 rounded border text-[7px] font-black uppercase ${getStatusStyle(o.status)}`}>{o.status}</span>
              </div>
              <h3 className="text-[10px] font-black text-zinc-950 uppercase truncate mb-0.5">{o.clientName}</h3>
              <p className="text-[8px] font-bold text-zinc-400 uppercase">🗓️ {o.executionDate}</p>
              {o.warehouseExitNumber && (
                  <p className="text-[7px] font-black text-brand-600 uppercase mt-1">EB N°: {o.warehouseExitNumber}</p>
              )}
              <div className="mt-auto space-y-1 pt-3">
                <div className="flex gap-1">
                    <button onClick={() => handleEdit(o)} className="flex-1 py-1.5 bg-zinc-900 text-white rounded-lg text-[8px] font-black uppercase hover:bg-black transition-colors">Editar</button>
                    {o.status !== EventStatus.CANCELLED && (
                      <button onClick={() => handleCancelOrder(o)} className="flex-1 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[8px] font-black uppercase hover:bg-rose-100 transition-colors">Anular</button>
                    )}
                </div>
              </div>
            </div>
          ))}
          {filteredOrders.length === 0 && (
            <div className="col-span-full py-20 text-center opacity-20 font-black uppercase text-xs tracking-widest">No hay pedidos confirmados en este periodo</div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-premium animate-slide-up">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                 <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Datos del Cliente</h4>
                 <select className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold border-none outline-none" value={orderData.clientId} onChange={e => setOrderData({...orderData, clientId: e.target.value})}>
                    <option value="">Seleccionar Cliente...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
                 </select>
                 <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-1">
                         <label className="text-[8px] font-black text-zinc-400 px-2 uppercase">EB N° (Egreso Bodega)</label>
                         <input type="number" placeholder="0000" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold border-none outline-none" value={orderData.warehouseExitNumber} onChange={e => setOrderData({...orderData, warehouseExitNumber: e.target.value})} />
                     </div>
                     <div className="space-y-1">
                         <label className="text-[8px] font-black text-zinc-400 px-2 uppercase">Fecha Evento</label>
                         <input type="date" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold border-none outline-none" value={orderData.executionDate} onChange={e => setOrderData({...orderData, executionDate: e.target.value})} />
                     </div>
                 </div>
              </div>
              <div className="space-y-4">
                 <div className="bg-zinc-900 text-white p-6 rounded-2xl shadow-xl flex justify-between items-center">
                    <div>
                        <p className="text-[10px] uppercase font-black opacity-50 tracking-widest">Total del Pedido</p>
                        <p className="text-4xl font-black tracking-tighter">$ {calculateTotal().toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-[8px] font-black bg-white/10 px-2 py-1 rounded uppercase">IVA 15% Aplicado</span>
                    </div>
                 </div>
                 <button onClick={handleSave} disabled={loading} className="w-full h-14 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-premium active:scale-95 transition-all">
                    {loading ? 'Sincronizando...' : editingId ? 'Guardar Cambios' : 'Confirmar Venta Directa'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default EventsView;