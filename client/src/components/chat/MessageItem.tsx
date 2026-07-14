import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { Message, ThoughtLogEntry } from "../../types/chat";
import ThinkingTrace from "./ThinkingTrace";
import { PROVIDER_MAP, PROVIDERS, type ProviderId } from "../providerMeta";
import { TradingChart } from "./TradingChart";
import { useAI } from "../../contexts/AIContext";

interface MessageItemProps {
  msg: Message;
  isLastUserMsg: boolean;
  nextMsg?: Message;
  loading: boolean;
  thoughtLog: ThoughtLogEntry[];
  thoughtStartTime: number | null;
  currentToolCalls: any[];
  currentContext: any[];
  onCancel: () => void;
  onViewInCanvas: (artifactId: string) => void;
  onRetry?: (errorMsgId: string, newProvider?: string, newModel?: string) => void;
}

const CodeBlock = ({
  language,
  value,
}: {
  language: string;
  value: string;
}) => {
  const [copied, setCopied] = React.useState(false);
  const [showLineNumbers, setShowLineNumbers] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = value.split("\n");

  return (
    <div className="relative group/code my-5 rounded-xl border border-white/10 bg-[#1A1D2E] shadow-2xl overflow-hidden">
      <div className="absolute right-2 top-2 z-10 flex items-center gap-2 opacity-0 group-hover/code:opacity-100 transition-all duration-200">
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setShowLineNumbers(!showLineNumbers);
          }}
          className={`p-1.5 rounded-md transition-all backdrop-blur-md border border-white/10 shadow-lg ${
            showLineNumbers
              ? "bg-[#fd3b12] text-white border-[#fd3b12]/20"
              : "bg-white/10 text-white/70 hover:bg-white/20"
          }`}
          title="Toggle line numbers"
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
              strokeWidth="2.5"
              d="M4 6h16M4 12h16M4 18h7"
            />
          </svg>
        </button>

        <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest bg-black/20 px-2 py-1 rounded-md backdrop-blur-sm border border-white/5">
          {language || "code"}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleCopy();
          }}
          className="p-1.5 rounded-md bg-white/10 hover:bg-[#fd3b12] text-white/70 hover:text-white transition-all backdrop-blur-md border border-white/10 shadow-lg"
          title="Copy to clipboard"
        >
          {copied ? (
            <svg
              className="w-3.5 h-3.5 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
          )}
        </button>
      </div>
      <pre className="!m-0 !p-4 !bg-transparent overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <code className="text-[11px] font-mono leading-relaxed text-[#E2E8F0]">
          {showLineNumbers
            ? lines.map((line, i) => (
                <div key={i} className="flex gap-4 min-w-fit">
                  <span className="shrink-0 w-6 text-right text-white/20 select-none tabular-nums border-r border-white/5 pr-2">
                    {i + 1}
                  </span>
                  <span className="whitespace-pre">{line || " "}</span>
                </div>
              ))
            : value}
        </code>
      </pre>
    </div>
  );
};

const PROVIDER_MODELS: Record<string, string[]> = {
  local: ["llama3", "gemma:2b", "gemma2", "mistral", "phi3"],
  ollama_cloud: ["llama3", "gemma2", "mistral", "phi3"],
  groq: ["llama3-70b-8192", "llama3-8b-8192", "mixtral-8x7b-32768", "gemma-7b-it"],
  openrouter: ["meta-llama/llama-3-70b-instruct", "google/gemma-2-27b-it", "mistralai/mistral-7b-instruct"],
  gemini: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"]
};

