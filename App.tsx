import React, { useState, useEffect } from 'react';
import { AuthState, UserRole } from './types';
import { storageService } from './services/storageService';
import Layout from './components/Layout';
import Login from './components/Login';
import EventsView from './components/views/EventsView';
import QuotesView from './components/views/QuotesView';
import DispatchView from './components/views/DispatchView';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({ user: null, isAuthenticated: false });
  const [activeView, setActiveView] = useState<string>('quotes');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = storageService.getCurrentSession();
    if (session) setAuth({ user: session, isAuthenticated: true });
    setLoading(false);
  }, []);

  if (loading) return null;
  if (!auth.isAuthenticated || !auth.user) return <Login onLogin={(u) => setAuth({user: u, isAuthenticated: true})} />;

  const renderView = () => {
    switch (activeView) {
      case 'quotes': return <QuotesView />;
      case 'events': return <EventsView />;
      case 'dispatch': return <DispatchView />;
      default: return <QuotesView />;
    }
  };

  return (
    <Layout user={auth.user} onLogout={() => { storageService.logout(); setAuth({user: null, isAuthenticated: false}); }} currentView={activeView} onNavigate={setActiveView}>
      {renderView()}
    </Layout>
  );
};

export default App;