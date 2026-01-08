
import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, Client, InventoryItem, PaymentMethod, PaymentStatus } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';
import { COMPANY_LOGO, COMPANY_NAME } from '../../constants';

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
    const unsub = storageService.subscribeToEvents(all => setOrders(all));
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

  const calculateFinancials = () => {
    const subtotal = selectedItems.reduce((acc, i) => acc + (parseFloat(i.price) * i.quantity), 0) * (formData.rentalDays || 1);
    const discount = formData.discountType === 'PERCENT' ? (subtotal * (formData.discountValue / 100)) : (parseFloat(formData.discountValue) || 0);
    const base = subtotal - discount;
    const iva = formData.hasInvoice ? (base * 0.15) : 0;
    const delivery = formData.requiresDelivery ? (parseFloat(formData.deliveryCost) || 0) : 0;
    const total = base + iva + delivery;
    return { subtotal, discount, base, iva, delivery, total };
  };

  const handlePrintOrder = async (order: EventOrder) => {
    const settings = await storageService.getSettings();
    const win = window.open('', '_blank');
    if (!win) {
      await uiService.alert("Navegador Bloqueado", "Por favor permita las ventanas emergentes (pop-ups) para ver el documento.");
      return;
    }

    const itemsRows = order.items.map(oi => {
      const inv = inventory.find(i => i.id === oi.itemId);
      const totalItem = oi.quantity * oi.priceAtBooking * (order.rentalDays || 1);
      return `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; text-transform: uppercase;">${inv?.name || 'Artículo'}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${oi.quantity}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${order.rentalDays || 1}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${oi.priceAtBooking.toFixed(2)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">$${totalItem.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const fin = {
        subtotal: order.items.reduce((acc, i) => acc + (i.priceAtBooking * i.quantity), 0) * (order.rentalDays || 1),
    };

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${order.status === EventStatus.QUOTE ? 'Proforma' : 'Pedido'} #${order.orderNumber}</title>
          <style>
            body { font-family: 'Plus Jakarta Sans', sans-serif; padding: 20px; color: #333; margin: 0; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #4c0519; padding-bottom: 15px; }
            .logo { height: 60px; }
            .title { text-align: right; }
            .title h1 { margin: 0; color: #4c0519; font-size: 20px; text-transform: uppercase; }
            .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f8f8f8; border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
            .totals { margin-top: 20px; width: 300px; margin-left: auto; }
            .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; }
            .grand-total { border-top: 2px solid #4c0519; margin-top: 10px; padding-top: 10px; font-weight: 900; font-size: 16px; color: #4c0519; }
            .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${settings?.logoUrl || COMPANY_LOGO}" class="logo" />
            <div class="title">
              <h1>${order.status === EventStatus.QUOTE ? 'PROFORMA' : 'PEDIDO DE RENTA'}</h1>
              <div style="font-weight: 800; font-size: 14px;"># ${String(order.orderNumber).padStart(5, '0')}</div>
            </div>
          </div>
          <div class="info-section">
            <div>
              <div style="font-weight: 800; text-transform: uppercase; margin-bottom: 5px; color: #4c0519;">Cliente</div>
              <div>${order.clientName}</div>
              <div>Dirección: ${order.deliveryAddress || 'N/A'}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 800; text-transform: uppercase; margin-bottom: 5px; color: #4c0519;">Detalles</div>
              <div>Fecha de Evento: ${order.executionDate}</div>
              <div>Días de Alquiler: ${order.rentalDays || 1}</div>
              ${order.warehouseExitNumber ? `<div>EB N°: ${order.warehouseExitNumber}</div>` : ''}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Descripción del Mobiliario / Servicio</th>
                <th style="text-align: center;">Cant</th>
                <th style="text-align: center;">Días</th>
                <th style="text-align: right;">P. Unit</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
          </table>
          <div class="totals">
            <div class="total-row"><span>Subtotal:</span><span>$ ${fin.subtotal.toFixed(2)}</span></div>
            ${order.deliveryCost ? `<div class="total-row"><span>Transporte:</span><span>$ ${order.deliveryCost.toFixed(2)}</span></div>` : ''}
            <div class="total-row grand-total"><span>TOTAL:</span><span>$ ${order.total.toFixed(2)}</span></div>
          </div>
          <div class="footer">
            Generado por Logistik Pro • ${settings?.name || COMPANY_NAME}<br/>
            Este documento no constituye una factura legal.
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() { window.close(); };
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleSave = async (asQuote: boolean = false) => {
    if (!formData.clientId || selectedItems.length === 0) return uiService.alert("Faltan Datos", "Seleccione cliente e ítems.");
    const { total } = calculateFinancials();
    const orderNumber = editingId ? orders.find(o => o.id === editingId)?.orderNumber || 0 : await storageService.generateOrderNumber();
    
    const order: EventOrder = {
      ...formData,
      id: editingId || '',
      orderNumber,
      clientName: clients.find(c => c.id === formData.clientId)?.name || 'Cliente',
      status: asQuote ? EventStatus.QUOTE : (editingId ? orders.find(o => o.id === editingId)?.status || EventStatus.CONFIRMED : EventStatus.CONFIRMED),
      paymentStatus: formData.paymentAmount >= total ? PaymentStatus.PAID : (formData.paymentAmount > 0 ? PaymentStatus.PARTIAL : PaymentStatus.CREDIT),
      paidAmount: parseFloat(formData.paymentAmount) || 0,
      total,
      items: selectedItems.map(i => ({ itemId: i.id, quantity: i.quantity, priceAtBooking: parseFloat(i.price) }))
    };

    const id = await storageService.saveEvent(order);
    if (await uiService.confirm("Éxito", "¿Desea imprimir el comprobante ahora?")) {
        handlePrintOrder({ ...order, id });
    }
    resetForm();
  };

  const handleSaveExpressClient = async () => {
    if (!expressClientData.name) return uiService.alert("Faltan Datos", "El nombre es obligatorio.");
    const newClient: Client = { id: '', name: expressClientData.name, documentId: expressClientData.documentId, email: '', phone: '', mobilePhone: expressClientData.mobilePhone, address: '' };
    await storageService.saveClient(newClient);
    setIsExpressModalOpen(false);
    setExpressClientData({ name: '', documentId: '', mobilePhone: '' });
    uiService.alert("Éxito", "Cliente registrado.");
  };

  const handleSendToDispatch = async (o: EventOrder) => {
      if (await uiService.confirm("Enviar a Despacho", `¿Autorizar el despacho del pedido #${o.orderNumber}?`)) {
          await storageService.saveEvent({ ...o, status: EventStatus.DISPATCHED });
          uiService.alert("Enviado", "Pedido disponible en Despachos.");
      }
  };

  const handleEdit = (o: EventOrder) => {
    setEditingId(o.id);
    const itemsWithData = o.items.map(oi => {
      const inv = inventory.find(i => i.id === oi.itemId);
      return { ...inv, quantity: oi.quantity, price: oi.priceAtBooking.toString() };
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

  const filteredData = orders.filter(o => {
    const matchesSearch = o.clientName.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === 'QUOTES') return matchesSearch && o.status === EventStatus.QUOTE;
    return matchesSearch && o.status !== EventStatus.QUOTE;
  });

  const fin = calculateFinancials();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-brand-950 uppercase">Gestión Comercial</h2>
          <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest">Ventas y Presupuestos</p>
        </div>
        <div className="flex bg-zinc-100 p-1 rounded-2xl shadow-inner gap-1">
            <button onClick={() => { setActiveTab('ORDERS'); resetForm(); }} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'ORDERS' && view === 'LIST' ? 'bg-white text-brand-900 shadow-md' : 'text-zinc-400'}`}>🛒 Pedidos</button>
            <button onClick={() => { setActiveTab('QUOTES'); resetForm(); }} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'QUOTES' && view === 'LIST' ? 'bg-white text-brand-900 shadow-md' : 'text-zinc-400'}`}>📝 Proformas</button>
            <button onClick={() => setView('FORM')} className="px-6 py-2 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] shadow-lg ml-2">+ Nuevo</button>
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
                <h3 className="text-[10px] font-black text-zinc-950 uppercase truncate leading-tight">{o.clientName}</h3>
                <p className="text-[8px] font-bold text-zinc-400 uppercase">🗓️ {o.executionDate}</p>
                <div className="mt-auto pt-3 flex flex-col gap-1">
                  <button onClick={() => handlePrintOrder(o)} className="w-full py-1.5 bg-zinc-900 text-white rounded-lg text-[8px] font-black uppercase">🖨️ Imprimir</button>
                  {o.status === EventStatus.CONFIRMED && <button onClick={() => handleSendToDispatch(o)} className="w-full py-1.5 bg-brand-900 text-white rounded-lg text-[8px] font-black uppercase">🚚 Despachar</button>}
                  <div className="flex gap-1">
                      <button onClick={() => handleEdit(o)} className="flex-1 py-1.5 bg-zinc-50 text-zinc-600 rounded-lg text-[8px] font-black uppercase">Editar</button>
                      <button onClick={async () => { if(await uiService.confirm("Anular Registro", "¿Está seguro que desea anular este registro?")) storageService.saveEvent({...o, status: EventStatus.CANCELLED}) }} className="flex-1 py-1.5 bg-rose-50 text-rose-300 rounded-lg text-[8px] font-black uppercase">Anular</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-soft grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase px-2">Cliente *</label>
                <div className="flex gap-2">
                    <select className="flex-1 h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={formData.clientId} onChange={e => setFormData({...formData, clientId: e.target.value})}>
                      <option value="">Seleccionar...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
                    </select>
                    <button type="button" onClick={() => setIsExpressModalOpen(true)} className="w-12 h-12 bg-brand-900 text-white rounded-xl flex items-center justify-center font-black text-lg shadow-md">+</button>
                </div>
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
              <div className="flex items-center gap-4 bg-zinc-50 p-3 rounded-xl md:col-span-2">
                 <label className="text-[9px] font-black text-zinc-400 uppercase">¿Transporte?</label>
                 <input type="checkbox" className="w-5 h-5" checked={formData.requiresDelivery} onChange={e => setFormData({...formData, requiresDelivery: e.target.checked})} />
                 {formData.requiresDelivery && <input type="number" placeholder="Costo Envío $" className="flex-1 h-10 bg-white rounded-lg px-4 text-xs font-bold border" value={formData.deliveryCost} onChange={e => setFormData({...formData, deliveryCost: e.target.value})} />}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-soft">
              <h3 className="text-[10px] font-black text-zinc-400 uppercase mb-4 px-2 tracking-widest">Items Seleccionados (Edite el precio si es necesario)</h3>
              <div className="space-y-2">
                {selectedItems.map(item => (
                  <div key={item.id} className="flex items-center gap-4 bg-zinc-50 p-3 rounded-2xl border border-zinc-100 group">
                    <div className="flex-1">
                      <p className="text-[10px] font-black uppercase text-zinc-950">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                          <span className="text-[8px] font-bold text-zinc-400">P. Unit: $</span>
                          <input type="number" step="0.01" className="w-20 h-7 bg-white border border-zinc-200 rounded px-2 text-[9px] font-black" value={item.price} onChange={e => setSelectedItems(selectedItems.map(si => si.id === item.id ? {...si, price: e.target.value} : si))} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="text-[8px] font-black text-zinc-400 uppercase">Cant:</label>
                        <input type="number" className="w-16 h-8 bg-white border border-zinc-200 rounded-lg text-center text-xs font-black" value={item.quantity} onChange={e => setSelectedItems(selectedItems.map(si => si.id === item.id ? {...si, quantity: parseInt(e.target.value)} : si))} />
                    </div>
                    <button onClick={() => setSelectedItems(selectedItems.filter(si => si.id !== item.id))} className="text-rose-300 hover:text-rose-500">✕</button>
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

            <div className="bg-white p-8 rounded-[2.5rem] shadow-premium border border-zinc-100 space-y-4">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-4 text-center">Resumen Financiero</h3>
              <div className="space-y-3 text-[10px] font-bold text-zinc-600 uppercase">
                  <div className="flex justify-between"><span>Subtotal Bruto</span><span>$ {fin.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between items-center gap-4">
                      <span>Descuento Aplicado</span>
                      <div className="flex gap-1 h-8">
                          <input type="number" className="w-16 bg-zinc-50 border rounded px-2" value={formData.discountValue} onChange={e => setFormData({...formData, discountValue: e.target.value})} />
                          <select className="bg-zinc-50 border rounded text-[8px]" value={formData.discountType} onChange={e => setFormData({...formData, discountType: e.target.value})}><option value="VALUE">$</option><option value="PERCENT">%</option></select>
                      </div>
                  </div>
                  <div className="flex justify-between"><span>Transporte</span><span>$ {fin.delivery.toFixed(2)}</span></div>
                  <div className="flex justify-between border-t pt-3 font-black text-brand-900 text-lg">
                      <span>TOTAL A PAGAR</span>
                      <span>$ {fin.total.toFixed(2)}</span>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-4">
                  <button onClick={() => handleSave(true)} className="py-4 bg-zinc-100 text-brand-900 rounded-xl font-black uppercase text-[8px] tracking-widest border border-zinc-200">💾 Guardar Proforma</button>
                  <button onClick={() => handleSave(false)} className="py-4 bg-brand-900 text-white rounded-xl font-black uppercase text-[8px] tracking-widest shadow-lg">🚀 Confirmar Pedido</button>
              </div>
              <button onClick={resetForm} className="w-full py-2 text-zinc-300 font-black uppercase text-[8px]">Cancelar y Salir</button>
            </div>
          </div>
        </div>
      )}

      {isExpressModalOpen && (
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-md flex items-center justify-center p-4 z-[200] animate-fade-in">
              <div className="bg-white rounded-[2rem] shadow-premium p-8 w-full max-w-sm border border-white animate-slide-up">
                  <h3 className="text-lg font-black text-brand-950 uppercase mb-4 border-b pb-3 tracking-tighter">Cliente Express</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="text-[8px] font-black text-zinc-400 uppercase px-2 mb-1 block">Nombre / Razón Social *</label>
                          <input autoFocus type="text" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold outline-none" value={expressClientData.name} onChange={e => setExpressClientData({...expressClientData, name: e.target.value})} />
                      </div>
                      <div className="flex gap-2 pt-4">
                          <button onClick={() => setIsExpressModalOpen(false)} className="flex-1 py-3 text-zinc-300 font-black uppercase text-[9px]">Cancelar</button>
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
