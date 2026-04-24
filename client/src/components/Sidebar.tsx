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
    <aside className="w-72 h-full flex flex-col bg-white/5 backdrop-blur-xl border-r border-white/10 z-30 transition-all duration-300">
      <div className="p-4 border-b border-white/10">
        <button 
          onClick={async () => {
            await onNewChat();
            await fetchConversations();
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-all active:scale-95 group"
        >
          <svg className="w-5 h-5 text-indigo-400 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          New Workspace
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
        {loading && <div className="text-center py-4 text-slate-500 text-xs uppercase tracking-widest font-bold animate-pulse">Syncing History...</div>}
        
        {!loading && conversations.length === 0 && (
          <div className="text-center py-10 px-4">
            <p className="text-xs text-slate-500 font-medium">No active sessions.</p>
          </div>
        )}

        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelectConversation(conv.id)}
            className={`w-full text-left p-3 rounded-xl transition-all group relative overflow-hidden ${
              currentConversationId === conv.id 
                ? 'bg-indigo-600/20 border border-indigo-500/30' 
                : 'hover:bg-white/5 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${currentConversationId === conv.id ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]' : 'bg-slate-600'}`}></div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate font-medium ${currentConversationId === conv.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                  {conv.title}
                </p>
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-tighter mt-0.5">
                  {new Date(conv.updated_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-white/10 bg-black/20">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 border border-white/10 flex items-center justify-center text-[10px] font-bold text-slate-300">
            ADM
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">Administrator</p>
            <p className="text-[10px] text-emerald-500 font-mono">System.Active</p>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
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
