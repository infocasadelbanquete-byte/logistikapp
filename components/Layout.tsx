
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { COMPANY_LOGO, COMPANY_NAME } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  currentView: string;
  onNavigate: (view: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  role?: UserRole;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, currentView, onNavigate }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const menu: MenuSection[] = [
    { title: 'OPERACIONES', items: [
      { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
      { id: 'events', label: 'Nuevo Pedido', icon: '🛒' },
      { id: 'quotes', label: 'Proformas', icon: '📝' },
      { id: 'dispatch', label: 'Despachos', icon: '🚚' },
      { id: 'returns', label: 'Ingresos', icon: '📥' },
    ]},
    { title: 'ADMINISTRACIÓN', items: [
      { id: 'accounting', label: 'Contabilidad', icon: '🧾' },
      { id: 'payments', label: 'Caja / Cartera', icon: '💰' },
      { id: 'inventory', label: 'Inventario', icon: '🪑' },
      { id: 'clients', label: 'Clientes', icon: '👥' },
    ]},
    { title: 'SISTEMA', items: [
      { id: 'users', label: 'Usuarios', icon: '🔐', role: UserRole.SUPER_ADMIN },
      { id: 'settings', label: 'Configuración', icon: '⚙️', role: UserRole.SUPER_ADMIN },
    ]}
  ];

  return (
    <div className="min-h-screen flex bg-zinc-50 flex-col md:flex-row font-sans">
      <aside className={`no-print fixed md:sticky top-0 left-0 h-screen z-[70] w-64 bg-white border-r border-zinc-200 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} flex flex-col shadow-xl`}>
        <div className="p-8 flex flex-col items-center">
          <img src={COMPANY_LOGO} alt="Logo" className="w-16 h-16 mb-2 object-contain" />
          <h2 className="text-brand-900 text-xs font-black uppercase tracking-tighter text-center">{COMPANY_NAME}</h2>
        </div>
        
        <nav className="flex-1 px-4 space-y-6 overflow-y-auto scrollbar-hide pb-10">
          {menu.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <p className="px-4 text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2 opacity-50">{section.title}</p>
              {section.items.filter(i => !i.role || user.role === i.role).map(item => (
                <button 
                  key={item.id}
                  onClick={() => { onNavigate(item.id); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-left ${currentView === item.id ? 'bg-brand-900 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50'}`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-6 border-t border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-900 font-bold text-xs">{user.name.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase truncate">{user.name}</p>
              <p className="text-[8px] font-bold text-zinc-400 uppercase">{user.role}</p>
            </div>
          </div>
          <button onClick={onLogout} className="w-full py-2.5 bg-white text-rose-500 rounded-xl text-[9px] font-black uppercase border border-rose-100 hover:bg-rose-50 transition-colors">Cerrar Sesión</button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="no-print h-16 bg-white/80 backdrop-blur-md border-b border-zinc-200 flex items-center justify-between px-6 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-zinc-400">☰</button>
          <div className="flex items-center gap-4">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <h1 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Sincronizado en tiempo real</h1>
          </div>
          <div className="text-[10px] font-black text-brand-900 bg-brand-50 px-3 py-1 rounded-full border border-brand-100 uppercase">
            {new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
