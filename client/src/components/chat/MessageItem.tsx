import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { Message, ThoughtLogEntry } from '../../types/chat';
import ThinkingTrace from './ThinkingTrace';

interface MessageItemProps {
  msg: Message;
  isLastUserMsg: boolean;
  loading: boolean;
  thoughtLog: ThoughtLogEntry[];
  thoughtStartTime: number | null;
  currentToolCalls: any[];
  currentContext: any[];
}

const MessageItem: React.FC<MessageItemProps> = ({
  msg,
  isLastUserMsg,
  loading,
  thoughtLog,
  thoughtStartTime,
  currentToolCalls,
  currentContext
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
          <div className="bg-[#FF6600] text-white px-5 py-3 rounded-2xl rounded-tr-none shadow-md shadow-[#FF6600]/10 max-w-[80%]">
            <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap">{msg.content}</p>
          </div>
        </div>
      ) : (
        <div className="flex justify-start animate-in fade-in slide-in-from-left-4">
          <div className="bg-white border border-black/[0.04] p-5 rounded-2xl rounded-tl-none shadow-sm max-w-[85%] relative group">
            <div className="absolute -left-1 top-2 w-1 h-10 bg-[#FF6600]/20 rounded-full"></div>
            <div className="prose prose-sm max-w-none text-[#1A1D2E] leading-relaxed font-medium">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
            {msg.status === 'typing' && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#FF6600]/60 uppercase tracking-widest animate-pulse">Synthesizing...</span>
              </div>
            )}
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
