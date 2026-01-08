import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { EventOrder, EventStatus } from '../types';

const Dashboard: React.FC = () => {
  const [events, setEvents] = useState<EventOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const unsub = storageService.subscribeToEvents(all => {
      setEvents(all);
      setLoading(false);
    });

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      unsub();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  const today = new Date();
  const next7Days = new Date();
  next7Days.setDate(today.getDate() + 7);

  const weeklyOrders = events.filter(e => {
    const d = new Date(e.executionDate);
    return d >= today && d <= next7Days && e.status !== EventStatus.CANCELLED;
  });

  const alerts = events.filter(e => e.status === EventStatus.PARTIAL_RETURN);
  const pendingPayments = events.filter(e => e.total - e.paidAmount - (e.withheldAmount || 0) > 1);

  if (loading) return <div className="animate-pulse flex flex-col gap-4"><div className="h-40 bg-white rounded-3xl"></div></div>;

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {installPrompt && (
        <div className="bg-gradient-to-r from-brand-900 to-brand-700 p-6 rounded-3xl shadow-premium flex flex-col md:flex-row justify-between items-center gap-4 border border-brand-800 animate-slide-up">
           <div className="flex items-center gap-4 text-center md:text-left">
              <span className="text-4xl">📱</span>
              <div>
                 <h3 className="text-white font-black uppercase text-sm tracking-widest">Instalar App Nativa</h3>
                 <p className="text-brand-100 text-[10px] font-medium">Accede más rápido y trabaja sin conexión desde tu escritorio o móvil.</p>
              </div>
           </div>
           <button onClick={handleInstallClick} className="px-8 py-3 bg-white text-brand-900 rounded-xl font-black uppercase text-[10px] shadow-2xl active:scale-95 transition-all">Instalar Ahora</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tablero Operativo Semanal */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-black text-brand-950 uppercase tracking-tighter flex items-center gap-2">
            <span>📅</span> Hoja de Ruta Semanal
          </h2>
          <div className="bg-white rounded-[2.5rem] shadow-premium border border-zinc-100 overflow-hidden">
            <div className="p-6 border-b border-zinc-50 bg-zinc-50/30 flex justify-between items-center">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Próximos 7 días</span>
              <span className="bg-brand-900 text-white text-[9px] font-black px-3 py-1 rounded-full">{weeklyOrders.length} PEDIDOS</span>
            </div>
            <div className="divide-y divide-zinc-50 max-h-[400px] overflow-y-auto scrollbar-hide">
              {weeklyOrders.map(e => (
                <div key={e.id} className="p-6 hover:bg-zinc-50 transition-colors flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-zinc-950 uppercase mb-0.5">{e.clientName}</p>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">🗓️ {e.executionDate} • {e.requiresDelivery ? 'C/T' : 'S/T'}</p>
                    {e.warehouseExitNumber && <span className="text-[8px] font-black text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded uppercase">EB N°: {e.warehouseExitNumber}</span>}
                  </div>
                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase ${
                      e.status === EventStatus.CONFIRMED ? 'bg-amber-100 text-amber-700' :
                      e.status === EventStatus.DISPATCHED ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {e.status}
                    </span>
                  </div>
                </div>
              ))}
              {weeklyOrders.length === 0 && <div className="p-20 text-center opacity-20 font-black uppercase text-xs">Sin pedidos para esta semana</div>}
            </div>
          </div>
        </div>

        {/* Alertas y Cartera */}
        <div className="space-y-6">
          <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-6 shadow-sm">
            <h3 className="text-rose-900 text-xs font-black uppercase mb-4 flex items-center gap-2">
              <span>⚠️</span> Alertas de Novedades
            </h3>
            <div className="space-y-3">
              {alerts.map(e => (
                <div key={e.id} className="bg-white/80 p-3 rounded-xl border border-rose-200">
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] font-black text-rose-950 uppercase mb-1">#ORD-{e.orderNumber}</p>
                    {e.warehouseExitNumber && <span className="text-[7px] font-black text-zinc-400">EB:{e.warehouseExitNumber}</span>}
                  </div>
                  <p className="text-[9px] text-rose-700 font-bold uppercase">{e.returnNotes || 'Sin descripción de novedad'}</p>
                </div>
              ))}
              {alerts.length === 0 && <p className="text-[9px] font-bold text-rose-300 uppercase text-center py-4">Sin novedades pendientes</p>}
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-[2rem] p-6 shadow-sm">
            <h3 className="text-emerald-900 text-xs font-black uppercase mb-4 flex items-center gap-2">
              <span>💰</span> Cartera Crítica
            </h3>
            <div className="space-y-3">
              {pendingPayments.slice(0, 3).map(e => (
                <div key={e.id} className="bg-white/80 p-3 rounded-xl border border-emerald-200 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-emerald-950 uppercase">{e.clientName}</p>
                    <p className="text-[8px] text-emerald-500 font-black">SALDO: $ {(e.total - e.paidAmount - (e.withheldAmount || 0)).toFixed(2)}</p>
                  </div>
                  <span className="text-xs">💸</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;