import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import StatusPanel from './components/StatusPanel';
import './App.css';

const App: React.FC = () => {
  const [activeConversation, setActiveConversation] = useState<string | null>(null);

  return (
    <div className="app-container">
      <Sidebar 
        activeConversation={activeConversation} 
        onSelectConversation={setActiveConversation} 
      />
      <main className="main-content">
        <ChatArea conversationId={activeConversation} />
      </main>
      <aside className="right-panel">
        <StatusPanel />
      </aside>
    </div>
  );
};

export default App;
