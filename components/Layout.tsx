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
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [companyName, setCompanyName] = useState(COMPANY_NAME);
  const [companyLogo, setCompanyLogo] = useState(COMPANY_LOGO);
  const [globalModal, setGlobalModal] = useState<any>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [cloudStatus, setCloudStatus] = useState<'ONLINE' | 'OFFLINE'>('OFFLINE');

  useEffect(() => {
    const unsubUi = uiService.subscribe(setGlobalModal);
    const unsubNotif = storageService.subscribeToNotifications(data => {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.isRead).length);
    });
    const unsubSettings = storageService.subscribeToSettings(settings => {
        if (settings) {
            setCompanyName(settings.name || COMPANY_NAME);
            setCompanyLogo(settings.logoUrl || COMPANY_LOGO);
        }
    });

    // Verificar estado de conexión
    setCloudStatus(storageService.isCloudConnected() ? 'ONLINE' : 'OFFLINE');

    const handleBeforeInstall = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    if (window.matchMedia('(display-mode: standalone)').matches) {
        setDeferredPrompt(null);
    }

    return () => { 
        unsubUi(); 
        unsubNotif(); 
        unsubSettings(); 
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallApp = async () => {
      if (!deferredPrompt) {
          uiService.alert("Instalación", "Si estás en iOS: Toca 'Compartir' y luego 'Añadir a pantalla de inicio'.");
          return;
      }
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleModalResolve = (val: any) => {
      if (globalModal?.resolve) globalModal.resolve(val);
      setGlobalModal(null);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Inicio', icon: '📊', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'events', label: 'Pedidos', icon: '📅', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'quotes', label: 'Proformas', icon: '📝', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'inventory', label: 'Catálogo', icon: '🪑', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'dispatch', label: 'Logística', icon: '🚚', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'returns', label: 'Retornos', icon: '📥', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'purchases', label: 'Compras', icon: '🛒', roles: [UserRole.SUPER_ADMIN] },
    { id: 'accounting', label: 'Contabilidad', icon: '🏛️', roles: [UserRole.SUPER_ADMIN] },
    { id: 'invoicing', label: 'Facturación', icon: '🧾', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
    { id: 'payments', label: 'Caja', icon: '💲', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'clients', label: 'Directorio', icon: '👥', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'reports', label: 'Reportes', icon: '📈', roles: [UserRole.SUPER_ADMIN] },
    { id: 'users', label: 'Equipo', icon: '🔐', roles: [UserRole.SUPER_ADMIN] },
    { id: 'settings', label: 'Ajustes', icon: '⚙️', roles: [UserRole.SUPER_ADMIN] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="min-h-screen flex bg-[#FDFDFD]">
      {isSidebarOpen && <div className="fixed inset-0 bg-zinc-900/10 backdrop-blur-sm z-[60] md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`no-print fixed md:sticky top-0 left-0 h-screen z-[70] w-64 bg-white border-r border-zinc-100 transition-all duration-500 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} flex flex-col shadow-sm`}>
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-zinc-50 rounded-2xl mb-4 p-2 flex items-center justify-center overflow-hidden border border-zinc-50 shadow-inner">
             <img src={companyLogo} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-brand-900 text-sm font-extrabold tracking-tighter leading-none uppercase">{companyName}</h2>
          <span className="text-[8px] text-zinc-300 mt-2 font-black tracking-widest uppercase">Admin Suite v{APP_VERSION}</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-4 scrollbar-hide">
          {filteredMenu.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button 
                key={item.id}
                onClick={() => { onNavigate(item.id); setIsSidebarOpen(false); }} 
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group ${isActive ? 'bg-zinc-50 text-brand-900 font-bold' : 'text-zinc-400 hover:bg-zinc-50/50 hover:text-zinc-600'}`}
              >
                <span className={`text-lg transition-transform duration-300 ${isActive ? 'scale-105' : 'grayscale opacity-50 group-hover:opacity-100'}`}>{item.icon}</span>
                <span className="text-[10px] font-bold tracking-widest uppercase">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-6 bg-zinc-50/30 border-t border-zinc-50 space-y-3">
           <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">Sincronización</span>
              <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${cloudStatus === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-orange-400'}`}></div>
                  <span className={`text-[7px] font-black uppercase ${cloudStatus === 'ONLINE' ? 'text-emerald-600' : 'text-orange-500'}`}>{cloudStatus}</span>
              </div>
           </div>

           {deferredPrompt && (
              <button onClick={handleInstallApp} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-black transition-all duration-300 uppercase tracking-widest shadow-lg flex items-center justify-center gap-2">
                <span>📲</span> Instalar App
              </button>
           )}

           <div className="flex items-center gap-3 mb-4 px-1">
              <div className="w-8 h-8 rounded-xl bg-zinc-200 flex items-center justify-center text-[10px] font-black text-zinc-600 uppercase">
                {user.name.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <p className="text-[10px] font-black text-zinc-800 truncate uppercase">{user.name.split(' ')[0]}</p>
                <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-tighter">{user.role === UserRole.SUPER_ADMIN ? 'Gerencia' : 'Operaciones'}</p>
              </div>
           </div>
           <button onClick={onLogout} className="w-full py-2.5 bg-white border border-zinc-200 hover:border-red-100 hover:text-red-500 text-zinc-400 rounded-xl text-[9px] font-black transition-all duration-300 uppercase tracking-widest shadow-sm">Cerrar Sesión</button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="no-print h-16 bg-white/80 backdrop-blur-xl border-b border-zinc-100 sticky top-0 z-50 flex items-center justify-between px-6 md:px-10">
          <div className="flex items-center gap-4">
             <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-zinc-50 rounded-xl text-zinc-400 active:scale-95 transition-transform">☰</button>
             {canGoBack && (
               <button onClick={() => window.history.back()} className="hidden md:flex items-center gap-2 text-zinc-300 hover:text-brand-900 transition-colors">
                  <span className="text-xl">←</span>
                  <span className="text-[9px] font-black uppercase tracking-widest">Regresar</span>
               </button>
             )}
          </div>
          
          <div className="flex items-center gap-3">
             <button className="p-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-100 rounded-xl text-zinc-300 transition-all relative">
                <span>🔔</span>
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-600 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white">{unreadCount}</span>}
             </button>
             {onHome && <button onClick={onHome} className="bg-brand-900 text-white px-4 py-2 rounded-xl font-bold text-[9px] uppercase tracking-[0.2em] hover:bg-brand-800 transition-all shadow-sm active:scale-95">Ir al Panel</button>}
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          <div className="animate-fade-in h-full overflow-y-auto">
            {children}
          </div>
        </main>
      </div>

      {globalModal && (
          <div className="fixed inset-0 bg-zinc-900/10 backdrop-blur-sm z-[200] flex items-center justify-center p-6 no-print animate-fade-in">
              <div className="bg-white rounded-[2.5rem] shadow-premium w-full max-w-sm p-10 text-center animate-slide-up border border-white">
                  <div className="w-16 h-16 bg-zinc-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <span className="text-3xl">{globalModal.type === 'CONFIRM' ? '❓' : '💡'}</span>
                  </div>
                  <h3 className="text-lg font-black text-brand-900 mb-2 tracking-tight leading-none uppercase">{globalModal.title}</h3>
                  <p className="text-zinc-400 text-xs mb-8 leading-relaxed px-2 font-bold uppercase tracking-tight">{globalModal.message}</p>
                  <div className="flex flex-col gap-2">
                      <button onClick={() => handleModalResolve(true)} className="w-full py-4 bg-brand-900 text-white rounded-2xl font-black shadow-lg hover:bg-brand-800 transition-all active:scale-95 uppercase text-[9px] tracking-widest">
                          {globalModal.confirmText || 'Entendido'}
                      </button>
                      {globalModal.type !== 'ALERT' && (
                          <button onClick={() => handleModalResolve(false)} className="w-full py-3 text-zinc-300 font-bold hover:text-zinc-500 transition-colors uppercase text-[8px] tracking-widest">
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