import React from 'react';

interface AgentCanvasProps {
  isOpen: boolean;
  onClose: () => void;
}

const AgentCanvas: React.FC<AgentCanvasProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <aside className="w-96 h-full flex flex-col bg-[var(--bg-surface)]/95 backdrop-blur-2xl border-l border-black/[0.05] z-30 animate-in slide-in-from-right duration-300 shadow-2xl">
      <div className="h-14 flex items-center justify-between px-5 border-b border-black/[0.05]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"></div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Agent Canvas</h3>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-black/[0.05] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
        {/* Placeholder for future content tabs */}
        <div className="flex items-center gap-4 mb-6">
          {['Code', 'Docs', 'Research'].map((tab) => (
            <button
              key={tab}
              className={`text-[9px] font-bold uppercase tracking-widest pb-1 border-b-2 transition-all ${
                tab === 'Code' 
                  ? 'border-[var(--accent)] text-[var(--text-primary)]' 
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <section className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-20 h-20 rounded-3xl bg-black/[0.03] flex items-center justify-center rotate-3 group-hover:rotate-0 transition-transform">
            <svg className="w-10 h-10 text-[var(--text-muted)] opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">Canvas Ready</h4>
            <p className="text-xs text-[var(--text-muted)] max-w-[220px] mt-2 leading-relaxed">
              Agent-generated code, documentation, and research artifacts will manifest in this space.
            </p>
          </div>
          
          <div className="pt-4 flex gap-2">
            <div className="px-3 py-1 rounded-full bg-black/5 border border-black/5 text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
              v1.0.0
            </div>
            <div className="px-3 py-1 rounded-full bg-[var(--accent)]/5 border border-[var(--accent)]/10 text-[8px] font-bold text-[var(--accent)] uppercase tracking-tighter">
              Awaiting Output
            </div>
          </div>
        </section>
      </div>

      <div className="p-4 border-t border-black/[0.05] bg-black/[0.02]">
        <div className="flex justify-between items-center text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
          <span>System.Canvas_Stream</span>
          <span className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-green-500"></div>
            Standby
          </span>
        </div>
      </div>
    </aside>
  );
};

export default AgentCanvas;
