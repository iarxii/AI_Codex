import React, { useState, useEffect } from 'react';

import ConversationPanel from '../components/ConversationPanel';
import Header from '../components/Header';

type LayoutProps = {
  children: React.ReactNode;
};


const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [provider, setProvider] = useState<'openai' | 'gemini'>('gemini'); // Default to 'gemini'
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);

  useEffect(() => {
    // Fetch conversations from the server
    const fetchConversations = async () => {
      const response = await fetch('http://localhost:3000/api/conversations');
      const data = await response.json();
      setConversations(data);
    };

    fetchConversations();
  }, []);

  const childrenWithProps = React.Children.map(children, child => {


    if (React.isValidElement(child)) {
      return React.cloneElement(child, { provider } as any);
    }
    return child;
  });

  return (
    <div className="flex h-screen bg-gray-300 relative">
      {/* Overlay sidebar for mobile, sidebar for md+ */}
      {/* Overlay background */}
      {isPanelOpen && (
        <div
          className="fixed inset-0 z-30 bg-[rgba(255,255,255,0.8)] bg-opacity-40 md:hidden"
          onClick={() => setIsPanelOpen(false)}
        />
      )}
      {/* Sidebar */}
      <div
        className={`
          fixed z-40 top-0 left-0 h-full w-64 bg-gray-800 text-white flex flex-col transition-transform duration-300
          ${isPanelOpen ? 'translate-x-0' : '-translate-x-full'}
          md:static md:translate-x-0 md:w-64 md:z-0
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-[#02396e]">
          <div className="flex-column justify-start items-start text-start">
            <small style={{ fontSize: '10px', fontWeight: 'semibold' }}>GP HealthMedAgentix | v0.1.0</small>
            <span className="font-bold text-lg">Conversations</span>
          </div>
          <div className="flex-column">
            {/* <button
              className="p-1 rounded hover:bg-gray-700"
              onClick={() => setIsPanelOpen(false)}
              aria-label="Close sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button> */}
          </div>
          <button
            className="md:hidden p-1 rounded hover:bg-gray-700"
            onClick={() => setIsPanelOpen(false)}
            aria-label="Close sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ConversationPanel
          conversations={conversations}
          onSelectConversation={(id) => setSelectedConversationId(id)}
          onCreateNew={() => console.log('Create new chat')}
          provider={provider}
          setProvider={setProvider}
        />
      </div >

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <Header onOpenSidebar={() => setIsPanelOpen(true)} />
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {childrenWithProps}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
