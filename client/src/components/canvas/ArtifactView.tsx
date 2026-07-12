import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Artifact } from '../../types/chat';
import SpiritBird from './SpiritBird';

interface ArtifactViewProps {
  artifact: Artifact;
  onSave?: (path: string, content: string) => void;
}

const ArtifactView: React.FC<ArtifactViewProps> = ({ artifact, onSave }) => {
  const [copied, setCopied] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(artifact.content);

  // Sync content when artifact changes if not editing
  React.useEffect(() => {
    if (!isEditing) {
      setEditContent(artifact.content);
    }
  }, [artifact.content, isEditing]);

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (onSave && (artifact.filePath || artifact.title)) {
      onSave(artifact.filePath || artifact.title, editContent);
    }
    setIsEditing(false);
  };

  const lines = artifact.type === 'code' ? artifact.content.split('\n') : [];

  return (
    <div className="flex flex-col h-full bg-[var(--bg-elevated)] rounded-2xl border border-black/[0.05] overflow-hidden shadow-sm">
      {/* Header with macOS window controls */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-black/[0.03] bg-black/[0.01]">
        <div className="flex items-center gap-3">
          {/* macOS-style window dots */}
          <div className="flex items-center gap-1.5 mr-1">
            <div className="w-[9px] h-[9px] rounded-full bg-[#FF5F57] border border-[#E0443E]/40"></div>
            <div className="w-[9px] h-[9px] rounded-full bg-[#FEBC2E] border border-[#DEA123]/40"></div>
            <div className="w-[9px] h-[9px] rounded-full bg-[#28C840] border border-[#1AAB29]/40"></div>
          </div>
          {/* File type badge */}
          <div className={`p-1.5 rounded-lg ${
            artifact.type === 'code' ? 'bg-blue-500/10 text-blue-600' :
            artifact.type === 'docs' ? 'bg-orange-500/10 text-orange-600' :
            'bg-purple-500/10 text-purple-600'
          }`}>
            {artifact.type === 'code' && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>}
            {artifact.type === 'docs' && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            {artifact.type === 'research' && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-[var(--text-primary)] truncate max-w-[220px]">
              {artifact.filePath ? artifact.filePath.split('/').pop() : artifact.title}
            </h4>
            <p className="text-[9px] text-[var(--text-muted)] font-mono uppercase tracking-tighter flex items-center gap-1.5">
              <span>{artifact.type}</span>
              {artifact.language && (
                <>
                  <span className="opacity-30">•</span>
                  <span>{artifact.language}</span>
                </>
              )}
              {artifact.filePath && (
                <>
                  <span className="opacity-30">•</span>
                  <span className="opacity-60 lowercase">{artifact.filePath}</span>
                </>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onSave && artifact.type === 'code' && (
            isEditing ? (
              <>
                <button onClick={() => { setIsEditing(false); setEditContent(artifact.content); }} className="px-2 py-1 hover:bg-black/[0.05] rounded text-[9px] font-bold text-[var(--text-muted)] uppercase">Cancel</button>
                <button onClick={handleSave} className="px-3 py-1 bg-[var(--accent)] text-white rounded text-[9px] font-bold uppercase shadow-[0_0_8px_rgba(255,102,0,0.3)]">Save</button>
              </>
            ) : (
              <button onClick={() => setIsEditing(true)} className="px-3 py-1 hover:bg-black/[0.05] rounded text-[9px] font-bold text-[var(--text-muted)] hover:text-[var(--accent)] uppercase flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                Edit
              </button>
            )
          )}
          
          {/* Copy button with animation */}
          <button 
            onClick={handleCopy}
            className={`p-2 rounded-xl transition-all ${
              copied 
                ? 'bg-green-500/10 text-green-500 scale-95' 
                : 'hover:bg-black/[0.05] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
            title="Copy content"
          >
            {copied ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto scrollbar-hide">
        {artifact.type === 'code' ? (
          /* Dark-themed code view with line numbers */
          <div className="bg-[#0F172A] text-slate-200 p-0 min-h-full flex">
            {isEditing ? (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-transparent text-[12px] font-mono leading-[1.7] p-4 text-slate-200 outline-none resize-none min-h-[300px]"
                spellCheck="false"
              />
            ) : (
              <div className="font-mono text-[12px] leading-[1.7] w-full">
                {lines.map((line, i) => (
                  <div 
                    key={i} 
                    className="flex hover:bg-white/[0.03] transition-colors"
                  >
                    {/* Line number gutter */}
                    <span className="select-none w-12 shrink-0 text-right pr-4 text-slate-500/60 text-[11px] leading-[1.7] border-r border-slate-700/30">
                      {i + 1}
                    </span>
                    {/* Code content */}
                    <span className="pl-4 pr-5 whitespace-pre-wrap break-all flex-1">
                      {line || '\u00A0'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Markdown documentation/research view */
          <div className="p-5 prose prose-sm max-w-none prose-slate prose-chat">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact.content}</ReactMarkdown>
          </div>
        )}

        {/* Spirit Bird Tutor Section */}
        {artifact.tutorExplanation && (
          <div className={`mt-8 ${artifact.type === 'code' ? 'bg-[#0F172A] px-5 pb-5' : 'px-5 pb-5'}`}>
            <div className="flex items-center gap-4 mb-6">
              <div className={`h-[1px] flex-1 ${artifact.type === 'code' ? 'bg-slate-700/30' : 'bg-black/[0.05]'}`}></div>
              <div className="flex items-center gap-2">
                <svg className="w-3 h-3 text-[var(--accent)]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${artifact.type === 'code' ? 'text-slate-400' : 'text-[var(--text-muted)]'}`}>Neural Insights</span>
              </div>
              <div className={`h-[1px] flex-1 ${artifact.type === 'code' ? 'bg-slate-700/30' : 'bg-black/[0.05]'}`}></div>
            </div>
            <SpiritBird explanation={artifact.tutorExplanation} />
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="h-8 px-4 flex items-center justify-between border-t border-black/[0.03] bg-black/[0.01] text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
        <span>{artifact.type === 'code' ? `${lines.length} lines` : 'Ready for export'}</span>
        <span>{new Date(artifact.timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

export default ArtifactView;
