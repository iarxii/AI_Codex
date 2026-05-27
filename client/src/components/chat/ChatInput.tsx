import React from "react";
import ProviderSelector from "../ProviderSelector";
import ModelConfigPanel from "./ModelConfigPanel";
import {
  ChatBubbleLeftRightIcon,
  CodeBracketIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";

interface ChatInputProps {
  input: string;
  setInput: (val: string) => void;
  onSend: (e: React.FormEvent) => void;
  loading: boolean;
  currentConvId: number | null;
  showTelemetry: boolean;
  setShowTelemetry: (val: boolean) => void;
  agentMode: boolean;
  setAgentMode: (val: boolean) => void;
  onExport?: () => void;
}

const SPECIALIZATIONS = [
  {
    id: "conversational",
    name: "Conversational",
    icon: <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />,
  },
  {
    id: "coding",
    name: "Coding",
    icon: <CodeBracketIcon className="w-3.5 h-3.5" />,
  },
  {
    id: "writing",
    name: "Writing",
    icon: <PencilSquareIcon className="w-3.5 h-3.5" />,
  },
  {
    id: "researcher",
    name: "Researcher",
    icon: <MagnifyingGlassIcon className="w-3.5 h-3.5" />,
  },
  {
    id: "image",
    name: "Image Generation",
    icon: <PhotoIcon className="w-3.5 h-3.5" />,
  },
];

const TOOLS = [
  {
    id: "codebase_search",
    name: "Codebase Search",
    description: "Search definitions and snippets",
  },
  {
    id: "workspace_writer",
    name: "Workspace Writer",
    description: "Create and edit files",
  },
  {
    id: "workspace_reader",
    name: "Workspace Reader",
    description: "Read file contents",
  },
  {
    id: "github_search",
    name: "GitHub Search",
    description: "Search repositories and code",
  },
  { id: "memory_skill", name: "Memory", description: "Access project history" },
  {
    id: "rag_query",
    name: "RAG Query",
    description: "Query vector knowledge base",
  },
  {
    id: "shell_exec",
    name: "Shell Executor",
    description: "Run terminal commands",
  },
  {
    id: "url_reader",
    name: "URL Reader",
    description: "Fetch and parse web content",
  },
];

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  onSend,
  loading,
  currentConvId,
  showTelemetry,
  setShowTelemetry,
  agentMode,
  setAgentMode,
  onExport,
}) => {
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  const [isSpecializationOpen, setIsSpecializationOpen] = React.useState(false);
  const [isToolsOpen, setIsToolsOpen] = React.useState(false);
  const [activeSpecialization, setActiveSpecialization] = React.useState(
    SPECIALIZATIONS[1],
  ); // Default to Coding
  const [isProviderBarExpanded, setIsProviderBarExpanded] = React.useState(() => {
    return window.innerWidth >= 640; // Default open on desktop, closed on mobile
  });

  // Sync specialization with agent mode
  React.useEffect(() => {
    if (!agentMode && activeSpecialization.id !== "conversational") {
      setActiveSpecialization(SPECIALIZATIONS[0]);
    }
  }, [agentMode]);
  return (
    <footer
      className="px-3 sm:px-6 pb-5 pt-3 bg-transparent border-t border-black/[0.04] z-20 safe-area-bottom"
      style={{ overflow: "visible", paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <div className={`max-w-4xl mx-auto mb-3 transition-all duration-300 ${isProviderBarExpanded ? 'block' : 'hidden'}`}>
        <ProviderSelector
          showTelemetry={showTelemetry}
          setShowTelemetry={setShowTelemetry}
        />
      </div>
      <form onSubmit={onSend} className="max-w-4xl mx-auto">
        {/* Main Input Container */}
        <div className="relative bg-[#E2E6EC] border border-black/[0.08] rounded-2xl shadow-md transition-all focus-within:border-[#fd3b12]/40 focus-within:shadow-lg focus-within:shadow-[#fd3b12]/5">
          {/* Function Buttons Row */}
          <div className="flex items-center gap-1 px-3 pt-2.5 pb-0">
            {/* Provider Selector Toggle */}
            <button
              type="button"
              onClick={() => setIsProviderBarExpanded(!isProviderBarExpanded)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                isProviderBarExpanded
                  ? "bg-[#fd3b12]/15 text-[#fd3b12] shadow-sm shadow-[#fd3b12]/5"
                  : "text-[#4A4D5E] hover:text-[#fd3b12] hover:bg-black/[0.05]"
              }`}
              title="Toggle provider selector bar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-3.5 sm:h-3.5">
                <rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span>Provider</span>
            </button>

            {/* Attachments */}
            <button
              type="button"
              onClick={() => alert("File attachments — coming soon!")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#4A4D5E] hover:text-[#1A1D2E] hover:bg-black/[0.05] transition-all"
              title="Attach files"
            >
              <svg
                className="w-4 h-4 sm:w-3.5 sm:h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
              <span className="hidden sm:inline">Attach</span>
            </button>

            {/* Agent Specialization Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSpecializationOpen(!isSpecializationOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  agentMode
                    ? "bg-[#fd3b12] text-white shadow-sm shadow-[#fd3b12]/20"
                    : "text-[#4A4D5E] hover:text-[#fd3b12] hover:bg-[#fd3b12]/8"
                }`}
                title="Select agent specialization"
              >
                {activeSpecialization.icon}
                <span className="hidden sm:inline">{activeSpecialization.name}</span>
                <svg
                  className="w-2.5 h-2.5 opacity-60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {isSpecializationOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-black/[0.08] rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="px-3 py-1.5 border-b border-black/[0.04] mb-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#7A7D8E]">
                      Specialization
                    </span>
                  </div>
                  {SPECIALIZATIONS.map((spec) => (
                    <button
                      key={spec.id}
                      type="button"
                      onClick={() => {
                        setActiveSpecialization(spec);
                        setIsSpecializationOpen(false);
                        setAgentMode(true);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium transition-colors hover:bg-black/[0.03] ${activeSpecialization.id === spec.id ? "text-[#fd3b12]" : "text-[#4A4D5E]"}`}
                    >
                      {spec.icon}
                      {spec.name}
                    </button>
                  ))}
                  <div className="mt-1 pt-1 border-t border-black/[0.04]">
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-[10px] font-black tracking-widest text-[#7A7D8E]">
                        AGENT MODE
                      </span>
                      <button
                        type="button"
                        onClick={() => setAgentMode(!agentMode)}
                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none ${
                          agentMode ? "bg-[#10B981]" : "bg-[#EF4444]"
                        }`}
                      >
                        <span
                          className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${
                            agentMode ? "translate-x-[17px]" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tools Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsToolsOpen(!isToolsOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#4A4D5E] hover:text-[#1A1D2E] hover:bg-black/[0.05] transition-all"
                title="Select tools"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="hidden sm:inline">Tools</span>
                <svg
                  className="w-2.5 h-2.5 opacity-40"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {isToolsOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-black/[0.08] rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="px-3 py-1.5 border-b border-black/[0.04] mb-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#7A7D8E]">
                      Capability Matrix
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {TOOLS.map((tool) => (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => {
                          alert(
                            `Tool ${tool.name} initialization - coming soon!`,
                          );
                          setIsToolsOpen(false);
                        }}
                        className="w-full flex flex-col items-start px-3 py-2 text-[11px] transition-colors hover:bg-black/[0.03]"
                      >
                        <span className="font-bold text-[#1A1D2E]">
                          {tool.name}
                        </span>
                        <span className="text-[10px] text-[#7A7D8E] leading-tight">
                          {tool.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Engine Config */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsConfigOpen(!isConfigOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  isConfigOpen
                    ? "bg-black/[0.08] text-[#1A1D2E]"
                    : "text-[#4A4D5E] hover:text-[#1A1D2E] hover:bg-black/[0.05]"
                }`}
                title="Engine Parameters"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
                <span className="hidden sm:inline">Engine</span>
              </button>
              <ModelConfigPanel isOpen={isConfigOpen} />
            </div>

            <div className="flex-1" />

            {/* Export Button */}
            <button
              type="button"
              onClick={onExport}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#4A4D5E] hover:text-[#1A1D2E] hover:bg-black/[0.05] transition-all"
              title="Export session data"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>

          {/* Textarea + Send Row */}
          <div className="flex items-end gap-3 px-3 pb-3 pt-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend(e);
                }
              }}
              placeholder={
                currentConvId
                  ? "What would you like to build today?"
                  : "Select a workspace to begin..."
              }
              disabled={!currentConvId}
              className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none px-2 py-2 text-sm text-[#1A1D2E] placeholder:text-[#7A7D8E] resize-none min-h-[44px] max-h-[120px] sm:max-h-[160px]"
              rows={1}
            />
            {/* Send Button — Prominent Round Orange */}
            <button
              type="submit"
              disabled={loading || !input.trim() || !currentConvId}
              className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                loading || !input.trim() || !currentConvId
                  ? "bg-[#BFC4CC] text-[#7A7D8E] cursor-not-allowed"
                  : "bg-[#fd3b12] text-white hover:bg-[#E65C00] shadow-lg shadow-[#fd3b12]/30 hover:shadow-[#fd3b12]/50 active:scale-95"
              }`}
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
                  strokeWidth="2.5"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </footer>
  );
};

export default ChatInput;
