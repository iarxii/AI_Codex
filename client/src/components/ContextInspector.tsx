import React from 'react';

interface ContextInspectorProps {
  contextData: any[];
  toolCalls: any[];
}

const ContextInspector: React.FC<ContextInspectorProps> = ({ contextData, toolCalls }) => {
  if (toolCalls.length === 0 && contextData.length === 0) return null;

  return (
    <div className="mt-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-500">
      {/* Tool Activity Section */}
      {toolCalls.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"></div>
            <h4 className="text-[10px] font-bold uppercase tracking-tighter text-[var(--text-secondary)]">System.Tool_Calls</h4>
          </div>
          
          <div className="space-y-3">
            {toolCalls.map((tool, i) => (
              <div key={i} className="p-3 bg-white/50 backdrop-blur-md border border-black/[0.05] rounded-xl font-mono text-[11px] shadow-sm ml-4">
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--accent)] font-bold">{tool.name}</span>
                  <span className="text-[var(--text-muted)] text-[9px]">ID: {tool.id?.slice(0, 4)}</span>
                </div>
                <div className="text-[var(--text-secondary)] overflow-x-auto">
                  <pre className="bg-transparent p-0 m-0 text-[10px] leading-tight">{JSON.stringify(tool.args, null, 2)}</pre>
                </div>
                {tool.result && (
                  <div className="mt-2 p-2 bg-green-50/50 border border-green-100 rounded text-green-700 overflow-x-auto max-h-40">
                    <div className="text-[9px] uppercase font-bold text-green-800 mb-1">Result</div>
                    <pre className="whitespace-pre-wrap bg-transparent p-0 m-0 text-[10px] leading-tight">{tool.result}</pre>
                  </div>
                )}
                {!tool.result && (
                  <div className="mt-2 flex items-center gap-2 text-[var(--text-muted)] italic">
                    <div className="w-1.2 h-1.2 rounded-full bg-[var(--accent)] animate-pulse"></div>
                    <span className="text-[9px]">Executing...</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* RAG Grounding Section */}
      {contextData.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>
            <h4 className="text-[10px] font-bold uppercase tracking-tighter text-[var(--text-secondary)]">Grounding.Context</h4>
          </div>

          <div className="space-y-4 ml-4">
            {contextData.map((chunk, i) => (
              <div key={i} className="group relative">
                <div className="absolute -left-2 top-0 bottom-0 w-[1px] bg-cyan-500/30 group-hover:bg-cyan-500 transition-colors"></div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-bold text-cyan-600 uppercase tracking-widest">Chunk_{i+1}</span>
                  <span className="text-[9px] text-[var(--text-muted)]">Score: {chunk.score?.toFixed(4)}</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all duration-300">
                  {chunk.content}
                </p>
                {chunk.source && <p className="text-[9px] text-[var(--text-muted)] mt-1 font-mono truncate">SRC: {chunk.source}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ContextInspector;

