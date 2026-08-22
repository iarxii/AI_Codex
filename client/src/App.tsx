import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import WorkspaceChat from './pages/Workspace';
import LiteChat from './pages/LiteChat';
import AdminOverview from './pages/AdminOverview';
import AdminDashboard from './pages/AdminDashboard';
import Integrations from './pages/Integrations';
import { AIProvider, useAI } from './contexts/AIContext';
import P5Background from './components/P5Background';
import { DisciplineProvider } from './contexts/DisciplineContext';
import { BridgeProvider } from './contexts/BridgeContext';
import ColabBridgeOverlay from './components/ColabBridgeOverlay';
import { getValidToken } from './utils/authToken';

import './App.css';

const isProtectedPath = (pathname: string): boolean =>
  pathname.startsWith('/workspace') ||
  pathname.startsWith('/chat') ||
  pathname.startsWith('/admin') ||
  pathname.startsWith('/integrations');

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const location = useLocation();
  const token = getValidToken();

  if (!token && isProtectedPath(location.pathname)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

const SessionExpiryWatcher: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    const enforceSession = () => {
      if (!isProtectedPath(location.pathname)) return;
      if (!getValidToken()) {
        navigate('/login', { replace: true, state: { from: location.pathname } });
      }
    };

    enforceSession();

    const handleVisibility = () => {
      if (!document.hidden) enforceSession();
    };
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === 'token') enforceSession();
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('storage', handleStorage);
    const intervalId = window.setInterval(enforceSession, 30000);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('storage', handleStorage);
      window.clearInterval(intervalId);
    };
  }, [location.pathname, navigate]);

  return null;
};

const AppContent: React.FC = () => {
  const { visualSettings, activeSpace } = useAI();
  return (
    <>
      <P5Background key={`${JSON.stringify(visualSettings)}-${activeSpace?.slug || 'global'}`} />
      <ColabBridgeOverlay />
      <Router>
        <SessionExpiryWatcher />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/workspace" element={<RequireAuth><WorkspaceChat /></RequireAuth>} />
          <Route path="/chat" element={<RequireAuth><LiteChat /></RequireAuth>} />
          <Route path="/integrations" element={<RequireAuth><Integrations /></RequireAuth>} />
          <Route path="/admin/overview" element={<RequireAuth><AdminOverview /></RequireAuth>} />
          <Route path="/admin/users" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
          {/* Fallback to login */}
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </>
  );
};

const App: React.FC = () => {
  return (
    <AIProvider>
      <BridgeProvider>
        <DisciplineProvider>
          <AppContent />
        </DisciplineProvider>
      </BridgeProvider>
    </AIProvider>
  );
};

export default App;
