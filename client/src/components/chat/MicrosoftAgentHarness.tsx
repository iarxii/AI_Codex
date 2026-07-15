import React, { useState, useRef, useEffect } from 'react';
import { Network, Calendar, FolderOpen, Zap, Cloud, Activity, CheckCircle2, Server, FileText, Database, Play, Square, Send, Terminal } from 'lucide-react';
import { config, getApiUrl } from '../../config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentLog {
  message: string;
  state: string;
  timestamp: string;
}

interface MicrosoftAgentHarnessProps {
  onArtifactReady?: (artifact: { id: string; title: string; content: string; language: string }) => void;
}

// ---------------------------------------------------------------------------
// Streaming helper
// ---------------------------------------------------------------------------

async function streamAgentTask(
  promptText: string,
  sessionId: string,
  onLog: (log: AgentLog) => void,
  onArtifact: (artifactJson: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
  signal: AbortSignal
) {
  const taskId = `ms-${Date.now()}`;
  const baseUrl = getApiUrl(true) || config.API_BASE_URL;
  const token = localStorage.getItem('token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(config.COLAB_SECRET ? { 'X-Codex-Premium-Key': config.COLAB_SECRET } : {}),
  };

  const body = JSON.stringify({
    id: taskId,
    sessionId,
    skillId: 'power_platform_dev',
    preferA2UI: true,
    message: {
      role: 'user',
      parts: [{ type: 'text', text: promptText }],
    },
  });

  try {
    const response = await fetch(`${baseUrl}/a2a/microsoft-agent-lab/tasks/send-stream`, {
      method: 'POST',
      headers,
      body,
      signal,
    });

    if (!response.ok || !response.body) {
      onError(`HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const raw = trimmed.slice(5).trim();
        if (!raw) continue;

        try {
          const data = JSON.parse(raw);

          const state = data.status?.state ?? '';
          const msg = data.status?.message?.parts?.[0]?.text ?? '';
          const ts = data.status?.timestamp ?? new Date().toISOString();

          onLog({ state, message: msg, timestamp: ts });

          if (data.final) {
            if (state === 'failed') {
              onError(msg || 'Agent task failed.');
            } else if (data.artifact?.parts?.[0]?.text) {
              onArtifact(data.artifact.parts[0].text);
            }
            onDone();
            return;
          }
        } catch {
          // skip malformed lines
        }
      }
    }
    onDone();
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      onError(err.message ?? 'Unknown network error.');
    }
    onDone();
  }
}

// ---------------------------------------------------------------------------
// Sub-component: Live Execution Log
// ---------------------------------------------------------------------------

const LogBadge: React.FC<{ state: string }> = ({ state }) => {
  const map: Record<string, string> = {
    working: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    completed: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    failed: 'text-red-400 bg-red-400/10 border-red-400/20',
    submitted: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  };
  const cls = map[state] ?? 'text-gray-400 bg-gray-400/10 border-gray-400/20';
  return (
    <span className={`text-[7px] font-mono uppercase px-1.5 py-0.5 rounded border font-bold ${cls}`}>
      {state || 'info'}
    </span>
  );
};

const ExecutionLogViewer: React.FC<{ logs: AgentLog[]; isLoading: boolean }> = ({ logs, isLoading }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="min-h-[100px] max-h-[200px] overflow-y-auto bg-black/60 rounded-lg border border-white/5 p-2 space-y-1.5 scrollbar-hide">
      {logs.length === 0 && !isLoading && (
        <div className="text-[8px] font-mono text-gray-600 text-center py-4">
          No execution logs yet. Run an agent task to see live output.
        </div>
      )}
      {logs.map((log, i) => (
        <div key={i} className="flex items-start gap-2">
          <LogBadge state={log.state} />
          <span className="text-[8px] font-mono text-gray-300 leading-relaxed flex-1 break-all">
            {log.message || '—'}
          </span>
          <span className="text-[7px] font-mono text-gray-600 shrink-0">
            {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
          </span>
        </div>
      ))}
      {isLoading && (
        <div className="flex items-center gap-2 animate-pulse">
          <span className="text-[7px] font-mono uppercase px-1.5 py-0.5 rounded border border-[#0078D4]/30 text-[#0078D4] bg-[#0078D4]/10 font-bold">live</span>
          <span className="text-[8px] font-mono text-gray-400">Agent is executing…</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const MicrosoftAgentHarness: React.FC<MicrosoftAgentHarnessProps> = ({ onArtifactReady }) => {
  const [activeTab, setActiveTab] = useState<'console' | 'mcp' | 'outlook' | 'onedrive' | 'power'>('console');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [lastArtifactJson, setLastArtifactJson] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sessionId = useRef(`harness-${Date.now()}`).current;

  const handleArtifact = (json: string) => {
    setLastArtifactJson(json);

    // Dispatch to parent if prop is provided
    if (onArtifactReady) {
      onArtifactReady({
        id: `ms-agent-${Date.now()}`,
        title: 'MS Agent — Generated Output',
        content: json,
        language: 'json',
      });
    }

    // Also dispatch a global event so AgentCanvas can pick it up
    window.dispatchEvent(
      new CustomEvent('a2ui-artifact', {
        detail: { id: `ms-agent-${Date.now()}`, title: 'MS Agent Output', content: json, language: 'json' },
      })
    );
  };

  const runTask = (promptText: string) => {
    if (!promptText.trim() || isLoading) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    setLogs([]);
    setLastArtifactJson(null);
    setActiveTab('console');

    streamAgentTask(
      promptText,
      sessionId,
      (log) => setLogs((prev) => [...prev, log]),
      handleArtifact,
      () => setIsLoading(false),
      (err) => {
        setLogs((prev) => [...prev, { state: 'failed', message: `Error: ${err}`, timestamp: new Date().toISOString() }]);
        setIsLoading(false);
      },
      abortRef.current.signal
    );
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsLoading(false);
    setLogs((prev) => [...prev, { state: 'cancelled', message: 'Task cancelled by user.', timestamp: new Date().toISOString() }]);
  };

  const TABS = [
    { id: 'console', icon: Terminal, label: 'Console' },
    { id: 'mcp', icon: Network, label: 'MCP' },
    { id: 'outlook', icon: Calendar, label: 'Outlook' },
    { id: 'onedrive', icon: FolderOpen, label: 'Drive' },
    { id: 'power', icon: Zap, label: 'Power' },
  ] as const;

  return (
    <div className="flex-1 p-4 flex flex-col items-center justify-start overflow-y-auto space-y-5 w-full scrollbar-hide">

      {/* HEADER CARD */}
      <div className="w-full bg-[#161922]/60 rounded-xl p-4 border border-white/5 flex items-center gap-3 shadow-lg">
        <div className="w-10 h-10 border border-[#0078D4]/30 rounded-xl bg-[#0078D4]/5 flex items-center justify-center relative shrink-0">
          <div className="w-2 h-2 rounded-full bg-[#0078D4] animate-ping absolute" />
          <Cloud className="w-5 h-5 text-[#0078D4]" />
        </div>
        <div className="text-left flex flex-col gap-1 w-full">
          <div className="flex justify-between items-start w-full">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-white">Office Knowledge Stack</h4>
            <span className={`flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border ${isLoading ? 'text-amber-400 bg-amber-400/10 border-amber-400/20 animate-pulse' : 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'}`}>
              <Activity className="w-2.5 h-2.5" />
              {isLoading ? 'EXECUTING' : 'READY'}
            </span>
          </div>
          <span className="self-start px-1.5 py-0.5 rounded bg-[#0078D4]/10 text-[7px] font-bold text-[#0078D4] border border-[#0078D4]/20 uppercase tracking-wider">
            Microsoft Graph Architecture
          </span>
        </div>
      </div>

      {/* TABS */}
      <div className="w-full bg-[#0F111A] rounded-xl border border-white/5 overflow-hidden flex flex-col shadow-xl">
        <div className="flex border-b border-white/5 bg-black/20 flex-wrap">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 py-2.5 text-[8px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 min-w-[20%] ${
                activeTab === id
                  ? 'bg-white/[0.03] text-[#0078D4] border-b-2 border-b-[#0078D4]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 flex flex-col gap-4">

          {/* ── CONSOLE TAB ── */}
          {activeTab === 'console' && (
            <div className="space-y-4 text-left animate-in fade-in duration-300">
              {/* Prompt Input */}
              <div className="bg-[#161922]/40 rounded-lg border border-white/5 overflow-hidden">
                <div className="px-3 pt-2.5 pb-1 flex items-center gap-2 border-b border-white/5">
                  <Terminal className="w-3.5 h-3.5 text-[#0078D4]" />
                  <span className="text-[9px] font-bold text-[#0078D4] uppercase tracking-wider">Agent Prompt Console</span>
                </div>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      runTask(customPrompt);
                    }
                  }}
                  placeholder="Describe a Power Platform task for the agent… (Ctrl+Enter to run)"
                  className="w-full bg-transparent text-[9px] text-gray-300 font-mono p-3 resize-none outline-none placeholder:text-gray-600 leading-relaxed"
                  rows={4}
                  disabled={isLoading}
                />
                <div className="flex justify-between items-center px-3 pb-2.5 pt-1">
                  <span className="text-[8px] text-gray-600 font-mono">Ctrl+Enter to execute</span>
                  <div className="flex gap-2">
                    {isLoading && (
                      <button
                        onClick={handleStop}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-bold uppercase tracking-wider hover:bg-red-500/20 transition-colors"
                      >
                        <Square className="w-3 h-3" /> Stop
                      </button>
                    )}
                    <button
                      onClick={() => runTask(customPrompt)}
                      disabled={isLoading || !customPrompt.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0078D4]/10 border border-[#0078D4]/20 text-[#0078D4] text-[8px] font-bold uppercase tracking-wider hover:bg-[#0078D4]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <span className="animate-spin w-3 h-3 border border-[#0078D4] border-t-transparent rounded-full" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      Run Agent
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Execution Log */}
              <div className="space-y-1.5">
                <span className="text-[8px] uppercase text-gray-500 font-mono">Live Execution Monitor</span>
                <ExecutionLogViewer logs={logs} isLoading={isLoading} />
              </div>

              {/* Artifact Ready Badge */}
              {lastArtifactJson && !isLoading && (
                <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider">A2UI Artifact Ready</div>
                      <div className="text-[8px] text-gray-500 font-mono">Interactive canvas available in the workspace viewer.</div>
                    </div>
                  </div>
                  <span className="text-[7px] font-mono text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase">a2ui+json</span>
                </div>
              )}

              {/* Quick Actions */}
              <div className="space-y-1.5">
                <span className="text-[8px] uppercase text-gray-500 font-mono">Quick Actions</span>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { label: 'Generate Canvas App Screen', prompt: 'Generate a Power Apps canvas app screen with an input form and a submit button that triggers a Power Automate flow.' },
                    { label: 'Sync OneDrive Summary', prompt: 'Sync recent OneDrive documents and generate a structured YAML summary of key files.' },
                    { label: 'Trigger Invoice Flow', prompt: 'Trigger the Invoice_Approval Power Automate flow and return execution status with a summary report.' },
                  ].map(({ label, prompt }) => (
                    <button
                      key={label}
                      onClick={() => runTask(prompt)}
                      disabled={isLoading}
                      className="w-full text-left p-2.5 rounded-lg bg-black/40 border border-white/5 hover:border-[#0078D4]/30 hover:bg-[#0078D4]/5 transition-all group disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-gray-300 font-medium group-hover:text-[#0078D4] transition-colors">{label}</span>
                        <Send className="w-3 h-3 text-gray-600 group-hover:text-[#0078D4] transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── MCP TAB ── */}
          {activeTab === 'mcp' && (
            <div className="space-y-4 text-left animate-in fade-in duration-300">
              <div className="bg-[#161922]/40 rounded-lg p-3 border border-white/5 flex gap-2 items-start">
                <Network className="w-4 h-4 text-[#0078D4] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-[#0078D4] uppercase tracking-wider">Active MCP Connections</span>
                  <p className="text-[9px] text-gray-400 leading-relaxed">
                    Model Context Protocol is actively synchronizing local filesystems with enterprise directory knowledge.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { name: 'Enterprise Graph', url: 'mcp://graph.microsoft.com', icon: Server },
                  { name: 'Local Workspaces', url: 'mcp://localhost:8080/fs', icon: Database },
                ].map(({ name, url, icon: Icon }) => (
                  <div key={name} className="p-2.5 bg-black/40 border border-white/5 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-emerald-400" />
                      <div>
                        <div className="text-[9px] font-bold text-white uppercase tracking-wider">{name}</div>
                        <div className="text-[8px] text-gray-500 font-mono">{url}</div>
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── OUTLOOK TAB ── */}
          {activeTab === 'outlook' && (
            <div className="space-y-4 text-left animate-in fade-in duration-300">
              <div className="bg-[#161922]/40 rounded-lg p-3 border border-white/5 flex gap-2 items-start">
                <Calendar className="w-4 h-4 text-[#0078D4] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-[#0078D4] uppercase tracking-wider">Daily Schedule</span>
                  <p className="text-[9px] text-gray-400 leading-relaxed">
                    Agent context is aware of your meetings and schedule for optimal task execution timing.
                  </p>
                </div>
              </div>
              <div className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
                {[
                  { time: '09:00 AM', title: 'Daily Standup', type: 'Teams Meeting' },
                  { time: '11:30 AM', title: 'Architecture Review', type: 'Teams Meeting' },
                  { time: '02:00 PM', title: 'Deep Work: Agent Tools', type: 'Focus Time' },
                ].map((mtg, i) => (
                  <div key={i} className="relative flex items-center py-2.5">
                    <div className="w-10 h-10 rounded-full border-4 border-[#0F111A] bg-[#161922] flex items-center justify-center shrink-0 z-10">
                      <div className="w-2 h-2 rounded-full bg-[#0078D4]" />
                    </div>
                    <div className="ml-3 w-full p-2.5 rounded-lg bg-[#161922]/80 border border-white/5 shadow-sm">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-bold text-white tracking-wide">{mtg.title}</span>
                        <time className="text-[8px] font-mono text-[#0078D4]">{mtg.time}</time>
                      </div>
                      <div className="text-[8px] text-gray-500 font-sans uppercase tracking-wider">{mtg.type}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ONEDRIVE TAB ── */}
          {activeTab === 'onedrive' && (
            <div className="space-y-4 text-left animate-in fade-in duration-300">
              <div className="bg-[#161922]/40 rounded-lg p-3 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-[#0078D4]" />
                  <span className="text-[9px] font-bold text-white uppercase tracking-wider">Recent Documents</span>
                </div>
                <button
                  onClick={() => runTask('Sync recent OneDrive documents and generate a YAML summary of key files and their modification status.')}
                  disabled={isLoading}
                  className="text-[8px] uppercase tracking-wider text-[#0078D4] hover:text-white transition-colors disabled:opacity-40"
                >
                  {isLoading ? 'Syncing…' : 'Sync Now'}
                </button>
              </div>
              <div className="space-y-1.5">
                {[
                  { name: 'Q3_Architecture_Review.docx', date: '2 hrs ago', size: '2.4 MB' },
                  { name: 'Deployment_Config_v2.xlsx', date: 'Yesterday', size: '1.1 MB' },
                  { name: 'API_Spec_Draft.pdf', date: 'Oct 12', size: '4.8 MB' },
                ].map((doc, i) => (
                  <div key={i} className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/5 transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-[#0078D4]/10 rounded text-[#0078D4]">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-300 font-medium group-hover:text-[#0078D4] transition-colors">{doc.name}</div>
                        <div className="text-[8px] text-gray-600 font-mono">{doc.size}</div>
                      </div>
                    </div>
                    <span className="text-[8px] text-gray-500">{doc.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── POWER PLATFORM TAB ── */}
          {activeTab === 'power' && (
            <div className="space-y-4 text-left animate-in fade-in duration-300">
              <div className="bg-[#161922]/40 rounded-lg p-3 border border-white/5 flex gap-2 items-start">
                <Zap className="w-4 h-4 text-[#0078D4] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-[#0078D4] uppercase tracking-wider">Power Automate Deployer</span>
                  <p className="text-[9px] text-gray-400 leading-relaxed">
                    Agent has access to tenant environment variables and can trigger Flow webhooks or draft PowerApps manifests.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => runTask('Trigger the Invoice_Approval Power Automate flow and return execution status with error details if it fails.')}
                  disabled={isLoading}
                  className="p-3 bg-black/40 border border-white/5 rounded-lg text-center cursor-pointer hover:border-[#0078D4]/50 transition-colors group disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="mx-auto w-8 h-8 rounded-full bg-[#0078D4]/10 flex items-center justify-center mb-2 group-hover:bg-[#0078D4]/20">
                    <Zap className="w-4 h-4 text-[#0078D4]" />
                  </div>
                  <div className="text-[9px] font-bold text-white uppercase tracking-wider">Trigger Flow</div>
                  <div className="text-[8px] text-gray-500 mt-0.5">Webhook Active</div>
                </button>

                <button
                  onClick={() => runTask('Generate a new Power Apps canvas app manifest with a form screen that includes input fields for Name, Email, and a Submit button that calls a flow webhook.')}
                  disabled={isLoading}
                  className="p-3 bg-black/40 border border-white/5 rounded-lg text-center cursor-pointer hover:border-purple-500/50 transition-colors group disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="mx-auto w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center mb-2 group-hover:bg-purple-500/20">
                    <Server className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-[9px] font-bold text-white uppercase tracking-wider">Power Apps</div>
                  <div className="text-[8px] text-gray-500 mt-0.5">Draft Manifest</div>
                </button>
              </div>

              <div className="space-y-1.5 mt-2">
                <span className="text-[8px] uppercase text-gray-500 font-mono">Live Execution Monitor</span>
                <ExecutionLogViewer logs={logs} isLoading={isLoading} />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
