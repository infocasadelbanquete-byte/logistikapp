import React, { useState, useEffect } from 'react';
import { EventOrder, EventStatus, Client, InventoryItem, UserRole } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService'; 

const QuotesView: React.FC = () => {
  const [quotes, setQuotes] = useState<EventOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    const unsub = storageService.subscribeToEvents((all) => {
        // Solo mostrar proformas activas (no anuladas ni convertidas)
        setQuotes(all.filter(e => e.status === EventStatus.QUOTE));
    });
    storageService.subscribeToClients(setClients);
    return () => unsub();
  }, []);

  const handleConfirmOrder = async (q: EventOrder) => {
      const ebNumStr = await uiService.prompt(
        "Confirmar Pedido", 
        "Ingrese el Número de Egreso de Bodega (EB N°) para pasar esta proforma a Pedidos Operativos:"
      );
      
      if (ebNumStr && ebNumStr.trim() !== "") {
          const ebNum = parseInt(ebNumStr);
          if (isNaN(ebNum)) return uiService.alert("Error", "El número de egreso debe ser numérico.");
          
          setQuotes(prev => prev.filter(item => item.id !== q.id)); // Optimistic UI
          await storageService.saveEvent({ 
            ...q, 
            status: EventStatus.CONFIRMED,
            warehouseExitNumber: ebNum
          });
          uiService.alert("Éxito", `Proforma PRO-${q.orderNumber} convertida en Pedido con EB N° ${ebNum}.`);
      } else if (ebNumStr === "") {
          uiService.alert("Dato Requerido", "Es obligatorio registrar el EB N° para confirmar el pedido.");
      }
  };

  const handleCancelQuote = async (q: EventOrder) => {
      if (await uiService.confirm("Anular Proforma", `¿Está seguro de anular la proforma PRO-${q.orderNumber}?`)) {
          await storageService.saveEvent({ ...q, status: EventStatus.CANCELLED });
          uiService.alert("Anulado", "La proforma ha sido cancelada.");
      }
  };

  const filteredQuotes = quotes.filter(q => 
    q.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    String(q.orderNumber).includes(searchQuery)
  );

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-black text-brand-900 uppercase tracking-tighter">Módulo de Proformas</h2>
                <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest">Cotizaciones pendientes de aprobación</p>
            </div>
            <div className="relative w-64">
                <input 
                    className="w-full h-10 bg-white border border-zinc-100 rounded-xl px-10 text-[10px] font-black outline-none shadow-soft" 
                    placeholder="Buscar proforma..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
            </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredQuotes.map(q => (
                <div key={q.id} className="bg-white p-4 rounded-xl shadow-soft border border-zinc-100 flex flex-col h-full group hover:border-violet-200 transition-all">
                    <div className="flex justify-between mb-2">
                        <span className="text-[7px] font-black text-violet-400 uppercase bg-violet-50 px-1.5 py-0.5 rounded">PRO-{q.orderNumber}</span>
                        <span className="text-[9px] font-black text-zinc-900 font-mono">$ {q.total.toFixed(2)}</span>
                    </div>
                    <h3 className="text-[10px] font-black text-zinc-800 uppercase truncate mb-4">{q.clientName}</h3>
                    <div className="mt-auto space-y-2">
                        <button onClick={() => handleConfirmOrder(q)} className="w-full py-2 bg-emerald-600 text-white rounded-lg text-[8px] font-black uppercase shadow-lg hover:bg-emerald-700 transition-all">
                            Confirmar Pedido
                        </button>
                        <button onClick={() => handleCancelQuote(q)} className="w-full py-2 bg-zinc-50 text-rose-300 rounded-lg text-[8px] font-black uppercase hover:text-rose-600 transition-all">
                            Anular Proforma
                        </button>
                    </div>
                </div>
            ))}
            {filteredQuotes.length === 0 && (
                <div className="col-span-full py-20 text-center opacity-20 font-black uppercase text-xs tracking-widest">No hay proformas pendientes</div>
            )}
        </div>
    </div>
  );
};

export default QuotesView;