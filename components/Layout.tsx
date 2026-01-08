import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { uiService } from '../services/uiService';
import { COMPANY_LOGO, COMPANY_NAME, APP_VERSION } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  currentView: string;
  onNavigate: (view: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, currentView, onNavigate }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [globalModal, setGlobalModal] = useState<any>(null);

  useEffect(() => {
    return uiService.subscribe(setGlobalModal);
  }, []);

  const menuItems = [
    { id: 'quotes', label: 'Proformas', icon: '📝' },
    { id: 'events', label: 'Registro de Pedidos', icon: '📅' },
    { id: 'dispatch', label: 'Despachos y Logística', icon: '🚚' },
  ];

  return (
    <div className="min-h-screen flex bg-[#FAF9F6] flex-col md:flex-row">
      <aside className={`no-print fixed md:sticky top-0 left-0 h-screen z-[70] w-64 bg-white border-r border-zinc-100 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} flex flex-col shadow-sm`}>
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-zinc-50 rounded-2xl mb-4 p-2 flex items-center justify-center border border-zinc-100">
             <img src={COMPANY_LOGO} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-brand-900 text-[10px] font-black uppercase leading-none tracking-tighter">{COMPANY_NAME}</h2>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {menuItems.map((item) => (
            <button 
              key={item.id}
              onClick={() => { onNavigate(item.id); setIsSidebarOpen(false); }} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === item.id ? 'bg-brand-900 text-white shadow-lg' : 'text-zinc-400 hover:bg-zinc-50'}`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-6 border-t border-zinc-50">
           <button onClick={onLogout} className="w-full py-3 bg-zinc-50 text-zinc-400 rounded-xl text-[9px] font-black uppercase border border-zinc-100">Cerrar Sesión</button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="no-print h-16 bg-white/80 backdrop-blur-md border-b border-zinc-100 flex items-center justify-between px-6">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-zinc-400">☰</button>
          <h1 className="text-[10px] font-black uppercase text-brand-900 tracking-widest">
            {menuItems.find(m => m.id === currentView)?.label || 'Sistema Logistik'}
          </h1>
          <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-[10px] font-black text-brand-900 border border-brand-100">
            {user.name.charAt(0)}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
          {children}
        </main>
      </div>

      {globalModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6 no-print">
              <div className="bg-white rounded-[2rem] shadow-premium w-full max-w-sm p-10 text-center animate-slide-up">
                  <h3 className="text-lg font-black text-brand-900 uppercase mb-2">{globalModal.title}</h3>
                  <p className="text-zinc-400 text-[10px] mb-8 font-bold uppercase">{globalModal.message}</p>
                  <div className="flex flex-col gap-2">
                      <button onClick={() => { globalModal.resolve(true); setGlobalModal(null); }} className="w-full py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-[9px]">
                          {globalModal.confirmText || 'Aceptar'}
                      </button>
                      {globalModal.type === 'CONFIRM' && (
                          <button onClick={() => { globalModal.resolve(false); setGlobalModal(null); }} className="w-full py-3 text-zinc-300 font-bold uppercase text-[8px]">
                              {globalModal.cancelText || 'Cancelar'}
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Layout;