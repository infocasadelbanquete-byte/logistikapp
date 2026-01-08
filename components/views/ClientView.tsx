
import React, { useState, useEffect } from 'react';
import { Client, UserRole, EventOrder, EventStatus } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService'; 
import { COMPANY_LOGO, COMPANY_NAME } from '../../constants';

const ClientView: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [events, setEvents] = useState<EventOrder[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<Client | null>(null);
  const [formData, setFormData] = useState<Partial<Client>>({});
  const [documentType, setDocumentType] = useState<'CI' | 'RUC'>('CI');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const canEdit = true;
  const canDelete = userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN;
  const canPrint = userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN;

  useEffect(() => {
    const unsubClients = storageService.subscribeToClients(setClients);
    const unsubEvents = storageService.subscribeToEvents(setEvents);
    const session = storageService.getCurrentSession();
    if (session) setUserRole(session.role);
    return () => { unsubClients(); unsubEvents(); };
  }, []);

  const handleOpenNew = () => { setFormData({}); setDocumentType('CI'); setIsModalOpen(true); };
  const handleOpenEdit = (client: Client) => { setFormData(client); setDocumentType(client.documentId.length === 13 ? 'RUC' : 'CI'); setIsModalOpen(true); };

  const handleDelete = async (id: string, name: string) => {
      if (await uiService.confirm("Eliminar Cliente", `¿Estás seguro de que deseas eliminar al cliente "${name}"?\nEsta acción no se puede deshacer.`)) {
          try {
              await storageService.deleteClient(id);
          } catch (error) {
              console.error(error);
              await uiService.alert("Error", "Hubo un error al eliminar el cliente.");
          }
      }
  };

  const handlePrintHistory = async (client: Client, clientEvents: EventOrder[]) => {
    const settings = await storageService.getSettings();
    const logo = settings?.logoUrl || COMPANY_LOGO;
    const name = settings?.name || COMPANY_NAME;

    const rows = clientEvents.map(e => {
      const balance = e.total - e.paidAmount;
      // Fixed: Replaced EventStatus.COMPLETED with EventStatus.RETURNED
      const statusLabel = e.status === EventStatus.RETURNED ? 'COMPLETADO' : e.status === EventStatus.CANCELLED ? 'ANULADO' : 'ACTIVO';
      const paymentsText = e.transactions?.map(t => `${t.method}: $${t.amount.toFixed(2)}`).join(' | ') || 'SIN PAGOS';

      return `
        <tr>
          <td style="border: 1px solid #000; padding: 6px; font-weight: bold; font-family: monospace;">#ORD-${String(e.orderNumber).padStart(4, '0')}</td>
          <td style="border: 1px solid #000; padding: 6px;">${e.executionDate}</td>
          <td style="border: 1px solid #000; padding: 6px; font-weight: 800; font-size: 8px;">${statusLabel}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: right;">$ ${e.total.toFixed(2)}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: right; color: green;">$ ${e.paidAmount.toFixed(2)}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: right; color: ${balance > 0 ? 'red' : 'black'}; font-weight: bold;">$ ${balance.toFixed(2)}</td>
          <td style="border: 1px solid #000; padding: 6px; font-size: 8px;">${paymentsText}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <html>
      <head>
        <title>Estado de Cuenta - ${client.name}</title>
        <style>
          @page { size: A4 landscape; margin: 1cm; }
          body { font-family: sans-serif; font-size: 10px; padding: 10px; color: #000; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #4c0519; padding-bottom: 10px; margin-bottom: 20px; }
          .logo { height: 50px; }
          .title { font-size: 18px; font-weight: 900; text-align: center; text-transform: uppercase; margin-bottom: 20px; color: #4c0519; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f3f4f6; border: 1px solid #000; padding: 10px; text-align: left; font-size: 9px; text-transform: uppercase; font-weight: 800; }
          td { border: 1px solid #000; padding: 8px; vertical-align: middle; }
          .client-box { border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
          .company-footer { margin-top: 40px; border-top: 1px solid #4c0519; padding-top: 15px; font-size: 9px; color: #444; text-align: center; clear: both; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${logo}" class="logo" />
          <div style="text-align: right;">
            <div style="font-size: 14px; font-weight: 900; color: #4c0519;">${name}</div>
            <div style="font-size: 8px; font-weight: 700; color: #999;">ESTADO DE CUENTA DE CLIENTE</div>
          </div>
        </div>
        <div class="client-box">
            <strong>CLIENTE:</strong> ${client.name.toUpperCase()} <br/>
            <strong>IDENTIFICACIÓN:</strong> ${client.documentId || 'N/A'} <br/>
            <strong>CELULAR:</strong> ${client.mobilePhone || client.phone || 'N/A'} <br/>
            <strong>FECHA DE EMISIÓN:</strong> ${new Date().toLocaleString()}
        </div>
        <div class="title">Historial de Transacciones</div>
        <table>
          <thead>
            <tr>
              <th width="10%">Orden</th>
              <th width="10%">Fecha</th>
              <th width="10%">Estado</th>
              <th width="10%">Venta Total</th>
              <th width="10%">Abonado</th>
              <th width="10%">Saldo</th>
              <th width="40%">Métodos de Pago Utilizados</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div style="margin-top: 30px; text-align: right; font-size: 12px; font-weight: 900;">
            TOTAL CARTERA PENDIENTE: $ ${clientEvents.reduce((acc, curr) => acc + (curr.total - curr.paidAmount), 0).toFixed(2)}
        </div>
        <div class="company-footer">
          <span style="margin-right: 15px;"><strong>📱</strong> 0998 858 204</span>
          <span style="margin-right: 15px;"><strong>📍</strong> Cornelio Crespo y Manuel Ignacio Ochoa</span>
          <span><strong>✉️</strong> infocasadelbanquete@gmail.com</span>
        </div>
        <script>window.onload=function(){setTimeout(()=>window.print(), 500)}</script>
      </body>
      </html>
    `;

    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
  };

  const handlePrintClients = async () => {
    const settings = await storageService.getSettings();
    const logo = settings?.logoUrl || COMPANY_LOGO;
    const name = settings?.name || COMPANY_NAME;
    const currentUser = storageService.getCurrentSession();

    const rows = filteredClients.map(c => `
      <tr>
        <td style="border: 1px solid #000; padding: 6px; font-weight: bold; text-transform: uppercase;">${c.name}</td>
        <td style="border: 1px solid #000; padding: 6px; font-family: monospace;">${c.documentId || '-'}</td>
        <td style="border: 1px solid #000; padding: 6px; text-transform: uppercase;">${c.contactPerson || '-'}</td>
        <td style="border: 1px solid #000; padding: 6px;">${c.email || '-'}</td>
        <td style="border: 1px solid #000; padding: 6px;">${c.mobilePhone || c.phone || '-'}</td>
        <td style="border: 1px solid #000; padding: 6px; font-size: 9px;">${c.address || '-'}</td>
      </tr>
    `).join('');

    const html = `
      <html>
      <head>
        <title>Directorio de Clientes - ${name}</title>
        <style>
          @page { size: A4 landscape; margin: 1cm; }
          body { font-family: sans-serif; font-size: 10px; padding: 10px; color: #000; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #4c0519; padding-bottom: 10px; margin-bottom: 20px; }
          .logo { height: 50px; }
          .title { font-size: 18px; font-weight: 900; text-align: center; text-transform: uppercase; margin-bottom: 20px; color: #4c0519; letter-spacing: -0.5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f3f4f6; border: 1px solid #000; padding: 10px; text-align: left; font-size: 9px; text-transform: uppercase; font-weight: 800; }
          td { border: 1px solid #000; padding: 8px; vertical-align: top; }
          .footer { margin-top: 30px; font-size: 8px; border-top: 1px solid #eee; padding-top: 10px; color: #666; display: flex; justify-content: space-between; }
          .company-footer { margin-top: 40px; border-top: 1px solid #4c0519; padding-top: 15px; font-size: 9px; color: #444; text-align: center; clear: both; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${logo}" class="logo" />
          <div style="text-align: right;">
            <div style="font-size: 14px; font-weight: 900; color: #4c0519;">${name}</div>
            <div style="font-size: 8px; font-weight: 700; color: #999; letter-spacing: 1px;">SISTEMA DE GESTIÓN LOGISTIK PRO</div>
          </div>
        </div>
        <div class="title">Listado Maestro de Clientes</div>
        <table>
          <thead>
            <tr>
              <th width="20%">Cliente / Razón Social</th>
              <th width="10%">Identificación</th>
              <th width="15%">Contacto</th>
              <th width="15%">Correo Electrónico</th>
              <th width="10%">Teléfono(s)</th>
              <th width="30%">Dirección</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="footer">
          <div>Generado el: ${new Date().toLocaleString()}</div>
          <div>Emitido por: ${currentUser?.name || 'Administrador'}</div>
          <div>Página 1 de 1</div>
        </div>
        <div class="company-footer">
          <span style="margin-right: 15px;"><strong>📱</strong> 0998 858 204</span>
          <span style="margin-right: 15px;"><strong>📍</strong> Cornelio Crespo y Manuel Ignacio Ochoa</span>
          <span><strong>✉️</strong> infocasadelbanquete@gmail.com</span>
        </div>
        <script>window.onload=function(){setTimeout(()=>window.print(), 500)}</script>
      </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      uiService.alert("Navegador Bloqueado", "Por favor habilite los popups en su navegador para imprimir.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) { await uiService.alert("Requerido", "El nombre del cliente es obligatorio."); return; }

    if (formData.documentId) {
        if (documentType === 'CI' && !/^\d{10}$/.test(formData.documentId)) { await uiService.alert("Formato Inválido", "Cédula debe tener 10 dígitos."); return; }
        if (documentType === 'RUC' && !/^\d{13}$/.test(formData.documentId)) { await uiService.alert("Formato Inválido", "RUC debe tener 13 dígitos."); return; }
    }

    const client: Client = {
      id: formData.id || '', name: formData.name, documentId: formData.documentId || '', email: formData.email || '', phone: formData.phone || '', mobilePhone: formData.mobilePhone || '', contactPerson: formData.contactPerson || '', address: formData.address || ''
    };

    await storageService.saveClient(client);
    setIsModalOpen(false);
    setFormData({});
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500); 
  };

  const filteredClients = clients.filter(client => {
    const query = searchQuery.toLowerCase();
    return (client.name.toLowerCase().includes(query) || (client.documentId && client.documentId.includes(query)) || (client.email && client.email.toLowerCase().includes(query)) || (client.phone && client.phone.includes(query)) || (client.contactPerson && client.contactPerson.toLowerCase().includes(query)));
  });

  const getClientHistory = (clientId: string) => {
      return events.filter(e => e.clientId === clientId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Cartera de Clientes</h2>
        <div className="flex gap-2 w-full md:w-auto">
          {canPrint && (
            <button onClick={handlePrintClients} className="flex-1 md:flex-none bg-zinc-900 hover:bg-black text-white px-4 py-2 rounded shadow text-sm font-bold flex items-center justify-center gap-2 transition-all">
              <span>🖨️</span> Imprimir Directorio
            </button>
          )}
          <button onClick={handleOpenNew} className="flex-1 md:flex-none bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded shadow text-sm font-bold">+ Nuevo Cliente</button>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">🔍</span>
          <input type="text" placeholder="Buscar por nombre, contacto, cédula..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-brand-500 focus:border-brand-500" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filteredClients.map(client => (
          <div key={client.id} className="bg-white p-3 rounded-xl shadow-soft border border-zinc-100 flex flex-col justify-between hover:shadow-premium transition-all group h-48">
            <div className="flex-1 overflow-hidden">
              <h3 className="font-black text-xs text-zinc-900 truncate uppercase leading-tight">{client.name}</h3>
              {client.contactPerson && (<p className="text-[8px] text-brand-600 font-bold uppercase truncate mt-1 opacity-60">{client.contactPerson}</p>)}
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[9px] font-mono text-zinc-400 truncate">{client.documentId || 'SIN ID'}</p>
                {(client.mobilePhone || client.phone) && (
                  <a 
                    href={`tel:${client.mobilePhone || client.phone}`} 
                    className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-90"
                    title="Llamar al cliente"
                  >
                    📞
                  </a>
                )}
              </div>
              <div className="mt-1">
                 <p className="text-[8px] text-zinc-400 truncate uppercase">{client.mobilePhone || client.phone || 'Sin teléfono'}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 mt-auto pt-2 border-t border-zinc-50">
              <button onClick={() => { setSelectedClientForHistory(client); setIsHistoryOpen(true); }} className="w-full py-1.5 bg-zinc-50 text-zinc-900 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-zinc-100">Actividad</button>
              <div className="flex gap-1">
                 <button onClick={() => handleOpenEdit(client)} className="flex-1 py-1 text-[8px] font-black text-blue-500 uppercase">Edit</button>
                 {canDelete && (<button onClick={() => handleDelete(client.id, client.name)} className="flex-1 py-1 text-[8px] font-black text-rose-300 uppercase">Eliminar</button>)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isHistoryOpen && selectedClientForHistory && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in no-print">
              <div className="bg-white rounded-[2rem] shadow-premium w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
                  <div className="p-6 bg-zinc-50 border-b flex justify-between items-center">
                      <div>
                          <h3 className="text-xl font-black text-brand-900 uppercase tracking-tighter">Historial Maestro</h3>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{selectedClientForHistory.name}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handlePrintHistory(selectedClientForHistory, getClientHistory(selectedClientForHistory.id))} className="h-10 px-4 bg-zinc-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md">🖨️ Imprimir</button>
                        <button onClick={() => setIsHistoryOpen(false)} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-zinc-400 border hover:text-zinc-950 transition-colors shadow-sm">✕</button>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                      {getClientHistory(selectedClientForHistory.id).length === 0 ? (
                          <div className="py-20 text-center text-zinc-300 font-black uppercase text-xs">Sin operaciones registradas</div>
                      ) : (
                          <div className="space-y-4">
                              {getClientHistory(selectedClientForHistory.id).map(e => {
                                  const balance = e.total - e.paidAmount;
                                  return (
                                      <div key={e.id} className="bg-zinc-50 rounded-2xl p-5 border border-zinc-100 flex flex-col md:flex-row justify-between gap-4">
                                          <div className="flex-1">
                                              <div className="flex items-center gap-2 mb-2">
                                                  <span className="font-mono font-black text-[10px] bg-white px-2 py-0.5 rounded border">#ORD-{e.orderNumber}</span>
                                                  {/* Fixed: Replaced EventStatus.COMPLETED with EventStatus.RETURNED */}
                                                  <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${e.status === EventStatus.RETURNED ? 'bg-emerald-100 text-emerald-700' : e.status === EventStatus.CANCELLED ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                      {e.status === EventStatus.RETURNED ? 'COMPLETADO' : e.status === EventStatus.CANCELLED ? 'ANULADO' : 'ACTIVO'}
                                                  </span>
                                              </div>
                                              <p className="text-[10px] font-bold text-zinc-500 uppercase">📅 Ejecución: {e.executionDate}</p>
                                          </div>
                                          <div className="bg-white p-4 rounded-xl border border-zinc-100 flex flex-row md:flex-col justify-around md:justify-center items-center gap-2 md:w-32">
                                              <div className="text-center">
                                                  <p className="text-[7px] font-black text-zinc-400 uppercase">Total</p>
                                                  <p className="font-black text-zinc-900">$ {e.total.toFixed(2)}</p>
                                              </div>
                                              <div className="text-center">
                                                  <p className="text-[7px] font-black text-zinc-400 uppercase">Saldo</p>
                                                  <p className={`font-black ${balance > 0.05 ? 'text-red-600' : 'text-emerald-600'}`}>$ {Math.max(0, balance).toFixed(2)}</p>
                                              </div>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 text-brand-800">{formData.id ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre o Razón Social *</label>
                <input required placeholder="Ej. Juan Pérez / Empresa S.A." className="w-full border border-gray-300 p-2 rounded" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Persona de Contacto</label>
                  <input placeholder="Ej. María López" className="w-full border border-gray-300 p-2 rounded" value={formData.contactPerson || ''} onChange={e => setFormData({...formData, contactPerson: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
                  <input type="email" placeholder="cliente@correo.com" className="w-full border border-gray-300 p-2 rounded" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>
              
              {/* Doc Type Selector */}
              <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">Identificación (Opcional)</label>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" name="docType" checked={documentType === 'CI'} onChange={() => setDocumentType('CI')} />
                    <span className="text-sm text-gray-700">CI (10)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" name="docType" checked={documentType === 'RUC'} onChange={() => setDocumentType('RUC')} />
                    <span className="text-sm text-gray-700">RUC (13)</span>
                  </label>
                </div>
                <input type="text" inputMode="numeric" placeholder={documentType === 'CI' ? "10 dígitos" : "13 dígitos"} className="w-full border border-gray-300 p-2 rounded mt-2" value={formData.documentId || ''} onChange={(e) => setFormData({...formData, documentId: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input className="w-full border border-gray-300 p-2 rounded" value={formData.phone || ''} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Celular</label>
                  <input className="w-full border border-gray-300 p-2 rounded" value={formData.mobilePhone || ''} onChange={(e) => setFormData({...formData, mobilePhone: e.target.value})} maxLength={10} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <textarea rows={2} className="w-full border border-gray-300 p-2 rounded" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded font-bold">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showSuccess && (<div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]"><div className="bg-white rounded-lg shadow-2xl p-8 flex flex-col items-center animate-fade-in text-center max-w-sm"><div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4"><span className="text-3xl">✅</span></div><h3 className="text-xl font-bold text-gray-800 mb-2">Cliente Guardado</h3></div></div>)}
    </div>
  );
};

export default ClientView;
