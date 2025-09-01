
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Chat from './pages/Chat';
import Layout from './pages/_Layout';

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Chat />} />
          {/* Add more routes here as needed */}
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
