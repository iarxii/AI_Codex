import React from 'react';

interface ContextInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  contextData: any[];
  toolCalls: any[];
}

const ContextInspector: React.FC<ContextInspectorProps> = ({ isOpen, onClose, contextData, toolCalls }) => {
  if (!isOpen) return null;

  return (
    <aside className="w-80 h-full flex flex-col bg-[var(--bg-surface)]/95 backdrop-blur-2xl border-l border-black/[0.05] z-30 animate-in slide-in-from-right duration-300 shadow-2xl">
      <div className="h-14 flex items-center justify-between px-5 border-b border-black/[0.05]">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Context Inspector</h3>
        <button onClick={onClose} className="p-1.5 hover:bg-black/[0.05] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-hide">
        {/* Tool Activity Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"></div>
            <h4 className="text-[10px] font-bold uppercase tracking-tighter text-[var(--text-secondary)]">System.Tool_Calls</h4>
          </div>
          
          <div className="space-y-3">
            {toolCalls.length === 0 && <p className="text-[10px] text-[var(--text-muted)] font-mono italic">No tool execution in current turn.</p>}
            {toolCalls.map((tool, i) => (
              <div key={i} className="p-3 bg-white border border-black/[0.05] rounded-xl font-mono text-[11px] shadow-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--accent)] font-bold">{tool.name}</span>
                  <span className="text-[var(--text-muted)]">ID: {tool.id?.slice(0, 4)}</span>
                </div>
                <div className="text-[var(--text-secondary)] overflow-x-auto">
                  <pre className="bg-transparent p-0 m-0 text-[10px] leading-tight">{JSON.stringify(tool.args, null, 2)}</pre>
                </div>
                {tool.result && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-100 rounded text-green-700 overflow-x-auto max-h-40">
                    <div className="text-[9px] uppercase font-bold text-green-800 mb-1">Result</div>
                    <pre className="whitespace-pre-wrap bg-transparent p-0 m-0 text-[10px] leading-tight">{tool.result}</pre>
                  </div>
                )}
                {!tool.result && (
                  <div className="mt-2 flex items-center gap-2 text-[var(--text-muted)] italic">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse"></div>
                    <span>Executing...</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* RAG Grounding Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>
            <h4 className="text-[10px] font-bold uppercase tracking-tighter text-[var(--text-secondary)]">Grounding.Context</h4>
          </div>

          <div className="space-y-4">
            {contextData.length === 0 && <p className="text-[10px] text-[var(--text-muted)] font-mono italic">No context retrieved.</p>}
            {contextData.map((chunk, i) => (
              <div key={i} className="group relative">
                <div className="absolute -left-2 top-0 bottom-0 w-[1px] bg-cyan-500/30 group-hover:bg-cyan-500 transition-colors"></div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-bold text-cyan-600 uppercase tracking-widest">Chunk_{i+1}</span>
                  <span className="text-[9px] text-[var(--text-muted)]">Score: {chunk.score?.toFixed(4)}</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-4 group-hover:line-clamp-none transition-all duration-300">
                  {chunk.content}
                </p>
                {chunk.source && <p className="text-[9px] text-[var(--text-muted)] mt-1 font-mono truncate">SRC: {chunk.source}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="p-4 border-t border-black/[0.05] bg-black/[0.02]">
        <div className="flex justify-between items-center text-[9px] font-mono text-[var(--text-muted)]">
          <span>Ollama.Llama3_2:3b</span>
          <span>Latency: 42ms</span>
        </div>
      </div>
    </aside>
  );
};

export default ContextInspector;
