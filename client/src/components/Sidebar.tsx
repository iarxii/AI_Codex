import React, { useEffect, useState } from 'react';
import SettingsModal from './SettingsModal';
import { 
  Cog6ToothIcon, 
  CpuChipIcon, 
  BoltIcon, 
  GlobeAltIcon, 
  SparklesIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline';
import { useAI, type ProviderId } from '../contexts/AIContext';

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
  const { provider } = useAI();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleUpdateTitle = async (id: number, newTitle: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/conversations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ title: newTitle })
      });
      if (res.ok) {
        setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
      }
    } catch (e) {
      console.error('Update failed', e);
    }
  };

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
    <aside className="w-72 h-full flex flex-col bg-[var(--bg-surface)]/40 backdrop-blur-2xl border-r border-black/[0.06] z-30 transition-all duration-300">
      <div className="px-6 py-8 flex flex-col items-center justify-center text-center group">
        <div className="relative mb-1">
          <img 
            src="/media/logo.png" 
            alt="AICodex Logo" 
            className="w-18 h-18 object-contain transition-all duration-500 group-hover:scale-105"
          />
        </div>

        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            AI<span className="text-[var(--accent)]">Codex</span>
          </h1>
          <div className="flex items-center gap-1.5 justify-center mt-1">
            <span className="text-[9px] font-medium uppercase tracking-[0.25em] text-[var(--text-muted)] flex items-center gap-1.5">
              {provider === 'local' && (
                <>
                  <CpuChipIcon className="w-3.5 h-3.5 text-[#FF6600]" />
                  Neural Core
                </>
              )}
              {provider === 'groq' && (
                <>
                  <BoltIcon className="w-3.5 h-3.5 text-[#FF6600]" />
                  Linked Velocity
                </>
              )}
              {provider === 'openrouter' && (
                <>
                  <GlobeAltIcon className="w-3.5 h-3.5 text-[#FF6600]" />
                  Omni Interface
                </>
              )}
              {provider === 'gemini' && (
                <>
                  <SparklesIcon className="w-3.5 h-3.5 text-[#FF6600]" />
                  Expert Reasoning
                </>
              )}
              {/* 👆 will be revised in future to offer "flavours" of agentic workflows for various purposes */}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-black/[0.06]">
        <button 
          onClick={async () => {
            await onNewChat();
            await fetchConversations();
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-xl text-sm font-semibold text-white transition-all active:scale-95 shadow-md shadow-[var(--accent)]/20 group"
        >
          <svg className="w-5 h-5 text-white group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          New Workspace
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-hide">
        {loading && <div className="text-center py-4 text-[var(--text-secondary)] text-xs uppercase tracking-widest font-semibold animate-pulse">Syncing History...</div>}
        
        {!loading && conversations.length === 0 && (
          <div className="text-center py-10 px-4">
            <p className="text-xs text-[var(--text-muted)] font-medium">No active sessions.</p>
          </div>
        )}

        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelectConversation(conv.id)}
            className={`w-full text-left p-3 rounded-xl transition-all group relative overflow-hidden ${
              currentConversationId === conv.id 
                ? 'bg-[var(--accent)]/12 border border-[var(--accent)]/25 shadow-sm' 
                : 'hover:bg-black/[0.04] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full transition-all ${currentConversationId === conv.id ? 'bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]' : 'bg-[var(--text-muted)]'}`}></div>
              <div className="flex-1 min-w-0 flex items-center justify-between group/item">
                <div className="flex-1 min-w-0">
                  {editingId === conv.id ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => {
                        setEditingId(null);
                        if (editValue.trim() && editValue !== conv.title) {
                          handleUpdateTitle(conv.id, editValue.trim());
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        } else if (e.key === 'Escape') {
                          setEditingId(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-white/50 border border-[var(--accent)]/30 rounded px-1 py-0.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                      autoFocus
                    />
                  ) : (
                    <p className={`text-sm truncate font-medium ${currentConversationId === conv.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
                      {conv.title}
                    </p>
                  )}
                  <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-tighter mt-0.5">
                    {new Date(conv.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {currentConversationId === conv.id && editingId !== conv.id && (
                  <div
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditValue(conv.title);
                      setEditingId(conv.id);
                    }}
                    className="opacity-0 group-hover/item:opacity-100 p-1 text-[var(--text-muted)] hover:text-[var(--accent)] transition-all cursor-pointer"
                  >
                    <PencilSquareIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-black/[0.06] bg-[var(--bg-primary)]/50">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
            ADM
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">Administrator</p>
            <p className="text-[10px] text-green-600 font-mono">System.Active</p>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-lg transition-colors"
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
