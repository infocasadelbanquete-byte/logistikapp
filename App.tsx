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
import QuotesView from './components/views/QuotesView';
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
  const [viewStack, setViewStack] = useState<string[]>(['dashboard']);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [logoutMessage, setLogoutMessage] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);

  const currentView = viewStack[viewStack.length - 1] || 'dashboard';

  useEffect(() => {
    const initApp = async () => {
      try {
        const session = storageService.getCurrentSession();
        if (session) {
          setAuth({ user: session, isAuthenticated: true });
          if (!window.history.state) {
            window.history.replaceState({ view: 'dashboard' }, '');
          }
        }
      } catch (e) {
        console.error("Error al cargar sesión:", e);
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      setViewStack((prevStack) => {
        if (prevStack.length > 1) {
          return prevStack.slice(0, -1);
        }
        return prevStack;
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogin = (user: any) => {
    setAuth({ user, isAuthenticated: true });
    setViewStack(['dashboard']);
    window.history.replaceState({ view: 'dashboard' }, '');
    setLogoutMessage('');
    setShowWelcome(true);
    storageService.createNotification(`Inicio de sesión: ${user.name}`, 'INFO');
    setTimeout(() => setShowWelcome(false), 2500);
  };

  const handleLogout = () => {
    const userName = auth.user?.name.split(' ')[0] || 'Usuario';
    storageService.logout();
    setLogoutMessage(`¡Gracias por tu trabajo, ${userName}! Sesión cerrada.`);
    setAuth({ user: null, isAuthenticated: false });
    setViewStack(['dashboard']);
    window.history.replaceState(null, '');
  };

  const handleNavigate = (view: string) => {
    if (view === currentView) return;
    window.history.pushState({ view }, '', `#${view}`);
    setViewStack(prev => [...prev, view]);
  };

  const handleBack = () => {
    if (viewStack.length > 1) {
      window.history.back();
    }
  };

  const handleGoHome = () => {
    if (currentView !== 'dashboard') {
      handleNavigate('dashboard');
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin h-12 w-12 border-4 border-brand-600 border-t-transparent rounded-full mb-4"></div>
        <p className="text-brand-900 font-bold">Cargando aplicación...</p>
      </div>
    );
  }

  if (!auth.isAuthenticated || !auth.user) {
    return <Login onLogin={handleLogin} initialMessage={logoutMessage} />;
  }

  const role = auth.user.role;

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'inventory': return <InventoryView role={role} />;
      case 'users': return role === UserRole.SUPER_ADMIN ? <UserView /> : <AccessDenied />;
      case 'clients': return <ClientView />;
      case 'events': return <EventsView />;
      case 'dispatch': return <DispatchView />; 
      case 'quotes': return <QuotesView />;
      case 'payments': return <PaymentsView />;
      case 'returns': return <ReturnsView />; 
      case 'purchases': return role === UserRole.SUPER_ADMIN ? <PurchasesView /> : <AccessDenied />;
      case 'accounting': return role === UserRole.SUPER_ADMIN ? <AccountingView /> : <AccessDenied />;
      case 'invoicing': return (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) ? <InvoicingView /> : <AccessDenied />;
      case 'bajas': return (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) ? <WriteOffsView /> : <AccessDenied />;
      case 'reports': return (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) ? <ReportsView /> : <AccessDenied />;
      case 'settings': return role === UserRole.SUPER_ADMIN ? <SettingsView /> : <AccessDenied />;
      default: return <Dashboard />;
    }
  };

  return (
    <>
      <Layout 
        user={auth.user} 
        onLogout={handleLogout} 
        currentView={currentView}
        onNavigate={handleNavigate}
        onRefresh={() => setRefreshTrigger(p => p + 1)}
        onBack={handleBack}
        onHome={handleGoHome}
        canGoBack={viewStack.length > 1}
      >
        <div key={refreshTrigger} className="h-full">
          {renderView()}
        </div>
      </Layout>

      {showWelcome && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center animate-bounce-up max-w-sm w-full mx-6">
            <img src={COMPANY_LOGO} alt="Logo" className="w-24 h-24 mx-auto mb-4 object-contain" />
            <h2 className="text-2xl font-bold text-brand-900">¡Bienvenido!</h2>
            <p className="text-gray-600">{auth.user.name}</p>
            <div className="mt-4 flex justify-center">
              <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const AccessDenied = () => (
  <div className="h-full flex flex-col items-center justify-center text-gray-500">
    <span className="text-4xl mb-2">🔒</span>
    <h3 className="font-bold text-lg">Acceso Restringido</h3>
    <p>No tiene permisos suficientes para este módulo.</p>
  </div>
);

export default App;