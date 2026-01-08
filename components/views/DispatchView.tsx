import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, PaymentMethod } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';

const DispatchView: React.FC = () => {
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'LOGISTICA' | 'RETIROS' | 'ARCHIVO'>('LOGISTICA');
  const [selectedOrder, setSelectedOrder] = useState<EventOrder | null>(null);
  const [novedades, setNovedades] = useState('');
  const [montoCobro, setMontoCobro] = useState('');

  useEffect(() => {
    const unsub = storageService.subscribeToEvents(setOrders);
    return () => unsub();
  }, []);

  const today = new Date().toISOString().split('T')[0];

  // Lógica de filtrado solicitada
  const toDispatch = orders.filter(o => 
    (o.status === EventStatus.CONFIRMED || o.status === EventStatus.DISPATCHED) && o.executionDate >= today
  );
  
  const toPickup = orders.filter(o => 
    (o.status === EventStatus.DELIVERED || o.status === EventStatus.DISPATCHED || o.status === EventStatus.PARTIAL_RETURN) && o.executionDate <= today
  );

  const archived = orders.filter(o => o.status === EventStatus.FINISHED);

  const displayed = (activeTab === 'LOGISTICA' ? toDispatch : activeTab === 'RETIROS' ? toPickup : archived)
    .filter(o => o.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || String(o.orderNumber).includes(searchQuery));

  const handleUpdateStatus = async (o: EventOrder, s: EventStatus) => {
      await storageService.saveEvent({ ...o, status: s });
      uiService.alert("Actualizado", `Estado de pedido #${o.orderNumber} actualizado a ${s}.`);
  };

  const handleProcessIngreso = async (o: EventOrder, hasIssues: boolean) => {
      if (!hasIssues) {
          // Si no hay novedades, archiva automáticamente
          await storageService.saveEvent({ ...o, status: EventStatus.FINISHED });
          uiService.alert("Finalizado", "Pedido recibido conforme. Se ha archivado en el repositorio.");
      } else {
          // Si hay novedades, pasa a retiro parcial
          await storageService.saveEvent({ ...o, status: EventStatus.PARTIAL_RETURN, returnNotes: novedades });
          uiService.alert("Novedades", "Pedido registrado con novedades. Queda pendiente en Retiro Parcial.");
      }
      setSelectedOrder(null);
      setNovedades('');
  };

  const handleCobroExpress = async (o: EventOrder) => {
      const monto = parseFloat(montoCobro);
      if (isNaN(monto) || monto <= 0) return;
      const nuevoPagado = o.paidAmount + monto;
      await storageService.saveEvent({ ...o, paidAmount: nuevoPagado });
      setMontoCobro('');
      uiService.alert("Cobro", "Pago parcial registrado satisfactoriamente.");
  };

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-2xl font-black text-brand-900 uppercase">Logística y Despachos</h2>
            <div className="flex bg-zinc-100 p-1 rounded-2xl">
                {['LOGISTICA', 'RETIROS', 'ARCHIVO'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === tab ? 'bg-white text-brand-900 shadow-md' : 'text-zinc-400'}`}>{tab}</button>
                ))}
            </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-soft border border-zinc-100">
            <div className="relative">
                <input className="w-full bg-zinc-50 border-none p-3 pl-12 rounded-xl text-xs font-bold outline-none" placeholder="Buscar en logística..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
            {displayed.map(o => (
                <div key={o.id} className="bg-white p-6 rounded-[2rem] shadow-soft border-t-8 border-brand-900 flex flex-col h-full">
                    <div className="flex justify-between mb-4">
                        <span className="text-[10px] font-black text-zinc-300">#ORD-{o.orderNumber}</span>
                        <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${o.status === EventStatus.CONFIRMED ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>{o.status}</span>
                    </div>
                    <h3 className="text-xs font-black text-zinc-950 uppercase mb-1">{o.clientName}</h3>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase mb-4">🗓️ {o.executionDate}</p>
                    
                    <div className="bg-zinc-50 p-3 rounded-xl mb-4 text-[9px] font-black uppercase">
                        <div className="flex justify-between"><span>Saldo:</span> <span className="text-rose-600 font-black">$ {(o.total - o.paidAmount).toFixed(2)}</span></div>
                    </div>

                    <div className="mt-auto space-y-2">
                        {activeTab === 'LOGISTICA' && (
                            <div className="flex gap-2">
                                <button onClick={() => handleUpdateStatus(o, EventStatus.DISPATCHED)} className="flex-1 py-3 bg-zinc-900 text-white rounded-lg text-[8px] font-black uppercase shadow-md active:scale-95 transition-transform">Despachar</button>
                                <button onClick={() => handleUpdateStatus(o, EventStatus.DELIVERED)} className="flex-1 py-3 bg-emerald-600 text-white rounded-lg text-[8px] font-black uppercase shadow-md active:scale-95 transition-transform">Entregar</button>
                            </div>
                        )}
                        {activeTab === 'RETIROS' && (
                            <button onClick={() => setSelectedOrder(o)} className="w-full py-4 bg-brand-900 text-white rounded-xl text-[9px] font-black uppercase shadow-premium active:scale-95 transition-transform">Procesar Ingreso</button>
                        )}
                        {activeTab !== 'ARCHIVO' && (
                            <div className="flex gap-2 border-t pt-3 mt-1">
                                <input type="number" placeholder="$" className="w-16 h-8 bg-zinc-100 rounded px-2 text-xs font-black" value={montoCobro} onChange={e=>setMontoCobro(e.target.value)} />
                                <button onClick={() => handleCobroExpress(o)} className="flex-1 h-8 bg-zinc-50 text-zinc-400 rounded text-[7px] font-black uppercase border border-zinc-100">Cobrar Saldo</button>
                            </div>
                        )}
                    </div>
                </div>
            ))}
            {displayed.length === 0 && <div className="col-span-full py-20 text-center opacity-20 uppercase font-black text-xs">Sin registros activos en esta sección</div>}
        </div>

        {selectedOrder && (
            <div className="fixed inset-0 bg-zinc-950/50 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
                <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-premium animate-slide-up">
                    <h3 className="text-xl font-black text-brand-950 uppercase mb-4 tracking-tighter">Control de Retiro</h3>
                    <div className="space-y-4">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase leading-relaxed">¿El mobiliario presenta daños, pérdidas o requiere limpieza especial?</p>
                        <textarea className="w-full h-28 bg-zinc-50 rounded-2xl p-4 text-xs font-bold outline-none border border-zinc-100 focus:ring-4 focus:ring-brand-50" placeholder="Detalle novedades aquí..." value={novedades} onChange={e=>setNovedades(e.target.value)} />
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button onClick={() => handleProcessIngreso(selectedOrder, false)} className="py-4 bg-emerald-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg">Todo Conforme</button>
                            <button onClick={() => handleProcessIngreso(selectedOrder, true)} className="py-4 bg-rose-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg">Con Novedades</button>
                        </div>
                        <button onClick={() => setSelectedOrder(null)} className="w-full py-2 text-zinc-300 font-black uppercase text-[8px]">Cancelar</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default DispatchView;