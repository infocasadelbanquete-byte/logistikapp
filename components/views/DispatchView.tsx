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
        // VISIBILIDAD: Filtrar por estados operativos o legacy
        const relevant = events.filter(e => e.status === EventStatus.RESERVED || e.status === EventStatus.DELIVERED || (e.status as any) === 'RESERVED' || (e.status as any) === 'DELIVERED');
        relevant.sort((a, b) => new Date(a.executionDate).getTime() - new Date(b.executionDate).getTime());
        setAllOrders(relevant);
    });
    storageService.subscribeToInventory(setInventory);
    storageService.subscribeToClients(setClients);
    storageService.subscribeToSettings(setSettings);
    return () => {};
  }, []);

  const getStatusLabel = (status: EventStatus) => {
      if (status === EventStatus.DELIVERED) return { label: 'Entregado', color: 'bg-green-100 text-green-700' };
      return { label: 'Por Despachar', color: 'bg-blue-100 text-blue-700' };
  };

  const confirmDelivery = async (order: EventOrder) => {
      if (!(await uiService.confirm("Confirmar Salida", "¿Confirma el despacho físico del mobiliario?"))) return;
      setIsProcessing(order.id);
      try {
          await storageService.saveEvent({ ...order, status: EventStatus.DELIVERED });
          uiService.alert("Éxito", "Despacho registrado.");
      } catch (error) { uiService.alert("Error", "Fallo al procesar."); } finally { setIsProcessing(null); }
  };

  const displayedOrders = allOrders.filter(o => {
      const isDelivered = o.status === EventStatus.DELIVERED;
      if (activeTab === 'HISTORY') return isDelivered;
      return !isDelivered && (activeTab === 'TRANSPORT' ? o.requiresDelivery : !o.requiresDelivery);
  });

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-zinc-950 uppercase tracking-tighter">Gestión de Despachos</h2>
            <div className="flex bg-zinc-100 p-1 rounded-2xl">
                <button onClick={() => setActiveTab('TRANSPORT')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase ${activeTab === 'TRANSPORT' ? 'bg-white text-brand-600 shadow-md' : 'text-zinc-400'}`}>🚛 Logística</button>
                <button onClick={() => setActiveTab('PICKUP')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase ${activeTab === 'PICKUP' ? 'bg-white text-zinc-900 shadow-md' : 'text-zinc-400'}`}>🏪 Retiro</button>
                <button onClick={() => setActiveTab('HISTORY')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase ${activeTab === 'HISTORY' ? 'bg-white text-green-700 shadow-md' : 'text-zinc-400'}`}>📜 Historial</button>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedOrders.map(order => {
                const status = getStatusLabel(order.status);
                return (
                    <div key={order.id} className="bg-white rounded-[1.5rem] shadow-soft border border-zinc-100 flex flex-col p-4 group">
                        <div className="flex justify-between items-center mb-3">
                            <span className="font-mono font-black text-zinc-400 text-[8px]">#ORD-${order.orderNumber}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase ${status.color}`}>{status.label}</span>
                        </div>
                        <h3 className="text-sm font-extrabold text-zinc-950 truncate uppercase mb-4">{order.clientName}</h3>
                        <div className="mt-auto flex gap-2">
                            {order.status !== EventStatus.DELIVERED && (
                                <button onClick={() => confirmDelivery(order)} disabled={isProcessing === order.id} className="w-full py-2 bg-brand-600 text-white rounded-lg text-[8px] font-black uppercase">
                                    {isProcessing === order.id ? '...' : 'Despachar Ahora'}
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default DispatchView;