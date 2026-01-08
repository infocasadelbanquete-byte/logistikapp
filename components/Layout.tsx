import React, { useState, useEffect } from 'react';
import { UserRole, User, AppNotification } from '../types';
import { storageService } from '../services/storageService';
import { uiService } from '../services/uiService';
import { COMPANY_LOGO, COMPANY_NAME, APP_VERSION } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  currentView: string;
  onNavigate: (view: string) => void;
  onRefresh: () => void;
  onHome?: () => void;
  canGoBack?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ 
    children, 
    user, 
    onLogout, 
    currentView, 
    onNavigate, 
    onRefresh,
    onHome,
    canGoBack 
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [companyName, setCompanyName] = useState(COMPANY_NAME);
  const [companyLogo, setCompanyLogo] = useState(COMPANY_LOGO);
  const [globalModal, setGlobalModal] = useState<any>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const unsubUi = uiService.subscribe(setGlobalModal);
    const unsubNotif = storageService.subscribeToNotifications(data => {
        setUnreadCount(data.filter(n => !n.isRead).length);
    });
    const unsubSettings = storageService.subscribeToSettings(settings => {
        if (settings) {
            setCompanyName(settings.name || COMPANY_NAME);
            setCompanyLogo(settings.logoUrl || COMPANY_LOGO);
        }
    });

    const handleBeforeInstall = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => { unsubUi(); unsubNotif(); unsubSettings(); window.removeEventListener('beforeinstallprompt', handleBeforeInstall); };
  }, []);

  const handleInstallApp = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleModalResolve = (val: any) => {
      if (globalModal?.resolve) globalModal.resolve(val);
      setGlobalModal(null);
  };

  // RESTRICCIONES DE ROLES SEGÚN SOLICITUD
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'quotes', label: 'Proformas', icon: '📝', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'events', label: 'Pedidos', icon: '📅', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'dispatch', label: 'Logística', icon: '🚚', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'returns', label: 'Retornos', icon: '📥', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'payments', label: 'Caja', icon: '💲', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'inventory', label: 'Catálogo', icon: '🪑', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'clients', label: 'Directorio', icon: '👥', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    // Módulos Críticos (Solo Super Admin)
    { id: 'purchases', label: 'Egresos', icon: '🛒', roles: [UserRole.SUPER_ADMIN] },
    { id: 'accounting', label: 'Contabilidad', icon: '🏛️', roles: [UserRole.SUPER_ADMIN] },
    { id: 'reports', label: 'Reportes Gen.', icon: '📈', roles: [UserRole.SUPER_ADMIN] },
    { id: 'users', label: 'Usuarios', icon: '🔐', roles: [UserRole.SUPER_ADMIN] },
    { id: 'settings', label: 'Ajustes', icon: '⚙️', roles: [UserRole.SUPER_ADMIN] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="min-h-screen flex bg-[#FAF9F6] flex-col md:flex-row">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`no-print fixed md:sticky top-0 left-0 h-screen z-[70] w-64 bg-white border-r border-zinc-100 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} flex flex-col shadow-sm`}>
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-zinc-50 rounded-2xl mb-4 p-2 flex items-center justify-center border border-zinc-100 shadow-inner">
             <img src={companyLogo} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-brand-900 text-xs font-black tracking-tighter uppercase leading-none">{companyName}</h2>
          <span className="text-[7px] text-zinc-300 mt-2 font-black tracking-[0.3em] uppercase">Logistik Pro v{APP_VERSION}</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 space-y-1 scrollbar-hide">
          {filteredMenu.map((item) => (
            <button 
              key={item.id}
              onClick={() => { onNavigate(item.id); setIsSidebarOpen(false); }} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === item.id ? 'bg-brand-900 text-white shadow-lg' : 'text-zinc-400 hover:bg-zinc-50'}`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[10px] font-black tracking-widest uppercase">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-zinc-50 space-y-3">
           {deferredPrompt && (
              <button onClick={handleInstallApp} className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md flex items-center justify-center gap-2">
                <span>📲</span> Instalar App
              </button>
           )}
           <button onClick={onLogout} className="w-full py-3 bg-zinc-50 text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest border border-zinc-100 hover:text-rose-500">Cerrar Sesión</button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="no-print h-16 bg-white/80 backdrop-blur-md border-b border-zinc-100 flex items-center justify-between px-6 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-zinc-50 rounded-xl text-zinc-400">☰</button>
          <div className="flex items-center gap-4">
            <h1 className="text-[10px] font-black uppercase text-brand-900 tracking-widest hidden sm:block">{filteredMenu.find(m => m.id === currentView)?.label}</h1>
          </div>
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-[10px] font-black text-brand-900 border border-brand-100">
                {user.name.charAt(0)}
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
          {children}
        </main>
      </div>

      {globalModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-fade-in no-print">
              <div className="bg-white rounded-[2.5rem] shadow-premium w-full max-w-sm p-10 text-center animate-slide-up">
                  <div className="text-4xl mb-6">{globalModal.type === 'CONFIRM' ? '❓' : '💡'}</div>
                  <h3 className="text-lg font-black text-brand-900 uppercase mb-2">{globalModal.title}</h3>
                  <p className="text-zinc-400 text-[10px] mb-8 font-bold uppercase tracking-tight leading-relaxed">{globalModal.message}</p>
                  <div className="flex flex-col gap-2">
                      <button onClick={() => handleModalResolve(true)} className="w-full py-4 bg-brand-900 text-white rounded-2xl font-black shadow-lg uppercase text-[9px] tracking-widest">
                          {globalModal.confirmText || 'Aceptar'}
                      </button>
                      {globalModal.type !== 'ALERT' && (
                          <button onClick={() => handleModalResolve(false)} className="w-full py-3 text-zinc-300 font-bold uppercase text-[8px]">
                              {globalModal.cancelText || 'Cerrar'}
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