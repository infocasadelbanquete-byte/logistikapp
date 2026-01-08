
import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { EventOrder, EventStatus } from '../types';

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
    default: return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  }
};

const Dashboard: React.FC = () => {
  const [events, setEvents] = useState<EventOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = storageService.subscribeToEvents(all => {
      setEvents(all);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const next7Days = new Date();
  next7Days.setDate(today.getDate() + 7);

  // Filtros operativos
  const weeklyOrders = events.filter(e => {
    const d = new Date(e.executionDate);
    return d >= today && d <= next7Days && e.status !== EventStatus.CANCELLED && e.status !== EventStatus.QUOTE;
  });

  // Indicadores Financieros
  const totalPendingCollection = events
    .filter(e => e.status !== EventStatus.CANCELLED && e.status !== EventStatus.QUOTE)
    .reduce((acc, e) => acc + (e.total - e.paidAmount - (e.withheldAmount || 0)), 0);

  let todayCollected = 0;
  events.forEach(e => {
    e.transactions?.forEach(t => {
      if (!t.isVoid && t.date.startsWith(todayStr)) {
        todayCollected += t.amount;
      }
    });
  });

  const totalQuotesValue = events
    .filter(e => e.status === EventStatus.QUOTE)
    .reduce((acc, e) => acc + e.total, 0);

  if (loading) return <div className="animate-pulse flex flex-col gap-4"><div className="h-40 bg-white rounded-3xl"></div></div>;

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Resumen Financiero Rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-zinc-100">
              <span className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em] mb-2 block">Saldo de Cartera</span>
              <div className="text-3xl font-black text-zinc-950 tracking-tighter">$ {totalPendingCollection.toFixed(2)}</div>
              <p className="text-[8px] font-bold text-zinc-400 mt-1 uppercase">Cuentas por cobrar activas</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-zinc-100">
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-2 block">Recaudado Hoy</span>
              <div className="text-3xl font-black text-zinc-950 tracking-tighter">$ {todayCollected.toFixed(2)}</div>
              <p className="text-[8px] font-bold text-zinc-400 mt-1 uppercase">Abonos registrados hoy</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-zinc-100">
              <span className="text-[9px] font-black text-violet-500 uppercase tracking-[0.2em] mb-2 block">Valor en Proformas</span>
              <div className="text-3xl font-black text-zinc-950 tracking-tighter">$ {totalQuotesValue.toFixed(2)}</div>
              <p className="text-[8px] font-bold text-zinc-400 mt-1 uppercase">Presupuestos por confirmar</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-black text-brand-950 uppercase tracking-tighter flex items-center gap-2">
            <span>📅</span> Agenda Operativa
          </h2>
          <div className="bg-white rounded-[2.5rem] shadow-premium border border-zinc-100 overflow-hidden">
            <div className="p-6 border-b border-zinc-50 bg-zinc-50/30 flex justify-between items-center">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Próximos 7 días</span>
              <span className="bg-brand-900 text-white text-[9px] font-black px-3 py-1 rounded-full">{weeklyOrders.length} ACTIVOS</span>
            </div>
            <div className="divide-y divide-zinc-50 max-h-[400px] overflow-y-auto">
              {weeklyOrders.map(e => (
                <div key={e.id} className="p-6 hover:bg-zinc-50 transition-colors flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-zinc-950 uppercase mb-0.5">{e.clientName}</p>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">🗓️ {e.executionDate} • {e.requiresDelivery ? 'DOMICILIO' : 'RETIRO'}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase border ${getStatusStyle(e.status)}`}>
                      {e.status}
                    </span>
                  </div>
                </div>
              ))}
              {weeklyOrders.length === 0 && <div className="p-20 text-center opacity-20 font-black uppercase text-xs">Sin pedidos para esta semana</div>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-6 shadow-sm">
            <h3 className="text-rose-900 text-xs font-black uppercase mb-4 flex items-center gap-2">⚠️ Novedades de Campo</h3>
            <div className="space-y-3">
              {events.filter(e => e.status === EventStatus.PARTIAL_RETURN).map(e => (
                <div key={e.id} className="bg-white/80 p-3 rounded-xl border border-rose-200">
                  <p className="text-[10px] font-black text-rose-950 uppercase">ORD-{e.orderNumber} | {e.clientName}</p>
                  <p className="text-[9px] text-rose-700 font-bold uppercase mt-1">{e.returnNotes || 'Faltantes detectados en el ingreso'}</p>
                </div>
              ))}
              {events.filter(e => e.status === EventStatus.PARTIAL_RETURN).length === 0 && (
                <p className="text-[9px] font-bold text-zinc-400 uppercase text-center py-4">Sin novedades pendientes</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
