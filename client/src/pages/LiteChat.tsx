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
  ChevronDown,
  X,
  PanelRightOpen,
  Sparkles,
  ShieldCheck,
  History as HistoryIcon,
  RotateCcw,
  MessageSquare,
  MessagesSquare,
  BrainCircuit
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLiteRtChat } from '../hooks/useLiteRtChat';
import PortalSwitcher from '../components/layout/PortalSwitcher';
import { LocalModelDownloadPanel } from '../components/chat/LocalModelDownloadPanel';
import { PROVIDERS } from '../components/providerMeta';
import type { ProviderId } from '../components/providerMeta';
import type { SystemCapabilities, ModelMetadata } from '../services/liteRtService';
import type { ArtifactDownloadState } from '../services/localModelDownloadService';

const LITERT_ICON = '/media/brand-icons/Litert_icon.svg';

const LiteRtMark: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <img src={LITERT_ICON} alt="LiteRT" className={`${className} object-contain drop-shadow-sm`} />
);

const PROMPT_HISTORY_KEY = 'aicodex_litert_prompt_history';
const PROMPT_HISTORY_LIMIT = 8;

const loadPromptHistory = (): string[] => {
  try {
    const raw = localStorage.getItem(PROMPT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((p): p is string => typeof p === 'string').slice(0, PROMPT_HISTORY_LIMIT)
      : [];
  } catch {
    return [];
  }
};

const SUGGESTED_PROMPTS: { text: string; icon: typeof Sparkles }[] = [
  { text: 'Explain client-side AI inference with LiteRT.js', icon: Sparkles },
  { text: 'Compare LiteRT.js execution with TensorFlow.js', icon: Zap },
  { text: 'How does WebGPU accelerate on-device LLMs?', icon: BrainCircuit },
  { text: 'How do model weights stay private on-device?', icon: ShieldCheck },
];

interface SidePanelContentProps {
  capabilities: SystemCapabilities | null;
  loading: boolean;
  activeModelId: string;
  selectModel: (id: string) => void;
  modelsList: ModelMetadata[];
  downloadStates: ArtifactDownloadState[];
  downloadTotalBytes: number;
  downloadLocalModels: () => void;
  cancelLocalModelDownload: () => void;
}

const SidePanelContent: React.FC<SidePanelContentProps> = ({
  capabilities,
  loading,
  activeModelId,
  selectModel,
  modelsList,
  downloadStates,
  downloadTotalBytes,
  downloadLocalModels,
  cancelLocalModelDownload,
}) => (
  <div className="space-y-6">
    <div>
      <h4 className="text-xs font-bold text-[var(--text-h)] uppercase tracking-wider mb-4 flex items-center gap-2">
        <LiteRtMark className="w-4 h-4" />
        Model Configuration
      </h4>

      <div className="space-y-3">
        <label className="block text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
          Select Local Model
        </label>
        <select
          value={activeModelId}
          onChange={(e) => selectModel(e.target.value)}
          className="w-full bg-white/80 border border-black/[0.08] rounded-xl px-3 py-2.5 text-xs text-[var(--text)] outline-none focus:border-[#fd3b12]/40 transition-colors elev-1"
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
        <div className="flex items-center justify-between p-2.5 rounded-xl glass-surface material-state">
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

        <div className="flex items-center justify-between p-2.5 rounded-xl glass-surface material-state">
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

        <div className="flex items-center justify-between p-2.5 rounded-xl glass-surface material-state">
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
      <div className="rounded-2xl glass-surface p-4 border border-[#8B5CF6]/15">
        <h5 className="text-xs font-bold text-[var(--text-h)] mb-2 flex items-center gap-1.5">
          <LiteRtMark className="w-3.5 h-3.5" />
          Edge AI Telemetry
        </h5>
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
          Gemma 3n uses LiteRT-LM for local text generation. Gecko adds optional local embeddings for retrieval. Model weights are never bundled in this app; download and cache them only after explicit confirmation.
        </p>
      </div>
    </div>
  </div>
);

const LiteChat: React.FC = () => {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [promptHistory, setPromptHistory] = useState<string[]>(loadPromptHistory);
  const [openSection, setOpenSection] = useState<'model' | 'prompts' | null>(null);
  const messagesFeedRef = useRef<HTMLDivElement>(null);
  const userName = localStorage.getItem('username') || 'Guest';

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
    provider,
    setProvider,
    cloudModels,
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

  // Close the mobile drawer on Escape, or when resizing up to desktop width
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsPanelOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 1024) setIsPanelOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const addPromptToHistory = (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setPromptHistory((prev) => {
      const next = [trimmed, ...prev.filter((p) => p !== trimmed)].slice(0, PROMPT_HISTORY_LIMIT);
      try {
        localStorage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable — history stays in-memory only
      }
      return next;
    });
  };

  const clearPromptHistory = () => {
    setPromptHistory([]);
    try {
      localStorage.removeItem(PROMPT_HISTORY_KEY);
    } catch {
      // Storage unavailable
    }
  };

  const switchEngine = (mode: 'cloud' | 'local') => {
    setEngineMode(mode);
    if (mode === 'cloud' && cloudModels[provider]?.[0]) {
      selectModel(cloudModels[provider][0].id);
    } else if (mode === 'local' && modelsList[0]) {
      selectModel(modelsList[0].id);
    }
  };

  const chooseModel = (id: string) => {
    selectModel(id);
    const isLocal = modelsList.some((m) => m.id === id);
    setEngineMode(isLocal ? 'local' : 'cloud');
  };

  const toggleSection = (section: 'model' | 'prompts') => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  const activeModels = engineMode === 'local'
    ? modelsList
    : (cloudModels[provider] || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;
    sendMessage(inputText);
    addPromptToHistory(inputText);
    setInputText('');
  };

  const panelContentProps: SidePanelContentProps = {
    capabilities,
    loading,
    activeModelId,
    selectModel,
    modelsList,
    downloadStates,
    downloadTotalBytes,
    downloadLocalModels,
    cancelLocalModelDownload,
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-transparent text-[var(--text-primary)] font-sans relative">

      {/* Visual background ambient glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#fd3b12]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#8B5CF6]/10 blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="relative h-14 flex items-center justify-between px-4 sm:px-6 bg-[var(--glass-bg)] backdrop-blur-2xl border-b border-black/[0.06] z-30 shrink-0 safe-area-top overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#fd3b12]/40 to-transparent pointer-events-none" />

        <div className="flex items-center gap-3 h-full shrink-0">
          <img
            src="/media/aicodex-spirit-bird.png"
            alt="AICodex Logo"
            className="w-7 h-7 p-1 bg-white object-contain rounded-lg border border-[#fd3b12]/30 shadow-sm shadow-[#fd3b12]/10"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-sm font-bold tracking-wider text-[var(--text-h)] truncate">
              AI<span className="text-[#fd3b12]">Codex</span> Chat
            </span>
            <span className="text-[8px] uppercase tracking-widest text-[var(--text-muted)] font-semibold truncate">
              LiteRT Web AI Engine
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 h-full">
          <PortalSwitcher isDark={false} />

          <button
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/login");
            }}
            className="p-2 hover:bg-black/5 rounded-lg text-[var(--text-muted)] hover:text-[#fd3b12] transition-colors touch-44"
            title="Logout"
            aria-label="Logout"
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

          {/* Panel drawer toggle — small screens only */}
          <button
            onClick={() => setIsPanelOpen(true)}
            className="lg:hidden p-2 rounded-xl glass-surface material-state text-[#4A4D5E] hover:text-[#fd3b12] transition-colors touch-44"
            title="Open AI Panel"
            aria-label="Open AI Panel"
          >
            <PanelRightOpen className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Chat Panel — glassmorphic layered with an AdaptivOrange gradient so the animated background shows through */}
        <div className="chat-surface flex-1 flex flex-col h-full min-h-0 min-w-0 relative overflow-hidden">
          {/* Ambient liquid aurora blobs */}
          <div
            className="liquid-blob w-72 h-72 -top-24 -right-24 opacity-25"
            style={{ background: 'radial-gradient(circle, rgba(253, 59, 18, 0.35), transparent 70%)' }}
          />
          <div
            className="liquid-blob w-80 h-80 -bottom-32 -left-24 opacity-20"
            style={{ background: 'radial-gradient(circle, rgba(255, 140, 20, 0.4), transparent 70%)' }}
          />

          {/* Top Telemetry Strip */}
          <div className="px-4 sm:px-6 py-2 bg-white/35 border-b border-white/40 flex items-center justify-between text-xs text-[var(--text-muted)] shrink-0 select-none overflow-x-auto gap-4">
            <div className="flex items-center gap-2.5">
              <span className="material-chip flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                Web Engine Online
              </span>
              <span className="hidden sm:inline text-black/10">|</span>
              <span className="material-chip hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full shrink-0">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Accelerator:
                <span className="font-bold text-[var(--text-primary)] uppercase ml-0.5">
                  {capabilities?.preferredAccelerator || 'Checking...'}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              {loading && tps > 0 && (
                <span className="material-chip flex items-center gap-1 font-mono text-emerald-600 px-2.5 py-1 rounded-full">
                  {tps} tokens/sec
                </span>
              )}

              <button
                onClick={clearChat}
                className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[#fd3b12] transition-colors press-lift"
                title="Clear Chat History"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div ref={messagesFeedRef} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-hide relative">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-3xl mx-auto px-4">
                {/* Welcome hero — LiteRT mark + user greeting */}
                <div className="mb-10">
                  <div className="p-5 rounded-3xl bg-[#5bc6a0]/10 border border-[#5bc6a0]/25 mb-6 shadow-lg shadow-[#5bc6a0]/5 inline-block">
                    <LiteRtMark className="w-12 h-12" />
                  </div>
                  <h3 className="text-2xl font-bold text-[var(--text-h)] tracking-tight">
                    Welcome back, <span className="text-[#5bc6a0]">{userName}</span>
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] mt-2.5">
                    Pick a model or load a prompt to start chatting.
                  </p>
                </div>

                {/* Collapsible pill toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <button
                    onClick={() => toggleSection('model')}
                    className={`flex items-center justify-between gap-3 px-5 py-3.5 rounded-full glass-surface material-state press-lift transition-all ${
                      openSection === 'model' ? 'border-[#fd3b12]/40 ring-2 ring-[#fd3b12]/20' : ''
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Cpu className="w-4 h-4 shrink-0 text-[#fd3b12]" />
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-h)]">Model Selection</span>
                    </span>
                    <ChevronDown className={`w-4 h-4 shrink-0 text-[var(--text-muted)] transition-transform ${openSection === 'model' ? 'rotate-180 text-[#fd3b12]' : ''}`} />
                  </button>

                  <button
                    onClick={() => toggleSection('prompts')}
                    className={`flex items-center justify-between gap-3 px-5 py-3.5 rounded-full glass-surface material-state press-lift transition-all ${
                      openSection === 'prompts' ? 'border-[#fd3b12]/40 ring-2 ring-[#fd3b12]/20' : ''
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <MessagesSquare className="w-4 h-4 shrink-0 text-[#fd3b12]" />
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-h)]">Prompts / History</span>
                    </span>
                    <ChevronDown className={`w-4 h-4 shrink-0 text-[var(--text-muted)] transition-transform ${openSection === 'prompts' ? 'rotate-180 text-[#fd3b12]' : ''}`} />
                  </button>
                </div>

                {/* Model Selection expanded panel */}
                <AnimatePresence initial={false}>
                  {openSection === 'model' && (
                    <motion.div
                      key="model-panel"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      className="w-full overflow-hidden"
                    >
                      <div className="rounded-2xl glass-surface material-state p-4 text-left shadow-sm mt-3">
                        <h4 className="flex items-center gap-2 text-xs font-bold text-[var(--text-h)] uppercase tracking-wider mb-3">
                          <Cpu className="w-4 h-4 text-[#fd3b12]" />
                          Model Selection
                        </h4>

                        <div className="flex items-center gap-1 p-1 rounded-xl bg-black/5 border border-black/[0.06] mb-3">
                          <button
                            onClick={() => switchEngine('cloud')}
                            className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                              engineMode === 'cloud'
                                ? 'bg-[#fd3b12] text-white shadow-md shadow-[#fd3b12]/20'
                                : 'text-[#4A4D5E] hover:text-[#fd3b12] hover:bg-black/5'
                            }`}
                          >
                            <Cloud className="w-3.5 h-3.5" />
                            Cloud
                          </button>
                          <button
                            onClick={() => switchEngine('local')}
                            className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                              engineMode === 'local'
                                ? 'bg-[#fd3b12] text-white shadow-md shadow-[#fd3b12]/20'
                                : 'text-[#4A4D5E] hover:text-[#fd3b12] hover:bg-black/5'
                            }`}
                          >
                            <Cpu className="w-3.5 h-3.5" />
                            Local
                          </button>
                        </div>

                        {engineMode === 'cloud' && (
                          <div className="relative mb-3">
                            <select
                              value={provider}
                              onChange={(e) => setProvider(e.target.value as ProviderId)}
                              className="appearance-none w-full bg-white/70 border border-black/[0.08] rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[#fd3b12]/20 transition-all cursor-pointer shadow-sm"
                            >
                              {PROVIDERS.filter(p => p.id !== 'local' && p.id !== 'litert').map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none" />
                          </div>
                        )}

                        <div className="space-y-2">
                          {activeModels.length === 0 ? (
                            <p className="text-[11px] text-[var(--text-muted)]">No models available for this engine.</p>
                          ) : (
                            activeModels.map((m) => {
                              const isActive = activeModelId === m.id;
                              return (
                                <button
                                  key={m.id}
                                  onClick={() => chooseModel(m.id)}
                                  className={`flex w-full items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all press-lift ${
                                    isActive
                                      ? 'bg-[#fd3b12]/10 border-[#fd3b12]/40 shadow-sm'
                                      : 'bg-white/70 border-black/[0.06] hover:border-[#fd3b12]/30 hover:bg-white/90'
                                  }`}
                                >
                                  <span className="flex items-center gap-2.5 min-w-0">
                                    <Cpu className="w-4 h-4 shrink-0 text-[#fd3b12]" />
                                    <span className="min-w-0">
                                      <span className="block text-xs font-bold text-[var(--text-h)] truncate">{m.name}</span>
                                      {'size' in m && (
                                        <span className="block text-[10px] text-[var(--text-muted)]">{(m as ModelMetadata).size}</span>
                                      )}
                                    </span>
                                  </span>
                                  {isActive && <CheckCircle className="w-4 h-4 shrink-0 text-[#fd3b12]" />}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Prompts / History expanded panel */}
                <AnimatePresence initial={false}>
                  {openSection === 'prompts' && (
                    <motion.div
                      key="prompts-panel"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      className="w-full overflow-hidden"
                    >
                      <div className="rounded-2xl glass-surface material-state p-4 text-left shadow-sm mt-3">
                        <h4 className="flex items-center gap-2 text-xs font-bold text-[var(--text-h)] uppercase tracking-wider mb-3">
                          <MessagesSquare className="w-4 h-4 text-[#fd3b12]" />
                          Prompts / History
                        </h4>

                        <div className="space-y-1.5 mb-3">
                          {SUGGESTED_PROMPTS.map((prompt) => (
                            <button
                              key={prompt.text}
                              onClick={() => setInputText(prompt.text)}
                              className="flex w-full items-center gap-2.5 p-2.5 rounded-xl bg-white/70 border border-black/[0.06] hover:border-[#fd3b12]/30 hover:bg-white/90 text-left transition-all press-lift"
                            >
                              <prompt.icon className="w-4 h-4 shrink-0 text-[#fd3b12]" />
                              <span className="text-xs text-[var(--text)] truncate">{prompt.text}</span>
                            </button>
                          ))}
                        </div>

                        <div className="border-t border-black/[0.05] pt-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                              <HistoryIcon className="w-3.5 h-3.5 text-[#fd3b12]" />
                              Recent Prompts
                            </span>
                            {promptHistory.length > 0 && (
                              <button
                                onClick={clearPromptHistory}
                                className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[#fd3b12] transition-colors press-lift"
                                title="Clear Prompt History"
                              >
                                <Trash2 className="w-3 h-3" />
                                Clear
                              </button>
                            )}
                          </div>
                          {promptHistory.length === 0 ? (
                            <p className="text-[11px] text-[var(--text-muted)]">
                              No prompts yet — ask something to build your history.
                            </p>
                          ) : (
                            <div className="space-y-1.5 max-h-36 overflow-y-auto scrollbar-hide">
                              {promptHistory.map((prompt, i) => (
                                <button
                                  key={`${prompt}-${i}`}
                                  onClick={() => setInputText(prompt)}
                                  className="group flex w-full items-center gap-2 p-2 rounded-lg bg-white/50 border border-black/[0.05] hover:border-[#fd3b12]/30 hover:bg-white/85 text-left transition-all"
                                  title="Load into composer"
                                >
                                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)] group-hover:text-[#fd3b12]" />
                                  <span className="text-[11px] text-[var(--text)] truncate">{prompt}</span>
                                  <RotateCcw className="w-3 h-3 shrink-0 ml-auto text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'bot' && (
                    <div className="w-8 h-8 rounded-lg bg-[#fd3b12]/10 border border-[#fd3b12]/20 flex items-center justify-center shrink-0 shadow-sm">
                      <img src="/media/aicodex-spirit-bird.png" alt="AICodex Logo" className="w-4 h-4 object-contain" />
                    </div>
                  )}

                  <div className={`max-w-[85%] px-5 py-3.5 text-sm leading-relaxed relative ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-br from-[#fd3b12] to-[#e8480a] text-white rounded-2xl rounded-tr-sm rounded-bl-sm shadow-md shadow-[#fd3b12]/10 user-corner-glow'
                      : 'bg-white border border-black/[0.06] text-[#334155] rounded-2xl rounded-tl-sm rounded-br-sm shadow-md bot-corner-glow'
                  }`}>
                    {msg.sender === 'user' ? (
                      <div className="absolute inset-0 pointer-events-none user-corner-glow-secondary rounded-2xl rounded-tr-sm rounded-bl-sm overflow-hidden"></div>
                    ) : (
                      <div className="absolute inset-0 pointer-events-none bot-corner-glow-secondary rounded-2xl rounded-tl-sm rounded-br-sm overflow-hidden"></div>
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
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 composer p-2 pl-4 rounded-[1.6rem]">
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all press-lift ${
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

                  {/* Cloud Configuration Selectors */}
                  {engineMode === 'cloud' && (
                    <div className="hidden sm:flex items-center gap-2 mr-1 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div className="relative group">
                        <select
                          value={provider}
                          onChange={(e) => setProvider(e.target.value as ProviderId)}
                          className="appearance-none bg-white/60 hover:bg-white/85 border border-black/[0.08] rounded-xl pl-3 pr-8 py-1.5 text-xs font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[#fd3b12]/20 transition-all cursor-pointer shadow-sm"
                        >
                          {PROVIDERS.filter(p => p.id !== 'local' && p.id !== 'litert').map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none" />
                      </div>

                      <div className="relative group">
                        <select
                          value={activeModelId}
                          onChange={(e) => selectModel(e.target.value)}
                          className="appearance-none bg-white/60 hover:bg-white/85 border border-black/[0.08] rounded-xl pl-3 pr-8 py-1.5 text-xs font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[#fd3b12]/20 transition-all cursor-pointer shadow-sm"
                        >
                          {cloudModels[provider] ? (
                            cloudModels[provider].map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))
                          ) : (
                            <option value="">No models available</option>
                          )}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none" />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!inputText.trim() || loading}
                    className="p-3 bg-[#fd3b12] text-white rounded-xl hover:bg-[#d6320f] transition-all disabled:opacity-50 disabled:hover:bg-[#fd3b12] disabled:cursor-not-allowed shadow-lg shadow-[#fd3b12]/15 active:scale-95 flex items-center justify-center press-lift"
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

        {/* Sidebar Capabilities Monitor Panel — static right rail on desktop */}
        <div className="hidden lg:flex flex-col w-80 bg-[var(--glass-bg)]/70 backdrop-blur-xl border-l border-black/[0.06] p-6 overflow-y-auto shrink-0 select-none relative">
          <div
            className="liquid-blob w-56 h-56 -top-10 -right-10 opacity-15"
            style={{ background: 'radial-gradient(circle, rgba(139, 92, 246, 0.5), transparent 70%)' }}
          />
          <SidePanelContent {...panelContentProps} />
        </div>

        {/* Slide-over side drawer — small screens */}
        <AnimatePresence>
          {isPanelOpen && (
            <>
              <motion.div
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsPanelOpen(false)}
              />
              <motion.aside
                className="fixed top-0 right-0 z-50 h-full w-[86vw] max-w-sm lg:hidden flex flex-col glass-surface border-l border-white/50 rounded-l-3xl shadow-2xl overflow-hidden"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.9 }}
                role="dialog"
                aria-modal="true"
                aria-label="AI Engine Panel"
              >
                <div className="flex items-center justify-between px-5 h-14 shrink-0 border-b border-black/[0.05] relative">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative flex items-center justify-center w-8 h-8 rounded-xl border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 shrink-0">
                      <LiteRtMark className="w-5 h-5" />
                      <span className="absolute -inset-1 rounded-xl bg-[#8B5CF6]/15 blur-md animate-glow" />
                    </div>
                    <div className="flex flex-col leading-tight min-w-0">
                      <span className="text-xs font-bold text-[var(--text-h)] truncate">
                        AI<span className="text-[#fd3b12]">Codex</span> <span className="text-gradient-litert">LiteRT</span>
                      </span>
                      <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                        Engine Panel
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPanelOpen(false)}
                    className="p-2 rounded-lg material-state text-[var(--text-muted)] hover:text-[#fd3b12] transition-colors touch-44"
                    title="Close Panel"
                    aria-label="Close AI Panel"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 select-none">
                  <SidePanelContent {...panelContentProps} />
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

      </div>

    </div>
  );
};

export default LiteChat;
