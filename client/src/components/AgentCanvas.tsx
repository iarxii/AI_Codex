import React, { useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import type { Artifact } from '../types/chat';
import { useAI } from '../contexts/AIContext';
import ArtifactView from './canvas/ArtifactView';
import GraphView from './canvas/GraphView';
import { ModuleTree } from './canvas/ModuleTree';
import DependencyMinimap from './canvas/DependencyMinimap';
import { CodeEditorPane } from './canvas/CodeEditorPane';
import { TerminalConsole } from './canvas/TerminalConsole';
import type { TerminalOutput } from './canvas/TerminalConsole';
import { config, getApiUrl } from '../config';

interface AgentCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  artifacts: Artifact[];
  externalSelectedId?: string | null;
  conversationId?: string | number | null;
}

type TabType = 'Code' | 'Docs' | 'Research' | 'Graph';
type CanvasWidth = 'compact' | 'wide' | 'full';

const WIDTH_MAP: Record<CanvasWidth, string> = {
  compact: 'w-[480px]',
  wide:    'w-[860px]',
  full:    'w-full',
};

/** Standard-mode tabs */
const STANDARD_TABS: TabType[] = ['Code', 'Docs', 'Research'];
/** CodeSpace-mode tabs (full IDE integration) */
const CODESPACE_TABS: TabType[] = ['Code', 'Docs', 'Research', 'Graph'];

