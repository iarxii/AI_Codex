import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Cpu, 
  Zap, 
  Trash2, 
  Send, 
  Cloud, 
  Info, 
  CheckCircle, 
  AlertTriangle,
  HelpCircle
} from 'lucide-react';
import { useLiteRtChat } from '../hooks/useLiteRtChat';
import PortalSwitcher from '../components/layout/PortalSwitcher';
import { LocalModelDownloadPanel } from '../components/chat/LocalModelDownloadPanel';

const LiteChat: React.FC = () => {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const messagesFeedRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    loading,
    capabilities,
    activeModelId,
    tps,
    engineMode,
    setEngineMode,
    selectModel,
    sendMessage,
    clearChat,
    modelsList,
    downloadStates,
    downloadTotalBytes,
    downloadLocalModels,
    cancelLocalModelDownload,
  } = useLiteRtChat();

  // Auto scroll to bottom on new messages (skip when there are none, otherwise
  // scrollIntoView on mount can scroll the whole page and crop the header)
  useEffect(() => {
    if (messages.length === 0) return;

    const frame = window.requestAnimationFrame(() => {
      const feed = messagesFeedRef.current;
      if (!feed) return;
      feed.scrollTop = feed.scrollHeight;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;
    sendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-transparent text-[var(--text-primary)] font-sans relative">
      
      {/* Visual background ambient glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#fd3b12]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="h-14 flex items-center justify-between px-6 bg-[var(--glass-bg)] backdrop-blur-xl border-b border-black/[0.06] z-10 shrink-0 safe-area-top">
        <div className="flex items-center gap-3 h-full">
          <img
            src="/media/aicodex-spirit-bird.png"
            alt="AICodex Logo"
            className="w-7 h-7 object-contain rounded-lg border border-[#fd3b12]/30 shadow-sm shadow-[#fd3b12]/10"
            onError={(e) => {
              // Fallback if image doesn't load
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-wider text-[var(--text-h)]">
              AI<span className="text-[#fd3b12]">Codex</span> Chat
            </span>
            <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
              LiteRT.js Web AI Engine
            </span>
          </div>
        </div>

        {/* Portal Switcher */}
        <div className="flex items-center gap-4">
          <PortalSwitcher isDark={false} />
          
          <button
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/login");
            }}
            className="p-2 hover:bg-black/5 rounded-lg text-[var(--text-muted)] hover:text-[#fd3b12] transition-colors"
            title="Logout"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Chat Panel — solid glass backdrop keeps the animated background from washing out content */}
        <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 bg-white/70 backdrop-blur-2xl">
          
          {/* Top Telemetry Strip */}
          <div className="px-6 py-2 bg-white/60 border-b border-black/[0.06] flex items-center justify-between text-xs text-[var(--text-muted)] shrink-0 select-none overflow-x-auto gap-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                Web Engine Online
              </span>
              <span className="text-black/10">|</span>
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Accelerator: 
                <span className="font-bold text-[var(--text-primary)] uppercase ml-0.5">
                  {capabilities?.preferredAccelerator || 'Checking...'}
                </span>
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              {loading && tps > 0 && (
                <span className="flex items-center gap-1 font-mono text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {tps} tokens/sec
                </span>
              )}
              
              <button 
                onClick={clearChat}
                className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[#fd3b12] transition-colors"
                title="Clear Chat History"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div ref={messagesFeedRef} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 scrollbar-hide">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto px-4">
                <div className="p-4 rounded-3xl bg-[#fd3b12]/10 border border-[#fd3b12]/20 mb-6 shadow-lg shadow-[#fd3b12]/5">
                  <Cpu className="w-10 h-10 text-[#fd3b12]" />
                </div>
                <h3 className="text-xl font-bold text-[var(--text-h)] mb-2">Welcome to AICodex Chat</h3>
                <p className="text-[#334155] text-sm leading-relaxed mb-6">
                  A high-speed conversation portal powered by the <strong className="text-[var(--text-h)]">AICodex Cloud Agent</strong>, 
                  with an experimental <strong className="text-[var(--text-h)]">LiteRT.js</strong> on-device preview mode. 
                  Toggle "Local (Preview)" below to try client-side WebGPU/WASM inference simulation.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <button
                    onClick={() => setInputText("Explain client-side AI inference with LiteRT.js")}
                    className="p-3.5 text-left rounded-xl bg-white border border-black/[0.06] shadow-sm hover:border-[#fd3b12]/30 hover:shadow-md text-xs text-[#334155] transition-all hover:translate-y-[-1px]"
                  >
                    💡 <strong className="text-[var(--text-h)]">Explain LiteRT.js</strong>
                    <div className="text-[var(--text-muted)] mt-1">Learn about WebGPU and WASM backend acceleration.</div>
                  </button>
                  <button
                    onClick={() => setInputText("Compare LiteRT.js execution with TensorFlow.js")}
                    className="p-3.5 text-left rounded-xl bg-white border border-black/[0.06] shadow-sm hover:border-[#fd3b12]/30 hover:shadow-md text-xs text-[#334155] transition-all hover:translate-y-[-1px]"
                  >
                    ⚡ <strong className="text-[var(--text-h)]">LiteRT vs TF.js</strong>
                    <div className="text-[var(--text-muted)] mt-1">Details on CPU, GPU and NPU performance boosts.</div>
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'bot' && (
                    <div className="w-8 h-8 rounded-lg bg-[#fd3b12]/10 border border-[#fd3b12]/20 flex items-center justify-center shrink-0 shadow-sm">
                      <Cpu className="w-4 h-4 text-[#fd3b12]" />
                    </div>
                  )}
                  
                  <div className={`max-w-[85%] px-5 py-3.5 text-sm leading-relaxed relative ${
                    msg.sender === 'user'
                      ? 'bg-[#fd3b12] text-white rounded-2xl rounded-tr-none rounded-bl-none shadow-md shadow-[#fd3b12]/10 user-corner-glow'
                      : 'bg-white border border-black/[0.06] text-[#334155] rounded-2xl rounded-tl-none rounded-br-none shadow-md bot-corner-glow'
                  }`}>
                    {msg.sender === 'user' ? (
                      <div className="absolute inset-0 pointer-events-none user-corner-glow-secondary rounded-2xl rounded-tr-none rounded-bl-none overflow-hidden"></div>
                    ) : (
                      <div className="absolute inset-0 pointer-events-none bot-corner-glow-secondary rounded-2xl rounded-tl-none rounded-br-none overflow-hidden"></div>
                    )}

                    {/* Message Content */}
                    <div className="whitespace-pre-wrap font-sans relative z-10">{msg.content || (
                      <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#fd3b12] animate-ping"></span>
                        Thinking...
                      </span>
                    )}</div>

                    {/* Metadata Footer */}
                    {msg.sender === 'bot' && (msg.accelerator || msg.tps || msg.engine) && (
                      <div className="mt-2.5 pt-2 border-t border-black/[0.04] flex items-center gap-3 text-[10px] text-[var(--text-muted)] font-mono select-none relative z-10">
                        <span className={`uppercase px-1.5 py-0.5 rounded font-bold ${
                          msg.engine === 'local' 
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                            : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                        }`}>
                          {msg.engine === 'local' ? 'local preview' : 'cloud engine'}
                        </span>
                        {msg.accelerator && (
                          <span className="bg-black/[0.04] px-1.5 py-0.5 rounded text-[var(--text-muted)]">
                            {msg.accelerator}
                          </span>
                        )}
                        {msg.tps && msg.tps > 0 && (
                          <span>{msg.tps} tok/s</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bottom Chat Input Form */}
          <div className="px-3 sm:px-6 pb-5 pt-3 bg-transparent border-t border-black/[0.04] shrink-0 safe-area-bottom">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-3">
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#E2E6EC] border border-black/[0.08] p-2 rounded-2xl shadow-md focus-within:border-[#fd3b12]/40 focus-within:shadow-lg focus-within:shadow-[#fd3b12]/5 transition-all">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    engineMode === 'local' 
                      ? "Chat with local Gemma after the model download..." 
                      : "Ask the AICodex Cloud Agent anything..."
                  }
                  className="flex-1 px-4 py-3 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none w-full"
                  disabled={loading}
                />
                
                <div className="flex items-center justify-end gap-2 shrink-0 px-2">
                  
                  {/* Engine Mode Selector Badge */}
                  <button
                    type="button"
                    onClick={() => setEngineMode(prev => prev === 'local' ? 'cloud' : 'local')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      engineMode === 'cloud'
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-600'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                    }`}
                    title={
                      engineMode === 'cloud' 
                        ? "Currently querying the real AICodex Cloud Agent" 
                        : "Local Gemma requires the confirmed model download and LiteRT-LM runtime"
                    }
                  >
                    {engineMode === 'cloud' ? (
                      <>
                        <Cloud className="w-3.5 h-3.5" />
                        <span>Cloud</span>
                      </>
                    ) : (
                      <>
                        <Cpu className="w-3.5 h-3.5" />
                        <span>Local Gemma</span>
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    disabled={!inputText.trim() || loading}
                    className="p-3 bg-[#fd3b12] text-white rounded-xl hover:bg-[#d6320f] transition-all disabled:opacity-50 disabled:hover:bg-[#fd3b12] disabled:cursor-not-allowed shadow-lg shadow-[#fd3b12]/15 active:scale-95 flex items-center justify-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Engine Helper Hint */}
              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] px-2">
                <span className="flex items-center gap-1">
                  <Info className="w-3 h-3 text-[#fd3b12]" />
                  Tip: Type <code className="bg-black/[0.04] px-1 py-0.5 rounded text-[var(--text)] font-mono">/cloud [prompt]</code> to force the cloud agent.
                </span>
                <span className="hidden sm:inline font-mono">
                  Engine: {engineMode === 'local' ? 'Gemma 3n Local (download required)' : 'AICodex Cloud Agent'}
                </span>
              </div>

            </form>
          </div>

        </div>

        {/* Sidebar Capabilities Monitor Panel */}
        <div className="hidden lg:flex flex-col w-80 bg-[var(--glass-bg)] backdrop-blur-xl border-l border-black/[0.06] p-6 space-y-6 overflow-y-auto shrink-0 select-none">
          
          <div>
            <h4 className="text-xs font-bold text-[var(--text-h)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#fd3b12]" />
              Model Configuration
            </h4>
            
            <div className="space-y-3">
              <label className="block text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                Select Local Model
              </label>
              <select
                value={activeModelId}
                onChange={(e) => selectModel(e.target.value)}
                className="w-full bg-white border border-black/[0.08] rounded-xl px-3 py-2.5 text-xs text-[var(--text)] outline-none focus:border-[#fd3b12]/40 transition-colors"
                disabled={loading}
              >
                {modelsList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.size})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                Gemma generates local replies. Gecko is an optional embedding model for retrieval and cannot generate chat responses.
              </p>
            </div>
          </div>

          <LocalModelDownloadPanel
            states={downloadStates}
            totalBytes={downloadTotalBytes}
            onDownload={downloadLocalModels}
            onCancel={cancelLocalModelDownload}
          />

          <div className="border-t border-black/[0.04] pt-5">
            <h4 className="text-xs font-bold text-[var(--text-h)] uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Capabilities Checklist</span>
            </h4>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/70 border border-black/[0.06] shadow-sm">
                <span className="text-[var(--text-muted)]">WebGPU:</span>
                {capabilities?.webgpu ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-bold">
                    <CheckCircle className="w-3.5 h-3.5" /> SUPPORTED
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="w-3.5 h-3.5" /> NO ACCEL
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/70 border border-black/[0.06] shadow-sm">
                <span className="text-[var(--text-muted)]">WASM Runtime:</span>
                {capabilities?.wasm ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-bold">
                    <CheckCircle className="w-3.5 h-3.5" /> READY
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-500 font-bold">
                    UNAVAILABLE
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/70 border border-black/[0.06] shadow-sm">
                <span className="text-[var(--text-muted)]">WebNN API:</span>
                {capabilities?.webnn ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-bold">
                    <CheckCircle className="w-3.5 h-3.5" /> AVAILABLE
                  </span>
                ) : (
                  <span className="text-[var(--text-muted)]">UNAVAILABLE</span>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-black/[0.04] pt-5">
            <div className="rounded-2xl bg-white/70 p-4 border border-[#fd3b12]/15 shadow-sm">
              <h5 className="text-xs font-bold text-[var(--text-h)] mb-2 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-[#fd3b12]" />
                Edge AI Telemetry
              </h5>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                Gemma 3n uses LiteRT-LM for local text generation. Gecko adds optional local embeddings for retrieval. Model weights are never bundled in this app; download and cache them only after explicit confirmation.
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default LiteChat;
