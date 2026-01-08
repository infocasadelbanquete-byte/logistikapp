import React, { useRef, useState, useEffect } from 'react';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService'; // Import uiService
import { isAiConfigured } from '../../services/geminiService';
import { COMPANY_NAME, COMPANY_SLOGAN, COMPANY_LOGO } from '../../constants';

const SettingsView: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{status: string, msg: string} | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
      const load = async () => {
          const settings = await storageService.getSettings();
          if (settings) { setName(settings.name); setSlogan(settings.slogan); setLogoUrl(settings.logoUrl); } else { setName(COMPANY_NAME); setSlogan(COMPANY_SLOGAN); setLogoUrl(COMPANY_LOGO); }
      };
      load();
  }, []);

  const handleSaveIdentity = async () => {
      if (!name) return uiService.alert("Requerido", "El nombre es obligatorio");
      setLoading(true);
      await storageService.saveSettings({ name, slogan, logoUrl: logoUrl || COMPANY_LOGO });
      setLoading(false);
      await uiService.alert("Éxito", "Identidad actualizada correctamente.");
  };

  const runConnectionTest = async () => {
      setIsTesting(true);
      setTestResult(null);
      const result = await storageService.testConnection();
      setTestResult({ status: result.success ? 'SUCCESS' : 'ERROR', msg: result.message + (result.details ? ` (${result.details})` : '') });
      setIsTesting(false);
  };

  const handleDownloadBackup = async () => {
    const data = await storageService.getFullBackup();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    const date = new Date().toISOString().split('T')[0];
    downloadAnchorNode.setAttribute("download", `eventospro_backup_${date}.json`);
    document.body.appendChild(downloadAnchorNode); downloadAnchorNode.click(); downloadAnchorNode.remove();
  };

  const handleRestoreBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (await uiService.confirm("Restaurar Datos", "⚠️ ¿Estás seguro? Esto reemplazará TODOS los datos actuales con los del archivo de respaldo. Esta acción no se puede deshacer.")) {
            const success = await storageService.restoreBackup(json);
            if (success) {
                await uiService.alert("Éxito", "Datos restaurados correctamente. La aplicación se recargará.");
                window.location.reload();
            } else {
                await uiService.alert("Error", "Error al procesar el archivo de respaldo.");
            }
        }
      } catch (error) { await uiService.alert("Error", "El archivo seleccionado no es válido."); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFactoryReset = async () => {
      const confirmText = "ELIMINAR-TODO";
      const input = await uiService.prompt("Zona de Peligro", `PELIGRO: Esto borrará todos los clientes, eventos e inventario.\n\nPara confirmar escribe "${confirmText}":`);
      if (input === confirmText) {
          await storageService.clearAllData();
          await uiService.alert("Reset", "Sistema reiniciado de fábrica.");
          window.location.reload();
      }
  };

  return (
    <div className="space-y-6 pb-12">
      <h2 className="text-2xl font-bold text-gray-800">Configuración del Sistema</h2>
      {/* ... (Existing JSX for Diagnostics and Identity Form, no alert changes needed here) ... */}
      <div className="bg-gray-800 text-white p-6 rounded-lg shadow-lg"><div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3"><h3 className="font-bold text-lg flex items-center gap-2"><span>📡</span> Diagnóstico de Conexión</h3><div className="flex gap-2"><div className={`px-2 py-1 rounded text-xs font-bold ${storageService.isCloudConnected() ? 'bg-green-600 text-white' : 'bg-orange-500 text-white'}`}>{storageService.isCloudConnected() ? 'NUBE (Firebase)' : 'LOCAL (Offline)'}</div><div className={`px-2 py-1 rounded text-xs font-bold ${isAiConfigured() ? 'bg-purple-600 text-white' : 'bg-gray-600 text-gray-300'}`}>{isAiConfigured() ? 'IA ACTIVA' : 'IA INACTIVA'}</div></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm"><div><p className="text-gray-400 mb-1">Estado de Variables:</p><ul className="space-y-1 font-mono text-xs"><li className="flex justify-between border-b border-gray-700 pb-1"><span>Base de Datos:</span> <span className={storageService.isCloudConnected() ? 'text-green-400' : 'text-orange-400'}>{storageService.isCloudConnected() ? 'CONECTADA' : 'SIN CONEXIÓN'}</span></li><li className="flex justify-between border-b border-gray-700 pb-1"><span>Gemini AI:</span> <span className={isAiConfigured() ? 'text-purple-400' : 'text-gray-500'}>{isAiConfigured() ? 'LISTO' : 'NO CONFIGURADO'}</span></li></ul>{!isAiConfigured() && (<p className="text-[10px] text-gray-500 mt-2 italic">Nota: Para activar la IA, edita <code>services/geminiService.ts</code> y pega tu API Key manualmente.</p>)}</div><div className="flex flex-col justify-end"><button onClick={runConnectionTest} disabled={isTesting} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50">{isTesting ? 'Probando conexión...' : '🔄 Probar Conexión con Firebase'}</button>{testResult && (<div className={`mt-3 p-3 rounded border ${testResult.status === 'SUCCESS' ? 'bg-green-900/50 border-green-500 text-green-300' : 'bg-red-900/50 border-red-500 text-red-300'}`}><strong>Resultado:</strong> {testResult.msg}</div>)}</div></div></div>
      <div className="bg-white p-6 rounded-lg shadow border-l-4 border-brand-500"><h3 className="font-bold text-lg text-brand-900 mb-4 flex items-center gap-2"><span>🏢</span> Identidad de la Empresa</h3><p className="text-sm text-gray-500 mb-4">Estos datos aparecerán en la barra lateral, reportes y proformas.</p><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-4"><div><label className="block text-sm font-medium text-gray-700">Nombre de la Empresa</label><input className="w-full border p-2 rounded mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Mi Evento Pro" /></div><div><label className="block text-sm font-medium text-gray-700">Eslogan / Subtítulo</label><input className="w-full border p-2 rounded mt-1" value={slogan} onChange={e => setSlogan(e.target.value)} placeholder="Ej. Renta de Mobiliario" /></div><div><label className="block text-sm font-medium text-gray-700">URL del Logotipo</label><input className="w-full border p-2 rounded mt-1" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." /><p className="text-xs text-gray-400 mt-1">Debe ser una URL pública de imagen (png/jpg)</p></div></div><div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg p-4 bg-gray-50"><span className="text-xs text-gray-400 mb-2">Vista Previa</span>{logoUrl ? (<img src={logoUrl} className="h-24 object-contain mb-2" alt="Preview" onError={(e) => (e.currentTarget.src = COMPANY_LOGO)} />) : (<div className="h-24 w-24 bg-gray-200 rounded-full flex items-center justify-center text-gray-400">Sin Logo</div>)}<h4 className="font-bold text-brand-900">{name || 'Nombre Empresa'}</h4><p className="text-xs text-gray-500">{slogan || 'Eslogan'}</p></div></div><div className="mt-4 flex justify-end"><button onClick={handleSaveIdentity} disabled={loading} className="bg-brand-600 text-white px-4 py-2 rounded shadow hover:bg-brand-700 font-bold">{loading ? 'Guardando...' : 'Guardar Identidad'}</button></div></div>
      <hr className="border-gray-200" /><h3 className="text-xl font-bold text-gray-800">Seguridad y Datos</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500"><div className="flex items-center gap-3 mb-4"><span className="text-3xl">💾</span><div><h3 className="font-bold text-lg">Copia de Seguridad</h3><p className="text-sm text-gray-500">Exportar datos a archivo JSON</p></div></div><p className="text-sm text-gray-600 mb-6">Descargue un archivo con toda la información de clientes, inventario, eventos y pagos. Guarde este archivo en un lugar seguro (nube, USB, correo).</p><button onClick={handleDownloadBackup} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors flex justify-center items-center gap-2">⬇️ Descargar Respaldo</button></div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500"><div className="flex items-center gap-3 mb-4"><span className="text-3xl">♻️</span><div><h3 className="font-bold text-lg">Restaurar Datos</h3><p className="text-sm text-gray-500">Importar desde archivo</p></div></div><p className="text-sm text-gray-600 mb-6">Cargue un archivo de respaldo previamente generado. Útil para cambiar de dispositivo o recuperar información perdida.</p><input type="file" accept=".json" ref={fileInputRef} onChange={handleRestoreBackup} className="hidden" /><button onClick={() => fileInputRef.current?.click()} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors flex justify-center items-center gap-2">⬆️ Cargar Respaldo</button></div>
         <div className="bg-red-50 p-6 rounded-lg shadow border border-red-200 md:col-span-2 mt-4"><h3 className="font-bold text-red-800 mb-2">Zona de Peligro</h3><div className="flex flex-col md:flex-row justify-between items-center gap-4"><p className="text-sm text-red-700">Si desea limpiar la aplicación completamente para empezar desde cero (borrará todo el historial local).</p><button onClick={handleFactoryReset} className="bg-white border border-red-500 text-red-600 hover:bg-red-600 hover:text-white font-bold py-2 px-4 rounded transition-colors text-sm whitespace-nowrap">⚠️ Reiniciar de Fábrica</button></div></div>
      </div>
    </div>
  );
};

export default SettingsView;