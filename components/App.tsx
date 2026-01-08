
import React, { useState, useEffect } from 'react';
import { AuthState, UserRole } from './types';
import { storageService } from './services/storageService';
import { COMPANY_LOGO } from './constants';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import InventoryView from './components/views/InventoryView';
import UserView from './components/views/UserView';
import ClientView from './components/views/ClientView';
import EventsView from './components/views/EventsView';
import ReportsView from './components/views/ReportsView';
import SettingsView from './components/views/SettingsView';
import WriteOffsView from './components/views/WriteOffsView';
import PaymentsView from './components/views/PaymentsView';
import ReturnsView from './components/views/ReturnsView';
import DispatchView from './components/views/DispatchView';
import InvoicingView from './components/views/InvoicingView';
import PurchasesView from './components/views/PurchasesView';
import AccountingView from './components/views/AccountingView';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({ user: null, isAuthenticated: false });
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [logoutMessage, setLogoutMessage] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      try {
        const session = storageService.getCurrentSession();
        if (session) {
          setAuth({ user: session, isAuthenticated: true });
        }
      } catch (e) {
        console.error("Error al cargar sesión:", e);
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, []);

  const handleLogin = (user: any) => {
    setAuth({ user, isAuthenticated: true });
    setActiveView('dashboard');
    setLogoutMessage('');
    setShowWelcome(true);
    setTimeout(() => setShowWelcome(false), 2500);
  };

  const handleLogout = () => {
    const userName = auth.user?.name.split(' ')[0] || 'Usuario';
    storageService.logout();
    setLogoutMessage(`¡Gracias por tu trabajo, ${userName}! Sesión cerrada.`);
    setAuth({ user: null, isAuthenticated: false });
    setActiveView('dashboard');
  };

  const handleNavigate = (view: string) => {
    setActiveView(view);
    window.scrollTo(0, 0);
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin h-12 w-12 border-4 border-brand-600 border-t-transparent rounded-full mb-4"></div>
        <p className="text-brand-900 font-bold tracking-widest uppercase text-xs">Cargando Sistema...</p>
      </div>
    );
  }

  if (!auth.isAuthenticated || !auth.user) {
    return <Login onLogin={handleLogin} initialMessage={logoutMessage} />;
  }

  const role = auth.user.role;

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard />;
      case 'events': return <EventsView />;
      case 'inventory': return <InventoryView role={role} />;
      case 'dispatch': return <DispatchView />; 
      case 'returns': return <ReturnsView />; 
      case 'purchases': return role === UserRole.SUPER_ADMIN ? <PurchasesView /> : <AccessDenied />;
      case 'accounting': return role === UserRole.SUPER_ADMIN ? <AccountingView /> : <AccessDenied />;
      case 'invoicing': return (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) ? <InvoicingView /> : <AccessDenied />;
      case 'payments': return <PaymentsView />;
      case 'clients': return <ClientView />;
      case 'bajas': return (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) ? <WriteOffsView /> : <AccessDenied />;
      case 'reports': return role === UserRole.SUPER_ADMIN ? <ReportsView onNavigate={handleNavigate} /> : <AccessDenied />;
      case 'users': return role === UserRole.SUPER_ADMIN ? <UserView /> : <AccessDenied />;
      case 'settings': return role === UserRole.SUPER_ADMIN ? <SettingsView /> : <AccessDenied />;
      default: return <Dashboard />;
    }
  };

  return (
    <>
      <Layout 
        user={auth.user} 
        onLogout={handleLogout} 
        currentView={activeView}
        onNavigate={handleNavigate}
      >
        <div key={activeView + refreshTrigger} className="w-full">
          {renderView()}
        </div>
      </Layout>

      {showWelcome && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center animate-bounce-up max-sm w-full mx-6 border-t-8 border-brand-600">
            <img src={COMPANY_LOGO} alt="Logo" className="w-24 h-24 mx-auto mb-4 object-contain" />
            <h2 className="text-2xl font-black text-brand-900">¡Hola, {auth.user.name.split(' ')[0]}!</h2>
            <p className="text-gray-500 font-medium text-sm mt-1">Iniciando tu panel de control...</p>
          </div>
        </div>
      )}
    </>
  );
};

const AccessDenied = () => (
  <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
        <span className="text-5xl">🔒</span>
    </div>
    <h3 className="font-black text-2xl text-brand-900 uppercase tracking-tighter">Acceso Restringido</h3>
    <p className="text-gray-400 font-medium max-w-xs mt-2">No tienes los permisos necesarios para este módulo.</p>
  </div>
);

export default App;
