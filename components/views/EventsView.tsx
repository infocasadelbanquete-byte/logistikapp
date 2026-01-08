import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, Client, InventoryItem, PaymentMethod, PaymentStatus } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';
import { COMPANY_LOGO, COMPANY_NAME } from '../../constants';

const EventsView: React.FC = () => {
  const [view, setView] = useState<'LIST' | 'FORM'>('LIST');
  const [clients, setClients] = useState<Client[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [orderData, setOrderData] = useState<any>({
    clientId: '',
    executionDate: new Date().toISOString().split('T')[0],
    requiresDelivery: false,
    deliveryCost: 0,
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

  const calculateTotal = () => {
    const itemsSubtotal = selectedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const discount = orderData.discountType === 'PERCENT' ? (itemsSubtotal * (orderData.discountValue / 100)) : orderData.discountValue;
    const subtotalAfterDiscount = itemsSubtotal - discount;
    const iva = orderData.hasInvoice ? (subtotalAfterDiscount * 0.15) : 0;
    return subtotalAfterDiscount + iva + (orderData.deliveryCost || 0);
  };

  const handleSave = async () => {
    if (!orderData.clientId || selectedItems.length === 0) return uiService.alert("Faltan Datos", "Seleccione cliente y productos.");
    
    setLoading(true);
    const total = calculateTotal();
    const orderNumber = await storageService.generateOrderNumber();
    
    const order: EventOrder = {
      id: '',
      orderNumber,
      clientId: orderData.clientId,
      clientName: clients.find(c => c.id === orderData.clientId)?.name || 'Consumidor Final',
      orderDate: new Date().toISOString(),
      executionDate: orderData.executionDate,
      status: EventStatus.CONFIRMED,
      paymentStatus: orderData.paymentAmount >= total ? PaymentStatus.PAID : (orderData.paymentAmount > 0 ? PaymentStatus.PARTIAL : PaymentStatus.CREDIT),
      paidAmount: orderData.paymentAmount,
      total,
      items: selectedItems.map(i => ({ itemId: i.id, quantity: i.quantity, priceAtBooking: i.price })),
      requiresDelivery: orderData.requiresDelivery,
      deliveryCost: orderData.deliveryCost,
      hasInvoice: orderData.hasInvoice,
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

    const orderId = await storageService.saveEvent(order);
    
    // Descontar Stock
    for (const item of selectedItems) {
      if (item.type === 'PRODUCT') await storageService.updateStock(item.id, -item.quantity);
    }

    setLoading(false);
    uiService.alert("Venta Exitosa", `Pedido #${orderNumber} registrado.`);
    setView('LIST');
    setSelectedItems([]);
  };

  const handlePrint = (o: EventOrder) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const client = clients.find(c => c.id === o.clientId);
    const orderItems = o.items.map(oi => {
      const it = inventory.find(inv => inv.id === oi.itemId);
      return `<tr><td>${it?.name}</td><td>${oi.quantity}</td><td>$ ${oi.priceAtBooking.toFixed(2)}</td><td>$ ${(oi.quantity * oi.priceAtBooking).toFixed(2)}</td></tr>`;
    }).join('');

    win.document.write(`
      <html><head><style>
        body { font-family: sans-serif; font-size: 10px; margin: 1cm; color: #111; }
        .header { display: flex; justify-content: space-between; border-bottom: 4px solid #4c0519; padding-bottom: 10px; margin-bottom: 20px; }
        .logo { height: 50px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #f3f4f6; text-align: left; padding: 10px; border-bottom: 2px solid #ddd; text-transform: uppercase; font-size: 8px; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        .totals { float: right; width: 250px; padding: 15px; background: #fff1f2; border-radius: 10px; margin-top: 20px; }
        .signature { margin-top: 100px; display: grid; grid-template-columns: 1fr 1fr; gap: 50px; text-align: center; }
        .sig-line { border-top: 1px solid #000; padding-top: 10px; font-weight: bold; }
      </style></head><body>
        <div class="header">
          <img src="${COMPANY_LOGO}" class="logo" />
          <div style="text-align: right;">
            <h2 style="margin:0; color:#4c0519;">${COMPANY_NAME}</h2>
            <p style="margin:2px 0;">ORDEN DE SERVICIO #${o.orderNumber}</p>
          </div>
        </div>
        <div style="background:#f9f9f9; padding:15px; border-radius:10px;">
          <p><strong>CLIENTE:</strong> ${o.clientName.toUpperCase()}</p>
          <p><strong>CÉDULA/RUC:</strong> ${client?.documentId || 'N/A'}</p>
          <p><strong>FECHA EVENTO:</strong> ${o.executionDate}</p>
          <p><strong>DIRECCIÓN:</strong> ${o.deliveryAddress || client?.address || 'N/A'}</p>
        </div>
        <table>
          <thead><tr><th>Descripción</th><th>Cant</th><th>V. Unit</th><th>Subtotal</th></tr></thead>
          <tbody>${orderItems}</tbody>
        </table>
        <div class="totals">
          <div style="display:flex; justify-content:space-between;"><span>Venta Bruta:</span><span>$ ${o.total.toFixed(2)}</span></div>
          <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:900; margin-top:10px; border-top:1px solid #4c0519; padding-top:5px;"><span>TOTAL:</span><span>$ ${o.total.toFixed(2)}</span></div>
        </div>
        <div style="clear:both;"></div>
        <div class="signature">
          <div class="sig-line">ENTREGADO POR</div>
          <div class="sig-line">RECIBIDO CONFORME (CLIENTE)</div>
        </div>
        <script>window.onload=function(){window.print()}</script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-brand-950 uppercase tracking-tighter">Venta Directa</h2>
          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mt-1">Registro de nuevos pedidos con afectación inmediata</p>
        </div>
        <button onClick={() => setView(view === 'LIST' ? 'FORM' : 'LIST')} className="px-8 h-12 bg-brand-900 text-white rounded-xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all">
          {view === 'LIST' ? '+ Nuevo Registro' : 'Volver al Listado'}
        </button>
      </div>

      {view === 'LIST' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
          {orders.map(o => (
            <div key={o.id} className="bg-white p-6 rounded-[2rem] shadow-premium border border-zinc-100 flex flex-col hover:border-brand-100 transition-all group">
              <div className="flex justify-between mb-4">
                <span className="text-[10px] font-black text-zinc-300">#ORD-{o.orderNumber}</span>
                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${o.paymentStatus === PaymentStatus.PAID ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{o.paymentStatus}</span>
              </div>
              <h3 className="text-sm font-black text-zinc-950 uppercase truncate mb-1">{o.clientName}</h3>
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-6">🗓️ {o.executionDate}</p>
              <div className="mt-auto flex gap-2">
                <button onClick={() => handlePrint(o)} className="flex-1 py-2.5 bg-zinc-900 text-white rounded-lg font-black uppercase text-[9px] shadow-md">🖨️ Imprimir</button>
                <button className="w-10 h-10 flex items-center justify-center bg-zinc-50 text-zinc-400 rounded-lg">👁️</button>
              </div>
            </div>
          ))}
          {orders.length === 0 && <div className="col-span-full py-20 text-center opacity-20 font-black uppercase text-xs">Sin pedidos registrados</div>}
        </div>
      ) : (
        <div className="bg-white rounded-[3rem] p-10 shadow-premium border border-zinc-100 animate-slide-up">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Sección Cliente y Datos */}
              <div className="space-y-6">
                <div className="p-8 bg-zinc-50 rounded-[2rem] border border-zinc-100 space-y-4">
                   <h3 className="text-xs font-black text-brand-900 uppercase mb-4 tracking-widest">1. Datos del Cliente</h3>
                   <select className="w-full h-12 bg-white rounded-xl px-4 text-[10px] font-black outline-none border border-zinc-200" value={orderData.clientId} onChange={e => setOrderData({...orderData, clientId: e.target.value})}>
                      <option value="">Seleccionar Cliente</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
                   </select>
                   <div className="grid grid-cols-2 gap-3">
                      <input type="date" className="w-full h-12 bg-white rounded-xl px-4 text-[10px] font-black border border-zinc-200" value={orderData.executionDate} onChange={e => setOrderData({...orderData, executionDate: e.target.value})} />
                      <div className="flex items-center gap-2 bg-white px-4 rounded-xl border border-zinc-200 h-12">
                         <input type="checkbox" checked={orderData.requiresDelivery} onChange={e => setOrderData({...orderData, requiresDelivery: e.target.checked})} />
                         <span className="text-[9px] font-black uppercase">¿Transporte? (C/T)</span>
                      </div>
                   </div>
                   {orderData.requiresDelivery && (
                     <input type="number" placeholder="Costo de Transporte $" className="w-full h-12 bg-white rounded-xl px-4 text-[10px] font-black border border-zinc-200" value={orderData.deliveryCost || ''} onChange={e => setOrderData({...orderData, deliveryCost: parseFloat(e.target.value) || 0})} />
                   )}
                </div>

                <div className="p-8 bg-zinc-950 rounded-[2rem] space-y-4">
                   <h3 className="text-xs font-black text-zinc-400 uppercase mb-4 tracking-widest">2. Selección de Mobiliario</h3>
                   <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                      {inventory.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                           <div>
                             <p className="text-[10px] font-black text-white uppercase">{item.name}</p>
                             <p className="text-[8px] font-bold text-zinc-500 uppercase">Disp: {item.stock}</p>
                           </div>
                           <button onClick={() => {
                             const existing = selectedItems.find(i => i.id === item.id);
                             if (existing) setSelectedItems(selectedItems.map(i => i.id === item.id ? {...i, quantity: i.quantity + 1} : i));
                             else setSelectedItems([...selectedItems, {...item, quantity: 1}]);
                           }} className="w-8 h-8 bg-brand-900 text-white rounded-lg font-black">+</button>
                        </div>
                      ))}
                   </div>
                </div>
              </div>

              {/* Sección Resumen y Pago */}
              <div className="space-y-6">
                 <div className="p-8 bg-white border border-zinc-200 rounded-[2rem] shadow-inner min-h-[400px] flex flex-col">
                    <h3 className="text-xs font-black text-zinc-900 uppercase mb-6 tracking-widest">3. Resumen de Venta</h3>
                    <div className="flex-1 space-y-3 overflow-y-auto max-h-[250px] mb-6">
                       {selectedItems.map(i => (
                         <div key={i.id} className="flex justify-between items-center text-[10px] font-bold">
                            <span className="uppercase text-zinc-400"><span className="text-zinc-900 font-black">{i.quantity}x</span> {i.name}</span>
                            <span>$ {(i.price * i.quantity).toFixed(2)}</span>
                         </div>
                       ))}
                       {selectedItems.length === 0 && <p className="text-center py-10 opacity-30 text-[9px] font-black uppercase">Cesta vacía</p>}
                    </div>
                    
                    <div className="border-t pt-4 space-y-2">
                       <div className="flex justify-between text-[9px] font-black text-zinc-400 uppercase"><span>Subtotal Mobiliario</span><span>$ {selectedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span></div>
                       <div className="flex items-center justify-between gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                             <input type="checkbox" checked={orderData.hasInvoice} onChange={e => setOrderData({...orderData, hasInvoice: e.target.checked})} />
                             <span className="text-[9px] font-black uppercase">Aplicar IVA (15%)</span>
                          </label>
                          {orderData.hasInvoice && <span className="text-[9px] font-black">$ {(selectedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) * 0.15).toFixed(2)}</span>}
                       </div>
                       <div className="pt-4 border-t-2 border-brand-900 flex justify-between items-center">
                          <span className="text-[10px] font-black text-brand-900 uppercase tracking-widest">Total a Pagar</span>
                          <span className="text-2xl font-black text-brand-950">$ {calculateTotal().toFixed(2)}</span>
                       </div>
                    </div>
                 </div>

                 <div className="p-8 bg-emerald-50 rounded-[2rem] border border-emerald-100 space-y-4">
                    <h3 className="text-xs font-black text-emerald-900 uppercase tracking-widest">4. Pago / Abono Inicial</h3>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-emerald-600 uppercase ml-2">Monto Abono</label>
                          <input type="number" className="w-full h-12 bg-white rounded-xl px-4 text-sm font-black text-emerald-950 shadow-sm border-none" value={orderData.paymentAmount || ''} onChange={e => setOrderData({...orderData, paymentAmount: parseFloat(e.target.value) || 0})} />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-emerald-600 uppercase ml-2">Método</label>
                          <select className="w-full h-12 bg-white rounded-xl px-4 text-[10px] font-black shadow-sm border-none" value={orderData.paymentMethod} onChange={e => setOrderData({...orderData, paymentMethod: e.target.value})}>
                             <option value={PaymentMethod.CASH}>Efectivo</option>
                             <option value={PaymentMethod.TRANSFER}>Transferencia</option>
                             <option value={PaymentMethod.DEPOSIT}>Depósito</option>
                             <option value={PaymentMethod.CHECK}>Cheque</option>
                          </select>
                       </div>
                    </div>
                    {(orderData.paymentMethod === PaymentMethod.TRANSFER || orderData.paymentMethod === PaymentMethod.DEPOSIT) && (
                      <select className="w-full h-12 bg-white rounded-xl px-4 text-[10px] font-black shadow-sm border-none" value={orderData.bankName} onChange={e => setOrderData({...orderData, bankName: e.target.value})}>
                        <option value="">-- Banco --</option>
                        <option value="Banco del Austro">Banco del Austro</option>
                        <option value="Banco Guayaquil">Banco Guayaquil</option>
                      </select>
                    )}
                    {orderData.paymentMethod === PaymentMethod.CHECK && (
                      <input type="text" placeholder="Nº Cheque y Banco" className="w-full h-12 bg-white rounded-xl px-4 text-[10px] font-black shadow-sm border-none" value={orderData.checkNumber} onChange={e => setOrderData({...orderData, checkNumber: e.target.value})} />
                    )}
                 </div>

                 <button onClick={handleSave} disabled={loading} className="w-full h-20 bg-brand-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-50">
                    {loading ? 'Procesando Venta...' : 'Finalizar y Guardar Venta'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default EventsView;