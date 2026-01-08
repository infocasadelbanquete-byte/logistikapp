import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';

interface WriteOffItem {
    id: string;
    name: string;
    code?: string;
    currentStock: number;
    writeOffQuantity: number;
    reason: string;
}

const WriteOffsView: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<WriteOffItem[]>([]);
  const [globalReason, setGlobalReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsub = storageService.subscribeToInventory((items) => {
        setInventory(items.filter(i => i.type === 'PRODUCT'));
    });
    return () => unsub();
  }, []);

  const handleAddItem = (item: InventoryItem) => {
      if (selectedItems.some(i => i.id === item.id)) return;
      setSelectedItems([ ...selectedItems, { id: item.id, name: item.name, code: item.code, currentStock: item.stock, writeOffQuantity: 1, reason: '' } ]);
  };

  const handleRemoveItem = (id: string) => { setSelectedItems(selectedItems.filter(i => i.id !== id)); };

  const handleQuantityChange = (id: string, qty: number) => {
      setSelectedItems(selectedItems.map(item => {
          if (item.id === id) {
              const validQty = Math.max(1, Math.min(qty, item.currentStock));
              return { ...item, writeOffQuantity: validQty };
          }
          return item;
      }));
  };

  const handleProcessWriteOff = async () => {
      if (selectedItems.length === 0) { await uiService.alert("Aviso", "No hay items seleccionados para dar de baja."); return; }
      if (!globalReason.trim()) { await uiService.alert("Requerido", "Por favor ingrese un motivo general para la baja (Ej. Obsoleto, Roto, Pérdida)."); return; }

      const itemSummary = selectedItems.map(i => `• ${i.name}: ${i.writeOffQuantity} unidades`).join('\n');
      const message = `¿Está seguro que desea dar de baja los siguientes productos del inventario físico?\n\n${itemSummary}\n\nMotivo: ${globalReason}\n\nEsta acción es irreversible y descontará el stock inmediatamente.`;

      if (await uiService.confirm("Confirmar Bajas", message)) {
          setIsProcessing(true);
          try {
              for (const item of selectedItems) { await storageService.updateStock(item.id, -item.writeOffQuantity); }
              await uiService.alert("Éxito", "Proceso finalizado. Los productos han sido dados de baja del inventario.");
              setSelectedItems([]);
              setGlobalReason('');
          } catch (error) {
              console.error(error);
              await uiService.alert("Error", "Hubo un error al procesar las bajas.");
          } finally {
              setIsProcessing(false);
          }
      }
  };

  const filteredInventory = inventory.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || (item.code && item.code.toLowerCase().includes(searchQuery.toLowerCase())));

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col md:flex-row gap-6">
      <div className="md:w-1/2 flex flex-col bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b bg-gray-50"><h3 className="font-bold text-gray-800 mb-2">1. Seleccionar Productos</h3><div className="relative"><input type="text" placeholder="🔍 Buscar por nombre o código..." className="w-full border p-2 rounded pl-8 focus:ring-brand-500 focus:border-brand-500" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div></div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">{filteredInventory.length === 0 ? (<p className="text-gray-400 text-center mt-10">No se encontraron productos.</p>) : (filteredInventory.map(item => { const isSelected = selectedItems.some(si => si.id === item.id); return (<div key={item.id} className={`flex justify-between items-center p-3 border rounded transition-colors ${isSelected ? 'bg-gray-100 opacity-50' : 'hover:bg-gray-50'}`}><div><div className="font-medium text-gray-800">{item.name}</div><div className="text-xs text-gray-500">Código: {item.code || 'N/A'} | Stock Físico: <span className="font-bold text-gray-700">{item.stock}</span></div></div><button onClick={() => handleAddItem(item)} disabled={isSelected || item.stock <= 0} className={`px-3 py-1 rounded text-sm font-bold ${isSelected ? 'text-gray-400 cursor-not-allowed' : 'bg-brand-100 text-brand-700 hover:bg-brand-200'}`}>{isSelected ? 'Seleccionado' : 'Agregar'}</button></div>); }))}</div>
      </div>
      <div className="md:w-1/2 flex flex-col bg-white rounded-lg shadow h-full">
          <div className="p-4 border-b bg-red-50"><h3 className="font-bold text-red-800 flex items-center gap-2"><span>🗑️</span> 2. Items a Dar de Baja</h3></div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">{selectedItems.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg"><span className="text-4xl mb-2">📋</span><p>Seleccione productos de la lista izquierda</p></div>) : (selectedItems.map(item => (<div key={item.id} className="border border-red-100 rounded-lg p-3 bg-white shadow-sm flex flex-col gap-2"><div className="flex justify-between items-start"><div><span className="font-bold text-gray-800">{item.name}</span><div className="text-xs text-gray-500">Disp: {item.currentStock}</div></div><button onClick={() => handleRemoveItem(item.id)} className="text-red-400 hover:text-red-600 font-bold px-2">✕</button></div><div className="flex items-center gap-4 bg-gray-50 p-2 rounded"><label className="text-xs font-bold text-gray-600">Cantidad a eliminar:</label><input type="number" min="1" max={item.currentStock} className="w-20 border border-gray-300 rounded p-1 text-center font-bold text-red-600 focus:ring-red-500 focus:border-red-500" value={item.writeOffQuantity} onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)} /></div></div>)))}</div>
          <div className="p-4 border-t bg-gray-50 space-y-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">Motivo de la Baja (Requerido)</label><textarea className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-brand-500 focus:border-brand-500" rows={2} placeholder="Ej. Mobiliario roto en evento, obsoleto por desgaste, pérdida en bodega..." value={globalReason} onChange={(e) => setGlobalReason(e.target.value)}></textarea></div><button onClick={handleProcessWriteOff} disabled={isProcessing || selectedItems.length === 0} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all">{isProcessing ? 'Procesando...' : '⚠️ Finalizar y Dar de Baja'}</button></div>
      </div>
    </div>
  );
};

export default WriteOffsView;