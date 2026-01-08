
import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, Client, InventoryItem, PaymentMethod } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService'; 

const getStatusStyle = (status: EventStatus) => {
  switch (status) {
    case EventStatus.QUOTE: return 'bg-violet-100 text-violet-700 border-violet-200';
    case EventStatus.CANCELLED: return 'bg-zinc-100 text-zinc-500 border-zinc-200';
    default: return 'bg-zinc-50 text-zinc-400 border-zinc-100';
  }
};

const QuotesView: React.FC = () => {
  const [view, setView] = useState<'LIST' | 'FORM'>('LIST');
  const [quotes, setQuotes] = useState<EventOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<any>({
    clientId: '',
    executionDate: new Date().toISOString().split('T')[0],
    rentalDays: 1,
    hasInvoice: false,
    discountValue: 0,
    discountType: 'VALUE',
    notes: ''
  });

  useEffect(() => {
    storageService.subscribeToEvents(all => setQuotes(all.filter(e => e.status === EventStatus.QUOTE)));
    storageService.subscribeToClients(setClients);
    storageService.subscribeToInventory(setInventory);
  }, []);

  const handleAddItem = (item: InventoryItem) => {
    const exists = selectedItems.find(i => i.id === item.id);
    if (exists) {
      setSelectedItems(selectedItems.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setSelectedItems([...selectedItems, { ...item, quantity: 1, price: item.price }]);
    }
  };

  const handleUpdateQty = (id: string, qty: number) => {
    setSelectedItems(selectedItems.map(i => i.id === id ? { ...i, quantity: Math.max(1, qty) } : i));
  };

  const calculateTotal = () => {
    const itemsSub = selectedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) * (formData.rentalDays || 1);
    const disc = formData.discountType === 'PERCENT' ? (itemsSub * (formData.discountValue / 100)) : (formData.discountValue || 0);
    const iva = formData.hasInvoice ? ((itemsSub - disc) * 0.15) : 0;
    return itemsSub - disc + iva;
  };

  const handleSave = async () => {
    if (!formData.clientId || selectedItems.length === 0) return uiService.alert("Faltan Datos", "Complete cliente y productos.");
    const total = calculateTotal();
    const orderNumber = editingId ? quotes.find(q => q.id === editingId)?.orderNumber || 0 : await storageService.generateOrderNumber();
    
    const quote: EventOrder = {
      ...formData,
      id: editingId || '',
      orderNumber,
      clientName: clients.find(c => c.id === formData.clientId)?.name || 'Cliente',
      status: EventStatus.QUOTE,
      paymentStatus: 'CRÉDITO' as any,
      paidAmount: 0,
      total,
      items: selectedItems.map(i => ({ itemId: i.id, quantity: i.quantity, priceAtBooking: i.price }))
    };

    await storageService.saveEvent(quote);
    uiService.alert("Éxito", "Proforma guardada.");
    resetForm();
  };

  const resetForm = () => {
    setView('LIST');
    setEditingId(null);
    setSelectedItems([]);
    setFormData({ clientId: '', executionDate: new Date().toISOString().split('T')[0], rentalDays: 1, hasInvoice: false, discountValue: 0, discountType: 'VALUE', notes: '' });
  };

  const handleConfirmToOrder = async (q: EventOrder) => {
    const ebNum = await uiService.prompt("Confirmar Pedido", "Ingrese el EB N° (Egreso de Bodega) para pasar esta proforma a Pedidos:");
    if (ebNum && ebNum.trim() !== "") {
      await storageService.saveEvent({ ...q, status: EventStatus.CONFIRMED, warehouseExitNumber: parseInt(ebNum) });
      uiService.alert("Éxito", `Pedido confirmado con EB N° ${ebNum}. Ahora se encuentra en el módulo de Pedidos.`);
    } else {
      uiService.alert("Requerido", "El EB N° es obligatorio para confirmar.");
    }
  };

  const handleCancelQuote = async (q: EventOrder) => {
    if (await uiService.confirm("Anular", "¿Anular esta proforma?")) {
      await storageService.saveEvent({ ...q, status: EventStatus.CANCELLED });
    }
  };

  const filteredQuotes = quotes.filter(q => q.clientName.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredInventory = inventory.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-brand-900 uppercase">Proformas</h2>
          <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest">Cotizaciones y Presupuestos</p>
        </div>
        <button onClick={() => view === 'LIST' ? setView('FORM') : resetForm()} className="px-6 h-10 bg-violet-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg">
          {view === 'LIST' ? '+ Nueva Proforma' : 'Volver'}
        </button>
      </div>

      {view === 'LIST' ? (
        <>
          <div className="bg-white p-4 rounded-2xl shadow-soft border border-zinc-100">
            <input type="text" placeholder="Filtrar por cliente..." className="w-full h-10 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredQuotes.map(q => (
              <div key={q.id} className="bg-white p-4 rounded-xl shadow-soft border border-zinc-100 flex flex-col hover:border-violet-200 transition-all">
                <div className="flex justify-between mb-2">
                  <span className="text-[7px] font-black text-violet-400 bg-violet-50 px-2 py-0.5 rounded">PRO-{q.orderNumber}</span>
                  <span className="text-[9px] font-black">$ {q.total.toFixed(2)}</span>
                </div>
                <h3 className="text-[10px] font-black text-zinc-800 uppercase truncate mb-4">{q.clientName}</h3>
                <div className="mt-auto space-y-2">
                  <button onClick={() => handleConfirmToOrder(q)} className="w-full py-2 bg-emerald-600 text-white rounded-lg text-[8px] font-black uppercase">Confirmar</button>
                  <button onClick={() => handleCancelQuote(q)} className="w-full py-2 bg-zinc-50 text-rose-300 rounded-lg text-[8px] font-black uppercase">Anular</button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-soft border border-zinc-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase px-2">Cliente *</label>
                <select className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={formData.clientId} onChange={e => setFormData({...formData, clientId: e.target.value})}>
                  <option value="">Seleccionar...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase px-2">Fecha Proyectada</label>
                <input type="date" className="w-full h-12 bg-zinc-50 rounded-xl px-4 text-xs font-bold" value={formData.executionDate} onChange={e => setFormData({...formData, executionDate: e.target.value})} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-soft">
              <h3 className="text-[10px] font-black text-zinc-400 uppercase mb-4 px-2">Detalle de Cotización</h3>
              <div className="space-y-2">
                {selectedItems.map(item => (
                  <div key={item.id} className="flex items-center gap-4 bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                    <div className="flex-1">
                      <p className="text-[10px] font-black uppercase text-zinc-950">{item.name}</p>
                      <p className="text-[8px] font-bold text-zinc-400">$ {item.price.toFixed(2)} c/u</p>
                    </div>
                    <input type="number" className="w-16 h-8 bg-white border border-zinc-200 rounded-lg text-center text-xs font-black" value={item.quantity} onChange={e => handleUpdateQty(item.id, parseInt(e.target.value))} />
                    <button onClick={() => setSelectedItems(selectedItems.filter(i => i.id !== item.id))} className="text-rose-300">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-soft space-y-4">
              <input type="text" placeholder="🔍 Buscar catálogo..." className="w-full h-10 bg-zinc-50 rounded-xl px-4 text-[10px] font-bold" value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
              <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                {filteredInventory.map(item => (
                  <button key={item.id} onClick={() => handleAddItem(item)} className="w-full flex justify-between items-center p-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl border border-zinc-100">
                    <span className="text-[9px] font-black uppercase text-zinc-800">{item.name}</span>
                    <span className="text-[9px] font-black text-brand-600">$ {item.price.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-violet-600 text-white p-8 rounded-[2.5rem] shadow-xl space-y-6">
              <div className="flex justify-between items-center text-2xl font-black">
                <span className="text-[10px] uppercase opacity-70">Total Estimado</span>
                <span>$ {calculateTotal().toFixed(2)}</span>
              </div>
              <button onClick={handleSave} className="w-full h-14 bg-white text-violet-600 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">
                Guardar Proforma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotesView;