const AgentCanvas: React.FC<AgentCanvasProps> = ({
  isOpen,
  onClose,
  artifacts,
  externalSelectedId,
  conversationId,
}) => {
  const { isPremiumSpace, activeSpace } = useAI();
  const [activeTab, setActiveTab] = useState<TabType>('Code');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState<CanvasWidth>('compact');

  // IDE-specific state
  const [terminalLogs, setTerminalLogs] = useState<TerminalOutput[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);

  const availableTabs = isPremiumSpace ? CODESPACE_TABS : STANDARD_TABS;

  // Reset to valid tab if current tab is hidden
  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab('Code');
    }
  }, [isPremiumSpace, activeTab, availableTabs]);

  // Sync with external selection
  useEffect(() => {
    if (externalSelectedId) {
      let art = artifacts.find(a => a.id === externalSelectedId);

      // Fuzzy fallback: strip type prefixes and normalise across ID formats
      if (!art) {
        const normalize = (s: string) =>
          s.replace(/^(code|docs|doc|research|fs)-/, '').toLowerCase().replace(/[/\\._-]/g, '');
        const target = normalize(externalSelectedId);
        art = artifacts.find(a =>
          normalize(a.id) === target ||
          (a.filePath && normalize(a.filePath) === target) ||
          (a.title && normalize(a.title) === target)
        );
      }

      if (art) {
        setSelectedId(art.id);
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
    if (activeTab === 'Graph') return;
    if (filteredArtifacts.length > 0 && (!selectedId || !filteredArtifacts.find(a => a.id === selectedId))) {
      setSelectedId(filteredArtifacts[0].id);
    }
  }, [activeTab, artifacts, selectedId]);

  const selectedArtifact = filteredArtifacts.find(a => a.id === selectedId) || filteredArtifacts[0];
  const isMultiFile = filteredArtifacts.length > 1;

  // ── Auth Headers helper ─────────────────────────────────────────────────
  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    ...(isPremiumSpace && config.COLAB_SECRET ? { 'X-Codex-Premium-Key': config.COLAB_SECRET } : {}),
  }), [isPremiumSpace]);

  // ── Workspace CRUD handlers ─────────────────────────────────────────────
  const handleCreateFile = async (path: string) => {
    if (!conversationId) return;
    try {
      const baseUrl = getApiUrl(isPremiumSpace);
      await fetch(`${baseUrl}${config.API_V1_STR}/workspace/${conversationId}/file`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ path, content: '' }),
      });
      window.dispatchEvent(new CustomEvent('workspace-update'));
    } catch (e) { console.error(e); }
  };

  const handleCreateFolder = async (path: string) => {
    if (!conversationId) return;
    try {
      const baseUrl = getApiUrl(isPremiumSpace);
      await fetch(`${baseUrl}${config.API_V1_STR}/workspace/${conversationId}/folder`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ path }),
      });
      window.dispatchEvent(new CustomEvent('workspace-update'));
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (path: string) => {
    if (!conversationId) return;
    try {
      const baseUrl = getApiUrl(isPremiumSpace);
      await fetch(`${baseUrl}${config.API_V1_STR}/workspace/${conversationId}/delete`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ path }),
      });
      window.dispatchEvent(new CustomEvent('workspace-update'));
      if (selectedId && path && selectedId.includes(path)) {
        setSelectedId(null);
      }
    } catch (e) { console.error(e); }
  };

  // ── Save handler (called by CodeEditorPane) ─────────────────────────────
  const handleSave = useCallback(async (path: string, content: string) => {
    if (!conversationId) return;
    const baseUrl = getApiUrl(isPremiumSpace);
    await fetch(`${baseUrl}${config.API_V1_STR}/workspace/${conversationId}/file`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ path, content }),
    });
    window.dispatchEvent(new CustomEvent('workspace-update'));
  }, [conversationId, isPremiumSpace, authHeaders]);

  // ── Run handler: POST /api/v1/skills/shell_exec/test ────────────────────
  const handleRun = useCallback(async (command: string) => {
    if (!conversationId || isExecuting) return;
    setIsExecuting(true);
    setIsTerminalOpen(true);

    const placeholder: TerminalOutput = {
      command,
      isRunning: true,
      timestamp: Date.now(),
    };
    setTerminalLogs(prev => [...prev, placeholder]);

    const startTime = Date.now();
    try {
      const baseUrl = getApiUrl(isPremiumSpace);
      const resp = await fetch(`${baseUrl}${config.API_V1_STR}/skills/shell_exec/test`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          command,
          cwd: '.',
          shell: 'default',
          conversation_id: String(conversationId),
        }),
      });
      const result = await resp.json();
      const durationMs = Date.now() - startTime;

      setTerminalLogs(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          command,
          output: result.output || result.data?.stdout || '',
          error: result.error || result.data?.stderr || '',
          returnCode: result.return_code ?? (result.success ? 0 : 1),
          durationMs,
          timestamp: Date.now(),
          isRunning: false,
        };
        return updated;
      });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      setTerminalLogs(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          command,
          error: String(err),
          returnCode: 1,
          durationMs,
          timestamp: Date.now(),
          isRunning: false,
        };
        return updated;
      });
    } finally {
      setIsExecuting(false);
    }
  }, [conversationId, isPremiumSpace, isExecuting, authHeaders]);

  // ── Export handler ──────────────────────────────────────────────────────
  const handleExport = async () => {
    if (artifacts.length === 0) return;
    setExporting(true);
    try {
      const zip = new JSZip();
      const usedPaths = new Set<string>();

      artifacts.forEach(art => {
        let fileName = art.title || `artifact-${art.id}`;
        let folderPath = '';

        if (art.filePath) {
          const parts = art.filePath.split('/');
          fileName = parts.pop() || fileName;
          folderPath = parts.join('/');
        } else {
          if (art.type === 'code') folderPath = 'src';
          else if (art.type === 'docs') folderPath = 'docs';
          else if (art.type === 'research') folderPath = 'research';
        }

        if (art.type === 'code' && !fileName.includes('.')) {
          const ext = art.language === 'python' || art.language === 'py' ? 'py' :
            art.language === 'javascript' || art.language === 'js' ? 'js' :
            art.language === 'typescript' || art.language === 'ts' ? 'ts' :
            art.language === 'json' ? 'json' :
            art.language === 'bash' || art.language === 'sh' ? 'sh' :
            art.language === 'tsx' ? 'tsx' : 'txt';
          fileName = `${fileName}.${ext}`;
        } else if ((art.type === 'docs' || art.type === 'research') && !fileName.includes('.')) {
          fileName = `${fileName}.md`;
        }

        fileName = fileName.replace(/[\\:*?"<>|]/g, '_');
        const fullPath = folderPath ? `${folderPath}/${fileName}` : fileName;

        let finalPath = fullPath;
        let counter = 1;
        while (usedPaths.has(finalPath)) {
          const extIdx = fileName.lastIndexOf('.');
          const base = extIdx !== -1 ? fileName.substring(0, extIdx) : fileName;
          const ext = extIdx !== -1 ? fileName.substring(extIdx) : '';
          finalPath = folderPath ? `${folderPath}/${base}_${counter}${ext}` : `${base}_${counter}${ext}`;
          counter++;
        }
        usedPaths.add(finalPath);
        zip.file(finalPath, art.content);
      });

      const spaceName = activeSpace?.name || 'Workspace';
      zip.file('README.md', `# ${spaceName} Export\n\nExported on: ${new Date().toLocaleString()}\nEnvironment: ${isPremiumSpace ? 'CodeSpace (Premium)' : 'Standard Space'}\nTotal Artifacts: ${artifacts.length}\n\n## Included Artifacts\n\n${artifacts.map(art => `- **${art.title}** (${art.type}${art.filePath ? `, path: \`${art.filePath}\`` : ''})`).join('\n')}\n`);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      const safeSpaceName = (activeSpace?.name || 'workspace').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      a.download = `aicodex-${safeSpaceName}-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate ZIP export:', err);
    } finally {
      setExporting(false);
    }
  };

  // ── Width toggle cycle ──────────────────────────────────────────────────
  const cycleWidth = () => {
    setCanvasWidth(prev =>
      prev === 'compact' ? 'wide' : prev === 'wide' ? 'full' : 'compact'
    );
  };

  if (!isOpen) return null;

  return (
    <aside
      className={`${WIDTH_MAP[canvasWidth]} h-full flex flex-col bg-[var(--bg-surface)]/95 backdrop-blur-2xl border-l border-black/[0.05] z-30 animate-in slide-in-from-right duration-300 shadow-2xl transition-[width] duration-200`}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="h-14 flex items-center justify-between px-5 border-b border-black/[0.05] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"></div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Agent Canvas</h3>
          {isPremiumSpace && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[7px] font-black uppercase tracking-wider text-[var(--accent)] border border-[var(--accent)]/20">
              CodeSpace
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Width toggle */}
          <button
            onClick={cycleWidth}
            className="p-1.5 hover:bg-black/[0.05] rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            title={canvasWidth === 'compact' ? 'Expand to Wide' : canvasWidth === 'wide' ? 'Expand to Full Screen' : 'Collapse'}
          >
            {canvasWidth === 'compact' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5" />
              </svg>
            ) : canvasWidth === 'wide' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9L4 4m0 0v5m0-5h5m6 0h5m0 0v5m0-5l-5 5M9 15l-5 5m0 0h5m-5 0v-5m16 5l-5-5m5 5v-5m0 5h-5" />
              </svg>
            )}
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={exporting || artifacts.length === 0}
            className={`p-1.5 hover:bg-black/[0.05] rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors ${exporting ? 'animate-pulse text-[var(--accent)]' : ''} ${artifacts.length === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
            title={exporting ? 'Exporting Workspace...' : 'Export Workspace as ZIP'}
          >
            {exporting ? (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-black/[0.05] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="px-5 py-3 flex items-center gap-4 border-b border-black/[0.02] bg-black/[0.01] shrink-0">
        {availableTabs.map((tab) => {
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
              {tab !== 'Graph' && count > 0 && (
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

      {/* ── Content Area ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'Graph' ? (
          <div className="flex-1 flex flex-col p-5 overflow-hidden">
            <GraphView workspaceId={conversationId || 'unknown'} />
          </div>

        ) : filteredArtifacts.length > 0 ? (
          <>
            {/* ━━ Code Tab: Full IDE layout ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {activeTab === 'Code' ? (
              <div className="flex-1 flex overflow-hidden">
                {/* Left: File Explorer */}
                <div className={`shrink-0 border-r border-black/[0.08] overflow-hidden flex flex-col ${canvasWidth === 'compact' ? 'w-44' : 'w-56'}`}>
                  <ModuleTree
                    artifacts={filteredArtifacts}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onCreateFile={handleCreateFile}
                    onCreateFolder={handleCreateFolder}
                    onDelete={handleDelete}
                  />
                </div>

                {/* Right: Editor + Terminal */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-hidden">
                    <CodeEditorPane
                      artifact={selectedArtifact}
                      onSave={handleSave}
                      onRun={handleRun}
                      isExecuting={isExecuting}
                    />
                  </div>
                  <TerminalConsole
                    logs={terminalLogs}
                    onClear={() => setTerminalLogs([])}
                    isOpen={isTerminalOpen}
                    onToggle={() => setIsTerminalOpen(prev => !prev)}
                  />
                </div>
              </div>

            ) : (
              /* ━━ Docs / Research Tab: Classic view ━━━━━━━━━━━━━━━━━━━━ */
              <div className="flex-1 flex flex-col overflow-hidden">
                {isMultiFile && isPremiumSpace ? (
                  /* CodeSpace multi-file */
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="max-h-[220px] overflow-y-auto scrollbar-hide border-b border-black/[0.04] bg-black/[0.01]">
                      <ModuleTree
                        artifacts={filteredArtifacts}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        onCreateFile={handleCreateFile}
                        onCreateFolder={handleCreateFolder}
                        onDelete={handleDelete}
                      />
                    </div>
                    <div className="flex-1 overflow-hidden flex flex-col p-4">
                      {selectedArtifact ? (
                        <ArtifactView artifact={selectedArtifact} onSave={handleSave} />
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-bold opacity-30">
                          Select a file to view
                        </div>
                      )}
                    </div>
                    <div className="px-4 pb-3 shrink-0">
                      <DependencyMinimap
                        artifacts={filteredArtifacts}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                      />
                    </div>
                  </div>

                ) : isMultiFile ? (
                  /* Standard multi-snippet flat list */
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="max-h-[200px] overflow-y-auto scrollbar-hide border-b border-black/[0.04]">
                      <div className="py-2 px-3 space-y-0.5">
                        {filteredArtifacts.map((art) => {
                          const isActive = selectedId === art.id;
                          const timeAgo = getRelativeTime(art.timestamp);
                          return (
                            <button
                              key={art.id}
                              onClick={() => setSelectedId(art.id)}
                              className={`w-full flex items-center gap-3 py-2 px-3 rounded-xl transition-all text-left group ${
                                isActive
                                  ? 'bg-[var(--accent)]/8 ring-1 ring-[var(--accent)]/20 shadow-sm'
                                  : 'hover:bg-black/[0.03]'
                              }`}
                            >
                              <LanguageBadge language={art.language} type={art.type} />
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className={`text-[10px] font-bold truncate ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                                  {art.title}
                                </span>
                                <span className="text-[8px] text-[var(--text-muted)] font-mono uppercase tracking-tight">
                                  {art.language || art.type} • {timeAgo}
                                </span>
                              </div>
                              {isActive && (
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_6px_rgba(255,102,0,0.5)] shrink-0"></div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden flex flex-col p-4">
                      {selectedArtifact ? (
                        <ArtifactView artifact={selectedArtifact} onSave={handleSave} />
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-bold opacity-30">
                          Select a snippet to view
                        </div>
                      )}
                    </div>
                  </div>

                ) : (
                  /* Single file classic view */
                  <div className="flex-1 flex flex-col p-5 space-y-5 overflow-y-auto scrollbar-hide">
                    {selectedArtifact ? (
                      <ArtifactView artifact={selectedArtifact} onSave={handleSave} />
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-bold opacity-30">
                        Select an artifact to view
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>

        ) : (
          /* ━━ Empty State ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
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

      {/* ── Footer Status ───────────────────────────────────────────────── */}
      <div className="p-4 border-t border-black/[0.05] bg-black/[0.02] shrink-0">
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

/* ── Helper Components ─────────────────────────────────────────────────── */

const LanguageBadge: React.FC<{ language?: string; type: Artifact['type'] }> = ({ language, type }) => {
  const lang = (language || '').toLowerCase();

  const badgeConfig: Record<string, { bg: string; text: string; label: string }> = {
    'python':     { bg: 'bg-blue-500/15',   text: 'text-blue-500',   label: 'PY' },
    'py':         { bg: 'bg-blue-500/15',   text: 'text-blue-500',   label: 'PY' },
    'javascript': { bg: 'bg-yellow-500/15', text: 'text-yellow-600', label: 'JS' },
    'js':         { bg: 'bg-yellow-500/15', text: 'text-yellow-600', label: 'JS' },
    'typescript': { bg: 'bg-blue-400/15',  text: 'text-blue-400',   label: 'TS' },
    'ts':         { bg: 'bg-blue-400/15',  text: 'text-blue-400',   label: 'TS' },
    'tsx':        { bg: 'bg-cyan-500/15',  text: 'text-cyan-500',   label: 'TSX' },
    'jsx':        { bg: 'bg-cyan-500/15',  text: 'text-cyan-500',   label: 'JSX' },
    'json':       { bg: 'bg-orange-500/15', text: 'text-orange-500', label: 'JSON' },
    'bash':       { bg: 'bg-green-500/15', text: 'text-green-500',  label: 'SH' },
    'sh':         { bg: 'bg-green-500/15', text: 'text-green-500',  label: 'SH' },
    'sql':        { bg: 'bg-indigo-500/15', text: 'text-indigo-500', label: 'SQL' },
    'yaml':       { bg: 'bg-rose-500/15',  text: 'text-rose-500',   label: 'YML' },
    'html':       { bg: 'bg-red-500/15',   text: 'text-red-500',    label: 'HTML' },
    'css':        { bg: 'bg-purple-500/15', text: 'text-purple-500', label: 'CSS' },
    'rust':       { bg: 'bg-orange-600/15', text: 'text-orange-600', label: 'RS' },
    'go':         { bg: 'bg-teal-500/15',  text: 'text-teal-500',   label: 'GO' },
  };

  const cfg = badgeConfig[lang] || (
    type === 'docs'     ? { bg: 'bg-orange-500/10', text: 'text-orange-500', label: 'DOC' } :
    type === 'research' ? { bg: 'bg-purple-500/10', text: 'text-purple-500', label: 'RES' } :
                          { bg: 'bg-slate-400/10',  text: 'text-slate-400',  label: 'TXT' }
  );

  return (
    <div className={`${cfg.bg} ${cfg.text} w-8 h-8 rounded-lg flex items-center justify-center text-[8px] font-black tracking-tight shrink-0 border border-current/10`}>
      {cfg.label}
    </div>
  );
};

function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default AgentCanvas;
