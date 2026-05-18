import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SpiritBirdProps {
  explanation: string;
}

const SpiritBird: React.FC<SpiritBirdProps> = ({ explanation }) => {
  return (
    <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="relative p-7 rounded-[32px] bg-white/40 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.05)] overflow-hidden group">
        {/* Animated Background Decoration */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[var(--accent)]/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-[var(--accent)]/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>

        <div className="relative flex flex-col md:flex-row gap-6">
          {/* Spirit Bird Avatar */}
          <div className="shrink-0 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-[var(--accent)]/30 rounded-[24px] blur-lg animate-pulse"></div>
              <img 
                src="/media/aicodex-spirit-bird.png" 
                alt="Spirit Bird" 
                className="w-16 h-16 rounded-[24px] border-2 border-white object-contain bg-white relative z-10 shadow-2xl group-hover:scale-105 group-hover:rotate-3 transition-all duration-500"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-4 border-white rounded-full z-20 shadow-md"></div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--accent)]">Spirit Bird</span>
                <div className="h-4 w-[1px] bg-[var(--accent)]/20"></div>
                <span className="text-[9px] font-bold px-3 py-0.5 rounded-full bg-white text-[var(--accent)] border border-[var(--accent)]/10 shadow-sm uppercase tracking-widest">Neural Tutor</span>
              </div>
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 border border-black/[0.03]">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-tighter">Logic Synthesized</span>
              </div>
            </div>

            <div className="prose prose-sm max-w-none prose-slate text-[13px] leading-relaxed text-[#4A4D5E] font-medium italic">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">"{children}"</p>,
                  strong: ({ children }) => <strong className="text-[var(--accent)] font-black">{children}</strong>,
                  code: ({ children }) => <code className="bg-[var(--accent)]/5 px-2 py-0.5 rounded text-[11px] font-mono text-[var(--accent)] border border-[var(--accent)]/10">{children}</code>
                }}
              >
                {explanation}
              </ReactMarkdown>
            </div>

            <div className="pt-4 flex items-center gap-4">
               <div className="h-[1px] flex-1 bg-gradient-to-r from-[var(--accent)]/30 to-transparent"></div>
               <div className="flex flex-col items-end">
                 <span className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em] opacity-40 mb-1">Knowledge Transmitted</span>
                 <span className="text-[9px] font-serif italic text-[var(--accent)] opacity-80">— Spirit Bird</span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpiritBird;
