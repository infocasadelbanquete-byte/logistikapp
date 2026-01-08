
import React, { useState, useEffect } from 'react';
import { InventoryItem, UserRole, PresentationType } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';
import { COMPANY_LOGO, COMPANY_NAME } from '../../constants';

interface InventoryViewProps {
  role: UserRole;
}

const InventoryView: React.FC<InventoryViewProps> = ({ role }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockEntryItem, setStockEntryItem] = useState<InventoryItem | null>(null);
  const [stockEntryQty, setStockEntryQty] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const initialFormState = {
    code: '', name: '', category: 'Mesas', price: '', replacementPrice: '', stock: '', description: '', type: 'PRODUCT', images: [], brand: '', model: '', presentationType: 'UNIT', quantityPerBox: 1, uses: '', extraNotes: ''
  };

  const [formData, setFormData] = useState<any>(initialFormState);
  const canDelete = role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
  const isSuperAdmin = role === UserRole.SUPER_ADMIN;

  useEffect(() => {
    const unsub = storageService.subscribeToInventory(setItems);
    return () => unsub();
  }, []);

  const handleDecimalChange = (value: string, field: string) => {
      const sanitized = value.replace(',', '.');
      if (sanitized === '' || /^\d*\.?\d*$/.test(sanitized)) {
        setFormData(prev => ({ ...prev, [field]: sanitized }));
      }
  };

  const generateUniqueCode = () => {
    const digits = Math.floor(100000 + Math.random() * 900000);
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return `${digits}${letters.charAt(Math.floor(Math.random() * letters.length))}${letters.charAt(Math.floor(Math.random() * letters.length))}`;
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setFormData({ ...initialFormState, category: 'Mesas', code: generateUniqueCode() });
    setIsModalOpen(true);
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({ 
        ...item, 
        price: item.price.toString(), 
        replacementPrice: (item.replacementPrice || 0).toString(), 
        stock: item.stock.toString(),
        presentationType: item.presentationType || 'UNIT',
        quantityPerBox: item.quantityPerBox || 1
    });
    setIsModalOpen(true);
  };

  const handlePrintInventory = async () => {
    const settings = await storageService.getSettings();
    const logo = settings?.logoUrl || COMPANY_LOGO;
    const name = settings?.name || COMPANY_NAME;
    const currentUser = storageService.getCurrentSession();

    const rows = filteredItems.map((item, index) => `
      <tr>
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${index + 1}</td>
        <td style="border: 1px solid #000; padding: 6px; font-weight: bold; text-transform: uppercase;">${item.name}</td>
        <td style="border: 1px solid #000; padding: 6px; font-family: monospace; font-size: 9px;">${item.code || '-'}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${item.type === 'SERVICE' ? '∞' : item.stock}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right;">$ ${item.price.toFixed(2)}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right;">$ ${(item.replacementPrice || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
      <html>
      <head>
        <title>Inventario Maestro - ${name}</title>
        <style>
          @page { size: A4; margin: 1cm; }
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
            <div style="font-size: 8px; font-weight: 700; color: #999; letter-spacing: 1px;">SISTEMA LOGISTIK PRO</div>
          </div>
        </div>
        <div class="title">Listado Maestro de Inventario</div>
        <table>
          <thead>
            <tr>
              <th width="5%">#</th>
              <th width="40%">Artículo / Mobiliario</th>
              <th width="15%">Código</th>
              <th width="10%">Stock</th>
              <th width="15%" style="text-align:right;">P. Alquiler</th>
              <th width="15%" style="text-align:right;">P. Reposición</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="footer">
          <div>Reporte generado el: ${new Date().toLocaleString()}</div>
          <div>Usuario: ${currentUser?.name || 'Admin'}</div>
          <div>Logistik v2.1.0</div>
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
      uiService.alert("Navegador Bloqueado", "Por favor habilite los popups para imprimir.");
    }
  };

  const handleExportExcel = () => {
    const headers = ['No', 'Nombre del Articulo', 'Codigo', 'Stock Actual', 'Precio Alquiler', 'Precio Reposicion'];
    const csvRows = [
      headers.join(';'),
      ...filteredItems.map((item, index) => [
        index + 1,
        `"${item.name}"`,
        `"${item.code || ''}"`,
        item.type === 'SERVICE' ? 'Infinito' : item.stock,
        item.price.toFixed(2),
        (item.replacementPrice || 0).toFixed(2)
      ].join(';'))
    ].join('\r\n');

    const blob = new Blob(["\ufeff" + csvRows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventario_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const performSave = async () => {
    try {
        const stockValue = formData.type === 'SERVICE' ? 999999 : (parseInt(formData.stock) || 0);
        const itemToSave = { 
            ...formData, 
            stock: stockValue, 
            price: parseFloat(formData.price) || 0, 
            replacementPrice: parseFloat(formData.replacementPrice) || 0, 
            id: editingItem ? editingItem.id : '' 
        } as InventoryItem;
        
        await storageService.saveInventoryItem(itemToSave);
        
        if (editingItem) {
            setIsModalOpen(false);
            await uiService.alert("Actualización Exitosa", "La ficha del activo ha sido actualizada en el catálogo.");
            setFormData(initialFormState);
        } else {
            const continueAdding = await uiService.confirm(
                "¡Artículo Registrado!", 
                "El producto se guardó correctamente. ¿Deseas ingresar otro artículo ahora?", 
                "Sí, ingresar otro", 
                "No, finalizar"
            );

            if (continueAdding) {
                setFormData({ 
                    ...initialFormState, 
                    category: formData.category, 
                    code: generateUniqueCode() 
                });
            } else {
                setIsModalOpen(false);
                setFormData(initialFormState);
            }
        }
    } catch (e: any) { 
        uiService.alert("Error de Sistema", e.message); 
    }
  };

  const handleUpdateStock = async () => {
      if (!stockEntryItem || !stockEntryQty) return;
      const change = parseInt(stockEntryQty);
      if (isNaN(change)) return;
      try {
          await storageService.updateStock(stockEntryItem.id, change);
          setIsStockModalOpen(false);
          setStockEntryQty('');
          await uiService.alert("Inventario Sincronizado", `Se ha ajustado el stock para "${stockEntryItem.name}".`);
      } catch (e: any) { uiService.alert("Error", e.message); }
  };

  const handleDeleteItem = async (item: InventoryItem) => {
      if (await uiService.confirm("Baja Definitiva", `¿Desea remover "${item.name}" del catálogo? Esta acción no se puede revertir.`)) {
          await storageService.deleteInventoryItem(item.id);
          await uiService.alert("Eliminado", "El artículo ha sido removido del sistema.");
      }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (item.code && item.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex-1 w-full relative group">
              <input 
                type="text" 
                placeholder="Buscar activo por nombre, código o categoría..." 
                className="w-full h-12 bg-white border border-zinc-100 rounded-2xl px-12 text-xs font-bold shadow-soft focus:ring-4 focus:ring-zinc-50 transition-all outline-none" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg grayscale opacity-30 group-focus-within:opacity-100 transition-opacity">🔍</span>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
              <button onClick={handleAddNew} className="h-12 px-6 bg-zinc-950 text-white rounded-xl font-black shadow-premium hover:bg-zinc-800 transition-all active:scale-95 flex items-center gap-3 uppercase text-[9px] tracking-widest flex-1 md:flex-none">
                + Activo
              </button>
          </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredItems.map(item => (
              <div key={item.id} className="bg-white rounded-2xl shadow-soft hover:shadow-premium transition-all duration-300 overflow-hidden border border-zinc-100 group flex flex-col h-72">
                  <div className="h-28 bg-zinc-50 relative overflow-hidden flex-none">
                      {item.images?.[0] ? (
                        <img src={item.images[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={item.name} />
                      ) : (
                        <div className="h-full flex items-center justify-center text-zinc-100 text-3xl">🪑</div>
                      )}
                      <div className="absolute top-2 left-2">
                         <span className={`px-2 py-0.5 rounded-lg text-[7px] font-black text-white tracking-widest uppercase shadow-md ${item.type === 'SERVICE' ? 'bg-zinc-900' : 'bg-brand-600'}`}>
                             {item.type === 'SERVICE' ? 'Serv' : 'Act'}
                         </span>
                      </div>
                      <div className="absolute bottom-2 right-2 bg-white/95 px-2 py-1 rounded-lg text-[10px] font-black text-zinc-900 shadow-sm border border-white">
                         $ {item.price.toFixed(2)}
                      </div>
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between">
                      <div className="overflow-hidden">
                        <span className="text-[7px] font-black text-brand-700 uppercase tracking-widest opacity-40 mb-0.5 block">{item.category}</span>
                        <h3 className="font-black text-zinc-950 leading-tight text-[10px] uppercase truncate" title={item.name}>{item.name}</h3>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2 bg-zinc-50/50 p-2 rounded-xl border border-zinc-100">
                         <div className="flex flex-col leading-none">
                            <span className="text-[6px] text-zinc-400 font-black uppercase tracking-widest">Stock</span>
                            <span className={`text-xs font-black ${item.type === 'PRODUCT' && item.stock < 5 ? 'text-red-500' : 'text-zinc-900'}`}>
                                {item.type === 'SERVICE' ? '∞' : item.stock}
                            </span>
                         </div>
                         {item.type === 'PRODUCT' && (
                            <button onClick={() => { setStockEntryItem(item); setIsStockModalOpen(true); }} className="w-7 h-7 bg-white text-zinc-400 rounded-lg hover:bg-zinc-950 hover:text-white transition-all font-black shadow-sm border border-zinc-100 flex items-center justify-center text-sm">+</button>
                         )}
                      </div>
                      
                      <div className="flex gap-1.5 mt-2 pt-2 border-t border-zinc-50">
                        <button onClick={() => handleEdit(item)} className="flex-1 py-1 bg-zinc-50 text-zinc-900 rounded-lg text-[7px] font-black uppercase hover:bg-zinc-100 transition-colors">
                            Ficha
                        </button>
                        {canDelete && (
                            <button onClick={() => handleDeleteItem(item)} className="w-7 h-7 flex items-center justify-center text-rose-200 hover:text-rose-600 transition-colors">
                                🗑️
                            </button>
                        )}
                      </div>
                  </div>
              </div>
          ))}
          {filteredItems.length === 0 && (
            <div className="col-span-full py-20 text-center opacity-20 uppercase font-black tracking-[0.5em] text-xs">
                Sin resultados
            </div>
          )}
      </div>

      {/* Stock Adjust Modal */}
      {isStockModalOpen && stockEntryItem && (
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-md flex items-center justify-center p-6 z-[200] animate-fade-in">
              <div className="bg-white rounded-[3rem] shadow-premium w-full max-w-sm p-12 text-center animate-slide-up border border-white">
                  <div className="w-20 h-20 bg-violet-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
                      <span className="text-4xl">📦</span>
                  </div>
                  <h3 className="text-2xl font-black text-zinc-900 mb-2 tracking-tighter uppercase">Gestión Stock</h3>
                  <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-10 truncate">{stockEntryItem.name}</p>
                  <div className="mb-10">
                      <input 
                        type="number" 
                        autoFocus
                        className="w-full bg-[#F8F9FA] border-none rounded-3xl h-24 text-center text-6xl font-black text-zinc-950 focus:ring-8 focus:ring-violet-50 transition-all outline-none shadow-inner" 
                        placeholder="0"
                        value={stockEntryQty}
                        onChange={e => setStockEntryQty(e.target.value)}
                      />
                  </div>
                  <div className="flex flex-col gap-4">
                      <button onClick={handleUpdateStock} className="w-full py-5 bg-zinc-950 text-white rounded-[1.5rem] font-black shadow-2xl hover:bg-zinc-800 transition-all uppercase text-[10px] tracking-widest">Sincronizar</button>
                      <button onClick={() => setIsStockModalOpen(false)} className="w-full py-3 text-zinc-300 font-black uppercase text-[9px]">Cerrar</button>
                  </div>
              </div>
          </div>
      )}

      {/* Ficha Técnica Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center p-4 z-[150] animate-fade-in">
              <div className="bg-[#FAF9F6] rounded-[4xl] shadow-premium w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-white animate-slide-up">
                  <div className="p-10 flex justify-between items-center border-b border-zinc-100 bg-white/50">
                      <div>
                        <h3 className="text-3xl font-black text-zinc-950 tracking-tighter uppercase">{editingItem ? 'Ficha de Activo' : 'Alta de Mobiliario'}</h3>
                        <p className="text-zinc-400 text-[9px] font-black uppercase tracking-[0.4em] mt-1">Control central de inventario Logistik</p>
                      </div>
                      <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 bg-white rounded-full shadow-soft flex items-center justify-center text-zinc-300 hover:text-zinc-950 transition-colors text-xl">✕</button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
                      <form onSubmit={(e) => { e.preventDefault(); performSave(); }} className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                          
                          <div className="space-y-8">
                                <div className="space-y-6">
                                   <div>
                                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block px-2">Denominación *</label>
                                      <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-white border border-zinc-100 rounded-2xl h-14 px-6 text-sm font-bold shadow-soft outline-none focus:ring-4 focus:ring-brand-50" />
                                   </div>
                                   <div className="grid grid-cols-2 gap-4">
                                      <div>
                                         <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block px-2">Categoría</label>
                                         <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-white border border-zinc-100 rounded-2xl h-14 px-6 text-sm font-bold outline-none cursor-pointer shadow-soft">
                                            <option value="Mesas">Mesas</option><option value="Sillas">Sillas</option><option value="Vajilla">Vajilla</option><option value="Cristalería">Cristalería</option><option value="Mantelería">Mantelería</option><option value="Equipos">Equipos</option><option value="Servicios">Servicios</option><option value="Otros">Otros</option>
                                         </select>
                                      </div>
                                      <div>
                                         <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block px-2">Código Interno</label>
                                         <input readOnly value={formData.code} className="w-full bg-zinc-50 border-none rounded-2xl h-14 px-6 text-sm font-mono text-zinc-400 font-bold" />
                                      </div>
                                   </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6 pt-4">
                                   <div className="bg-white p-4 rounded-2xl shadow-soft">
                                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">Precio Renta ($)</label>
                                      <input required type="text" inputMode="decimal" value={formData.price} onChange={e => handleDecimalChange(e.target.value, 'price')} className="w-full bg-zinc-50 border-none rounded-xl h-12 px-4 text-lg font-black text-brand-800" placeholder="0.00" />
                                   </div>
                                   <div className="bg-white p-4 rounded-2xl shadow-soft">
                                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">Valor Reposición</label>
                                      <input type="text" inputMode="decimal" value={formData.replacementPrice} onChange={e => handleDecimalChange(e.target.value, 'replacementPrice')} className="w-full bg-zinc-50 border-none rounded-xl h-12 px-4 text-lg font-black text-zinc-900" placeholder="0.00" />
                                   </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Naturaleza</label>
                                    <div className="flex p-1.5 bg-zinc-100 rounded-2xl">
                                        <button type="button" onClick={() => setFormData({...formData, type: 'PRODUCT'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${formData.type === 'PRODUCT' ? 'bg-white shadow-md text-zinc-950' : 'text-zinc-400'}`}>Mobiliario</button>
                                        <button type="button" onClick={() => setFormData({...formData, type: 'SERVICE'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${formData.type === 'SERVICE' ? 'bg-white shadow-md text-zinc-950' : 'text-zinc-400'}`}>Servicio</button>
                                    </div>
                                    {formData.type === 'PRODUCT' && (
                                        <div className="animate-fade-in">
                                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block px-2">Stock Inicial</label>
                                            <input required type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full bg-white border border-zinc-100 rounded-2xl h-14 px-6 text-sm font-bold shadow-soft outline-none focus:ring-4 focus:ring-brand-50" />
                                        </div>
                                    )}
                                </div>
                          </div>

                          <div className="space-y-8">
                                <div className="w-full aspect-video bg-white rounded-[2.5rem] border-4 border-dashed border-zinc-100 flex flex-col items-center justify-center p-4 relative group overflow-hidden shadow-soft">
                                    {formData.images?.[0] ? (
                                        <img src={formData.images[0]} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Vista" />
                                    ) : (
                                        <div className="text-center opacity-30">
                                            <span className="text-5xl block mb-2">📸</span>
                                            <p className="text-[9px] font-black uppercase tracking-widest">Imagen Principal</p>
                                        </div>
                                    )}
                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (up) => setFormData(p => ({...p, images: [up.target?.result as string]}));
                                            reader.readAsDataURL(file);
                                        }
                                    }} />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                   <div>
                                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 block ml-2">Marca</label>
                                      <input type="text" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="w-full bg-white border border-zinc-100 rounded-xl h-12 px-5 text-xs font-bold shadow-sm" />
                                   </div>
                                   <div>
                                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 block ml-2">Modelo</label>
                                      <input type="text" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} className="w-full bg-white border border-zinc-100 rounded-xl h-12 px-5 text-xs font-bold shadow-sm" />
                                   </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block ml-2">Notas Especiales</label>
                                    <textarea value={formData.extraNotes} onChange={e => setFormData({...formData, extraNotes: e.target.value})} className="w-full bg-white border border-zinc-100 rounded-[2rem] p-6 text-sm font-bold shadow-soft outline-none focus:ring-4 focus:ring-brand-50" rows={3} placeholder="Instrucciones de transporte o fragilidad..." />
                                </div>
                          </div>

                          <div className="lg:col-span-2 flex justify-end pt-6 gap-6 border-t border-zinc-100">
                              <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 h-14 rounded-2xl text-zinc-400 font-black text-[10px] uppercase tracking-widest hover:text-zinc-600">Cancelar</button>
                              <button type="submit" className="px-16 h-14 bg-brand-900 text-white rounded-3xl font-black shadow-premium hover:bg-black transition-all active:scale-95 uppercase text-[10px] tracking-widest">
                                 {editingItem ? 'Sincronizar Ficha' : 'Guardar en Catálogo'}
                              </button>
                          </div>
                      </form>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default InventoryView;
