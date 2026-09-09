import React, { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type { Artifact } from '../../types/chat';

interface CodeEditorPaneProps {
  artifact: Artifact | undefined;
  onSave: (path: string, content: string) => Promise<void> | void;
  onRun?: (command: string) => Promise<void> | void;
  isExecuting?: boolean;
}

function resolveLanguage(artifact?: Artifact): string {
  if (!artifact) return 'plaintext';
  const path = (artifact.filePath || artifact.title || '').toLowerCase();
  const lang = (artifact.language || '').toLowerCase();

  if (path.endsWith('.py') || lang === 'python' || lang === 'py') return 'python';
  if (path.endsWith('.ts') || lang === 'typescript' || lang === 'ts') return 'typescript';
  if (path.endsWith('.tsx') || lang === 'tsx') return 'typescript';
  if (path.endsWith('.js') || lang === 'javascript' || lang === 'js') return 'javascript';
  if (path.endsWith('.jsx') || lang === 'jsx') return 'javascript';
  if (path.endsWith('.json') || lang === 'json') return 'json';
  if (path.endsWith('.html') || lang === 'html') return 'html';
  if (path.endsWith('.css') || lang === 'css') return 'css';
  if (path.endsWith('.sh') || path.endsWith('.bash') || lang === 'bash' || lang === 'sh') return 'shell';
  if (path.endsWith('.sql') || lang === 'sql') return 'sql';
  if (path.endsWith('.md') || lang === 'markdown') return 'markdown';
  if (path.endsWith('.yml') || path.endsWith('.yaml') || lang === 'yaml') return 'yaml';
  return 'plaintext';
}

function resolveRunCommand(artifact?: Artifact): string | null {
  if (!artifact) return null;
  const path = artifact.filePath || artifact.title;
  if (!path) return null;
  const lower = path.toLowerCase();

  if (lower.endsWith('.py')) return `python ${path}`;
  if (lower.endsWith('.js')) return `node ${path}`;
  if (lower.endsWith('.sh')) return `bash ${path}`;
  if (lower.endsWith('.ps1')) return `powershell -File ${path}`;
  return null;
}

export const CodeEditorPane: React.FC<CodeEditorPaneProps> = ({
  artifact,
  onSave,
  onRun,
  isExecuting = false,
}) => {
  const [content, setContent] = useState<string>(artifact?.content ?? '');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setContent(artifact?.content ?? '');
    setIsDirty(false);
  }, [artifact?.id, artifact?.filePath]);

  const handleSave = useCallback(async () => {
    if (!artifact) return;
    const path = artifact.filePath || artifact.title;
    if (!path) return;
    setIsSaving(true);
    try {
      await onSave(path, content);
      setIsDirty(false);
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setIsSaving(false);
    }
  }, [artifact, content, onSave]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Keyboard shortcut: Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  if (!artifact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0d1117] text-slate-500 font-mono text-[11px] uppercase tracking-widest">
        <svg className="w-10 h-10 mb-3 opacity-30 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Select a file from the explorer to view and edit
      </div>
    );
  }

  const language = resolveLanguage(artifact);
  const runCommand = resolveRunCommand(artifact);
  const lineCount = content.split('\n').length;
  const filePath = artifact.filePath || artifact.title;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] overflow-hidden">
      {/* Editor Action Bar / Header */}
      <div className="h-10 px-4 flex items-center justify-between bg-[#161b22] border-b border-black/30 select-none shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[11px] font-mono font-bold text-slate-200 truncate">
            {filePath}
          </span>
          {isDirty && (
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
          )}
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400 font-mono shrink-0">
            {language}
          </span>
          <span className="text-[9px] text-slate-500 font-mono shrink-0">
            {lineCount} lines
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Run button if file is runnable */}
          {runCommand && onRun && (
            <button
              onClick={() => onRun(runCommand)}
              disabled={isExecuting}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                isExecuting
                  ? 'bg-amber-500/20 text-amber-300 cursor-wait'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.3)]'
              }`}
              title={`Execute ${runCommand} in sandbox`}
            >
              {isExecuting ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Running</span>
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>Run</span>
                </>
              )}
            </button>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
              isSaving
                ? 'bg-blue-500/20 text-blue-300 cursor-wait'
                : isDirty
                ? 'bg-[var(--accent)] hover:brightness-110 text-white shadow-[0_0_8px_rgba(255,102,0,0.3)]'
                : 'opacity-40 text-slate-400 cursor-default'
            }`}
            title={isDirty ? 'Save (Ctrl+S)' : 'Saved'}
          >
            {isSaving ? (
              <span>Saving...</span>
            ) : (
              <span>{isDirty ? 'Save' : 'Saved'}</span>
            )}
          </button>

          {/* Copy content button */}
          <button
            onClick={handleCopy}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Copy file contents"
          >
            {copied ? (
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Monaco Code Editor */}
      <div className="flex-1 relative overflow-hidden">
        <Editor
          height="100%"
          language={language}
          value={content}
          theme="vs-dark"
          onChange={(val) => {
            setContent(val ?? '');
            setIsDirty(true);
          }}
          options={{
            fontSize: 12,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            tabSize: 2,
            padding: { top: 8, bottom: 8 },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
          }}
        />
      </div>
    </div>
  );
};

export default CodeEditorPane;
