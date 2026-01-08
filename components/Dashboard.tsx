
import React, { useEffect, useState } from 'react';
import { storageService } from '../services/storageService';
import { EventOrder, Client, InventoryItem, UserRole, EventStatus } from '../types';

const Dashboard: React.FC = () => {
  const [events, setEvents] = useState<EventOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [todayStr, setTodayStr] = useState('');
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const now = new Date();
    const local = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    setTodayStr(local);
    
    const session = storageService.getCurrentSession();
    const isSA = session?.role === UserRole.SUPER_ADMIN;
    setIsSuperAdmin(isSA);
    
    const unsubEvents = storageService.subscribeToEvents(setEvents);
    const unsubClients = storageService.subscribeToClients(setClients);
    const unsubInventory = storageService.subscribeToInventory(setInventory);
    
    storageService.clearOldNotifications();
    
    if (isSA) {
        const lastBackup = localStorage.getItem('last_full_backup_timestamp');
        if (!lastBackup) {
            setShowBackupReminder(true);
        } else {
            const diff = Date.now() - parseInt(lastBackup);
            const days = diff / (1000 * 60 * 60 * 24);
            if (days >= 15) setShowBackupReminder(true);
        }
    }

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    return () => { 
      unsubEvents(); 
      unsubClients(); 
      unsubInventory();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDownloadBackup = async () => {
    const data = await storageService.getFullBackup();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    const date = new Date().toISOString().split('T')[0];
    downloadAnchorNode.setAttribute("download", `logistik_respaldo_${date}.json`);
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click(); 
    downloadAnchorNode.remove();
    setShowBackupReminder(false);
  };

  const getWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Lunes
    const start = new Date(now.setDate(diff));
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Domingo
    end.setHours(23,59,59,999);
    return { start, end };
  };

  const { start: weekStart, end: weekEnd } = getWeekRange();
  
  const todaysEvents = events.filter(e => 
    (e.executionDates?.includes(todayStr) || e.executionDate === todayStr) && 
    e.status !== EventStatus.CANCELLED && e.status !== EventStatus.QUOTE
  );

  const upcomingDispatches = events.filter(e => {
    if (e.status !== EventStatus.RESERVED) return false;
    const evDate = new Date(e.executionDate + 'T12:00:00');
    const today = new Date(todayStr + 'T12:00:00');
    const diffTime = evDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 3;
  }).sort((a,b) => a.executionDate.localeCompare(b.executionDate));
  
  const weeklyEvents = events.filter(e => {
    const evDate = new Date(e.executionDate + 'T12:00:00');
    return evDate >= weekStart && evDate <= weekEnd && e.status !== EventStatus.CANCELLED && e.status !== EventStatus.QUOTE;
  }).sort((a,b) => a.executionDate.localeCompare(b.executionDate));

  const alertEvents = events.filter(e => e.status === EventStatus.WITH_ISSUES);
  
  const stats = [
    { label: 'Pedidos Hoy', val: todaysEvents.length, icon: '⚡', color: 'bg-emerald-50/60', border: 'border-emerald-100', text: 'text-emerald-900', visible: true },
    { label: 'Novedades', val: alertEvents.length, icon: '⚠️', color: 'bg-orange-50/60', border: 'border-orange-100', text: 'text-orange-900', visible: true },
    { label: 'Activos', val: inventory.length, icon: '📦', color: 'bg-rose-50/60', border: 'border-rose-100', text: 'text-rose-900', visible: true },
  ];

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tighter uppercase leading-none">Panel de Control</h1>
          <p className="text-zinc-400 font-bold mt-1.5 uppercase tracking-[0.3em] text-[7px] md:text-[8px]">Resumen ejecutivo de operaciones</p>
        </div>
        <div className="flex items-center gap-3">
           {deferredPrompt && (
             <button onClick={handleInstallApp} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-premium flex items-center gap-2 animate-bounce transition-all">
                <span>📲</span> Instalar App
             </button>
           )}
           <div className="bg-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl shadow-soft border border-zinc-100 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-pulse"></div>
              <span className="text-[8px] md:text-[9px] font-black uppercase text-zinc-500 tracking-widest whitespace-nowrap">
                {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
           </div>
        </div>
      </div>
      
      {showBackupReminder && isSuperAdmin && (
        <div className="bg-brand-950 text-white p-5 rounded-2xl shadow-premium border border-brand-800 flex flex-col md:flex-row items-center justify-between gap-4 animate-bounce-up">
            <div className="flex items-center gap-4 text-center md:text-left">
                <div className="w-12 h-12 bg-brand-800 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">🛡️</span>
                </div>
                <div>
                    <h3 className="font-black uppercase text-xs tracking-tight">Seguridad de Datos: Respaldo Quincenal</h3>
                    <p className="text-brand-300 text-[9px] font-bold uppercase tracking-widest leading-relaxed">Han pasado 15 días desde su última copia de seguridad. Proteja su información hoy.</p>
                </div>
            </div>
            <button onClick={handleDownloadBackup} className="bg-white text-brand-950 px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-brand-50 transition-all active:scale-95 whitespace-nowrap">Descargar JSON</button>
        </div>
      )}

      {upcomingDispatches.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in border-l-8 border-l-blue-600">
            <div className="flex items-center gap-3 text-center sm:text-left">
                <span className="text-xl">🚚</span>
                <div>
                    <h3 className="text-blue-950 font-black uppercase text-[10px] tracking-tight">Recordatorio: Despachos Próximos</h3>
                    <p className="text-blue-700 text-[8px] md:text-[9px] font-bold uppercase tracking-tight">Hay {upcomingDispatches.length} reservas programadas para los próximos 3 días. Prepare la logística de salida.</p>
                </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto max-w-full no-scrollbar pb-1 sm:pb-0">
                {upcomingDispatches.slice(0, 3).map(e => (
                    <div key={e.id} className="bg-white/80 px-2 py-0.5 rounded-lg text-[7px] font-black text-blue-600 border border-blue-100 shadow-sm uppercase whitespace-nowrap">ORD-#{e.orderNumber} • {e.executionDate}</div>
                ))}
            </div>
        </div>
      )}

      {alertEvents.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-3 text-center sm:text-left">
                <span className="text-xl">💡</span>
                <div>
                    <h3 className="text-orange-950 font-black uppercase text-[10px] tracking-tight">Atención: Pendientes de Retorno</h3>
                    <p className="text-orange-700 text-[8px] md:text-[9px] font-bold uppercase tracking-tight">Hay {alertEvents.length} procesos con novedades. Gestionar estos retornos asegura la disponibilidad de su stock.</p>
                </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto max-w-full no-scrollbar pb-1 sm:pb-0">
                {alertEvents.slice(0, 3).map(e => (
                    <div key={e.id} className="bg-white/80 px-2 py-0.5 rounded-lg text-[7px] font-black text-orange-600 border border-orange-100 shadow-sm uppercase whitespace-nowrap">#${e.orderNumber}</div>
                ))}
            </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {stats.filter(s => s.visible).map((s, i) => (
          <div key={i} className={`${s.color} ${s.border} p-3 md:p-4 rounded-3xl shadow-sm flex flex-col justify-between h-24 border transition-all hover:scale-[1.02]`}>
            <div className="flex justify-between items-center">
               <span className="text-base md:text-lg grayscale opacity-40">{s.icon}</span>
               <span className={`text-[6px] md:text-[7px] font-black uppercase tracking-[0.2em] ${s.text} opacity-60`}>{s.label}</span>
            </div>
            <div className={`text-base md:text-lg font-black tracking-tight ${s.text} uppercase`}>{s.val}</div>
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/50 rounded-[2.5rem] p-6 md:p-8 shadow-soft border border-zinc-100 min-h-[250px]">
               <h3 className="text-[8px] md:text-[9px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-6 md:mb-8 flex items-center gap-2">
                 <span className="w-2 h-2 bg-brand-800 rounded-full opacity-30"></span>
                 Hoja de Ruta Hoy
               </h3>
               <div className="space-y-4">
                  {todaysEvents.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center opacity-10">
                       <span className="text-4xl mb-4">📅</span>
                       <p className="text-[8px] font-black uppercase tracking-[0.4em]">Sin rutas hoy</p>
                    </div>
                  ) : todaysEvents.map(e => (
                    <div key={e.id} className="p-4 bg-white rounded-2xl border border-zinc-100 flex justify-between items-center shadow-sm hover:border-brand-200 transition-colors">
                      <div className="min-w-0 pr-4">
                        <div className="font-black text-zinc-800 text-[10px] md:text-[11px] uppercase tracking-tight truncate">#{e.orderNumber} • {e.clientName}</div>
                        <p className="text-[8px] md:text-[9px] text-zinc-400 truncate mt-1 font-bold uppercase tracking-tight">
                            {e.requiresDelivery ? (e.deliveryAddress || 'No especificada') : 'Retiro en Bodega'}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 px-3 py-1 rounded-lg text-[7px] md:text-[8px] font-black uppercase border ${e.requiresDelivery ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-zinc-50 text-zinc-400 border-zinc-100'}`}>
                          {e.requiresDelivery ? '🚛' : '🏠'}
                      </span>
                    </div>
                  ))}
               </div>
            </div>

            <div className="bg-zinc-900 rounded-[2.5rem] p-6 md:p-8 shadow-premium text-white">
               <h3 className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-6 md:mb-8 flex items-center gap-2">
                 <span className="w-2 h-2 bg-brand-500 rounded-full"></span>
                 Cronograma de Trabajo Semanal
               </h3>
               <div className="space-y-3">
                  {weeklyEvents.length === 0 ? (
                    <div className="py-12 text-center opacity-20 font-black uppercase text-[8px] tracking-widest">Sin eventos programados esta semana</div>
                  ) : weeklyEvents.map(e => (
                    <div key={e.id} className="flex items-center gap-4 p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group">
                        <div className="flex flex-col items-center justify-center w-12 h-12 bg-white/10 rounded-xl text-center flex-shrink-0">
                           <span className="text-[10px] font-black uppercase leading-none">{new Date(e.executionDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                           <span className="text-[8px] font-bold text-zinc-500">{e.executionDate.split('-')[2]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="text-[10px] font-black uppercase truncate group-hover:text-brand-400 transition-colors">#{e.orderNumber} • {e.clientName}</p>
                           <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter truncate">{e.requiresDelivery ? e.deliveryAddress : 'RETIRO BODEGA'}</p>
                        </div>
                        <span className={`text-[7px] font-black uppercase px-2 py-1 rounded-lg ${e.status === EventStatus.DELIVERED ? 'text-emerald-400 border border-emerald-400/20' : 'text-zinc-400 border border-zinc-700'}`}>
                           {e.status}
                        </span>
                    </div>
                  ))}
               </div>
            </div>
        </div>

        <div className="bg-white/40 rounded-[2.5rem] p-6 md:p-8 shadow-soft border border-zinc-100">
           <h3 className="text-[8px] md:text-[9px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-6 md:mb-8 flex items-center gap-2">
             <span className="w-2 h-2 bg-zinc-300 rounded-full"></span>
             Flujo Reciente
           </h3>
           <div className="space-y-6">
             {events.slice(0, 5).map(e => (
               <div key={e.id} className="flex gap-4 items-start relative pb-6 border-l-2 border-zinc-100 pl-6 last:pb-0 last:border-0">
                 <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-zinc-200 border-2 border-white shadow-sm"></div>
                 <div className="flex-1 min-w-0 -mt-1">
                    <p className="text-[10px] font-black text-zinc-800 uppercase tracking-tight truncate">{e.clientName}</p>
                    <p className="text-[8px] text-zinc-400 mt-1 uppercase font-bold tracking-widest">#{e.orderNumber} • {e.executionDate}</p>
                 </div>
               </div>
             ))}
           </div>
           <button className="w-full mt-10 py-3 text-zinc-400 font-black text-[8px] uppercase tracking-[0.4em] bg-white border border-zinc-100 rounded-xl hover:text-zinc-600 hover:border-zinc-200 transition-all shadow-sm">Ver Auditoría</button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
