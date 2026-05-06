import React, { useState, useEffect, useCallback } from 'react';
import { config } from '../../config';

interface GraphViewProps {
  workspaceId?: string | number;
  isGlobal?: boolean;
}

type GraphStatus = 'loading' | 'available' | 'unavailable';

const GraphView: React.FC<GraphViewProps> = ({ workspaceId, isGlobal = false }) => {
  const [status, setStatus] = useState<GraphStatus>('loading');

  const graphUrl = isGlobal 
    ? `${config.API_BASE_URL}/admin/graph/graph.html`
    : `${config.API_BASE_URL}/graph/${workspaceId}/graph.html`;

  const probeGraph = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch(graphUrl, { method: 'HEAD' });
      setStatus(res.ok ? 'available' : 'unavailable');
    } catch {
      setStatus('unavailable');
    }
  }, [graphUrl]);

  useEffect(() => {
    probeGraph();
  }, [probeGraph]);

  if (status === 'loading') {
    return (
      <div className="w-full h-full min-h-[400px] rounded-2xl overflow-hidden border border-black/[0.05] bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin"></div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Probing Graph Endpoint…</span>
        </div>
      </div>
    );
  }

  if (status === 'unavailable') {
    return (
      <div className="w-full h-full min-h-[400px] rounded-2xl overflow-hidden border border-dashed border-black/[0.08] bg-gradient-to-br from-white to-black/[0.02] flex flex-col items-center justify-center p-8 text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-black/[0.03] border border-black/[0.05] flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-black/[0.06] animate-[spin_25s_linear_infinite]"></div>
          <svg className="w-9 h-9 text-[var(--text-muted)] opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h4 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest">
            {isGlobal ? 'Global Graph Not Generated' : 'Workspace Graph Not Available'}
          </h4>
          <p className="text-[10px] text-[var(--text-muted)] max-w-[260px] leading-relaxed font-medium">
            {isGlobal
              ? 'The cross-workspace knowledge map will appear here once workspaces have been analyzed by the Graphify engine.'
              : 'Ask the agent to generate code in this workspace, then the structural graph will be built automatically.'}
          </p>
        </div>
        <button
          onClick={probeGraph}
          className="px-4 py-2 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] text-[9px] font-black uppercase tracking-widest hover:bg-[var(--accent)]/20 transition-all active:scale-95"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[400px] rounded-2xl overflow-hidden border border-black/[0.05] bg-white relative group">
      <div className="absolute top-4 right-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={probeGraph}
          className="px-3 py-1.5 bg-white/80 backdrop-blur-md border border-black/[0.1] rounded-lg text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors shadow-sm"
        >
          Refresh
        </button>
        <a 
          href={graphUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-white/80 backdrop-blur-md border border-black/[0.1] rounded-lg text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors shadow-sm"
        >
          Open in New Tab
        </a>
      </div>
      <iframe 
        src={graphUrl} 
        className="w-full h-full border-none"
        title="Knowledge Graph"
      />
    </div>
  );
};

export default GraphView;
