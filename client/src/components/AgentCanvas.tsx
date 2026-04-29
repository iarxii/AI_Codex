import React, { useState, useEffect } from 'react';
import type { Artifact } from '../types/chat';
import ArtifactView from './canvas/ArtifactView';

interface AgentCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  artifacts: Artifact[];
  externalSelectedId?: string | null;
  onSaveToScratchpad?: (artifact: Artifact) => Promise<void>;
}

type TabType = 'Code' | 'Docs' | 'Research';

const AgentCanvas: React.FC<AgentCanvasProps> = ({ isOpen, onClose, artifacts, externalSelectedId, onSaveToScratchpad }) => {
  const [activeTab, setActiveTab] = useState<TabType>('Code');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Sync with external selection
  useEffect(() => {
    if (externalSelectedId) {
      const art = artifacts.find(a => a.id === externalSelectedId);
      if (art) {
        setSelectedId(externalSelectedId);
        // Switch tab automatically
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
    if (filteredArtifacts.length > 0 && (!selectedId || !filteredArtifacts.find(a => a.id === selectedId))) {
      setSelectedId(filteredArtifacts[0].id);
    }
  }, [activeTab, artifacts, selectedId]);

  const selectedArtifact = artifacts.find(a => a.id === selectedId);

  if (!isOpen) return null;

  return (
    <aside className="w-[450px] h-full flex flex-col bg-[var(--bg-surface)]/95 backdrop-blur-2xl border-l border-black/[0.05] z-30 animate-in slide-in-from-right duration-300 shadow-2xl">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-5 border-b border-black/[0.05]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"></div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Agent Canvas</h3>
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

      {/* Tabs */}
      <div className="px-5 py-3 flex items-center gap-4 border-b border-black/[0.02] bg-black/[0.01]">
        {(['Code', 'Docs', 'Research'] as TabType[]).map((tab) => {
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
              {count > 0 && (
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
        {filteredArtifacts.length > 0 ? (
          <div className="flex-1 flex flex-col p-5 space-y-5 overflow-y-auto scrollbar-hide">
            {/* Artifact List (Compact if multiple) */}
            {filteredArtifacts.length > 1 && (
              <div className="flex gap-2 pb-2 overflow-x-auto scrollbar-hide shrink-0">
                {filteredArtifacts.map(art => (
                  <button
                    key={art.id}
                    onClick={() => setSelectedId(art.id)}
                    className={`px-3 py-2 rounded-xl border transition-all text-left min-w-[120px] max-w-[120px] ${
                      selectedId === art.id 
                        ? 'bg-white border-[var(--accent)]/30 shadow-sm' 
                        : 'bg-black/[0.02] border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="text-[9px] font-bold text-[var(--text-primary)] truncate">{art.title}</div>
                    <div className="text-[7px] text-[var(--text-muted)] font-mono uppercase truncate">{art.language || art.type}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Artifact Detail */}
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

export default AgentCanvas;
