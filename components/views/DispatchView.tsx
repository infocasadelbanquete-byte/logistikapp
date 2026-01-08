
import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, InventoryItem, Client, CompanySettings } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService'; 
import { COMPANY_LOGO, COMPANY_NAME } from '../../constants';

const SERVICE_CONDITIONS = `
<div style="margin-top:20px; font-size:8px; line-height:1.2; text-align:justify; border-top:1px solid #eee; pt-10px;">
  <strong>CONDICIONES DEL SERVICIO:</strong><br/>
  a) El cliente lee y acepta los servicios tal y como se detallan en la presente cotización, al igual en la forma indicada por el personal de La Casa del Banquete.<br/>
  b) El cliente acuerda conjuntamente con La Casa del Banquete la forma y momento de entrega de los servicios contratados.<br/>
  c) En caso de que la entrega no se la realice el momento acordado, una vez estando nuestro personal en el sitio señalado para el montaje del servicio, el cliente asumirá un costo adicional por motivos de un nuevo traslado.<br/>
  d) En caso de que la entrega no se la realice en el lugar acordado, una vez estando nuestro personal en el sitio señalado para el montaje del servicio, el cliente asumirá un costo adicional por motivos de un nuevo traslado.<br/>
  e) En caso que el cliente requiera adicionar más servicios o implementos una vez estando el personal de La Casa del Banquete en el lugar del montaje, el cliente asumirá un costo adicional por traslado del o los servicios adicionales.<br/>
  f) El cliente es responsable de recibir y revisar detalladamente los artículos contratados para el servicio acordado, con el fin de verificar el estado en el que se entregan los mismos.<br/>
  g) El servicio de saloneros es de máximo 5 horas, en caso de requerir mas tiempo de servicio, se deberá cubrir un valor adicional de $8.00 por hora por salonero y un valor adicional de transporte de $5.00 de igual manera por cada salonero.<br/>
  h) Todo articulo como vajilla, cristalería, cubertería, fuentes, samovares, bandejas, y otros que ameriten, deben regresar lavados, caso contrario no se procederá la recepción de los mismos el momento de retirar los implementos solicitados para el servicio.<br/>
  i) Todo articulo o implemento que presente roturas, fisuras o pérdida al momento del retiro del servicio, será asumido por el cliente con el valor respectivo a cada implemento, al igual que la mantelería o lonas que presenten manchas que representen un daño permanente al artículo referido.<br/>
  <br/>
  <strong>FORMA DE PAGO:</strong> 50 % anticipo 50% contra entrega a excepción de empresas o instituciones (crédito directo). El pago puede ser en efectivo, cheque o transferencia bancaria.
</div>`;

