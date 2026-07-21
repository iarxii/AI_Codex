import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import LiteChat from './pages/LiteChat';
import AdminOverview from './pages/AdminOverview';
import AdminDashboard from './pages/AdminDashboard';
import { AIProvider, useAI } from './contexts/AIContext';
import P5Background from './components/P5Background';
import { DisciplineProvider } from './contexts/DisciplineContext';
import { BridgeProvider } from './contexts/BridgeContext';
import ColabBridgeOverlay from './components/ColabBridgeOverlay';

import './App.css';

const AppContent: React.FC = () => {
  const { visualSettings, activeSpace } = useAI();
  return (
    <>
      <P5Background key={`${JSON.stringify(visualSettings)}-${activeSpace?.slug || 'global'}`} />
      <ColabBridgeOverlay />
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/lite-chat" element={<LiteChat />} />
          <Route path="/admin/overview" element={<AdminOverview />} />
          <Route path="/admin/users" element={<AdminDashboard />} />
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
