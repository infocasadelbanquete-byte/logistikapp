import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';
import { COMPANY_LOGO, COMPANY_NAME } from '../../constants';

const DispatchView: React.FC = () => {
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'CT' | 'ST'>('CT');
  const [search, setSearch] = useState('');

  useEffect(() => {
    storageService.subscribeToEvents(setOrders);
  }, []);

  const filtered = orders.filter(o => 
    (o.status === EventStatus.CONFIRMED || o.status === EventStatus.DISPATCHED) &&
    (activeTab === 'CT' ? o.requiresDelivery : !o.requiresDelivery) &&
    (o.clientName.toLowerCase().includes(search.toLowerCase()) || String(o.orderNumber).includes(search))
  );

  const handleDispatch = async (o: EventOrder) => {
    if (await uiService.confirm("Confirmar Despacho", `¿Desea marcar el pedido #${o.orderNumber} como DESPACHADO?`)) {
      await storageService.saveEvent({ ...o, status: EventStatus.DISPATCHED });
      uiService.alert("Éxito", "Estado actualizado.");
    }
  };

  const handleDeliver = async (o: EventOrder) => {
    await storageService.saveEvent({ ...o, status: EventStatus.DELIVERED });
    uiService.alert("Logística", "Pedido marcado como ENTREGADO.");
  };

  const handlePrintLogisticsReport = async () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const settings = await storageService.getSettings();
    const rows = filtered.map(o => `
      <tr>
        <td style="font-weight:bold; font-family:monospace;">#ORD-${o.orderNumber}<br/><span style="color:#be123c; font-size:8px;">EB: ${o.warehouseExitNumber || '-'}</span></td>
        <td>${o.clientName.toUpperCase()}</td>
        <td>${o.deliveryAddress || 'RETIRO EN LOCAL'}</td>
        <td style="text-align:center;">${o.status}</td>
      </tr>
    `).join('');

    win.document.write(`
      <html><head><style>
        body { font-family: sans-serif; font-size: 10px; padding: 20px; }
        .header { display: flex; justify-content: space-between; border-bottom: 3px solid #4c0519; padding-bottom: 10px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #f3f4f6; text-align: left; padding: 10px; border-bottom: 2px solid #ddd; text-transform: uppercase; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
      </style></head><body>
        <div class="header">
          <img src="${settings?.logoUrl || COMPANY_LOGO}" height="40" />
          <div style="text-align:right">
            <h2 style="margin:0; color:#4c0519;">HOJA DE RUTA LOGÍSTICA</h2>
            <p style="margin:0;">GENERADO: ${new Date().toLocaleString()}</p>
          </div>
        </div>
        <table>
          <thead><tr><th>Orden / EB</th><th>Cliente</th><th>Dirección de Entrega</th><th>Estado</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <script>window.onload=function(){window.print()}</script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-brand-950 uppercase tracking-tighter">Gestión de Logística</h2>
          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mt-1">Control de salidas y entregas</p>
        </div>
        <div className="flex bg-zinc-100 p-1.5 rounded-2xl shadow-inner gap-1">
          <button onClick={() => setActiveTab('CT')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'CT' ? 'bg-white text-brand-900 shadow-md' : 'text-zinc-400'}`}>🚚 Con Transporte</button>
          <button onClick={() => setActiveTab('ST')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'ST' ? 'bg-white text-brand-900 shadow-md' : 'text-zinc-400'}`}>🏠 Retiro Local</button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
           <input 
             className="w-full bg-white border border-zinc-100 h-12 px-12 rounded-2xl text-xs font-bold shadow-soft outline-none focus:ring-2 focus:ring-brand-50" 
             placeholder="Buscar logística pendiente..." 
             value={search} 
             onChange={e => setSearch(e.target.value)} 
           />
           <span className="absolute left-4 top-1/2 -translate-y-1/2 grayscale opacity-30">🔍</span>
        </div>
        <button onClick={handlePrintLogisticsReport} className="px-6 bg-zinc-950 text-white rounded-2xl font-black uppercase text-[9px] shadow-lg tracking-widest">🖨️ Reporte</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(o => (
          <div key={o.id} className="bg-white rounded-[2.5rem] p-8 shadow-premium border border-zinc-100 flex flex-col relative overflow-hidden">
            <div className={`absolute top-0 right-0 h-2 w-full ${o.status === EventStatus.CONFIRMED ? 'bg-amber-400' : 'bg-blue-500'}`}></div>
            <div className="flex justify-between items-start mb-6">
               <span className="text-[10px] font-black text-zinc-300">ORD-#{o.orderNumber}</span>
               <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase ${o.status === EventStatus.CONFIRMED ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>{o.status}</span>
            </div>
            <h3 className="text-sm font-black text-zinc-950 uppercase mb-1">{o.clientName}</h3>
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-4">📍 {o.deliveryAddress || 'Retiro en Local'}</p>
            {o.warehouseExitNumber && (
              <div className="mb-4">
                <span className="text-[9px] font-black text-brand-700 bg-brand-50 px-2 py-1 rounded-lg uppercase">EB N°: {o.warehouseExitNumber}</span>
              </div>
            )}
            <div className="bg-zinc-50 p-4 rounded-2xl mb-8">
               <p className="text-[8px] font-black text-zinc-400 uppercase mb-2">Artículos en lista:</p>
               <div className="text-[10px] font-bold text-zinc-700">
                  {o.items.length} productos registrados.
               </div>
            </div>
            <div className="mt-auto flex gap-2">
              {o.status === EventStatus.CONFIRMED ? (
                <button onClick={() => handleDispatch(o)} className="flex-1 py-3 bg-zinc-950 text-white rounded-xl font-black uppercase text-[8px] shadow-lg">📦 Marcar Despacho</button>
              ) : (
                <button onClick={() => handleDeliver(o)} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-[8px] shadow-lg">✅ Confirmar Entrega</button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full py-20 text-center opacity-20 font-black uppercase text-xs">Sin registros que coincidan</div>}
      </div>
    </div>
  );
};

export default DispatchView;