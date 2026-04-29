import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { Artifact } from '../../types/chat';

interface ArtifactViewProps {
  artifact: Artifact;
}

const ArtifactView: React.FC<ArtifactViewProps> = ({ artifact }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-elevated)] rounded-2xl border border-black/[0.05] overflow-hidden shadow-sm">
      <div className="h-12 px-4 flex items-center justify-between border-b border-black/[0.03] bg-black/[0.01]">
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${
            artifact.type === 'code' ? 'bg-blue-500/10 text-blue-600' :
            artifact.type === 'docs' ? 'bg-orange-500/10 text-orange-600' :
            'bg-purple-500/10 text-purple-600'
          }`}>
            {artifact.type === 'code' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>}
            {artifact.type === 'docs' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            {artifact.type === 'research' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-[var(--text-primary)] truncate max-w-[180px]">{artifact.title}</h4>
            <p className="text-[9px] text-[var(--text-muted)] font-mono uppercase tracking-tighter">
              {artifact.type} {artifact.language && `• ${artifact.language}`}
            </p>
          </div>
        </div>
        
        <button 
          onClick={handleCopy}
          className="p-2 hover:bg-black/[0.05] rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
          title="Copy content"
        >
          {copied ? (
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-5 scrollbar-hide bg-[#F8FAFC]">
        {artifact.type === 'code' ? (
          <pre className="text-[12px] font-mono leading-relaxed text-slate-800 whitespace-pre-wrap">
            <code>{artifact.content}</code>
          </pre>
        ) : (
          <div className="prose prose-sm max-w-none prose-slate">
            <ReactMarkdown>{artifact.content}</ReactMarkdown>
          </div>
        )}
      </div>
      
      <div className="h-8 px-4 flex items-center justify-between border-t border-black/[0.03] bg-black/[0.01] text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
        <span>Ready for export</span>
        <span>{new Date(artifact.timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

export default ArtifactView;
