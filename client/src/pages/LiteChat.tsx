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

const LiteChat: React.FC = () => {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    loading,
    capabilities,
    activeModelId,
    loadModelProgress,
    tps,
    engineMode,
    setEngineMode,
    selectModel,
    sendMessage,
    clearChat,
    modelsList
  } = useLiteRtChat();

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;
    sendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gradient-to-br from-[#1E2028] via-[#121318] to-[#0A0B0D] text-slate-100 font-sans relative">
      
      {/* Visual background ambient glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#fd3b12]/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 bg-[#161821]/80 backdrop-blur-xl border-b border-white/[0.06] z-10 shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="/media/aicodex-spirit-bird.png"
            alt="AICodex Logo"
            className="w-8 h-8 object-contain rounded-lg border border-[#fd3b12]/30 shadow-md shadow-[#fd3b12]/10"
            onError={(e) => {
              // Fallback if image doesn't load
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-wider text-white">
              AI<span className="text-[#fd3b12]">Codex</span> Chat
            </span>
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
              LiteRT.js Web AI Engine
            </span>
          </div>
        </div>

        {/* Portal Switcher */}
        <div className="flex items-center gap-4">
          <PortalSwitcher isDark={true} />
          
          <button
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/login");
            }}
            className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
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
        
        {/* Chat Panel */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          
          {/* Top Telemetry Strip */}
          <div className="px-6 py-2 bg-[#12131A]/60 border-b border-white/[0.04] flex items-center justify-between text-xs text-slate-400 shrink-0 select-none overflow-x-auto gap-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                Web Engine Online
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-yellow-500" />
                Accelerator: 
                <span className="font-bold text-white uppercase ml-0.5">
                  {capabilities?.preferredAccelerator || 'Checking...'}
                </span>
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              {loading && tps > 0 && (
                <span className="flex items-center gap-1 font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {tps} tokens/sec
                </span>
              )}
              
              <button 
                onClick={clearChat}
                className="flex items-center gap-1 text-slate-500 hover:text-red-400 transition-colors"
                title="Clear Chat History"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>

          {/* Model Loading State Overlay */}
          {loadModelProgress !== null && (
            <div className="absolute inset-x-0 top-0 h-1 bg-[#12131A] z-20">
              <div 
                className="h-full bg-gradient-to-r from-[#fd3b12] to-yellow-500 transition-all duration-150"
                style={{ width: `${loadModelProgress}%` }}
              />
              <div className="absolute top-2 left-6 text-[10px] text-[#fd3b12] font-mono tracking-wider uppercase animate-pulse">
                Compiling LiteRT weights: {loadModelProgress}%
              </div>
            </div>
          )}

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 [scrollbar-width:thin] scrollbar-color-[#1E2028]">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto px-4">
                <div className="p-4 rounded-3xl bg-[#fd3b12]/10 border border-[#fd3b12]/20 mb-6 shadow-lg shadow-[#fd3b12]/5">
                  <Cpu className="w-10 h-10 text-[#fd3b12]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Welcome to AICodex Chat</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  A high-speed, client-side conversation portal powered by <strong className="text-slate-200">LiteRT.js</strong>. 
                  All inference runs locally on your WebGPU/WASM accelerator. 
                  Toggle to cloud mode for coding tasks requiring file editing or execution sandbox.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <button
                    onClick={() => setInputText("Explain client-side AI inference with LiteRT.js")}
                    className="p-3.5 text-left rounded-xl bg-[#1A1C24]/60 border border-white/[0.04] hover:border-white/[0.1] text-xs text-slate-300 transition-all hover:bg-[#1E202B]/80 hover:translate-y-[-1px]"
                  >
                    💡 <strong>Explain LiteRT.js</strong>
                    <div className="text-slate-500 mt-1">Learn about WebGPU and WASM backend acceleration.</div>
                  </button>
                  <button
                    onClick={() => setInputText("Compare LiteRT.js execution with TensorFlow.js")}
                    className="p-3.5 text-left rounded-xl bg-[#1A1C24]/60 border border-white/[0.04] hover:border-white/[0.1] text-xs text-slate-300 transition-all hover:bg-[#1E202B]/80 hover:translate-y-[-1px]"
                  >
                    ⚡ <strong>LiteRT vs TF.js</strong>
                    <div className="text-slate-500 mt-1">Details on CPU, GPU and NPU performance boosts.</div>
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
                    <div className="w-8 h-8 rounded-lg bg-[#fd3b12]/10 border border-[#fd3b12]/20 flex items-center justify-center shrink-0 shadow">
                      <Cpu className="w-4 h-4 text-[#fd3b12]" />
                    </div>
                  )}
                  
                  <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-[#fd3b12] text-white rounded-tr-none'
                      : 'bg-[#181A22] border border-white/[0.05] text-slate-200 rounded-tl-none'
                  }`}>
                    {/* Message Content */}
                    <div className="whitespace-pre-wrap font-sans">{msg.content || (
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#fd3b12] animate-ping"></span>
                        Thinking...
                      </span>
                    )}</div>

                    {/* Metadata Footer */}
                    {msg.sender === 'bot' && (msg.accelerator || msg.tps || msg.engine) && (
                      <div className="mt-2.5 pt-2 border-t border-white/[0.03] flex items-center gap-3 text-[10px] text-slate-500 font-mono select-none">
                        <span className={`uppercase px-1.5 py-0.5 rounded font-bold ${
                          msg.engine === 'local' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {msg.engine} engine
                        </span>
                        {msg.accelerator && (
                          <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
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
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Form */}
          <div className="p-6 bg-[#161821]/40 border-t border-white/[0.06] shrink-0">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-4">
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0F1015]/80 border border-white/[0.06] p-2 rounded-2xl focus-within:border-[#fd3b12]/30 transition-all shadow-inner">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    engineMode === 'local' 
                      ? "Chat locally with LiteRT.js (WebGPU accelerated)..." 
                      : "Query full Cloud Agent Workspace..."
                  }
                  className="flex-1 px-4 py-3 bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none w-full"
                  disabled={loading}
                />
                
                <div className="flex items-center justify-end gap-2 shrink-0 px-2">
                  
                  {/* Cloud Mode Selector Badge */}
                  <button
                    type="button"
                    onClick={() => setEngineMode(prev => prev === 'local' ? 'cloud' : 'local')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      engineMode === 'cloud'
                        ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                        : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    }`}
                    title={
                      engineMode === 'cloud' 
                        ? "Currently in Cloud Fallback mode for full agent code-writing tools" 
                        : "Currently in Local Edge mode running entirely in your browser"
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
                        <span>Local (WebGPU)</span>
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
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-2">
                <span className="flex items-center gap-1">
                  <Info className="w-3 h-3 text-[#fd3b12]" />
                  Tip: Type <code className="bg-[#1D1E28] px-1 py-0.5 rounded text-slate-400 font-mono">/cloud [prompt]</code> to auto-execute on the backend.
                </span>
                <span className="hidden sm:inline font-mono">
                  Engine: {engineMode === 'local' ? 'LiteRT.js Web GPU' : 'Agentic Cloud Core'}
                </span>
              </div>

            </form>
          </div>

        </div>

        {/* Sidebar Capabilities Monitor Panel */}
        <div className="hidden lg:flex flex-col w-80 bg-[#161821]/80 backdrop-blur-xl border-l border-white/[0.06] p-6 space-y-6 overflow-y-auto shrink-0 select-none">
          
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#fd3b12]" />
              Model Configuration
            </h4>
            
            <div className="space-y-3">
              <label className="block text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                Select Local Model
              </label>
              <select
                value={activeModelId}
                onChange={(e) => selectModel(e.target.value)}
                className="w-full bg-[#0F1015] border border-white/[0.06] rounded-xl px-3 py-2.5 text-xs text-slate-300 outline-none focus:border-[#fd3b12]/40 transition-colors"
                disabled={loading}
              >
                {modelsList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.size})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                LiteRT.js loads compiled weights dynamically to WebAssembly or WebGPU.
              </p>
            </div>
          </div>

          <div className="border-t border-white/[0.04] pt-5">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Capabilities Checklist</span>
            </h4>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0F1015]/40 border border-white/[0.02]">
                <span className="text-slate-400">WebGPU:</span>
                {capabilities?.webgpu ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <CheckCircle className="w-3.5 h-3.5" /> SUPPORTED
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-yellow-500">
                    <AlertTriangle className="w-3.5 h-3.5" /> NO ACCEL
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0F1015]/40 border border-white/[0.02]">
                <span className="text-slate-400">WASM Runtime:</span>
                {capabilities?.wasm ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <CheckCircle className="w-3.5 h-3.5" /> READY
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-400 font-bold">
                    UNAVAILABLE
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0F1015]/40 border border-white/[0.02]">
                <span className="text-slate-400">WebNN API:</span>
                {capabilities?.webnn ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <CheckCircle className="w-3.5 h-3.5" /> AVAILABLE
                  </span>
                ) : (
                  <span className="text-slate-500">UNAVAILABLE</span>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.04] pt-5 rounded-2xl bg-gradient-to-br from-[#fd3b12]/5 to-transparent p-4 border border-[#fd3b12]/10">
            <h5 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-[#fd3b12]" />
              Edge AI Telemetry
            </h5>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Google's LiteRT.js brings highly optimized cross-platform execution (XNNPACK CPU, ML Drift GPU) directly to web pages via WebAssembly.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
};

export default LiteChat;
