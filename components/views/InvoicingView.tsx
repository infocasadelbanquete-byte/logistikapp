
import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';

const InvoicingView: React.FC = () => {
  const [allInvoiceableOrders, setAllInvoiceableOrders] = useState<EventOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'REGISTRY'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<EventOrder | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsub = storageService.subscribeToEvents((all) => {
        const invoiceable = all.filter(e => e.hasInvoice && e.status !== EventStatus.QUOTE && e.status !== EventStatus.CANCELLED);
        setAllInvoiceableOrders(invoiceable);
    });
    return () => unsub();
  }, []);

  const handleOpenInvoicing = (order: EventOrder) => {
    setSelectedOrder(order);
    setInvoiceNumber(order.invoiceNumber || '');
  };

  const handleMarkAsInvoiced = async () => {
    if (!selectedOrder || !invoiceNumber.trim()) {
        uiService.alert("Dato Requerido", "Ingrese el número de factura para confirmar.");
        return;
    }

    setIsProcessing(true);
    try {
        const updated: EventOrder = {
            ...selectedOrder,
            invoiceGenerated: true,
            invoiceNumber: invoiceNumber.trim()
        };
        await storageService.saveEvent(updated);
        await uiService.alert("Éxito", `Información actualizada para el pedido #${selectedOrder.orderNumber}.`);
        setSelectedOrder(null);
    } catch (e) {
        uiService.alert("Error", "No se pudo actualizar el registro.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleRemoveInvoiceRegistry = async (order: EventOrder) => {
      if (await uiService.confirm("Remover del Registro", "¿Desea quitar los datos de facturación de este pedido? El pedido volverá a la lista de pendientes.")) {
          const updated: EventOrder = {
              ...order,
              invoiceGenerated: false,
              invoiceNumber: ''
          };
          await storageService.saveEvent(updated);
          uiService.alert("Removido", "Registro de facturación eliminado.");
      }
  };

  const filtered = allInvoiceableOrders.filter(o => {
    const matchesSearch = o.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || String(o.orderNumber).includes(searchQuery);
    if (activeTab === 'PENDING') return matchesSearch && !o.invoiceGenerated;
    return matchesSearch; 
  });

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h2 className="text-2xl font-black text-brand-900 tracking-tighter uppercase">Facturación y Tributación</h2>
                <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mt-1">Gestión exclusiva de pedidos facturables</p>
            </div>
            <div className="flex bg-zinc-100 p-1 rounded-2xl shadow-inner">
                <button onClick={() => setActiveTab('PENDING')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'PENDING' ? 'bg-white text-brand-900 shadow-md scale-105' : 'text-zinc-400'}`}>Por Facturar</button>
                <button onClick={() => setActiveTab('REGISTRY')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'REGISTRY' ? 'bg-white text-brand-900 shadow-md scale-105' : 'text-zinc-400'}`}>Registro Único</button>
            </div>
        </div>

        <div className="bg-white p-4 rounded-[1.5rem] shadow-premium border border-zinc-100">
            <div className="relative">
                <input 
                    className="w-full bg-zinc-50 border-none p-3 pl-12 rounded-xl text-sm font-bold shadow-inner outline-none focus:ring-4 focus:ring-brand-50" 
                    placeholder="Buscar en facturables..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 grayscale opacity-30 text-sm">🔍</span>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(order => (
                <div key={order.id} className={`bg-white rounded-[1.5rem] p-5 shadow-soft border-t-4 flex flex-col group ${order.invoiceGenerated ? 'border-emerald-500' : 'border-amber-500'}`}>
                    <div className="flex justify-between items-start mb-4">
                        <span className="font-mono font-black text-zinc-300 text-[8px] bg-zinc-50 px-2 py-1 rounded">#ORD-${order.orderNumber}</span>
                        <div className="flex gap-2">
                             {order.invoiceGenerated && (
                                 <button onClick={() => handleRemoveInvoiceRegistry(order)} className="text-rose-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all">🗑️</button>
                             )}
                             <span className={`text-[7px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full ${order.invoiceGenerated ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                {order.invoiceGenerated ? 'FACTURADO' : 'PENDIENTE'}
                             </span>
                        </div>
                    </div>
                    <h3 className="text-sm font-black text-zinc-950 uppercase truncate mb-1">{order.clientName}</h3>
                    <div className="bg-zinc-50 p-3 rounded-xl mb-4 mt-auto space-y-1">
                        <div className="flex justify-between text-[8px] font-black text-zinc-400 uppercase">
                            <span>Monto Total</span>
                            <span className="text-zinc-900">$ {order.total.toFixed(2)}</span>
                        </div>
                        {order.invoiceGenerated && (
                            <div className="flex justify-between text-[8px] font-black text-emerald-600 uppercase pt-1 border-t border-emerald-100">
                                <span>Factura Nº</span>
                                <span>{order.invoiceNumber}</span>
                            </div>
                        )}
                    </div>
                    <button onClick={() => handleOpenInvoicing(order)} className={`w-full py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md transition-all ${order.invoiceGenerated ? 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200' : 'bg-brand-900 text-white hover:bg-black'}`}>
                        {order.invoiceGenerated ? '✏️ Editar Factura' : '📄 Registrar Factura'}
                    </button>
                </div>
            ))}
        </div>

        {selectedOrder && (
            <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
                <div className="bg-white rounded-[2.5rem] shadow-premium p-8 w-full max-w-sm border border-white animate-slide-up">
                    <h3 className="text-lg font-black text-brand-950 uppercase mb-2">Dato de Facturación</h3>
                    <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-6">Pedido #{selectedOrder.orderNumber} - {selectedOrder.clientName}</p>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-2 mb-1 block">Número de Factura Realizada</label>
                            <input 
                                autoFocus
                                type="text" 
                                className="w-full h-14 bg-zinc-50 border-none rounded-2xl px-6 text-xl font-black text-zinc-950 focus:ring-8 focus:ring-brand-50 outline-none shadow-inner"
                                placeholder="001-001-..."
                                value={invoiceNumber}
                                onChange={e => setInvoiceNumber(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2 pt-4">
                            <button onClick={handleMarkAsInvoiced} disabled={isProcessing} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg">
                                {isProcessing ? 'Sincronizando...' : '💾 Sellar Datos'}
                            </button>
                            <button onClick={() => setSelectedOrder(null)} className="w-full py-2 text-zinc-300 font-bold uppercase text-[8px]">Cancelar</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default InvoicingView;
