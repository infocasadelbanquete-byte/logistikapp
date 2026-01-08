
import React, { useState, useEffect } from 'react';
import { EventOrder, Client, EventStatus, User, PaymentTransaction } from '../../types';
import { storageService } from '../../services/storageService';
import { COMPANY_LOGO, COMPANY_NAME } from '../../constants';

const ReportsView: React.FC = () => {
  const [events, setEvents] = useState<EventOrder[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventOrder[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<PaymentTransaction[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year' | 'all' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    const load = async () => {
        const loadedEvents = await storageService.getEventsOnce();
        const unsubClients = storageService.subscribeToClients(setClients);
        setEvents(loadedEvents);
        setCurrentUser(storageService.getCurrentSession());
        return () => { unsubClients(); };
    };
    load();
  }, []);

  useEffect(() => {
    applyFilters(events, dateRange, searchQuery);
  }, [dateRange, searchQuery, events, customStartDate, customEndDate]);

  const applyFilters = (allEvents: EventOrder[], range: string, query: string) => {
    const now = new Date();
    const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    let resultEvents = allEvents.filter(e => e.status !== EventStatus.QUOTE && e.status !== EventStatus.CANCELLED);

    if (range === 'today') {
        resultEvents = resultEvents.filter(e => e.executionDate === todayStr);
    } else if (range === 'custom' && customStartDate && customEndDate) {
        resultEvents = resultEvents.filter(e => e.executionDate >= customStartDate && e.executionDate <= customEndDate);
    } else if (range !== 'all') {
      const today = new Date();
      today.setHours(0,0,0,0);
      resultEvents = resultEvents.filter(e => {
        const evDate = new Date(e.executionDate + 'T00:00:00');
        let cutoff = new Date();
        if (range === 'week') cutoff.setDate(today.getDate() - 7);
        if (range === 'month') cutoff.setMonth(today.getMonth() - 1);
        if (range === 'year') cutoff.setFullYear(today.getFullYear() - 1);
        return evDate >= cutoff;
      });
    }

    if (query) {
      const q = query.toLowerCase();
      resultEvents = resultEvents.filter(e => e.clientName.toLowerCase().includes(q) || String(e.orderNumber).includes(q));
    }
    setFilteredEvents(resultEvents);

    let allTransactions: PaymentTransaction[] = [];
    allEvents.forEach(e => {
        if (e.transactions) {
            allTransactions = [...allTransactions, ...e.transactions.map(t => ({...t, orderNumber: e.orderNumber, clientName: e.clientName} as any))];
        }
    });

    if (range === 'today') {
        allTransactions = allTransactions.filter(t => t.date.startsWith(todayStr));
    } else if (range === 'custom' && customStartDate && customEndDate) {
        allTransactions = allTransactions.filter(t => t.date.split('T')[0] >= customStartDate && t.date.split('T')[0] <= customEndDate);
    } else if (range !== 'all') {
        allTransactions = allTransactions.filter(t => {
            const tDate = new Date(t.date);
            let cutoff = new Date();
            if (range === 'week') cutoff.setDate(now.getDate() - 7);
            if (range === 'month') cutoff.setMonth(now.getMonth() - 1);
            if (range === 'year') cutoff.setFullYear(now.getFullYear() - 1);
            return tDate >= cutoff;
        });
    }
    setFilteredTransactions(allTransactions);
  };

  const totalSold = filteredEvents.reduce((acc, e) => acc + (Number(e.total) || 0), 0);
  const totalCollected = filteredTransactions.reduce((acc, t) => acc + (t.isVoid ? 0 : Number(t.amount) || 0), 0);
  const pendingToCollect = totalSold - totalCollected;

  const handleGeneratePDF = async () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const setts = await storageService.getSettings();
    const logo = setts?.logoUrl || COMPANY_LOGO;
    const company = setts?.name || COMPANY_NAME;

    const bodyRows = filteredEvents.map(e => `
        <tr>
            <td style="font-family:monospace; font-weight:bold;">#ORD-${String(e.orderNumber).padStart(5, '0')}</td>
            <td>${e.executionDate}</td>
            <td style="text-transform:uppercase;">${e.clientName}</td>
            <td style="text-align:right">$ ${e.total.toFixed(2)}</td>
            <td style="text-align:right; color:#059669; font-weight:bold;">$ ${e.paidAmount.toFixed(2)}</td>
        </tr>`).join('');

    win.document.write(`<!DOCTYPE html><html><head><style>
        @page { size: A4 landscape; margin: 1.2cm; }
        body { font-family: sans-serif; font-size: 10px; color: #18181b; }
        .header { display: flex; justify-content: space-between; border-bottom: 4px solid #4c0519; padding-bottom: 10px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
        .card { background: #f9f9f9; border: 1px solid #ddd; padding: 10px; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #4c0519; color: white; padding: 8px; text-align: left; text-transform: uppercase; }
        td { padding: 8px; border: 1px solid #eee; }
    </style></head><body>
        <div class="header"><img src="${logo}" height="50"/><div><h2>${company}</h2>REPORTE DE VENTAS | ${rangeLabel()}</div></div>
        <div class="summary">
            <div class="card">TOTAL FACTURADO: $ ${totalSold.toFixed(2)}</div>
            <div class="card">RECAUDADO: $ ${totalCollected.toFixed(2)}</div>
            <div class="card">PENDIENTE: $ ${pendingToCollect.toFixed(2)}</div>
        </div>
        <table><thead><tr><th>FOLIO</th><th>FECHA</th><th>CLIENTE</th><th style="text-align:right">MONTO</th><th style="text-align:right">ABONADO</th></tr></thead><tbody>${bodyRows}</tbody></table>
        <script>window.onload=function(){window.print()}</script>
    </body></html>`);
    win.document.close();
  };

  const rangeLabel = () => {
    if (dateRange === 'today') return 'HOY';
    if (dateRange === 'week') return 'ÚLTIMA SEMANA';
    if (dateRange === 'month') return 'ESTE MES';
    if (dateRange === 'year') return 'ESTE AÑO';
    if (dateRange === 'custom') return `${customStartDate} AL ${customEndDate}`;
    return 'HISTÓRICO TOTAL';
  };

  return (
    <div className="space-y-6 flex flex-col animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h2 className="text-4xl font-black text-brand-900 uppercase tracking-tighter">Ventas y Reportes</h2>
          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Filtros dinámicos de rendimiento comercial</p>
        </div>
        <button onClick={handleGeneratePDF} className="h-14 px-8 bg-zinc-950 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-premium active:scale-95 transition-all flex items-center gap-2">🖨️ Imprimir Reporte</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-[2.5rem] shadow-soft border border-zinc-100">
        <div className="space-y-1">
          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-1">Periodo</label>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)} className="w-full h-12 bg-zinc-50 border-none rounded-xl px-4 text-[10px] font-black outline-none focus:ring-4 focus:ring-brand-50 transition-all">
            <option value="today">Hoy</option>
            <option value="week">Últimos 7 días</option>
            <option value="month">Este Mes</option>
            <option value="year">Este Año</option>
            <option value="all">Todo el Historial</option>
            <option value="custom">Rango Personalizado</option>
          </select>
        </div>
        {dateRange === 'custom' && (
            <>
            <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-1">Desde</label>
                <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="w-full h-12 bg-zinc-50 border-none rounded-xl px-4 text-[10px] font-black shadow-inner" />
            </div>
            <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-1">Hasta</label>
                <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="w-full h-12 bg-zinc-50 border-none rounded-xl px-4 text-[10px] font-black shadow-inner" />
            </div>
            </>
        )}
        <div className={`${dateRange === 'custom' ? 'md:col-span-1' : 'md:col-span-3'} space-y-1`}>
          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-1">Buscar Cliente</label>
          <input type="text" placeholder="Nombre..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-12 bg-zinc-50 border-none rounded-xl px-4 text-[10px] font-black shadow-inner" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-zinc-100">
            <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] mb-2 block">Monto Vendido</span>
            <div className="text-2xl font-black text-zinc-950">$ {totalSold.toFixed(2)}</div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-zinc-100">
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-2 block">Recaudado</span>
            <div className="text-2xl font-black text-zinc-950">$ {totalCollected.toFixed(2)}</div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-zinc-100">
            <span className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em] mb-2 block">Saldo de Cartera</span>
            <div className="text-2xl font-black text-zinc-950">$ {pendingToCollect.toFixed(2)}</div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-premium border border-zinc-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                <th className="px-8 py-5">Orden</th>
                <th className="px-8 py-5">Fecha</th>
                <th className="px-8 py-5">Cliente</th>
                <th className="px-8 py-5 text-right">Monto</th>
                <th className="px-8 py-5 text-right">Abonos</th>
                <th className="px-8 py-5 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredEvents.map(e => (
                <tr key={e.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-8 py-4 font-mono text-[10px] font-black text-zinc-400">#ORD-${e.orderNumber}</td>
                  <td className="px-8 py-4 text-[10px] font-bold text-zinc-500 uppercase">{e.executionDate}</td>
                  <td className="px-8 py-4 text-[10px] font-black text-zinc-800 uppercase">{e.clientName}</td>
                  <td className="px-8 py-4 text-[10px] font-black text-zinc-900 text-right">$ {e.total.toFixed(2)}</td>
                  <td className="px-8 py-4 text-[10px] font-black text-emerald-600 text-right">$ {e.paidAmount.toFixed(2)}</td>
                  <td className={`px-8 py-4 text-[11px] font-black text-right ${(e.total - e.paidAmount) > 0.05 ? 'text-rose-600' : 'text-emerald-600'}`}>$ {(e.total - e.paidAmount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredEvents.length === 0 && (
            <div className="py-20 text-center text-zinc-300 font-black uppercase text-[10px] tracking-widest">Sin registros encontrados</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsView;
