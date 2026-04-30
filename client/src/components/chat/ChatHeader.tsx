import React from "react";
import AgentPulse from "../AgentPulse";
import { useNavigate } from "react-router-dom";
import ProviderIcon from "../ProviderIcon";


interface ChatHeaderProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  currentConvId: number | null;
  setIsOnboardingOpen: (open: boolean) => void;
  isCanvasOpen: boolean;
  setIsCanvasOpen: (open: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
  connected: boolean;
  activeProvider: string;
  activeProviderInfo: any;
  currentLatency: number | null;
  loading: boolean;
  artifactCount?: number;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  currentConvId,
  setIsOnboardingOpen,
  isCanvasOpen,
  setIsCanvasOpen,
  setIsSettingsOpen,
  connected,
  activeProvider,
  activeProviderInfo,
  currentLatency,
  loading,
  artifactCount = 0,
}) => {
  const navigate = useNavigate();

  return (
    <header className="h-14 flex items-center justify-between px-5 bg-[#D8DCE4]/60 backdrop-blur-xl border-b border-black/[0.06] z-20 shadow-sm w-full">
      {/* items justified to the left */}
      <div className="flex items-center justify-start gap-3">
        {/* Sidebar Toggle */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-1.5 text-[#4A4D5E] hover:text-[#FF6600] hover:bg-black/5 rounded-lg transition-all active:scale-95"
          title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
          </svg>
        </button>

        {/* Logo shown when sidebar is closed or on mobile */}
        <div
          className={`flex items-center gap-2 animate-in fade-in slide-in-from-left-4 duration-300 ${isSidebarOpen ? "lg:hidden" : ""}`}
        >
          <img
            src="/media/aicodex_logo_2_transp.png"
            alt="AICodex Logo"
            className="w-7 h-7 shrink-0 object-contain rounded-lg border border-[var(--accent)]"
          />
          <span className="text-sm font-bold tracking-tight text-[var(--text-primary)] hidden sm:block">
            AI<span className="text-[var(--accent)]">Codex</span>
          </span>
        </div>

        <div className="w-px h-4 bg-black/[0.08] mx-1"></div>

        {/* workspace profile */}
        <button
          onClick={() => {
            if (currentConvId) setIsOnboardingOpen(true);
          }}
          className="text-left group/card hover:bg-black/5 p-1.5 rounded-lg transition-colors"
        >
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#4A4D5E] group-hover/card:text-[#FF6600] flex items-center gap-2">
            {currentConvId ? `Workspace #${currentConvId}` : "No Workspace"}
            {currentConvId && (
              <span className="opacity-0 group-hover/card:opacity-100 text-[9px] font-bold tracking-widest bg-[#FF6600]/10 text-[#FF6600] px-1.5 py-0.5 rounded transition-opacity">
                PROFILE
              </span>
            )}
          </h2>
        </button>
      </div>

      {/* items justified to the right */}
      <div className="flex items-center justify-end gap-3">
        {/* llama.cpp Portal Shortcut */}
        <a
          href="http://127.0.0.1:11434"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-black/[0.04] border-black/[0.08] text-[#4A4D5E] hover:text-[#1A1D2E] hover:border-black/[0.15] text-xs font-semibold transition-all"
          title="Open llama.cpp server portal"
        >
          <ProviderIcon provider={activeProviderInfo} size={14} />
          llama.cpp
        </a>

        {/* Canvas Toggle */}
        <button
          onClick={() => setIsCanvasOpen(!isCanvasOpen)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            isCanvasOpen
              ? "bg-[#FF6600]/10 border-[#FF6600]/30 text-[#FF6600]"
              : "bg-black/[0.04] border-black/[0.08] text-[#4A4D5E] hover:text-[#1A1D2E] hover:border-black/[0.15]"
          }`}
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          Canvas
          {artifactCount > 0 && (
            <span className="flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full bg-[#FF6600] text-white text-[8px] font-black animate-in zoom-in">
              {artifactCount}
            </span>
          )}
        </button>

        {/* Agent Pulse Status */}
        <div className="hidden md:flex items-center px-4 border-l border-black/[0.06] ml-2">
          <AgentPulse mode={loading ? "thinking" : "idle"} showText={false} />

          {/* Latency */}
          {currentLatency && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all ${loading ? "bg-red-100 border-red-300" : "bg-black/[0.04] border-black/[0.06]"}`}>
              <span className="text-[10px] font-semibold text-[#4A4D5E] uppercase tracking-tight">
                {currentLatency.toFixed(2)}s
              </span>
            </div>
          )}
        </div>

        {/* Provider Badge — clickable, opens SettingsModal */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
            connected
              ? "bg-[#FF6600]/10 border-[#FF6600]/25 hover:bg-[#FF6600]/20 hover:border-[#FF6600]/40"
              : "bg-red-100 border-red-300"
          }`}
          title={`Provider: ${activeProviderInfo.label} — Click to change`}
        >
          <ProviderIcon provider={activeProviderInfo} size={16} />
          <span
            className={`hidden md:flex text-[10px] font-bold uppercase tracking-tight ${
              connected ? "text-[#FF6600]" : "text-red-600"
            }`}
          >
            {activeProviderInfo.label} API
          </span>
          <div
            className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
          ></div>
        </button>

        {/* Logout */}
        <button
          onClick={() => {
            localStorage.removeItem("token");
            navigate("/login");
          }}
          className="p-2 hover:bg-black/[0.06] rounded-lg text-[#7A7D8E] hover:text-[#1A1D2E] transition-colors"
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
  );
};

export default ChatHeader;
