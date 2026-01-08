import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService'; 

const DispatchView: React.FC = () => {
  const [allOrders, setAllOrders] = useState<EventOrder[]>([]);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'LOGISTICA' | 'RETIRO' | 'HISTORIAL'>('LOGISTICA');

  useEffect(() => {
    const unsub = storageService.subscribeToEvents((events) => {
        // RESTITUCIÓN: Se incluyen estados equivalentes a Reservado y Entregado
        const relevant = events.filter(e => {
            const s = String(e.status).toUpperCase();
            return s === 'RESERVED' || s === 'RESERVADO' || s === 'CONFIRMADO' || s === 'DELIVERED' || s === 'ENTREGADO' || s === 'DESPACHADO';
        });
        relevant.sort((a, b) => new Date(a.executionDate).getTime() - new Date(b.executionDate).getTime());
        setAllOrders(relevant);
    });
    return () => unsub();
  }, []);

  const confirmDelivery = async (order: EventOrder) => {
      if (!(await uiService.confirm("Confirmar Despacho", "¿Confirma la salida física de este mobiliario de la bodega?"))) return;
      setIsProcessing(order.id);
      try {
          await storageService.saveEvent({ ...order, status: EventStatus.DELIVERED });
          uiService.alert("Éxito", "Despacho registrado correctamente.");
      } catch (error) { uiService.alert("Error", "Fallo al procesar."); } finally { setIsProcessing(null); }
  };

  const displayedOrders = allOrders.filter(o => {
      const s = String(o.status).toUpperCase();
      const isDelivered = s === 'DELIVERED' || s === 'ENTREGADO' || s === 'DESPACHADO';
      if (activeTab === 'HISTORIAL') return isDelivered;
      return !isDelivered && (activeTab === 'LOGISTICA' ? o.requiresDelivery : !o.requiresDelivery);
  });

  return (
    <div className="space-y-6 animate-fade-in p-2 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-2xl font-black text-brand-900 uppercase tracking-tighter">Gestión de Salidas</h2>
            <div className="flex bg-white p-1 rounded-2xl shadow-soft border border-zinc-100 w-full md:w-auto">
                {['LOGISTICA', 'RETIRO', 'HISTORIAL'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === tab ? 'bg-brand-900 text-white shadow-md' : 'text-zinc-400'}`}>{tab}</button>
                ))}
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
            {displayedOrders.map(order => {
                const s = String(order.status).toUpperCase();
                const isDelivered = s === 'DELIVERED' || s === 'ENTREGADO' || s === 'DESPACHADO';

                return (
                    <div key={order.id} className="bg-white rounded-[2rem] shadow-soft border border-zinc-100 flex flex-col p-6 group">
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-mono font-black text-zinc-300 text-[9px]">#ORD-{order.orderNumber}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase ${isDelivered ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>{isDelivered ? 'En Campo' : 'Por Salir'}</span>
                        </div>
                        <h3 className="text-xs font-black text-zinc-950 truncate uppercase mb-1">{order.clientName}</h3>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase mb-4">🗓️ {order.executionDate}</p>
                        <div className="bg-zinc-50 p-3 rounded-xl mb-6">
                            <p className="text-[8px] font-black text-zinc-400 uppercase mb-1">Destino:</p>
                            <p className="text-[9px] font-bold text-zinc-800 uppercase leading-tight">{order.deliveryAddress || 'Retiro en Local'}</p>
                        </div>
                        <div className="mt-auto">
                            {!isDelivered ? (
                                <button onClick={() => confirmDelivery(order)} disabled={isProcessing === order.id} className="w-full py-3 bg-brand-900 text-white rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all">
                                    {isProcessing === order.id ? '...' : 'Registrar Salida'}
                                </button>
                            ) : (
                                <div className="text-center p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest italic">Mobiliario Despachado</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            {displayedOrders.length === 0 && <div className="col-span-full py-20 text-center opacity-20 uppercase font-black text-xs">Sin registros que procesar</div>}
        </div>
    </div>
  );
};

export default DispatchView;