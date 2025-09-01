import React, { useState } from 'react';

import ConversationPanel from '../components/ConversationPanel';
import Header from '../components/Header';

type LayoutProps = {
  children: React.ReactNode;
};


const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  // Mock data for conversations - replace with real data later
  const mockConversations = [
    { id: 1, title: 'Initial Health Inquiry' },
    { id: 2, title: 'Follow-up on Symptoms' },
    { id: 3, title: 'Data Analysis Request' },
  ];

  return (
    <div className="flex h-screen bg-gray-100 relative">
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
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <span className="font-bold text-lg">Conversations</span>
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
          conversations={mockConversations}
          onSelectConversation={(id) => console.log(`Selected convo ${id}`)}
          onCreateNew={() => console.log('Create new chat')}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <Header onOpenSidebar={() => setIsPanelOpen(true)} />
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
