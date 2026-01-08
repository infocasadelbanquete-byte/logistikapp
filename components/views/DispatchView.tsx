import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, InventoryItem, Client, CompanySettings } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService'; 

const DispatchView: React.FC = () => {
  const [allOrders, setAllOrders] = useState<EventOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'TRANSPORT' | 'PICKUP' | 'HISTORY'>('TRANSPORT');

  useEffect(() => {
    const unsubEvents = storageService.subscribeToEvents((events) => {
        // RESTITUCIÓN: Se incluyen estados equivalentes a Reservado y Entregado
        const relevant = events.filter(e => {
            const s = String(e.status).toUpperCase();
            return s === 'RESERVED' || s === 'RESERVADO' || s === 'CONFIRMADO' || s === 'DELIVERED' || s === 'ENTREGADO' || s === 'DESPACHADO';
        });
        relevant.sort((a, b) => new Date(a.executionDate).getTime() - new Date(b.executionDate).getTime());
        setAllOrders(relevant);
    });
    storageService.subscribeToInventory(setInventory);
    storageService.subscribeToClients(setClients);
    storageService.subscribeToSettings(setSettings);
    return () => {};
  }, []);

  const getStatusLabel = (status: any) => {
      const s = String(status).toUpperCase();
      if (s === 'DELIVERED' || s === 'ENTREGADO' || s === 'DESPACHADO') return { label: 'Entregado', color: 'bg-green-100 text-green-700' };
      return { label: 'Por Despachar', color: 'bg-blue-100 text-blue-700' };
  };

  const confirmDelivery = async (order: EventOrder) => {
      if (!(await uiService.confirm("Confirmar Salida", "¿Confirma el despacho físico del mobiliario?"))) return;
      setIsProcessing(order.id);
      try {
          await storageService.saveEvent({ ...order, status: EventStatus.DELIVERED });
          uiService.alert("Éxito", "Despacho registrado correctamente.");
      } catch (error) { uiService.alert("Error", "Fallo al procesar."); } finally { setIsProcessing(null); }
  };

  const displayedOrders = allOrders.filter(o => {
      const s = String(o.status).toUpperCase();
      const isDelivered = s === 'DELIVERED' || s === 'ENTREGADO' || s === 'DESPACHADO';
      if (activeTab === 'HISTORY') return isDelivered;
      return !isDelivered && (activeTab === 'TRANSPORT' ? o.requiresDelivery : !o.requiresDelivery);
  });

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-zinc-950 uppercase tracking-tighter">Gestión Logística</h2>
            <div className="flex bg-zinc-100 p-1 rounded-2xl">
                <button onClick={() => setActiveTab('TRANSPORT')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase ${activeTab === 'TRANSPORT' ? 'bg-white text-brand-600 shadow-md' : 'text-zinc-400'}`}>🚛 Logística</button>
                <button onClick={() => setActiveTab('PICKUP')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase ${activeTab === 'PICKUP' ? 'bg-white text-zinc-900 shadow-md' : 'text-zinc-400'}`}>🏪 Retiro</button>
                <button onClick={() => setActiveTab('HISTORY')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase ${activeTab === 'HISTORY' ? 'bg-white text-green-700 shadow-md' : 'text-zinc-400'}`}>📜 Historial</button>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
            {displayedOrders.map(order => {
                const status = getStatusLabel(order.status);
                const s = String(order.status).toUpperCase();
                const isDelivered = s === 'DELIVERED' || s === 'ENTREGADO' || s === 'DESPACHADO';

                return (
                    <div key={order.id} className="bg-white rounded-[1.5rem] shadow-soft border border-zinc-100 flex flex-col p-4 group">
                        <div className="flex justify-between items-center mb-3">
                            <span className="font-mono font-black text-zinc-400 text-[8px]">#ORD-${order.orderNumber}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase ${status.color}`}>{status.label}</span>
                        </div>
                        <h3 className="text-sm font-extrabold text-zinc-950 truncate uppercase mb-4">{order.clientName}</h3>
                        <div className="mt-auto flex gap-2">
                            {!isDelivered && (
                                <button onClick={() => confirmDelivery(order)} disabled={isProcessing === order.id} className="w-full py-2 bg-brand-600 text-white rounded-lg text-[8px] font-black uppercase shadow-md active:scale-95 transition-all">
                                    {isProcessing === order.id ? '...' : 'Registrar Salida'}
                                </button>
                            )}
                            {isDelivered && <span className="text-[7px] font-black text-zinc-300 uppercase italic">Salida: {order.executionDate}</span>}
                        </div>
                    </div>
                );
            })}
            {displayedOrders.length === 0 && <div className="col-span-full py-20 text-center opacity-20 uppercase font-black text-xs">Sin despachos en esta categoría</div>}
        </div>
    </div>
  );
};

export default DispatchView;