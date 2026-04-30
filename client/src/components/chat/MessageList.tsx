import React from 'react';
import MessageItem from './MessageItem';
import type { Message, ThoughtLogEntry } from '../../types/chat';
import type { ProviderId } from '../../contexts/AIContext';

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  thoughtLog: ThoughtLogEntry[];
  thoughtStartTime: number | null;
  currentToolCalls: any[];
  currentContext: any[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  currentConvId: number | null;
  activeProvider: ProviderId;
  activeModel: string;
  onCancel: () => void;
  onViewInCanvas: (artifactId: string) => void;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  loading,
  thoughtLog,
  thoughtStartTime,
  currentToolCalls,
  currentContext,
  scrollRef,
  currentConvId,
  activeProvider,
  activeModel,
  onCancel,
  onViewInCanvas
}) => {
  const lastUserIndex = [...messages].reverse().findIndex(m => m.sender === 'user');

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide relative z-10">
      {!currentConvId && (() => {
        const config = {
          local: { label: 'Neural Core', icon: '/media/brand-icons/ollama-color.svg', desc: 'Execute models directly on your hardware for maximum privacy and low latency.' },
          ollama_cloud: { label: 'Neural Cloud', icon: '/media/brand-icons/ollama-color.svg', desc: 'Connect to your remote Ollama instances with high-performance cloud scale.' },
          groq: { label: 'Neural Velocity', icon: '/media/brand-icons/groq.webp', desc: 'Harness LPU technology for lightning-fast inference and real-time agentic reasoning.' },
          openrouter: { label: 'Neural Interface', icon: '/media/brand-icons/openrouter.webp', desc: 'Unified gateway to the world\'s most powerful LLMs and specialist expert models.' },
          gemini: { label: 'Neural Expert', icon: '/media/brand-icons/gemini-logo_svgstack_com_37141777229654.svg', desc: 'Leverage Google\'s most capable multimodal models for complex problem solving.' }
        }[activeProvider] || { label: 'Neural Link', icon: null, desc: 'Select a session from the shelf or create a new workspace to begin agentic execution.' };

        return (
          <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-700">
            <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-8 border transition-all duration-500 shadow-xl shadow-black/[0.02] rotate-3 hover:rotate-0 ${
              'bg-white border-black/[0.04]'
              // activeProvider === 'groq' 
              //   ? 'bg-[#0A0A0C] border-white/10' 
              //   : 'bg-white border-black/[0.04]'
            }`}>
              {config.icon ? (
                <img src={config.icon} alt={config.label} className="w-12 h-12 object-contain" />
              ) : (
                <svg className="w-12 h-12 text-[#FF6600]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
            </div>
            <h2 className="text-3xl font-bold text-[#1A1D2E] mb-3 tracking-tighter">
              Initialize <span className="text-[#FF6600]">{config.label}</span>
            </h2>
            <p className="max-w-md text-[#7A7D8E] text-sm leading-relaxed font-medium">
              {config.desc}
            </p>
            <div className="mt-8 flex gap-3">
              <div className="px-4 py-1.5 rounded-full bg-black/5 text-[10px] font-bold text-[#4A4D5E] uppercase tracking-widest border border-black/[0.03]">
                {activeProvider}
              </div>
              <div className="px-4 py-1.5 rounded-full bg-[#FF6600]/5 text-[10px] font-bold text-[#FF6600] uppercase tracking-widest border border-[#FF6600]/10">
                {activeModel}
              </div>
            </div>

            {/* API Setup Guide — Appears if key is missing for cloud providers */}
            {(() => {
              const cloudProviders = ['groq', 'openrouter', 'gemini', 'ollama_cloud'];
              if (!cloudProviders.includes(activeProvider)) return null;

              const hasKey = {
                groq: !!localStorage.getItem('groq_api_key'),
                openrouter: !!localStorage.getItem('openrouter_api_key'),
                gemini: !!localStorage.getItem('gemini_api_key'),
                ollama_cloud: !!localStorage.getItem('ollama_cloud_key'),
              }[activeProvider as string];

              if (hasKey) return null;

              const guide = {
                groq: {
                  link: 'https://console.groq.com/keys',
                  steps: ['Visit the Groq Console', 'Create a new API Key', 'Add it to the Settings modal']
                },
                openrouter: {
                  link: 'https://openrouter.ai/settings/keys',
                  steps: ['Login to OpenRouter', 'Generate a new API Key', 'Paste it in the Settings gear']
                },
                gemini: {
                  link: 'https://aistudio.google.com/app/apikey',
                  steps: ['Open Google AI Studio', 'Click "Create API key"', 'Update your Settings here']
                },
                ollama_cloud: {
                  link: localStorage.getItem('ollama_cloud_url') || 'https://ollama.com',
                  steps: ['Verify your remote URL', 'Ensure the instance is active', 'Enter your auth token if required']
                }
              }[activeProvider as string] || { link: '#', steps: [] };

              return (
                <div className="mt-10 w-full max-w-lg p-6 rounded-2xl bg-white border border-black/[0.05] shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-[#FF6600]/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#FF6600]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-bold text-[#1A1D2E] uppercase tracking-tight">API Access Setup</h3>
                  </div>

                  <div className="space-y-3 mb-6 text-left">
                    {guide.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-3 group">
                        <span className="w-5 h-5 rounded-full bg-black/5 flex items-center justify-center text-[10px] font-bold text-[#4A4D5E] group-hover:bg-[#FF6600] group-hover:text-white transition-all">
                          {i + 1}
                        </span>
                        <p className="text-xs text-[#4A4D5E] font-medium">{step}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/50 text-left mb-6">
                    <div className="flex items-center gap-2 mb-2 text-amber-700">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-[10px] font-bold uppercase tracking-widest">Security Sandbox Protocol</span>
                    </div>
                    <p className="text-[11px] text-amber-800/80 leading-relaxed font-medium italic">
                      "To maintain system integrity, please generate a dedicated API key exclusively for this sandbox. We recommend restricted permissions that deny administrative access or payment modifications, ensuring this key is used only for isolated neural experiments."
                    </p>
                  </div>

                  <a 
                    href={guide.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-xl bg-[#1A1D2E] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#FF6600] transition-all shadow-lg shadow-black/10 flex items-center justify-center gap-2"
                  >
                    <span>Get {activeProvider} API Key</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              );
            })()}
          </div>
        );
      })()}

      <div className="space-y-6">
        {messages.map((msg, index) => (
          <MessageItem 
            key={msg.id}
            msg={msg}
            isLastUserMsg={lastUserIndex !== -1 && index === (messages.length - 1 - lastUserIndex)}
            loading={loading}
            thoughtLog={thoughtLog}
            thoughtStartTime={thoughtStartTime}
            currentToolCalls={currentToolCalls}
            currentContext={currentContext}
            onCancel={onCancel}
            onViewInCanvas={onViewInCanvas}
          />
        ))}
      </div>
      <div ref={scrollRef} />
    </main>
  );
};

export default MessageList;
