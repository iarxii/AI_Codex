import React, { Fragment, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Listbox, Transition } from '@headlessui/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { 
  Cpu, 
  Zap, 
  Trash2, 
  Send, 
  Cloud, 
  CheckCircle, 
  AlertTriangle,
  ChevronDown,
  SlidersHorizontal,
  Bot,
  Microchip,
  FileText,
  Image as ImageIcon,
  X,
  Sparkles,
  ShieldCheck,
  History as HistoryIcon,
  RotateCcw,
  MessageSquare,
  MessagesSquare,
  BrainCircuit,
  Check,
  Paperclip,
  Download,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLiteRtChat } from '../hooks/useLiteRtChat';
import PortalSwitcher from '../components/layout/PortalSwitcher';
import SettingsModal from '../components/SettingsModal';
import { LocalModelDownloadPanel } from '../components/chat/LocalModelDownloadPanel';
import { PROVIDERS, MORE_PROVIDERS } from '../components/providerMeta';
import type { ProviderId } from '../components/providerMeta';
import ProviderIcon from '../components/ProviderIcon';
import type { SystemCapabilities, ModelMetadata } from '../services/liteRtService';
import type { ArtifactDownloadState, DownloadReadiness } from '../services/localModelDownloadService';
import {
  buildAttachmentPromptContext,
  formatAttachmentSize,
  normalizeAttachments,
  type ChatAttachment,
} from '../utils/chatAttachments';
import 'katex/dist/katex.min.css';

const LITERT_ICON = '/media/brand-icons/Litert_icon.svg';
const LITERT_ICON_WHITE = '/media/brand-icons/Litert_icon_white.svg';

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

const formatDuration = (durationMs?: number): string => {
  if (!durationMs || durationMs <= 0) return '-';
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(2)}s`;
};

interface ParsedMessageAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeLabel: string;
  descriptor: string;
  extractedText?: string;
}

interface ParsedMessageContent {
  text: string;
  attachments: ParsedMessageAttachment[];
}

const parseUserMessageContent = (content: string): ParsedMessageContent => {
  const match = content.match(/\[ATTACHMENTS_CONTEXT\]([\s\S]*?)\[\/ATTACHMENTS_CONTEXT\]/);
  if (!match) {
    return { text: content, attachments: [] };
  }

  const contextBody = match[1] || '';
  const cleanedText = content
    .replace(match[0], '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const lines = contextBody.split('\n');
  const attachments: ParsedMessageAttachment[] = [];
  let current: ParsedMessageAttachment | null = null;
  let collectingExtractedText = false;
  const extractedTextLines: string[] = [];

  const flushCurrent = () => {
    if (!current) return;
    if (extractedTextLines.length > 0) {
      current.extractedText = extractedTextLines.join('\n').trim();
      extractedTextLines.length = 0;
    }
    attachments.push(current);
    current = null;
    collectingExtractedText = false;
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();

    if (line.startsWith('- File: ')) {
      flushCurrent();
      const fileLine = line.replace('- File: ', '').trim();
      const fileMatch = fileLine.match(/^(.*?)\s*\((.*?),\s*(.*?)\)$/);
      const name = fileMatch?.[1]?.trim() || fileLine;
      const mimeType = fileMatch?.[2]?.trim() || 'unknown';
      const sizeLabel = fileMatch?.[3]?.trim() || '';

      current = {
        id: `${name}-${attachments.length}`,
        name,
        mimeType,
        sizeLabel,
        descriptor: '',
      };
      return;
    }

    if (!current) return;

    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('Content:')) {
      current.descriptor = trimmed.replace('Content:', '').trim();
      collectingExtractedText = false;
      return;
    }

    if (trimmed === 'Extracted text:') {
      current.descriptor = 'Extracted text included';
      collectingExtractedText = false;
      return;
    }

    if (trimmed === '```text') {
      collectingExtractedText = true;
      return;
    }

    if (trimmed === '```') {
      collectingExtractedText = false;
      return;
    }

    if (collectingExtractedText) {
      extractedTextLines.push(line);
    }
  });

  flushCurrent();

  return {
    text: cleanedText,
    attachments,
  };
};

