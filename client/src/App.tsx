import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import { AIProvider } from './contexts/AIContext';
import P5Background from './components/P5Background';

import './App.css';

const App: React.FC = () => {
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <AIProvider>
      <P5Background />
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route 
            path="/chat" 
            element={isAuthenticated ? <Chat /> : <Navigate to="/login" />} 
          />
          {/* Fallback to login */}
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </AIProvider>
  );
};

export default App;