const DispatchView: React.FC = () => {
  const [allOrders, setAllOrders] = useState<EventOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [dispatchNotes, setDispatchNotes] = useState('');
  
  const [activeTab, setActiveTab] = useState<'TRANSPORT' | 'PICKUP' | 'HISTORY'>('TRANSPORT');
  const [orderToConfirm, setOrderToConfirm] = useState<EventOrder | null>(null);

  useEffect(() => {
    const unsubEvents = storageService.subscribeToEvents((events) => {
        const relevant = events.filter(e => e.status === EventStatus.RESERVED || e.status === EventStatus.DELIVERED);
        relevant.sort((a, b) => new Date(a.executionDate).getTime() - new Date(b.executionDate).getTime());
        setAllOrders(relevant);
    });
    storageService.subscribeToInventory(setInventory);
    storageService.subscribeToClients(setClients);
    storageService.subscribeToSettings(setSettings);
    return () => {};
  }, []);

  const confirmDelivery = async () => {
      if (!orderToConfirm) return;
      const currentUser = storageService.getCurrentSession();
      setIsProcessing(orderToConfirm.id);
      try {
          const updatedOrder: EventOrder = { 
            ...orderToConfirm, 
            status: EventStatus.DELIVERED, 
            dispatchedBy: currentUser?.name || 'Sistema',
            dispatchNotes: dispatchNotes.trim() || undefined
          };
          await storageService.saveEvent(updatedOrder);
          setOrderToConfirm(null);
          setDispatchNotes('');
          uiService.alert("Entrega Confirmada", `El pedido #${orderToConfirm.orderNumber} ha sido marcado como Entregado.`);
      } catch (error) { 
          uiService.alert("Error", "Error al procesar entrega."); 
      } finally { 
          setIsProcessing(null); 
      }
  };

  const generateDispatchGuide = (order: EventOrder) => {
    const win = window.open('', '_blank');
    if (!win) return uiService.alert("Bloqueador de Ventanas", "Por favor habilite los popups.");
    const logo = settings?.logoUrl || COMPANY_LOGO;
    const name = settings?.name || COMPANY_NAME;
    const client = clients.find(c => c.id === order.clientId);
    const itemsRows = order.items.map(item => {
        const invItem = inventory.find(inv => inv.id === item.itemId);
        if (invItem?.type === 'SERVICE') return '';
        return `<tr><td style="text-align:center; border: 1px solid #000; padding: 6px; font-weight: bold;">${item.quantity}</td><td style="border: 1px solid #000; padding: 6px; text-transform:uppercase;">${invItem?.name || 'Item'}</td><td style="text-align:center; border: 1px solid #000; color: #999;">[ ]</td></tr>`;
    }).join('');
    const html = `<html><head><title>GUIA ORD-${order.orderNumber}</title><style>body { font-family: 'Courier New', monospace; font-size: 11px; padding: 20px; color: #000; } .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; } table { width: 100%; border-collapse: collapse; border: 1px solid #000; } th, td { border: 1px solid #000; padding: 8px; } th { background: #eee; } .company-footer { margin-top: 30px; border-top: 1px solid #000; padding-top: 15px; font-size: 9px; color: #444; text-align: center; clear: both; }</style></head><body><div class="header"><img src="${logo}" style="height:50px" /><div><b>${name}</b><br/>GUÍA DE SALIDA # ${order.orderNumber}</div></div><p><b>CLIENTE:</b> ${order.clientName.toUpperCase()} | <b>DESTINO:</b> ${order.deliveryAddress || 'BODEGA'}</p><table><thead><tr><th width="15%">CANT</th><th>ARTÍCULO</th><th width="10%">OK</th></tr></thead><tbody>${itemsRows}</tbody></table><div style="margin-top:20px; display:flex; justify-content:space-between"><div style="border-top:1px solid #000; width:200px; text-align:center">ENTREGADO</div><div style="border-top:1px solid #000; width:200px; text-align:center">RECIBIDO</div></div>${SERVICE_CONDITIONS}<div class="company-footer"><span style="margin-right: 15px;"><strong>📱</strong> 0998 858 204</span><span><strong>✉️</strong> infocasadelbanquete@gmail.com</span></div><script>window.onload=function(){window.print()}</script></body></html>`;
    win.document.open(); win.document.write(html); win.document.close();
  };

  const displayedOrders = allOrders.filter(o => {
      const isHistory = o.status === EventStatus.DELIVERED;
      if (activeTab === 'HISTORY') return isHistory;
      return (o.status === EventStatus.RESERVED) && (activeTab === 'TRANSPORT' ? o.requiresDelivery : !o.requiresDelivery);
  });

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-2xl font-black text-zinc-950 tracking-tighter uppercase">Gestión de Despachos</h2>
            <div className="flex bg-zinc-100 p-1 rounded-2xl shadow-inner">
                <button onClick={() => setActiveTab('TRANSPORT')} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase ${activeTab === 'TRANSPORT' ? 'bg-white text-brand-600 shadow-md scale-105' : 'text-zinc-400'}`}>🚛 Logística</button>
                <button onClick={() => setActiveTab('PICKUP')} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase ${activeTab === 'PICKUP' ? 'bg-white text-zinc-900 shadow-md scale-105' : 'text-zinc-400'}`}>🏪 Retiro</button>
                <button onClick={() => setActiveTab('HISTORY')} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase ${activeTab === 'HISTORY' ? 'bg-white text-green-700 shadow-md scale-105' : 'text-zinc-400'}`}>📜 Historial</button>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedOrders.map(order => (
                <div key={order.id} className="bg-white rounded-[1.5rem] shadow-soft border border-zinc-100 flex flex-col overflow-hidden group">
                    <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-100 flex justify-between items-center">
                        <span className="font-mono font-black text-zinc-400 text-[8px]">#ORDEN {String(order.orderNumber).padStart(4, '0')}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase ${order.status === EventStatus.DELIVERED ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-800'}`}>{order.status}</span>
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                        <h3 className="text-sm font-extrabold text-zinc-950 truncate mb-1 uppercase">{order.clientName}</h3>
                        <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mb-3">🗓️ {order.executionDate}</p>
                        <div className="bg-zinc-50 p-3 rounded-xl mb-4 text-[9px] space-y-1.5 border border-zinc-100 shadow-inner">
                            <p className="text-zinc-500 truncate"><span className="font-black text-zinc-900">📍:</span> {order.requiresDelivery ? order.deliveryAddress : 'RETIRO BODEGA'}</p>
                        </div>
                        <div className="mt-auto flex gap-2">
                            <button onClick={() => generateDispatchGuide(order)} className="flex-1 py-2 bg-zinc-950 text-white rounded-lg text-[8px] font-black uppercase">Guía</button>
                            {order.status !== EventStatus.DELIVERED && <button onClick={() => { setOrderToConfirm(order); setDispatchNotes(''); }} className="flex-[1.5] py-2 bg-brand-600 text-white rounded-lg text-[8px] font-black uppercase">Despachar Ahora</button>}
                        </div>
                    </div>
                </div>
            ))}
        </div>
        {orderToConfirm && (
            <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-md flex items-center justify-center p-6 z-[200] animate-fade-in no-print">
                <div className="bg-white rounded-[2rem] shadow-premium w-full max-w-sm p-8 text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 text-3xl">🚚</div>
                    <h3 className="text-xl font-extrabold text-zinc-950 mb-1 tracking-tighter">Confirmar Salida</h3>
                    <p className="text-zinc-400 text-xs font-medium mb-6">¿Confirma la salida física del mobiliario?</p>
                    <textarea className="w-full h-24 bg-zinc-50 border rounded-xl p-3 text-xs font-bold outline-none mb-6 focus:ring-4 focus:ring-brand-50" placeholder="Notas de despacho..." value={dispatchNotes} onChange={(e) => setDispatchNotes(e.target.value)} />
                    <div className="flex flex-col gap-2">
                        <button onClick={confirmDelivery} disabled={isProcessing !== null} className="w-full py-3.5 bg-zinc-950 text-white rounded-xl font-black uppercase text-[9px]">Sellar Entrega</button>
                        <button onClick={() => setOrderToConfirm(null)} className="w-full py-2 text-zinc-300 font-black uppercase text-[9px]">Cancelar</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default DispatchView;