interface SidePanelContentProps {
  capabilities: SystemCapabilities | null;
  loading: boolean;
  activeModelId: string;
  selectModel: (id: string) => void;
  modelsList: ModelMetadata[];
  downloadStates: ArtifactDownloadState[];
  downloadTotalBytes: number;
  downloadReadiness: DownloadReadiness | null;
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
  downloadReadiness,
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
      readiness={downloadReadiness}
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
        <img src="/media/brand-icons/LiteRT_Blog4.jpg" alt="LiteRT.js" className="img-fluid rounded-md mb-2" />
        <h5 className="text-xs font-bold text-[var(--text-h)] mb-2 flex items-center gap-1.5"> 
          {/* <LiteRtMark className="w-3.5 h-3.5" /> */}
          Edge AI Telemetry powered by LiteRT.js
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
  const [isSessionsPanelOpen, setIsSessionsPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [promptHistory, setPromptHistory] = useState<string[]>(loadPromptHistory);
  const [openSection, setOpenSection] = useState<'prompts' | null>(null);
  const [cloudConfigOpen, setCloudConfigOpen] = useState(true);
  const [isDesktopPanelOpen, setIsDesktopPanelOpen] = useState(true);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentWarning, setAttachmentWarning] = useState<string | null>(null);
  const messagesFeedRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userName = localStorage.getItem('username') || 'Guest';

  const {
    messages,
    sessions,
    sessionsLoading,
    activeConversationId,
    activeSession,
    loading,
    capabilities,
    activeModelId,
    tps,
    engineMode,
    setEngineMode,
    selectModel,
    sendMessage,
    clearChat,
    refreshSessions,
    loadConversation,
    createConversation,
    deleteConversation,
    modelsList,
    downloadStates,
    downloadTotalBytes,
    downloadReadiness,
    downloadLocalModels,
    cancelLocalModelDownload,
    provider,
    setProvider,
    cloudModels,
    cloudProviderStatus,
    missingApiKey,
  } = useLiteRtChat();

  const startNewSession = async () => {
    clearChat();
    setAttachments([]);
    setAttachmentWarning(null);
    await createConversation();
  };

  const handleClearChat = () => {
    const confirmed = window.confirm('Are you sure you want to clear chat? You will lose all chat history in this view.');
    if (!confirmed) return;
    clearChat();
    setAttachments([]);
    setAttachmentWarning(null);
  };

