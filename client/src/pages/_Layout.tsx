import React from 'react';

type LayoutProps = {
  children: React.ReactNode;
};

const Layout: React.FC<LayoutProps> = ({ children }) => (
  <div style={{ minHeight: '100vh', background: '#f7f9fa' }}>
    <header style={{ padding: '1rem', background: '#1a237e', color: '#fff', fontWeight: 'bold', fontSize: '1.5rem' }}>
      GP HealthMedAgentix
    </header>
    <main style={{ maxWidth: 600, margin: '2rem auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', padding: 24 }}>
      {children}
    </main>
  </div>
);

export default Layout;
