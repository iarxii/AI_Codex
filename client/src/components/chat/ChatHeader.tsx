import React from "react";
import AgentPulse from "../AgentPulse";
import { useNavigate } from "react-router-dom";
import ProviderIcon from "../ProviderIcon";
import { useAI } from "../../contexts/AIContext";
import NeuralFunctionSwitch from "./NeuralFunctionSwitch";

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
  isHarnessOpen?: boolean;
  setIsHarnessOpen?: (open: boolean) => void;
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
  activeProviderInfo,
  currentLatency,
  loading,
  artifactCount = 0,
  isHarnessOpen,
  setIsHarnessOpen,
}) => {
  const navigate = useNavigate();
  const { activeSpace } = useAI();

  return (
    <header className="h-14 flex items-center justify-between bg-[#D8DCE4]/60 backdrop-blur-xl border-b border-black/[0.06] z-20 shadow-sm w-full safe-area-top overflow-x-auto flex-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* items justified to the left */}
      <div className="flex items-center justify-start gap-3 shrink-0">
        <div className="sticky left-0 z-10 flex items-center gap-3 bg-gradient-to-r from-[#D8DCE4] via-[#D8DCE4]/90 to-transparent pl-3 pr-6 py-1 -ml-3 mr-1">
          {/* Sidebar Toggle */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2.5 sm:p-1.5 text-[#4A4D5E] hover:text-[#fd3b12] hover:bg-black/5 rounded-lg transition-all active:scale-95 shrink-0"
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
            className={`flex items-center gap-2 animate-in fade-in slide-in-from-left-4 duration-300 shrink-0 ${isSidebarOpen ? "lg:hidden" : ""}`}
          >
            <img
              src="/media/aicodex-spirit-bird.png"
              alt="AICodex Logo"
              className="w-7 h-7 shrink-0 object-contain rounded-lg border border-[var(--accent)]"
            />
            <span className="text-sm font-bold tracking-tight text-[var(--text-primary)] hidden sm:block">
              AI<span className="text-[var(--accent)]">Codex</span>
            </span>
          </div>

          <div className="w-px h-4 bg-black/[0.08] mx-1 shrink-0"></div>
        </div>

        {/* workspace profile */}
        <button
          onClick={() => {
            if (currentConvId) setIsOnboardingOpen(true);
          }}
          className="text-left group/card hover:bg-black/5 p-1.5 rounded-lg transition-colors flex-1 min-w-0 max-w-[200px] sm:max-w-[250px] md:max-w-none"
        >
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#4A4D5E] group-hover/card:text-[#fd3b12] flex items-center gap-2">
            {activeSpace ? (
              <span className="flex items-center gap-1 truncate w-full">
                <span className="text-[var(--accent)] font-bold truncate">{activeSpace.name}</span>
                {currentConvId ? <span className="shrink-0">/ Session #{currentConvId}</span> : ""}
              </span>
            ) : (
              <span className="truncate w-full">
                {currentConvId ? `Workspace #${currentConvId}` : "No Workspace"}
              </span>
            )}
            {currentConvId && (
              <span className="hidden md:inline opacity-0 group-hover/card:opacity-100 text-[9px] font-bold tracking-widest bg-[#fd3b12]/10 text-[#fd3b12] px-1.5 py-0.5 rounded transition-opacity shrink-0">
                PROFILE
              </span>
            )}
          </h2>
        </button>
      </div>

      {/* items justified to the right */}
      <div className="flex items-center justify-end gap-3 shrink-0">
        {/* Spirit Bird Interaction Harness Toggle — only for trading space on < lg screens */}
        {activeSpace?.slug === 'trading-space' && setIsHarnessOpen && (
          <button
            onClick={() => setIsHarnessOpen(!isHarnessOpen)}
            className={`lg:hidden p-2.5 rounded-2xl border transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm ${
              isHarnessOpen
                ? "bg-[#fd3b12]/15 text-[#fd3b12] border-[#fd3b12]/30 shadow-[#fd3b12]/10"
                : "bg-white/40 border-black/[0.05] text-[#4A4D5E] hover:text-[#fd3b12] hover:bg-white/60"
            }`}
            title="Toggle Spirit Bird Interaction Harness"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">Harness</span>
          </button>
        )}

        {/* System Function Shifter Dropdown */}
        <NeuralFunctionSwitch 
          isCanvasOpen={isCanvasOpen}
          setIsCanvasOpen={setIsCanvasOpen}
          artifactCount={artifactCount}
        />

        <div className="sticky right-0 z-10 flex items-center gap-3 bg-gradient-to-r from-transparent via-[#D8DCE4]/90 to-[#D8DCE4] pl-6 pr-3 py-1 -mr-3 ml-1 shrink-0">
          {/* Agent Pulse Status */}
          <div className="hidden md:flex items-center px-4 border-l border-black/[0.06] ml-2">
            <AgentPulse mode={loading ? "thinking" : "idle"} showText={false} />

            {/* Latency */}
            {currentLatency && (
              <div
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all ${loading ? "bg-red-100 border-red-300" : "bg-black/[0.04] border-black/[0.06]"}`}
              >
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
                ? "bg-[#fd3b12]/10 border-[#fd3b12]/25 hover:bg-[#fd3b12]/20 hover:border-[#fd3b12]/40"
                : "bg-red-100 border-red-300"
            }`}
            title={`Provider: ${activeProviderInfo.label} — Click to change`}
          >
            <ProviderIcon provider={activeProviderInfo} size={16} />
            <span
              className={`hidden md:flex text-[10px] font-bold uppercase tracking-tight ${
                connected ? "text-[#fd3b12]" : "text-red-600"
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
              localStorage.removeItem("ai_active_space");
              localStorage.removeItem("ai_sidebar_tab");
              navigate("/login");
            }}
            className="p-2.5 hover:bg-black/[0.06] rounded-lg text-[#7A7D8E] hover:text-[#1A1D2E] transition-colors"
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
      </div>
    </header>
  );
};

export default ChatHeader;