const MessageItem: React.FC<MessageItemProps> = ({
  msg,
  isLastUserMsg,
  nextMsg,
  loading,
  thoughtLog,
  thoughtStartTime,
  currentToolCalls,
  currentContext,
  onCancel,
  onViewInCanvas,
  onRetry,
}) => {
  const isUser = msg.sender === "user";
  const isError = msg.content.startsWith("❌ Error:") || msg.content.startsWith("❌ Send Failed:");
  const [messageCopied, setMessageCopied] = React.useState(false);

  const { activeSpace } = useAI();

  const allowedProviders = React.useMemo(() => {
    return PROVIDERS.filter((p) => {
      if (activeSpace && ["code-lab", "gpt-oss", "health-tech", "microsoft-agent-lab"].includes(activeSpace.slug)) {
        if (p.id === "groq") return false;
      }
      return true;
    });
  }, [activeSpace]);

  const getFilteredModelsForProvider = React.useCallback((prov: ProviderId) => {
    const allModels = PROVIDER_MODELS[prov] || [];
    if (activeSpace && ["code-lab", "health-tech"].includes(activeSpace.slug)) {
      return allModels.filter(m => m.toLowerCase().includes("gemma"));
    }
    if (activeSpace?.slug === "gpt-oss") {
      if (prov === "gemini") {
        return allModels.filter(m => m.toLowerCase().includes("gemini"));
      }
      return allModels.filter(m => m.toLowerCase().includes("gpt") || m.toLowerCase().includes("openai"));
    }
    return allModels;
  }, [activeSpace]);

  const [selectedProvider, setSelectedProvider] = React.useState<ProviderId>(() => {
    const prov = (localStorage.getItem("ai_provider") as ProviderId) || "local";
    if (activeSpace && ["code-lab", "gpt-oss", "health-tech", "microsoft-agent-lab"].includes(activeSpace.slug) && prov === "groq") {
      return "local";
    }
    return prov;
  });

  const [selectedModel, setSelectedModel] = React.useState<string>(() => {
    const prov = (localStorage.getItem("ai_provider") as ProviderId) || "local";
    const activeProv = (activeSpace && ["code-lab", "gpt-oss", "health-tech", "microsoft-agent-lab"].includes(activeSpace.slug) && prov === "groq") ? "local" : prov;
    const models = getFilteredModelsForProvider(activeProv);
    const persisted = localStorage.getItem(`ai_model_${activeProv}`);
    if (persisted && models.includes(persisted)) {
      return persisted;
    }
    return models.length > 0 ? models[0] : "";
  });

  const handleProviderChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const prov = e.target.value as ProviderId;
    setSelectedProvider(prov);
    const models = getFilteredModelsForProvider(prov);
    if (models.length > 0) {
      setSelectedModel(models[0]);
    }
  }, [getFilteredModelsForProvider]);

  const handleModelChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(e.target.value);
  }, []);

  const handleSwitchAndRetry = React.useCallback(() => {
    if (onRetry) {
      onRetry(msg.id, selectedProvider, selectedModel);
    }
  }, [onRetry, msg.id, selectedProvider, selectedModel]);

  const handleCopyMessage = React.useCallback(() => {
    navigator.clipboard.writeText(msg.content);
    setMessageCopied(true);
    setTimeout(() => setMessageCopied(false), 2000);
  }, [msg.content]);

  const getFirstArtifactId = (content: string, msgId?: string) => {
    const regex = /\[CANVAS:(\w+):([^:\]]+)/i;
    const match = regex.exec(content);

    if (match) {
      const type = match[1].toLowerCase();
      const title = match[2];

      const typeNormMap: Record<string, string> = {
        code: "code",
        docs: "docs",
        doc: "docs",
        documentation: "docs",
        research: "research",
      };
      const artifactType = typeNormMap[type] || "docs";
      return `${artifactType}-${title.replace(/\s+/g, "-").toLowerCase()}`;
    }

    // Fallback: match the logic in artifactParser.ts for standard code blocks
    if (content.includes("```")) {
      return `code-gen-${msgId || "anon"}-1`;
    }

    return null;
  };

  const firstArtifactId = getFirstArtifactId(msg.content, msg.id);

  return (
    <div id={`msg-${msg.id}`} className="space-y-4">
      {isError ? (
        <div className="flex flex-col items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-white border-l-4 border-red-500 p-4 rounded-xl rounded-tl-none rounded-br-none shadow-sm max-w-3xl flex gap-4 w-full">
            <div className="text-red-500 shrink-0 mt-0.5">
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
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="text-xs text-[#1A1D2E] leading-relaxed font-semibold">
              {msg.content.replace("❌ Error: ", "").replace("❌ Send Failed: ", "")}
            </div>
          </div>
          
          {onRetry && (
            <div className="flex flex-wrap items-center gap-3 bg-[#161925]/60 border border-white/5 p-3 rounded-xl max-w-3xl w-full text-xs">
              <button
                onClick={() => onRetry(msg.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#fd3b12] hover:bg-[#fd3b12]/80 text-white font-bold uppercase tracking-wider text-[10px] transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 6H16" />
                </svg>
                Retry
              </button>

              <div className="w-px h-5 bg-white/10 hidden sm:block"></div>

              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[200px]">
                <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Switch Model:</span>
                
                <select
                  value={selectedProvider}
                  onChange={handleProviderChange}
                  className="bg-black/40 border border-white/10 text-white rounded px-2 py-1 text-[11px] focus:outline-none focus:border-[#fd3b12]/50 font-medium"
                >
                  {allowedProviders.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>

                <select
                  value={selectedModel}
                  onChange={handleModelChange}
                  className="bg-black/40 border border-white/10 text-white rounded px-2 py-1 text-[11px] focus:outline-none focus:border-[#fd3b12]/50 font-medium"
                >
                  {getFilteredModelsForProvider(selectedProvider).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                <button
                  onClick={handleSwitchAndRetry}
                  className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Switch & Retry
                </button>
              </div>
            </div>
          )}
        </div>
      ) : isUser ? (
        <div className="flex justify-end animate-in fade-in slide-in-from-right-4">
          <div className="flex flex-col items-end gap-1.5 max-w-[80%]">
            <div className="flex items-center gap-2 mr-0.5">
              <button
                onClick={handleCopyMessage}
                className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-[#fd3b12]/70 hover:text-[#fd3b12] transition-colors border border-transparent hover:border-[#fd3b12]/20"
                title="Copy message text"
              >
                {messageCopied ? (
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                    />
                  </svg>
                )}
              </button>
              <span className="text-[9px] font-bold text-[#fd3b12] uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded-md border border-white/20 backdrop-blur-sm">
                @{localStorage.getItem("username") || "Architect"}
              </span>
            </div>
            <div className="bg-[#fd3b12] text-white px-5 py-3 rounded-2xl rounded-tr-none rounded-bl-none shadow-md shadow-[#fd3b12]/10 relative user-corner-glow w-full">
              {/* Secondary corner glow decorator */}
              <div className="absolute inset-0 pointer-events-none user-corner-glow-secondary rounded-2xl rounded-tr-none rounded-bl-none overflow-hidden"></div>
              
              <p className="text-[12px] leading-relaxed font-medium whitespace-pre-wrap relative z-10">
                {msg.content}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 w-full">
          {/* Persisted Neural Trace */}
          {(msg.metadata?.thought_log?.length > 0 || msg.metadata?.tool_calls?.length > 0) && (
            <ThinkingTrace
              loading={false}
              thoughtLog={msg.metadata.thought_log || []}
              thoughtStartTime={msg.metadata.thought_log?.[0]?.timestamp || null}
              currentToolCalls={msg.metadata.tool_calls || []}
              currentContext={[]}
            />
          )}
          <div className="flex justify-start animate-in fade-in slide-in-from-left-4">
            <div className="flex flex-col items-start gap-1.5 max-w-[85%]">
              <span className="text-[9px] font-bold text-[#fd3b12] uppercase tracking-widest bg-[#fd3b12]/10 px-2 py-0.5 rounded-md border border-[#fd3b12]/20 backdrop-blur-sm ml-0.5">
                Agent
              </span>
            <div className="bg-white border border-black/[0.04] p-5 rounded-2xl rounded-tl-none rounded-br-none shadow-sm relative group bot-corner-glow w-full">
              {/* Secondary corner glow decorator */}
              <div className="absolute inset-0 pointer-events-none bot-corner-glow-secondary rounded-2xl rounded-tl-none rounded-br-none overflow-hidden"></div>
              
              <div className="absolute -left-1 top-2 w-1 h-10 bg-[#fd3b12]/20 rounded-full"></div>

              {/* Attribution Row */}
              {!isUser && (
                <div className="flex items-center gap-2 mb-3 text-[10px] font-bold text-[#4A4D5E]/50 uppercase tracking-widest border-b border-black/[0.03] pb-2">
                  {(() => {
                    const providerId = msg.metadata?.provider || "ollama_cloud"; // Fallback
                    const modelName = msg.metadata?.model || "Neural Core";
                    const pInfo = PROVIDER_MAP[providerId as any];
                    return (
                      <>
                        {pInfo?.icon && (
                          <img
                            src={pInfo.icon}
                            alt=""
                            className="w-3.5 h-3.5 object-contain opacity-70 grayscale hover:grayscale-0 transition-all"
                          />
                        )}
                        <span>{pInfo?.label || providerId}</span>
                        <span className="text-[#fd3b12]/30 font-light">|</span>
                        <span className="text-[#1A1D2E]/60">{modelName}</span>
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="prose-chat max-w-none text-[#1A1D2E] font-medium">
                {React.useMemo(() => {
                  // Try to parse tool call from content
                  const toolMatch = msg.content.match(
                    /^({[\s\S]*?})\n?<\/tool_call>/,
                  );
                  let displayContent = msg.content;
                  let toolHeader = null;

                  if (toolMatch) {
                    try {
                      const parsed = JSON.parse(toolMatch[1]);
                      displayContent = parsed.arguments?.content || msg.content;
                      toolHeader = (
                        <div className="mb-4 flex items-center gap-2 p-2 rounded-lg bg-[#fd3b12]/5 border border-[#fd3b12]/10 text-[10px] font-bold text-[#fd3b12] uppercase tracking-wider">
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2.5"
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                          </svg>
                          <span>Agentic Action: {parsed.name}</span>
                          {parsed.arguments?.filename && (
                            <>
                              <span className="opacity-30">|</span>
                              <span className="text-[#1A1D2E]/60 lowercase font-mono tracking-normal">
                                {parsed.arguments.filename}
                              </span>
                            </>
                          )}
                        </div>
                      );
                    } catch (e) {
                      console.error("Failed to parse tool call JSON:", e);
                    }
                  }

                  // Preprocess to support [TRADING_CHART:...] syntax by mapping it to a trading-chart code block
                  displayContent = displayContent.replace(
                    /\[TRADING_CHART:([^:\]\s]+)(?::([^:\]\s]+))?(?::([^:\]\s]+))?(?::([^:\]\s]+))?\]/gi,
                    (_match, symbol, entry, sl, tp) => {
                      const config: any = { symbol: symbol || "BTCUSD" };
                      if (entry) config.entry = Number(entry);
                      if (sl) config.sl = Number(sl);
                      if (tp) config.tp = Number(tp);
                      return `\n\n\`\`\`trading-chart\n${JSON.stringify(config, null, 2)}\n\`\`\`\n\n`;
                    }
                  );

                  return (
                    <>
                      {toolHeader}
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          pre: ({ children }) => (
                            <React.Fragment>{children}</React.Fragment>
                          ),
                          p: ({ children }) => (
                            <div className="mb-4 last:mb-0">{children}</div>
                          ),
                          blockquote: ({ children }) => (
                            <div className="my-4 border-l-4 border-indigo-500 bg-indigo-500/10 p-4 rounded-r-xl shadow-sm text-sm text-indigo-200">
                              {children}
                            </div>
                          ),
                          code({
                            node,
                            inline,
                            className,
                            children,
                            ...props
                          }: any) {
                            const match = /language-([\w-]+)/.exec(
                              className || "",
                            );
                            const isTradingChart = match && match[1] === "trading-chart";
                            return !inline ? (
                              isTradingChart ? (
                                (() => {
                                  try {
                                    const data = JSON.parse(String(children));
                                    return (
                                      <div className="my-5">
                                        <TradingChart 
                                          symbol={data.symbol} 
                                          initialEntry={data.entry} 
                                          initialSL={data.sl} 
                                          initialTP={data.tp} 
                                        />
                                      </div>
                                    );
                                  } catch (e) {
                                    return (
                                      <div className="my-5">
                                        <TradingChart />
                                      </div>
                                    );
                                  }
                                })()
                              ) : (
                                <CodeBlock
                                  language={match ? match[1] : ""}
                                  value={String(children).replace(/\n$/, "")}
                                />
                              )
                            ) : (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {displayContent}
                      </ReactMarkdown>
                    </>
                  );
                }, [msg.content])}
              </div>

              {/* Response Metadata Footer */}
              {!isUser && msg.metadata && (
                <div className="mt-3 pt-2 border-t border-black/[0.03] flex items-center gap-3 text-[9px] font-bold text-[#4A4D5E]/40 uppercase tracking-tight">
                  <button
                    onClick={handleCopyMessage}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-black/5 hover:text-[#4A4D5E]/80 transition-colors"
                    title="Copy full response"
                  >
                    {messageCopied ? (
                      <>
                        <svg
                          className="w-3 h-3 text-green-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="3"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-green-600/80">Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.5"
                            d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                          />
                        </svg>
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  <div className="flex-grow"></div>
                  <div className="flex items-center gap-1">
                    <svg
                      className="w-2.5 h-2.5 opacity-50"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>
                      {new Date(
                        msg.metadata.timestamp || Date.now(),
                      ).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {msg.metadata.tokens && (
                    <div className="flex items-center gap-1">
                      <svg
                        className="w-2.5 h-2.5 opacity-50"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        />
                      </svg>
                      <span>{msg.metadata.tokens} tokens</span>
                    </div>
                  )}

                  {msg.metadata.latency && (
                    <div className="flex items-center gap-1 text-[#fd3b12]/60">
                      <svg
                        className="w-2.5 h-2.5 opacity-60"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      <span>
                        {typeof msg.metadata.latency === "number"
                          ? msg.metadata.latency.toFixed(2)
                          : msg.metadata.latency}
                        s
                      </span>
                    </div>
                  )}

                  {firstArtifactId && (
                    <button
                      onClick={() => onViewInCanvas(firstArtifactId)}
                      className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#fd3b12]/10 hover:bg-[#fd3b12]/20 text-[#fd3b12] border border-[#fd3b12]/20 transition-all group/canvas"
                    >
                      <svg
                        className="w-3 h-3 group-hover/canvas:scale-110 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 6h16M4 12h16m-7 6h7"
                        />
                      </svg>
                      <span>View in Canvas</span>
                    </button>
                  )}
                </div>
              )}

              {msg.status === "typing" && (
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-black/[0.03] pt-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span
                        className="w-1 h-1 bg-[#fd3b12] rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      ></span>
                      <span
                        className="w-1 h-1 bg-[#fd3b12] rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      ></span>
                      <span
                        className="w-1 h-1 bg-[#fd3b12] rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      ></span>
                    </div>
                    <span className="text-[10px] font-bold text-[#fd3b12]/80 uppercase tracking-widest">
                      Synthesizing
                    </span>
                  </div>

                  <button
                    onClick={onCancel}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors border border-red-200/50 group/cancel"
                    title="Cancel Operation"
                  >
                    <svg
                      className="w-3 h-3 group-hover/cancel:rotate-90 transition-transform duration-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    <span className="text-[9px] font-bold uppercase tracking-tight">
                      Stop
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Thinking Process — Appear BELOW the user message but ABOVE the bot message if possible */}
      {isLastUserMsg && (!nextMsg || nextMsg.sender !== "bot" || nextMsg.status === "typing") && (
        <ThinkingTrace
          loading={loading}
          thoughtLog={thoughtLog}
          thoughtStartTime={thoughtStartTime}
          currentToolCalls={currentToolCalls}
          currentContext={currentContext}
        />
      )}
    </div>
  );
};

export default MessageItem;
