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
          groq: { label: 'Neural Velocity', icon: '/media/brand-icons/white-grok-logo_svgstack_com_37181777229567.svg', desc: 'Harness LPU technology for lightning-fast inference and real-time agentic reasoning.' },
          openrouter: { label: 'Neural Interface', icon: '/media/brand-icons/openrouter.webp', desc: 'Unified gateway to the world\'s most powerful LLMs and specialist expert models.' },
          gemini: { label: 'Neural Expert', icon: '/media/brand-icons/gemini-logo_svgstack_com_37141777229654.svg', desc: 'Leverage Google\'s most capable multimodal models for complex problem solving.' }
        }[activeProvider] || { label: 'Neural Link', icon: null, desc: 'Select a session from the shelf or create a new workspace to begin agentic execution.' };

        return (
          <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-700">
            <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-8 border transition-all duration-500 shadow-xl shadow-black/[0.02] rotate-3 hover:rotate-0 ${
              activeProvider === 'groq' 
                ? 'bg-[#0A0A0C] border-white/10' 
                : 'bg-white border-black/[0.04]'
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
