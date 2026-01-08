
import React, { useState, useEffect } from 'react';
import { PurchaseTransaction, PurchaseDocType, Provider } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';
import { COMPANY_LOGO, COMPANY_NAME } from '../../constants';

const PurchasesView: React.FC = () => {
  const [purchases, setPurchases] = useState<PurchaseTransaction[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'directory' | 'edit_provider'>('list');
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const getInitialForm = (): Partial<PurchaseTransaction> => ({
    date: new Date().toISOString().split('T')[0],
    provider: { name: '', documentId: '', phone: '', mobile: '', email: '' } as Provider,
    details: '',
    docType: PurchaseDocType.INVOICE,
    docNumber: '',
    values: { subtotal15: 0, subtotal0: 0, subtotalRise: 0, exemptVat: 0, vat15: 0, total: 0 },
    payment: { method: 'Efectivo', bank: '', institution: '', accountNumber: '', otherDetails: '' }
  });

  const [formData, setFormData] = useState<Partial<PurchaseTransaction>>(getInitialForm());

  useEffect(() => {
    const unsubP = storageService.subscribeToPurchases(setPurchases);
    const unsubD = storageService.subscribeToProviders(setProviders);
    return () => { unsubP(); unsubD(); };
  }, []);

  const calculateTotals = (vals: any) => {
    const sub15 = parseFloat(vals.subtotal15?.toString().replace(',', '.') || '0') || 0;
    const sub0 = parseFloat(vals.subtotal0?.toString().replace(',', '.') || '0') || 0;
    const rise = parseFloat(vals.subtotalRise?.toString().replace(',', '.') || '0') || 0;
    const exempt = parseFloat(vals.exemptVat?.toString().replace(',', '.') || '0') || 0;
    const vat = sub15 * 0.15;
    const total = sub15 + sub0 + rise + exempt + vat;
    
    setFormData(prev => ({
      ...prev,
      values: { ...vals, vat15: vat, total: total }
    }));
  };

  const handleValueChange = (field: string, val: string) => {
    const sanitized = val.replace(',', '.');
    if (sanitized !== '' && !/^\d*\.?\d*$/.test(sanitized)) return;
    const currentValues = formData.values || { subtotal15: 0, subtotal0: 0, subtotalRise: 0, exemptVat: 0, vat15: 0, total: 0 };
    calculateTotals({ ...currentValues, [field]: sanitized });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.provider?.name || !formData.provider?.documentId) {
        return uiService.alert("Requerido", "Nombre y RUC del proveedor obligatorios.");
    }
    setIsSaving(true);
    try {
        const providerData: Provider = {
            id: '',
            name: formData.provider.name,
            documentId: formData.provider.documentId,
            phone: formData.provider.phone,
            mobile: formData.provider.mobile,
            email: formData.provider.email
        };
        await storageService.saveProvider(providerData);

        const finalValues = {
            subtotal15: parseFloat(formData.values?.subtotal15?.toString() || '0'),
            subtotal0: parseFloat(formData.values?.subtotal0?.toString() || '0'),
            subtotalRise: parseFloat(formData.values?.subtotalRise?.toString() || '0'),
            exemptVat: parseFloat(formData.values?.exemptVat?.toString() || '0'),
            vat15: formData.values?.vat15 || 0,
            total: formData.values?.total || 0
        };
        
        await storageService.savePurchase({ 
            ...formData, 
            id: editingId || '',
            values: finalValues 
        } as PurchaseTransaction);
        
        await uiService.alert("Éxito", editingId ? "Registro actualizado." : "Transacción registrada.");
        setViewMode('list');
        setEditingId(null);
        setFormData(getInitialForm());
    } catch (e) {
        uiService.alert("Error", "No se pudo procesar el registro.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleEditPurchase = (p: PurchaseTransaction) => {
      setEditingId(p.id);
      setFormData(p);
      setViewMode('create');
  };

  const handleDeletePurchase = async (id: string) => {
      if (await uiService.confirm("Eliminar Registro", "¿Está seguro de eliminar esta compra? Esta acción no se puede deshacer.")) {
          await storageService.deletePurchase(id);
          uiService.alert("Eliminado", "El registro ha sido removido.");
      }
  };

  const handleUpdateProvider = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingProvider) return;
      await storageService.saveProvider(editingProvider);
      uiService.alert("Éxito", "Proveedor actualizado.");
      setViewMode('directory');
  };

  const filteredPurchases = purchases.filter(p => 
    (p.provider.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.provider.documentId.includes(searchQuery)) && (!dateFilter || p.date === dateFilter)
  );

  const filteredProviders = providers.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.documentId.includes(searchQuery));

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h2 className="text-3xl font-black text-brand-900 tracking-tighter uppercase">Compras y Egresos</h2>
            <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mt-1">Gestión administrativa de proveedores</p>
        </div>
        <div className="flex bg-zinc-100 p-1.5 rounded-2xl shadow-inner gap-1">
            <button onClick={() => { setViewMode('list'); setEditingId(null); }} className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase transition-all ${viewMode === 'list' ? 'bg-white text-brand-900 shadow-md' : 'text-zinc-400'}`}>Listado</button>
            <button onClick={() => setViewMode('directory')} className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase transition-all ${viewMode === 'directory' ? 'bg-white text-brand-900 shadow-md' : 'text-zinc-400'}`}>Proveedores</button>
            <button onClick={() => { setEditingId(null); setFormData(getInitialForm()); setViewMode('create'); }} className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase transition-all ${viewMode === 'create' && !editingId ? 'bg-white text-brand-900 shadow-md scale-105' : 'text-zinc-400'}`}>+ Nuevo Registro</button>
        </div>
      </div>

      {viewMode === 'create' ? (
        <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-premium border border-zinc-100 relative animate-slide-up">
            <form onSubmit={handleSave} className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-2 relative">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Proveedor / Razón Social *</label>
                        <input required type="text" list="provider-list" value={formData.provider?.name || ''} onChange={e => {
                            const p = providers.find(pr => pr.name === e.target.value);
                            if (p) {
                                setFormData(prev => ({...prev, provider: { name: p.name, documentId: p.documentId, phone: p.phone || '', mobile: p.mobile || '', email: p.email || '' } as Provider}));
                            } else {
                                setFormData(prev => ({...prev, provider: {...(prev.provider || {}), name: e.target.value} as Provider}));
                            }
                        }} className="w-full h-14 bg-zinc-50 border-none rounded-2xl px-6 font-bold outline-none" />
                        <datalist id="provider-list">
                            {providers.map(p => <option key={p.id} value={p.name} />)}
                        </datalist>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">RUC / CI *</label>
                        <input required type="text" value={formData.provider?.documentId || ''} onChange={e => setFormData(prev => ({...prev, provider: {...(prev.provider || {}), documentId: e.target.value} as Provider}))} className="w-full h-14 bg-zinc-50 border-none rounded-2xl px-6 font-mono font-black" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6 border-t border-zinc-100">
                    <div className="lg:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Detalles de Compra</label>
                        <input type="text" value={formData.details || ''} onChange={e => setFormData(prev => ({...prev, details: e.target.value}))} className="w-full h-14 bg-zinc-50 border-none rounded-2xl px-6 font-bold outline-none" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Nº Comprobante</label>
                        <input type="text" value={formData.docNumber || ''} onChange={e => setFormData(prev => ({...prev, docNumber: e.target.value}))} className="w-full h-14 bg-zinc-50 border-none rounded-2xl px-6 font-mono font-black outline-none" placeholder="001-001..." />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Fecha Documento</label>
                        <input type="date" value={formData.date || ''} onChange={e => setFormData(prev => ({...prev, date: e.target.value}))} className="w-full h-14 bg-zinc-50 border-none rounded-2xl px-6 font-bold outline-none" />
                    </div>
                </div>

                <div className="bg-zinc-900 p-8 rounded-[2.5rem] shadow-2xl">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {['subtotal15', 'subtotal0', 'subtotalRise', 'exemptVat'].map(field => (
                            <div key={field} className="space-y-2">
                                <label className="text-[8px] font-black text-zinc-500 uppercase px-2">{field.replace('subtotal', 'Sub ').replace('exemptVat', 'Exento IVA')}</label>
                                <input type="text" inputMode="decimal" value={(formData.values as any)?.[field] || ''} onChange={e => handleValueChange(field, e.target.value)} className="w-full h-12 bg-white/5 border-none rounded-xl px-4 text-white font-black text-center outline-none" placeholder="0.00" />
                            </div>
                        ))}
                        <div className="bg-brand-900 rounded-2xl flex flex-col justify-center items-center shadow-lg lg:col-span-2">
                            <span className="text-[7px] font-black text-brand-200 uppercase tracking-widest">Total Transacción</span>
                            <div className="text-xl font-black text-white">$ {formData.values?.total?.toFixed(2) || '0.00'}</div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-4 pt-6">
                    <button type="button" onClick={() => { setViewMode('list'); setEditingId(null); }} className="px-8 font-black text-zinc-400 uppercase text-[9px]">Cancelar</button>
                    <button type="submit" disabled={isSaving} className="h-16 px-16 bg-brand-900 text-white rounded-2xl font-black shadow-premium active:scale-95 text-[10px] uppercase disabled:opacity-50">
                        {isSaving ? 'Sincronizando...' : editingId ? '💾 Actualizar Registro' : '💾 Registrar Compra'}
                    </button>
                </div>
            </form>
        </div>
      ) : viewMode === 'directory' ? (
          <div className="space-y-4 animate-fade-in">
              <div className="bg-white p-4 rounded-[1.5rem] shadow-soft border border-zinc-100 relative">
                  <input type="text" placeholder="Buscar en el directorio..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full h-12 bg-zinc-50 border-none rounded-xl px-12 text-xs font-bold outline-none" />
                  <span className="absolute left-8 top-1/2 -translate-y-1/2 grayscale opacity-30">🔍</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredProviders.map(p => (
                      <div key={p.id} className="bg-white p-6 rounded-[2rem] shadow-soft border border-zinc-100 flex flex-col justify-between group h-48">
                          <div>
                              <h3 className="font-black text-[10px] text-zinc-950 uppercase truncate leading-tight mb-1">{p.name}</h3>
                              <p className="text-[8px] font-mono text-zinc-400">{p.documentId}</p>
                          </div>
                          <div className="flex gap-2 pt-4 mt-auto border-t border-zinc-50">
                              <button onClick={() => { setEditingProvider(p); setViewMode('edit_provider'); }} className="flex-1 py-2 bg-zinc-50 text-zinc-600 rounded-lg text-[8px] font-black uppercase hover:bg-zinc-100">Editar</button>
                              <button onClick={() => storageService.deleteProvider(p.id)} className="w-10 h-8 flex items-center justify-center text-rose-300 hover:text-rose-600 transition-colors">🗑️</button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      ) : viewMode === 'edit_provider' && editingProvider ? (
          <div className="max-w-xl mx-auto bg-white p-10 rounded-[3rem] shadow-premium border border-zinc-100 animate-slide-up">
              <h3 className="text-xl font-black text-brand-900 uppercase tracking-tighter mb-8">Editar Proveedor</h3>
              <form onSubmit={handleUpdateProvider} className="space-y-6">
                  <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-400 uppercase px-2">Razón Social</label>
                      <input required className="w-full h-12 bg-zinc-50 rounded-xl px-4 font-bold" value={editingProvider.name} onChange={e => setEditingProvider({...editingProvider, name: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-400 uppercase px-2">RUC / CI</label>
                      <input required className="w-full h-12 bg-zinc-100 rounded-xl px-4 font-mono font-black" value={editingProvider.documentId} readOnly />
                  </div>
                  <div className="flex gap-4 pt-4">
                      <button type="button" onClick={() => setViewMode('directory')} className="flex-1 text-zinc-300 font-black uppercase text-[9px]">Volver</button>
                      <button type="submit" className="flex-[2] h-14 bg-brand-900 text-white rounded-2xl font-black shadow-lg uppercase text-[9px]">Guardar Cambios</button>
                  </div>
              </form>
          </div>
      ) : (
          <div className="space-y-4">
              <div className="bg-white rounded-[2.5rem] shadow-premium border border-zinc-100 overflow-hidden">
                  <table className="w-full border-collapse">
                      <thead>
                          <tr className="text-left text-[9px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-50 border-b">
                              <th className="px-8 py-5">Fecha</th>
                              <th className="px-8 py-5">Proveedor</th>
                              <th className="px-8 py-5">Documento</th>
                              <th className="px-8 py-5 text-right">Monto Total</th>
                              <th className="px-8 py-5 text-center">Acciones</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                          {filteredPurchases.map(p => (
                              <tr key={p.id} className="hover:bg-zinc-50/80 transition-colors group">
                                  <td className="px-8 py-4 text-[10px] font-bold text-zinc-500">{p.date}</td>
                                  <td className="px-8 py-4">
                                      <div className="text-[10px] font-black text-zinc-900 uppercase">{p.provider.name}</div>
                                      <div className="text-[8px] font-mono text-zinc-400">{p.provider.documentId}</div>
                                  </td>
                                  <td className="px-8 py-4">
                                      <div className="text-[10px] font-bold text-zinc-700">{p.docType}</div>
                                      <div className="text-[9px] font-black text-brand-600">#{p.docNumber}</div>
                                  </td>
                                  <td className="px-8 py-4 text-base font-black text-rose-600 text-right">$ {p.values.total.toFixed(2)}</td>
                                  <td className="px-8 py-4 text-center">
                                      <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => handleEditPurchase(p)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg">✏️</button>
                                          <button onClick={() => handleDeletePurchase(p.id)} className="p-2 text-rose-300 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all">🗑️</button>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}
    </div>
  );
};

export default PurchasesView;
