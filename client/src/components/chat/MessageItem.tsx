import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { Message, ThoughtLogEntry } from '../../types/chat';
import ThinkingTrace from './ThinkingTrace';
import { PROVIDER_MAP } from '../providerMeta';

interface MessageItemProps {
  msg: Message;
  isLastUserMsg: boolean;
  loading: boolean;
  thoughtLog: ThoughtLogEntry[];
  thoughtStartTime: number | null;
  currentToolCalls: any[];
  currentContext: any[];
  onCancel: () => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
  msg,
  isLastUserMsg,
  loading,
  thoughtLog,
  thoughtStartTime,
  currentToolCalls,
  currentContext,
  onCancel
}) => {
  const isUser = msg.sender === 'user';
  const isError = msg.content.startsWith('❌ Error:');

  return (
    <div className="space-y-4">
      {isError ? (
        <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-white border-l-4 border-red-500 p-4 rounded-xl rounded-tl-none shadow-sm max-w-3xl flex gap-4">
            <div className="text-red-500 shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-xs text-[#1A1D2E] leading-relaxed font-medium">
              {msg.content.replace('❌ Error: ', '')}
            </div>
          </div>
        </div>
      ) : isUser ? (
        <div className="flex justify-end animate-in fade-in slide-in-from-right-4">
          <div className="flex flex-col items-end gap-1.5 max-w-[80%]">
            <span className="text-[9px] font-bold text-[#FF6600] uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded-md border border-white/20 backdrop-blur-sm mr-0.5">
              @{localStorage.getItem('username') || 'Architect'}
            </span>
            <div className="bg-[#FF6600] text-white px-5 py-3 rounded-2xl rounded-tr-none shadow-md shadow-[#FF6600]/10 relative user-corner-glow w-full">
              <p className="text-[12px] leading-relaxed font-medium whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-start animate-in fade-in slide-in-from-left-4">
          <div className="flex flex-col items-start gap-1.5 max-w-[85%]">
            <span className="text-[9px] font-bold text-[#FF6600] uppercase tracking-widest bg-[#FF6600]/10 px-2 py-0.5 rounded-md border border-[#FF6600]/20 backdrop-blur-sm ml-0.5">Agent</span>
            <div className="bg-white border border-black/[0.04] p-5 rounded-2xl rounded-tl-none shadow-sm relative group bot-corner-glow w-full">
            <div className="absolute -left-1 top-2 w-1 h-10 bg-[#FF6600]/20 rounded-full"></div>
            
            {/* Attribution Row */}
            {!isUser && msg.metadata && (
              <div className="flex items-center gap-2 mb-3 text-[10px] font-bold text-[#4A4D5E]/50 uppercase tracking-widest border-b border-black/[0.03] pb-2">
                {(() => {
                  const pInfo = PROVIDER_MAP[msg.metadata.provider];
                  return (
                    <>
                      {pInfo?.icon && (
                        <img src={pInfo.icon} alt="" className="w-3.5 h-3.5 object-contain opacity-70 grayscale hover:grayscale-0 transition-all" />
                      )}
                      <span>{pInfo?.label || msg.metadata.provider}</span>
                      <span className="text-[#FF6600]/30 font-light">|</span>
                      <span className="text-[#1A1D2E]/60">{msg.metadata.model}</span>
                    </>
                  );
                })()}
              </div>
            )}

            <div className="prose-chat max-w-none text-[#1A1D2E] font-medium">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>

            {/* Response Metadata Footer */}
            {!isUser && msg.metadata && (
              <div className="mt-3 pt-2 border-t border-black/[0.03] flex items-center justify-end gap-3 text-[9px] font-bold text-[#4A4D5E]/40 uppercase tracking-tight">
                <div className="flex items-center gap-1">
                  <svg className="w-2.5 h-2.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{new Date(msg.metadata.timestamp || Date.now()).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                
                {msg.metadata.tokens && (
                  <div className="flex items-center gap-1">
                    <svg className="w-2.5 h-2.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <span>{msg.metadata.tokens} tokens</span>
                  </div>
                )}

                {msg.metadata.latency && (
                  <div className="flex items-center gap-1 text-[#FF6600]/60">
                    <svg className="w-2.5 h-2.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>{typeof msg.metadata.latency === 'number' ? msg.metadata.latency.toFixed(2) : msg.metadata.latency}s</span>
                  </div>
                )}
              </div>
            )}
            
            {msg.status === 'typing' && (
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-black/[0.03] pt-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1 h-1 bg-[#FF6600] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1 h-1 bg-[#FF6600] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1 h-1 bg-[#FF6600] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-[10px] font-bold text-[#FF6600]/80 uppercase tracking-widest">Synthesizing</span>
                </div>
                
                <button 
                  onClick={onCancel}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors border border-red-200/50 group/cancel"
                  title="Cancel Operation"
                >
                  <svg className="w-3 h-3 group-hover/cancel:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-[9px] font-bold uppercase tracking-tight">Stop</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Thinking Process — Appear BELOW the user message but ABOVE the bot message if possible */}
      {isLastUserMsg && (
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