  const handleExportChat = () => {
    const sessionData = {
      sessionId: activeConversationId?.toString() || 'guest-session',
      timestamp: new Date().toISOString(),
      provider: {
        name: provider,
        class: engineMode,
      },
      turns: messages.map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        content: msg.content,
        metadata: {
          provider: msg.metadata?.provider,
          model: msg.metadata?.model,
          latencyMs: msg.metadata?.durationMs,
          tokenCount: msg.metadata?.tokens,
          timestamp: msg.metadata?.timestamp || msg.timestamp,
          engine: msg.engine,
        },
      })),
    };

    const blob = new Blob([JSON.stringify(sessionData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aicodex-litechat-${sessionData.sessionId}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAttachmentPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { accepted, rejected, capped } = normalizeAttachments(event.target.files);
    if (accepted.length) {
      setAttachments((previous) => {
        const merged = [...previous];
        accepted.forEach((next) => {
          if (!merged.some((item) => item.id === next.id)) {
            merged.push(next);
          }
        });
        return merged.slice(0, 6);
      });
    }

    const warnings: string[] = [];
    if (rejected.length) warnings.push(`Unsupported file type: ${rejected.join(', ')}`);
    if (capped) warnings.push('Attachment limit reached (max 6 files).');
    setAttachmentWarning(warnings.length ? warnings.join(' ') : null);

    if (event.target) {
      event.target.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((previous) => previous.filter((item) => item.id !== id));
  };

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
      if (e.key === 'Escape') {
        setIsPanelOpen(false);
        setIsSessionsPanelOpen(false);
      }
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

  useEffect(() => {
    if (engineMode !== 'local') {
      setIsPanelOpen(false);
      setIsDesktopPanelOpen(false);
    }
  }, [engineMode]);

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

  const toggleSection = (section: 'prompts') => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;

    let outboundMessage = inputText;
    if (attachments.length > 0) {
      const attachmentContext = await buildAttachmentPromptContext(attachments);
      outboundMessage = `${inputText}\n${attachmentContext}`;
    }

    sendMessage(outboundMessage);
    addPromptToHistory(inputText);
    setInputText('');
    setAttachments([]);
    setAttachmentWarning(null);
    if (composerRef.current) {
      composerRef.current.style.height = 'auto';
    }
  };

  const handleComposerInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e);
    }
  };

  const panelContentProps: SidePanelContentProps = {
    capabilities,
    loading,
    activeModelId,
    selectModel,
    modelsList,
    downloadStates,
    downloadTotalBytes,
    downloadReadiness,
    downloadLocalModels,
    cancelLocalModelDownload,
  };

  const cloudProviderOptions = [...PROVIDERS, ...MORE_PROVIDERS].filter(
    (p) => p.id !== 'local' && p.id !== 'litert',
  );
  const selectedCloudProvider =
    cloudProviderOptions.find((p) => p.id === provider) || cloudProviderOptions[0];
  const selectedCloudModelLabel =
    cloudModels[provider]?.find((model) => model.id === activeModelId)?.name || activeModelId;
  const selectedLocalModelLabel =
    modelsList.find((model) => model.id === activeModelId)?.name || activeModelId;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-transparent text-[var(--text-primary)] font-sans relative">

      {/* Visual background ambient glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#fd3b12]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#8B5CF6]/10 blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="relative h-14 flex items-center justify-between px-4 sm:px-6 bg-gradient-to-r from-white via-[#fd3b12]/40 to-[#fd3b12] border-b border-[#fd3b12]/30 z-30 shrink-0 safe-area-top overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#fd3b12]/40 to-transparent pointer-events-none" />

        <div className="flex items-center gap-3 h-full shrink-0 pe-2">
          {/* New Chat */}
          <button
            onClick={startNewSession}
            className="p-2.5 sm:p-1.5 text-[#4A4D5E] hover:text-[#fd3b12] hover:bg-black/5 rounded-lg transition-all active:scale-95 shrink-0"
            title="Start a New Session"
            aria-label="New Chat"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <img
            src="/media/aicodex-spirit-bird-white.png"
            alt="AICodex Logo"
            className="w-7 h-7 p-1 bg-[#fd3b12] object-contain rounded-lg border border-[#fd3b12]/30 shadow-sm shadow-[#fd3b12]/10"
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

          <button
            onClick={() => setIsSessionsPanelOpen(true)}
            className="hidden md:flex items-center rounded-full border border-white/25 bg-white/15 hover:bg-white/25 px-3 py-1 text-[10px] font-semibold text-[#fd3b12] max-w-[260px] transition-colors"
            title="Open Chat Sessions"
            aria-label="Open Chat Sessions"
          >
            <HistoryIcon className="w-4 h-4 mr-1.5 shrink-0" />
            <span className="truncate">
              {activeSession?.title || 'Guest Session'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 h-full">
          <PortalSwitcher isDark={true} />

          {/* Provider Badge — clickable, opens SettingsModal */}
          {(() => {
            const providerInfo = [...PROVIDERS, ...MORE_PROVIDERS].find((p) => p.id === provider);
            if (!providerInfo) return null;
            const isLive = cloudProviderStatus[provider] === 'live';
            return (
              <button
                onClick={() => setIsSettingsOpen(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer shrink-0 ${
                  isLive
                    ? 'bg-white/20 border-white/25 hover:bg-white/30 text-white'
                    : 'bg-red-500/30 border-red-500/40 text-red-100'
                }`}
                title={`Provider: ${providerInfo.label} — Click to change`}
              >
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white shadow-sm shrink-0">
                  <ProviderIcon provider={providerInfo} size={14} />
                </span>
                <span className="hidden md:flex text-[10px] font-bold uppercase tracking-tight text-white">
                  {providerInfo.label} API
                </span>
                <div
                  className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`}
                ></div>
              </button>
            );
          })()}

          <button
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/login");
            }}
            className="p-2 hover:bg-white/15 rounded-lg text-white/90 hover:text-white transition-colors touch-44"
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

          {engineMode === 'local' && (
            <button
              onClick={() => {
                if (window.innerWidth >= 1024) {
                  setIsDesktopPanelOpen((open) => !open);
                } else {
                  setIsPanelOpen(true);
                }
              }}
              className="p-2 rounded-xl bg-black/20 text-white hover:text-white hover:bg-black/30 transition-colors touch-44"
              title={window.innerWidth >= 1024
                ? (isDesktopPanelOpen ? 'Hide Model Configuration Panel' : 'Show Model Configuration Panel')
                : 'Open AI Panel'}
              aria-label={window.innerWidth >= 1024
                ? (isDesktopPanelOpen ? 'Hide Model Configuration Panel' : 'Show Model Configuration Panel')
                : 'Open AI Panel'}
            >
              <img
                src="/media/brand-icons/Litert_icon_white.svg"
                alt="LiteRT"
                className={`w-5 h-5 object-contain transition-transform ${isDesktopPanelOpen ? 'rotate-90' : ''}`}
              />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Chat Panel — glassmorphic layered with an AdaptivOrange gradient so the animated background shows through */}
        <div className="chat-surface flex-1 flex flex-col h-full min-h-0 min-w-0 relative overflow-hidden">
          {/* Ambient liquid aurora blobs */}
          <div
            className="liquid-blob w-72 h-72 -top-24 -right-24 opacity-25"
            style={{ background: 'radial-gradient(circle, rgba(91, 198, 160, 0.4), transparent 70%)' }}
          />
          <div
            className="liquid-blob w-80 h-80 -bottom-32 -left-24 opacity-20"
            style={{ background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4), transparent 70%)' }}
          />

          {/* Top Telemetry Strip — moved to footer */}
          <div className="hidden">top-telemetry-relocated</div>

          {/* Messages Feed */}
          <div ref={messagesFeedRef} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-hide relative">
            {messages.length === 0 ? (
              <div className="min-h-full flex flex-col items-center text-center max-w-3xl mx-auto px-4">
                <div className="my-auto flex flex-col items-center w-full">
                {/* Welcome hero — LiteRT mark + user greeting */}
                <div className="mb-10">
                  <div className="p-7 rounded-[2rem] bg-[#fd3b12] border border-[#fd3b12]/40 mb-6 shadow-2xl shadow-[#fd3b12]/40 inline-block">
                    <div className="w-24 h-24 brightness-0 invert drop-shadow-lg" >
                      <img src={LITERT_ICON_WHITE} alt="LiteRT" className="w-4 h-4 object-contain drop-shadow-sm" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-[var(--text-h)] tracking-tight">
                    Welcome back, <span className="text-[#fd3b12]">{userName}</span>
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] mt-2.5">
                    Pick a model or load a prompt to start chatting.
                  </p>
                </div>

                {/* Prompts / History pill toggle — auto-width when collapsed, full-width when open */}
                <div className="flex justify-center w-full">
                  <motion.button
                    onClick={() => toggleSection('prompts')}
                    layout
                    transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                    className={`flex items-center justify-between gap-3 px-5 py-3.5 rounded-full glass-surface material-state press-lift transition-colors ${
                      openSection === 'prompts' ? 'border-[#fd3b12]/40 ring-2 ring-[#fd3b12]/20 w-full' : 'w-auto'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <MessagesSquare className="w-4 h-4 shrink-0 text-[#fd3b12]" />
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-h)]">Prompts / History</span>
                    </span>
                    <ChevronDown className={`w-4 h-4 shrink-0 text-[var(--text-muted)] transition-transform ${openSection === 'prompts' ? 'rotate-180 text-[#fd3b12]' : ''}`} />
                  </motion.button>
                </div>

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

                          <div className="mt-3.5 border-t border-black/[0.05] pt-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                                <HistoryIcon className="w-3.5 h-3.5 text-[#fd3b12]" />
                                Chat Sessions
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={startNewSession}
                                  className="text-[10px] text-[var(--text-muted)] hover:text-[#fd3b12] transition-colors press-lift"
                                  title="Start a new persisted session"
                                >
                                  New
                                </button>
                                <button
                                  onClick={() => refreshSessions()}
                                  className="text-[10px] text-[var(--text-muted)] hover:text-[#fd3b12] transition-colors press-lift"
                                  title="Refresh sessions"
                                >
                                  Refresh
                                </button>
                              </div>
                            </div>

                            {sessionsLoading ? (
                              <p className="text-[11px] text-[var(--text-muted)]">Loading sessions...</p>
                            ) : sessions.length === 0 ? (
                              <p className="text-[11px] text-[var(--text-muted)]">No sessions yet. Start a new chat to persist history.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-44 overflow-y-auto scrollbar-hide">
                                {sessions.map((session) => {
                                  const isActive = session.id === activeConversationId;
                                  return (
                                    <div
                                      key={session.id}
                                      className={`group flex items-center gap-2 p-2 rounded-lg border transition-all ${
                                        isActive
                                          ? 'bg-[#fd3b12]/10 border-[#fd3b12]/35'
                                          : 'bg-white/50 border-black/[0.05] hover:border-[#fd3b12]/25 hover:bg-white/85'
                                      }`}
                                    >
                                      <button
                                        onClick={() => loadConversation(session.id)}
                                        className="min-w-0 flex-1 text-left"
                                        title="Load chat session"
                                      >
                                        <div className="text-[11px] font-semibold text-[var(--text)] truncate">
                                          {session.title || `Session #${session.id}`}
                                        </div>
                                        <div className="text-[10px] text-[var(--text-muted)] truncate">
                                          {new Date(session.updated_at).toLocaleString()}
                                        </div>
                                      </button>
                                      <button
                                        onClick={() => deleteConversation(session.id)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-red-500"
                                        title="Delete session"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const parsedUserContent = msg.sender === 'user' && msg.content
                  ? parseUserMessageContent(msg.content)
                  : null;
                const contentForDisplay = parsedUserContent?.text || msg.content;

                return (
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
                    <div className="font-sans relative z-10 prose prose-sm max-w-none prose-pre:my-2 prose-code:text-inherit">
                      {contentForDisplay ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            pre: ({ children }) => (
                              <pre className="rounded-lg border border-black/[0.08] bg-black/[0.03] p-3 overflow-x-auto text-[12px]">{children}</pre>
                            ),
                            code: ({ inline, children, ...props }: any) => (
                              inline ? (
                                <code className="px-1 py-0.5 rounded bg-black/[0.05]" {...props}>{children}</code>
                              ) : (
                                <code {...props}>{children}</code>
                              )
                            ),
                          }}
                        >
                          {contentForDisplay}
                        </ReactMarkdown>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#fd3b12] animate-ping"></span>
                          Thinking...
                        </span>
                      )}
                    </div>

                    {msg.sender === 'user' && parsedUserContent && parsedUserContent.attachments.length > 0 && (
                      <div className="mt-3 space-y-2 relative z-10">
                        {parsedUserContent.attachments.map((attachment) => {
                          const isImage = attachment.mimeType.startsWith('image/');
                          const isPdf = attachment.mimeType === 'application/pdf';

                          return (
                            <div
                              key={attachment.id}
                              className="rounded-xl border border-white/20 bg-black/35 backdrop-blur-sm p-2.5 text-white"
                            >
                              <div className="flex items-start gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-black/35 border border-white/20 flex items-center justify-center shrink-0">
                                  {isImage ? (
                                    <ImageIcon className="w-4 h-4" />
                                  ) : (
                                    <FileText className="w-4 h-4" />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="text-[11px] font-semibold truncate" title={attachment.name}>
                                    {attachment.name}
                                  </div>
                                  <div className="text-[10px] text-white/75 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                    <span className="px-1.5 py-0.5 rounded-full bg-black/45 border border-white/20">
                                      {isImage ? 'Image' : isPdf ? 'PDF' : 'Document'}
                                    </span>
                                    {attachment.sizeLabel && <span>{attachment.sizeLabel}</span>}
                                    <span className="truncate">{attachment.mimeType}</span>
                                  </div>
                                </div>
                              </div>

                              {attachment.extractedText && (
                                <div className="mt-2 rounded-lg bg-black/45 border border-white/15 p-2">
                                  <div className="text-[10px] uppercase tracking-wider text-white/80 mb-1">Extracted Text</div>
                                  <p className="text-[11px] text-white/95 whitespace-pre-wrap line-clamp-4">
                                    {attachment.extractedText}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Metadata Footer */}
                    {msg.sender === 'bot' && (
                      <div className="mt-2.5 pt-2 border-t border-black/[0.04] flex items-center justify-between gap-2 text-[10px] text-[var(--text-muted)] select-none relative z-10">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {msg.metadata?.provider && msg.metadata.provider !== 'local' ? (
                            (() => {
                              const providerInfo = [...PROVIDERS, ...MORE_PROVIDERS].find((p) => p.id === msg.metadata?.provider);
                              return providerInfo ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white shadow-sm shrink-0">
                                  <ProviderIcon provider={providerInfo} size={12} />
                                </span>
                              ) : (
                                <Cloud className="w-3.5 h-3.5 shrink-0" />
                              );
                            })()
                          ) : (
                            <Cpu className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                          )}
                          <span className="truncate">
                            {msg.metadata?.provider || msg.engine}
                          </span>
                          <span>|</span>
                          <span className="truncate text-[var(--text-primary)] font-semibold">{msg.metadata?.model || activeModelId}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 text-right">
                          <span>{formatDuration(msg.metadata?.durationMs)}</span>
                          <span>•</span>
                          <span>{msg.metadata?.tokens ?? 0} tokens</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
              })
            )}
          </div>

          {/* Bottom Chat Input Form */}
          <div className="px-3 sm:px-6 pb-5 pt-3 bg-transparent border-t border-black/[0.04] shrink-0 safe-area-bottom">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-2">
              <div className="composer p-2 pl-4 rounded-[1.6rem]">
                {/* Cloud Configuration Selectors — collapsible group */}
                <AnimatePresence initial={false}>
                  {engineMode === 'cloud' && cloudConfigOpen && (
                    <motion.div
                      key="cloud-config"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                      className="overflow-visible relative z-30"
                    >
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 pb-2 px-1 border-b border-black/[0.04] mb-1">
                        <div className="relative flex-1 min-w-0">
                          <Listbox value={provider} onChange={(value) => setProvider(value as ProviderId)}>
                            <div className="relative">
                              <Listbox.Button className="relative w-full bg-white/60 hover:bg-white/85 border border-[#fd3b12]/40 rounded-xl pl-2.5 pr-8 py-2 text-xs font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[#fd3b12]/20 transition-all shadow-sm text-left">
                                <span className="flex items-center gap-2.5 min-w-0">
                                  {selectedCloudProvider && (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white shadow-sm shrink-0">
                                      <ProviderIcon provider={selectedCloudProvider} size={14} />
                                    </span>
                                  )}
                                  <span className="truncate">{selectedCloudProvider?.label || provider}</span>
                                </span>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none" />
                              </Listbox.Button>

                              <Transition
                                as={Fragment}
                                leave="transition ease-in duration-100"
                                leaveFrom="opacity-100"
                                leaveTo="opacity-0"
                              >
                                <Listbox.Options className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl bg-white border border-black/[0.08] p-1.5 text-xs shadow-xl focus:outline-none">
                                  {cloudProviderOptions.map((option) => (
                                    <Listbox.Option
                                      key={option.id}
                                      value={option.id}
                                      className={({ active }) =>
                                        `relative cursor-pointer select-none rounded-lg py-2 pl-2.5 pr-8 transition-colors ${
                                          active
                                            ? 'bg-[#fd3b12]/10 text-[#fd3b12]'
                                            : 'text-[var(--text-primary)]'
                                        }`
                                      }
                                    >
                                      {({ selected }) => (
                                        <>
                                          <span className="flex items-center gap-2.5 min-w-0">
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white shadow-sm shrink-0">
                                              <ProviderIcon provider={option} size={14} />
                                            </span>
                                            <span className={`truncate ${selected ? 'font-bold' : 'font-medium'}`}>
                                              {option.label}
                                            </span>
                                          </span>
                                          {selected && (
                                            <span className="absolute inset-y-0 right-2 flex items-center text-[#fd3b12]">
                                              <Check className="w-3.5 h-3.5" />
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </Listbox.Option>
                                  ))}
                                </Listbox.Options>
                              </Transition>
                            </div>
                          </Listbox>
                        </div>

                        <div className="relative flex-1 min-w-0">
                          <select
                            value={activeModelId}
                            onChange={(e) => selectModel(e.target.value)}
                            className="appearance-none w-full bg-white/60 hover:bg-white/85 border border-[#fd3b12]/40 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[#fd3b12]/20 transition-all cursor-pointer shadow-sm"
                          >
                            {cloudModels[provider] && cloudModels[provider].length > 0 ? (
                              cloudModels[provider].map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))
                            ) : (
                              <option value="">
                                {missingApiKey
                                  ? 'Add your API key to load models'
                                  : (cloudProviderStatus[provider] === 'live'
                                      ? 'No models available'
                                      : 'No models loaded — configure & refresh')}
                              </option>
                            )}
                          </select>
                          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#fd3b12]">
                            <Bot className="w-4 h-4" />
                          </div>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                  </AnimatePresence>

                {/* Missing API Key Notice */}
                {engineMode === 'cloud' && missingApiKey && (
                  <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl border border-amber-300/60 bg-amber-50/70 text-xs text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                    <span className="min-w-0">
                      No API key saved for this provider. Open your provider settings and add your{' '}
                      <span className="font-semibold">{provider}</span> API key to send messages.
                    </span>
                  </div>
                )}

                {(attachments.length > 0 || attachmentWarning) && (
                  <div className="px-1 pb-2">
                    {attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {attachments.map((attachment) => (
                          <span
                            key={attachment.id}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/70 border border-black/[0.08] text-[10px] text-[var(--text-primary)]"
                          >
                            <span className="max-w-[180px] truncate" title={attachment.name}>{attachment.name}</span>
                            <span className="text-[var(--text-muted)]">{formatAttachmentSize(attachment.size)}</span>
                            <button
                              type="button"
                              onClick={() => removeAttachment(attachment.id)}
                              className="text-[var(--text-muted)] hover:text-[#fd3b12]"
                              title="Remove attachment"
                            >
                              x
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {attachmentWarning && (
                      <p className="text-[10px] text-amber-700">{attachmentWarning}</p>
                    )}
                  </div>
                )}

                {/* Composer Row */}
                <div className="flex items-end gap-2">
                  <textarea
                    ref={composerRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onInput={handleComposerInput}
                    onKeyDown={handleComposerKeyDown}
                    rows={1}
                    placeholder={
                      engineMode === 'local'
                        ? "Chat with local Gemma after the model download..."
                        : "Ask the AICodex Cloud Agent anything..."
                    }
                    className="flex-1 min-w-0 px-1 py-3 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none w-full resize-none leading-relaxed max-h-[168px] overflow-y-auto"
                    disabled={loading}
                  />

                  <div className="flex items-center gap-2 shrink-0 pb-1.5">

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-black/[0.08] bg-white/70 text-[var(--text-muted)] hover:text-[#fd3b12] hover:border-[#fd3b12]/35 transition-all"
                      title="Attach media or documents"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline text-xs font-semibold">Attach</span>
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      accept=".png,.jpg,.jpeg,.webp,.gif,.md,.txt,.pdf,image/*,text/markdown,text/plain,application/pdf"
                      onChange={handleAttachmentPick}
                    />

                    {/* Engine Mode Selector Badge */}
                    <button
                      type="button"
                      onClick={() => setEngineMode(prev => prev === 'local' ? 'cloud' : 'local')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all press-lift ${
                        engineMode === 'cloud'
                          ? 'bg-[#fd3b12]/10 border-[#fd3b12]/30 text-[#fd3b12] hover:bg-[#fd3b12]/15 shadow-[0_6px_14px_-6px_rgba(253,59,18,0.45)]'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/15 shadow-[0_6px_14px_-6px_rgba(16,185,129,0.45)]'
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
                          <span className="hidden sm:inline">Cloud</span>
                        </>
                      ) : (
                        <>
                          <Cpu className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Local Gemma</span>
                        </>
                      )}
                    </button>

                    {/* Cloud Config Collapse Toggle */}
                    {engineMode === 'cloud' && (
                      <button
                        type="button"
                        onClick={() => setCloudConfigOpen(o => !o)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all press-lift ${
                          cloudConfigOpen
                            ? 'bg-[#fd3b12]/10 border-[#fd3b12]/30 text-[#fd3b12] hover:bg-[#fd3b12]/15 shadow-[0_6px_14px_-6px_rgba(253,59,18,0.45)]'
                            : 'bg-white/70 border-[#fd3b12]/25 text-[var(--text-muted)] hover:bg-white/90 hover:text-[#fd3b12] hover:border-[#fd3b12]/40'
                        }`}
                        title="Toggle provider & model configuration"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${cloudConfigOpen ? 'rotate-180' : ''}`} />
                      </button>
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
              </div>
            </form>

            {/* Footer Telemetry Strip */}
            <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-[var(--text-muted)] select-none gap-4 overflow-x-auto py-2.5">
              <div className="flex items-center gap-2.5">
                <span
                  className="material-chip hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0 text-[var(--text-muted)] max-w-[320px]"
                  title={engineMode === 'cloud'
                    ? `Cloud provider ${selectedCloudProvider?.label || provider} using ${selectedCloudModelLabel}`
                    : `Local provider LiteRT using ${selectedLocalModelLabel}`}
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white shadow-sm shrink-0">
                    {engineMode === 'cloud' ? (
                      <ProviderIcon provider={selectedCloudProvider} size={12} />
                    ) : (
                      <LiteRtMark className="w-3 h-3" />
                    )}
                  </span>
                  <span className="truncate max-w-[180px] text-[var(--text-primary)] font-semibold">
                    {engineMode === 'cloud' ? selectedCloudModelLabel : selectedLocalModelLabel}
                  </span>
                </span>
                <span className="material-chip hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full shrink-0">
                  <Microchip className="w-3.5 h-3.5 text-[#5bc6a0]" />
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
                  onClick={handleClearChat}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-black/[0.08] hover:border-[#fd3b12]/30 text-[var(--text-muted)] hover:text-[#fd3b12] transition-colors press-lift"
                  title="Clear Chat History"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Chat</span>
                </button>

                <button
                  onClick={handleExportChat}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-black/[0.08] hover:border-[#fd3b12]/30 text-[var(--text-muted)] hover:text-[#fd3b12] transition-colors press-lift"
                  title="Export Chat"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Chat</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Sidebar Capabilities Monitor Panel — static right rail on desktop */}
        <div className={`${engineMode === 'local' && isDesktopPanelOpen ? 'hidden lg:flex' : 'hidden'} flex-col w-80 bg-[var(--glass-bg)]/70 backdrop-blur-xl border-l border-black/[0.06] p-6 overflow-y-auto shrink-0 select-none relative`}>
          <div
            className="liquid-blob w-56 h-56 -top-10 -right-10 opacity-15"
            style={{ background: 'radial-gradient(circle, rgba(139, 92, 246, 0.5), transparent 70%)' }}
          />
          <SidePanelContent {...panelContentProps} />
        </div>

        {/* Slide-over side drawer — small screens */}
        <AnimatePresence>
          {engineMode === 'local' && isPanelOpen && (
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
                    <img
                      src="/media/aicodex-spirit-bird.png"
                      alt="AICodex Logo"
                      className="w-7 h-7 p-1 bg-white object-contain rounded-lg border border-[#fd3b12]/30 shadow-sm shadow-[#fd3b12]/10 shrink-0"
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

        <AnimatePresence>
          {isSessionsPanelOpen && (
            <>
              <motion.div
                className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSessionsPanelOpen(false)}
              />
              <motion.aside
                className="fixed top-0 right-0 z-[60] h-full w-[92vw] max-w-md flex flex-col bg-white/95 backdrop-blur-2xl border-l border-black/[0.08] shadow-2xl"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                role="dialog"
                aria-modal="true"
                aria-label="Chat Sessions"
              >
                <div className="h-14 px-4 flex items-center justify-between border-b border-black/[0.08]">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-h)]">Chat Sessions</h3>
                    <p className="text-[10px] text-[var(--text-muted)]">Persistent history and AI-generated titles</p>
                  </div>
                  <button
                    onClick={() => setIsSessionsPanelOpen(false)}
                    className="p-2 rounded-lg hover:bg-black/5 text-[var(--text-muted)] hover:text-[#fd3b12]"
                    title="Close Sessions"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                <div className="p-4 border-b border-black/[0.06] flex items-center gap-2">
                  <button
                    onClick={startNewSession}
                    className="px-3 py-1.5 rounded-lg bg-[#fd3b12] text-white text-xs font-semibold hover:bg-[#e63a16] transition-colors"
                  >
                    New Session
                  </button>
                  <button
                    onClick={() => refreshSessions()}
                    className="px-3 py-1.5 rounded-lg bg-white border border-black/[0.08] text-xs font-semibold text-[var(--text-primary)] hover:border-[#fd3b12]/40 hover:text-[#fd3b12] transition-colors"
                  >
                    Refresh
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {!activeConversationId && (
                    <div className="rounded-lg border border-dashed border-black/[0.14] bg-black/[0.02] px-3 py-2 text-[11px] text-[var(--text-muted)]">
                      Guest session active. Log in to persist chat sessions.
                    </div>
                  )}

                  {sessionsLoading ? (
                    <p className="text-sm text-[var(--text-muted)]">Loading sessions...</p>
                  ) : sessions.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">No persisted sessions found.</p>
                  ) : (
                    sessions.map((session) => {
                      const isActive = session.id === activeConversationId;
                      return (
                        <div
                          key={session.id}
                          className={`group rounded-xl border p-3 transition-colors ${
                            isActive
                              ? 'border-[#fd3b12]/40 bg-[#fd3b12]/8'
                              : 'border-black/[0.08] bg-white hover:border-[#fd3b12]/30'
                          }`}
                        >
                          <button
                            onClick={() => {
                              loadConversation(session.id);
                              setIsSessionsPanelOpen(false);
                            }}
                            className="w-full text-left"
                            title="Open session"
                          >
                            <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                              {session.title || `Session #${session.id}`}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                              {new Date(session.updated_at).toLocaleString()}
                            </div>
                          </button>
                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() => deleteConversation(session.id)}
                              className="text-[11px] text-[var(--text-muted)] hover:text-red-600 transition-colors"
                              title="Delete session"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

      </div>

      {/* Provider Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} setIsOpen={setIsSettingsOpen} />
    </div>
  );
};

export default LiteChat;
