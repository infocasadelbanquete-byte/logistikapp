import React, { useEffect, useState } from 'react';
import { storageService } from '../services/storageService';
import { EventOrder, InventoryItem, UserRole, EventStatus } from '../types';

const Dashboard: React.FC = () => {
  const [events, setEvents] = useState<EventOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [reportPeriod, setReportPeriod] = useState<'WEEK' | 'MONTH'>('WEEK');

  useEffect(() => {
    const session = storageService.getCurrentSession();
    setCurrentUser(session);
    const unsubEvents = storageService.subscribeToEvents(setEvents);
    const unsubInventory = storageService.subscribeToInventory(setInventory);
    return () => { unsubEvents(); unsubInventory(); };
  }, []);

  const getFilteredEvents = () => {
    const now = new Date();
    const start = new Date(now);
    if (reportPeriod === 'WEEK') start.setDate(now.getDate() - 7);
    else start.setMonth(now.getMonth() - 1);
    
    return events.filter(e => {
        const evDate = new Date(e.executionDate + 'T12:00:00');
        const s = String(e.status).toUpperCase();
        return evDate >= start && s !== 'QUOTE' && s !== 'PROFORMA';
    });
  };

  const filteredReport = getFilteredEvents();
  const issuesCount = filteredReport.filter(e => String(e.status).toUpperCase() === 'WITH_ISSUES' || String(e.status).toUpperCase() === 'NOVEDADES').length;
  const isPrivileged = currentUser?.role === UserRole.SUPER_ADMIN;

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tighter uppercase leading-none">Panel Logístico</h1>
          <p className="text-zinc-400 font-bold mt-1.5 uppercase tracking-[0.3em] text-[8px]">Bienvenido, {currentUser?.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-zinc-100">
              <p className="text-[8px] font-black text-zinc-400 uppercase mb-2 tracking-widest">Catálogo Activo</p>
              <p className="text-3xl font-black text-zinc-950 leading-none">{inventory.length}</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-zinc-100">
              <p className="text-[8px] font-black text-zinc-400 uppercase mb-2 tracking-widest">Pedidos {reportPeriod === 'WEEK' ? 'Semanales' : 'Mensuales'}</p>
              <p className="text-3xl font-black text-brand-900 leading-none">{filteredReport.length}</p>
          </div>
          <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100">
              <p className="text-[8px] font-black text-rose-400 uppercase mb-2 tracking-widest">Pendientes Novedad</p>
              <p className="text-3xl font-black text-rose-600 leading-none">{issuesCount}</p>
          </div>
          <div className="bg-zinc-950 p-6 rounded-[2rem] text-white">
              <p className="text-[8px] font-black text-zinc-500 uppercase mb-2 tracking-widest">Sincronización</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <p className="text-xs font-black uppercase">Activa</p>
              </div>
          </div>
      </div>

      <div className="bg-white rounded-[2.5rem] p-6 md:p-10 shadow-premium border border-zinc-100">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
              <h3 className="text-[10px] font-black text-brand-900 uppercase tracking-widest">Actividad de Pedidos y Novedades</h3>
              <div className="flex bg-zinc-100 p-1 rounded-xl gap-1 w-full sm:w-auto">
                  <button onClick={() => setReportPeriod('WEEK')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${reportPeriod === 'WEEK' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400'}`}>Semana</button>
                  <button onClick={() => setReportPeriod('MONTH')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${reportPeriod === 'MONTH' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400'}`}>Mes</button>
              </div>
          </div>
          <div className="overflow-x-auto no-scrollbar -mx-6 sm:mx-0">
              <table className="w-full text-left min-w-[500px]">
                  <thead>
                      <tr className="text-[9px] font-black text-zinc-400 uppercase border-b border-zinc-50 pb-4">
                          <th className="px-6 pb-4">Orden</th>
                          <th className="px-6 pb-4">Cliente</th>
                          <th className="px-6 pb-4">Fecha</th>
                          {isPrivileged && <th className="px-6 pb-4 text-right">Total</th>}
                          <th className="px-6 pb-4 text-center">Estado</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                      {filteredReport.slice(0, 10).map(e => (
                          <tr key={e.id} className="hover:bg-zinc-50 transition-colors">
                              <td className="px-6 py-4 font-mono font-black text-[9px] text-zinc-400">#ORD-{e.orderNumber}</td>
                              <td className="px-6 py-4 text-[10px] font-black text-zinc-800 uppercase truncate max-w-[150px]">{e.clientName}</td>
                              <td className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase">{e.executionDate}</td>
                              {isPrivileged && <td className="px-6 py-4 text-[10px] font-black text-zinc-900 text-right">$ {e.total.toFixed(2)}</td>}
                              <td className="px-6 py-4 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase ${String(e.status).toUpperCase() === 'WITH_ISSUES' || String(e.status).toUpperCase() === 'NOVEDADES' ? 'bg-rose-100 text-rose-600' : 'bg-zinc-100 text-zinc-500'}`}>
                                      {e.status}
                                  </span>
                              </td>
                          </tr>
                      ))}
                      {filteredReport.length === 0 && <tr><td colSpan={isPrivileged ? 5 : 4} className="py-10 text-center opacity-20 uppercase font-black text-xs">Sin actividad reciente</td></tr>}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;