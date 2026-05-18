import React, { useState, useEffect } from 'react';
import type { Artifact } from '../types/chat';
import { useAI } from '../contexts/AIContext';
import ArtifactView from './canvas/ArtifactView';
import GraphView from './canvas/GraphView';
import ModuleTree from './canvas/ModuleTree';
import DependencyMinimap from './canvas/DependencyMinimap';

interface AgentCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  artifacts: Artifact[];
  externalSelectedId?: string | null;
  conversationId?: string | number | null;
}

type TabType = 'Code' | 'Docs' | 'Research' | 'Graph';

/** Standard-mode tabs (no Graph or deep IDE features) */
const STANDARD_TABS: TabType[] = ['Code', 'Docs', 'Research'];
/** CodeSpace-mode tabs (full IDE integration) */
const CODESPACE_TABS: TabType[] = ['Code', 'Docs', 'Research', 'Graph'];

const AgentCanvas: React.FC<AgentCanvasProps> = ({ isOpen, onClose, artifacts, externalSelectedId, conversationId }) => {
  const { isPremiumSpace } = useAI();
  const [activeTab, setActiveTab] = useState<TabType>('Code');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const availableTabs = isPremiumSpace ? CODESPACE_TABS : STANDARD_TABS;

  // Reset to valid tab if current tab is hidden
  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab('Code');
    }
  }, [isPremiumSpace, activeTab, availableTabs]);

  // Sync with external selection
  useEffect(() => {
    if (externalSelectedId) {
      const art = artifacts.find(a => a.id === externalSelectedId);
      if (art) {
        setSelectedId(externalSelectedId);
        if (art.type === 'code') setActiveTab('Code');
        else if (art.type === 'docs') setActiveTab('Docs');
        else if (art.type === 'research') setActiveTab('Research');
      }
    }
  }, [externalSelectedId, artifacts]);

  // Filter artifacts based on active tab
  const filteredArtifacts = artifacts.filter(art => {
    if (activeTab === 'Code') return art.type === 'code';
    if (activeTab === 'Docs') return art.type === 'docs';
    if (activeTab === 'Research') return art.type === 'research';
    return false;
  });

  // Auto-select first artifact in a tab if none selected
  useEffect(() => {
    if (activeTab === 'Graph') return;
    if (filteredArtifacts.length > 0 && (!selectedId || !filteredArtifacts.find(a => a.id === selectedId))) {
      setSelectedId(filteredArtifacts[0].id);
    }
  }, [activeTab, artifacts, selectedId]);

  const selectedArtifact = artifacts.find(a => a.id === selectedId);
  const isMultiFile = filteredArtifacts.length > 1;

  if (!isOpen) return null;

  return (
    <aside className="w-[450px] h-full flex flex-col bg-[var(--bg-surface)]/95 backdrop-blur-2xl border-l border-black/[0.05] z-30 animate-in slide-in-from-right duration-300 shadow-2xl">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-5 border-b border-black/[0.05]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"></div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Agent Canvas</h3>
          {/* Space mode badge */}
          {isPremiumSpace && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[7px] font-black uppercase tracking-wider text-[var(--accent)] border border-[var(--accent)]/20">
              CodeSpace
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              // Export logic could go here
            }}
            className="p-1.5 hover:bg-black/[0.05] rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            title="Export Workspace"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-black/[0.05] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs — dynamically rendered based on space mode */}
      <div className="px-5 py-3 flex items-center gap-4 border-b border-black/[0.02] bg-black/[0.01]">
        {availableTabs.map((tab) => {
          const count = artifacts.filter(a => a.type === tab.toLowerCase()).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative py-1 text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeTab === tab 
                  ? 'text-[var(--accent)]' 
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {tab}
              {tab !== 'Graph' && count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-black/[0.05] text-[8px] border border-black/[0.05]">
                  {count}
                </span>
              )}
              {activeTab === tab && (
                <div className="absolute -bottom-[13px] left-0 right-0 h-0.5 bg-[var(--accent)] rounded-full shadow-[0_0_8px_rgba(255,102,0,0.4)]"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'Graph' ? (
          /* Graph is only available in CodeSpace mode */
          <div className="flex-1 flex flex-col p-5 overflow-hidden">
            <GraphView workspaceId={conversationId || 'unknown'} />
          </div>
        ) : filteredArtifacts.length > 0 ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 
              CodeSpace: Full ModuleTree + DependencyMinimap for IDE workflow.
              Standard:  Flat snippet list for simple browsing.
            */}
            {isMultiFile && isPremiumSpace ? (
              /* === CodeSpace Multi-File View === */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="max-h-[220px] overflow-y-auto scrollbar-hide border-b border-black/[0.04] bg-black/[0.01]">
                  <ModuleTree
                    artifacts={filteredArtifacts}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                </div>

                <div className="flex-1 overflow-hidden flex flex-col p-4">
                  {selectedArtifact ? (
                    <div className="flex-1 overflow-hidden">
                      <ArtifactView artifact={selectedArtifact} />
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-bold opacity-30">
                      Select a file to view
                    </div>
                  )}
                </div>

                <div className="px-4 pb-3 shrink-0">
                  <DependencyMinimap
                    artifacts={filteredArtifacts}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                </div>
              </div>
            ) : isMultiFile ? (
              /* === Standard Multi-Snippet View (Flat List) === */
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Clean flat snippet list */}
                <div className="max-h-[200px] overflow-y-auto scrollbar-hide border-b border-black/[0.04]">
                  <div className="py-2 px-3 space-y-0.5">
                    {filteredArtifacts.map((art) => {
                      const isActive = selectedId === art.id;
                      const timeAgo = getRelativeTime(art.timestamp);
                      return (
                        <button
                          key={art.id}
                          onClick={() => setSelectedId(art.id)}
                          className={`w-full flex items-center gap-3 py-2 px-3 rounded-xl transition-all text-left group ${
                            isActive
                              ? 'bg-[var(--accent)]/8 ring-1 ring-[var(--accent)]/20 shadow-sm'
                              : 'hover:bg-black/[0.03]'
                          }`}
                        >
                          {/* Language badge */}
                          <LanguageBadge language={art.language} type={art.type} />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className={`text-[10px] font-bold truncate ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                              {art.title}
                            </span>
                            <span className="text-[8px] text-[var(--text-muted)] font-mono uppercase tracking-tight">
                              {art.language || art.type} • {timeAgo}
                            </span>
                          </div>
                          {isActive && (
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_6px_rgba(255,102,0,0.5)] shrink-0"></div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Artifact Detail */}
                <div className="flex-1 overflow-hidden flex flex-col p-4">
                  {selectedArtifact ? (
                    <div className="flex-1 overflow-hidden">
                      <ArtifactView artifact={selectedArtifact} />
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-bold opacity-30">
                      Select a snippet to view
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Single file/snippet: Classic view */
              <div className="flex-1 flex flex-col p-5 space-y-5 overflow-y-auto scrollbar-hide">
                {selectedArtifact ? (
                  <div className="flex-1">
                    <ArtifactView artifact={selectedArtifact} />
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-bold opacity-30">
                    Select an artifact to view
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-6">
            <div className="w-24 h-24 rounded-full bg-black/[0.02] border border-black/[0.04] flex items-center justify-center relative">
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-black/[0.05] animate-[spin_20s_linear_infinite]"></div>
              <svg className="w-10 h-10 text-[var(--text-muted)] opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest">Workspace Empty</h4>
              <p className="text-[10px] text-[var(--text-muted)] max-w-[200px] leading-relaxed font-medium">
                Ask the agent to generate code, blueprints, or research to populate this canvas.
              </p>
            </div>
            
            <div className="flex gap-2 pt-2">
              <div className="px-3 py-1 rounded-full bg-black/[0.03] text-[7px] font-black text-[var(--text-muted)] uppercase tracking-tighter border border-black/[0.05]">
                Neural.Link v1.2
              </div>
              <div className="px-3 py-1 rounded-full bg-[var(--accent)]/5 text-[7px] font-black text-[var(--accent)] uppercase tracking-tighter border border-[var(--accent)]/10">
                Standby Mode
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Status */}
      <div className="p-4 border-t border-black/[0.05] bg-black/[0.02]">
        <div className="flex justify-between items-center text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
            <span>System.Canvas_Ready</span>
          </div>
          <div className="flex items-center gap-3">
            <span>{artifacts.length} Artifacts</span>
            <span className="opacity-30">|</span>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

/* ── Helper Components ── */

/** Colored badge for file language/type */
const LanguageBadge: React.FC<{ language?: string; type: Artifact['type'] }> = ({ language, type }) => {
  const lang = (language || '').toLowerCase();
  
  const badgeConfig: Record<string, { bg: string; text: string; label: string }> = {
    'python': { bg: 'bg-blue-500/15', text: 'text-blue-500', label: 'PY' },
    'py': { bg: 'bg-blue-500/15', text: 'text-blue-500', label: 'PY' },
    'javascript': { bg: 'bg-yellow-500/15', text: 'text-yellow-600', label: 'JS' },
    'js': { bg: 'bg-yellow-500/15', text: 'text-yellow-600', label: 'JS' },
    'typescript': { bg: 'bg-blue-400/15', text: 'text-blue-400', label: 'TS' },
    'ts': { bg: 'bg-blue-400/15', text: 'text-blue-400', label: 'TS' },
    'tsx': { bg: 'bg-cyan-500/15', text: 'text-cyan-500', label: 'TSX' },
    'jsx': { bg: 'bg-cyan-500/15', text: 'text-cyan-500', label: 'JSX' },
    'json': { bg: 'bg-orange-500/15', text: 'text-orange-500', label: 'JSON' },
    'jsonc': { bg: 'bg-orange-500/15', text: 'text-orange-500', label: 'JSON' },
    'bash': { bg: 'bg-green-500/15', text: 'text-green-500', label: 'SH' },
    'sh': { bg: 'bg-green-500/15', text: 'text-green-500', label: 'SH' },
    'shell': { bg: 'bg-green-500/15', text: 'text-green-500', label: 'SH' },
    'sql': { bg: 'bg-indigo-500/15', text: 'text-indigo-500', label: 'SQL' },
    'yaml': { bg: 'bg-rose-500/15', text: 'text-rose-500', label: 'YML' },
    'yml': { bg: 'bg-rose-500/15', text: 'text-rose-500', label: 'YML' },
    'html': { bg: 'bg-red-500/15', text: 'text-red-500', label: 'HTML' },
    'css': { bg: 'bg-purple-500/15', text: 'text-purple-500', label: 'CSS' },
    'rust': { bg: 'bg-orange-600/15', text: 'text-orange-600', label: 'RS' },
    'go': { bg: 'bg-teal-500/15', text: 'text-teal-500', label: 'GO' },
  };

  const config = badgeConfig[lang] || (
    type === 'docs' ? { bg: 'bg-orange-500/10', text: 'text-orange-500', label: 'DOC' } :
    type === 'research' ? { bg: 'bg-purple-500/10', text: 'text-purple-500', label: 'RES' } :
    { bg: 'bg-slate-400/10', text: 'text-slate-400', label: 'TXT' }
  );

  return (
    <div className={`${config.bg} ${config.text} w-8 h-8 rounded-lg flex items-center justify-center text-[8px] font-black tracking-tight shrink-0 border border-current/10`}>
      {config.label}
    </div>
  );
};

/** Relative time helper */
function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default AgentCanvas;
