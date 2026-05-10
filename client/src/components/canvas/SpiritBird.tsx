import React from 'react';
import ReactMarkdown from 'react-markdown';

interface SpiritBirdProps {
  explanation: string;
}

const SpiritBird: React.FC<SpiritBirdProps> = ({ explanation }) => {
  return (
    <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="relative p-6 rounded-3xl bg-gradient-to-br from-[var(--accent)]/[0.03] to-[var(--accent)]/[0.08] border border-[var(--accent)]/10 backdrop-blur-md overflow-hidden group">
        {/* Animated Background Decoration */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[var(--accent)]/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-[var(--accent)]/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>

        <div className="relative flex gap-5">
          {/* Spirit Bird Avatar */}
          <div className="shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-[var(--accent)]/20 rounded-2xl blur-md animate-pulse"></div>
              <img 
                src="/media/aicodex-spirit-bird.png" 
                alt="Spirit Bird" 
                className="w-14 h-14 rounded-2xl border-2 border-[var(--accent)]/30 object-contain bg-[var(--bg-surface)] relative z-10 shadow-lg group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-[var(--bg-surface)] rounded-full z-20"></div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">Spirit Bird</span>
                <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/10 uppercase tracking-widest">Neural Tutor</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-[var(--accent)] animate-ping"></div>
                <span className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-tighter">Analyzing Logic...</span>
              </div>
            </div>

            <div className="prose prose-sm max-w-none prose-slate text-[12px] leading-relaxed text-[var(--text-secondary)] font-medium italic">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-3 last:mb-0">"{children}"</p>,
                  strong: ({ children }) => <strong className="text-[var(--accent)] font-bold">{children}</strong>,
                  code: ({ children }) => <code className="bg-black/5 px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--accent)]">{children}</code>
                }}
              >
                {explanation}
              </ReactMarkdown>
            </div>

            <div className="pt-2 flex items-center gap-4">
               <div className="h-[1px] flex-1 bg-gradient-to-r from-[var(--accent)]/20 to-transparent"></div>
               <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] opacity-40">Upskilling Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpiritBird;
