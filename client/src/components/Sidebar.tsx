import React, { useEffect, useState } from 'react';
import SettingsModal from './SettingsModal';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';

type Conversation = {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
};

interface SidebarProps {
  currentConversationId: number | null;
  onSelectConversation: (id: number) => void;
  onNewChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentConversationId, onSelectConversation, onNewChat }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/conversations/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="w-72 h-full flex flex-col bg-[#BFC4CC]/80 backdrop-blur-xl border-r border-black/[0.06] z-30 transition-all duration-300">
      <div className="p-4 border-b border-black/[0.06]">
        <button 
          onClick={async () => {
            await onNewChat();
            await fetchConversations();
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#FF6600] hover:bg-[#E65C00] rounded-xl text-sm font-semibold text-white transition-all active:scale-95 shadow-md shadow-[#FF6600]/20 group"
        >
          <svg className="w-5 h-5 text-white group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          New Workspace
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-hide">
        {loading && <div className="text-center py-4 text-[#4A4D5E] text-xs uppercase tracking-widest font-semibold animate-pulse">Syncing History...</div>}
        
        {!loading && conversations.length === 0 && (
          <div className="text-center py-10 px-4">
            <p className="text-xs text-[#7A7D8E] font-medium">No active sessions.</p>
          </div>
        )}

        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelectConversation(conv.id)}
            className={`w-full text-left p-3 rounded-xl transition-all group relative overflow-hidden ${
              currentConversationId === conv.id 
                ? 'bg-[#FF6600]/12 border border-[#FF6600]/25 shadow-sm' 
                : 'hover:bg-black/[0.04] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full transition-all ${currentConversationId === conv.id ? 'bg-[#FF6600] shadow-[0_0_8px_rgba(255,102,0,0.5)]' : 'bg-[#7A7D8E]'}`}></div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate font-medium ${currentConversationId === conv.id ? 'text-[#1A1D2E]' : 'text-[#4A4D5E] group-hover:text-[#1A1D2E]'}`}>
                  {conv.title}
                </p>
                <p className="text-[10px] text-[#7A7D8E] font-mono uppercase tracking-tighter mt-0.5">
                  {new Date(conv.updated_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-black/[0.06] bg-[#B5BAC2]/50">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FF6600] to-[#FF8533] flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
            ADM
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#1A1D2E] truncate">Administrator</p>
            <p className="text-[10px] text-green-600 font-mono">System.Active</p>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 text-[#7A7D8E] hover:text-[#FF6600] hover:bg-[#FF6600]/10 rounded-lg transition-colors"
          >
            <Cog6ToothIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <SettingsModal isOpen={isSettingsOpen} setIsOpen={setIsSettingsOpen} />
    </aside>
  );
};

export default Sidebar;
