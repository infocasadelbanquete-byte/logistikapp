import React, { useState, useEffect } from 'react';
import { AuthState, UserRole } from './types';
import { storageService } from './services/storageService';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import InventoryView from './components/views/InventoryView';
import UserView from './components/views/UserView';
import ClientView from './components/views/ClientView';
import EventsView from './components/views/EventsView';
import QuotesView from './components/views/QuotesView';
import AccountingView from './components/views/AccountingView';
import SettingsView from './components/views/SettingsView';
import PaymentsView from './components/views/PaymentsView';
import DispatchView from './components/views/DispatchView';
import ReturnsView from './components/views/ReturnsView';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({ user: null, isAuthenticated: false });
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = storageService.getCurrentSession();
    if (session) setAuth({ user: session, isAuthenticated: true });
    setLoading(false);
  }, []);

  const handleLogin = (u: any) => {
    setAuth({ user: u, isAuthenticated: true });
  };

  const handleLogout = () => {
    storageService.logout();
    setAuth({ user: null, isAuthenticated: false });
    setActiveView('dashboard');
  };

  if (loading) return null;
  if (!auth.isAuthenticated || !auth.user) return <Login onLogin={handleLogin} />;

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard />;
      case 'events': return <EventsView />;
      case 'quotes': return <QuotesView />;
      case 'dispatch': return <DispatchView />;
      case 'returns': return <ReturnsView />;
      case 'accounting': return <AccountingView />;
      case 'payments': return <PaymentsView />;
      case 'inventory': return <InventoryView role={auth.user?.role || UserRole.STAFF} />;
      case 'clients': return <ClientView />;
      case 'users': return <UserView />;
      case 'settings': return <SettingsView />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout user={auth.user} onLogout={handleLogout} currentView={activeView} onNavigate={setActiveView}>
      {renderView()}
    </Layout>
  );
};

export default App;