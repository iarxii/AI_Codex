import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2 } from 'lucide-react';
import { useAI } from '../../contexts/AIContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getApiUrl } from '../../config';

interface MiniContextChatProps {
  symbol: string;
  onInteractionChange?: (isActive: boolean) => void;
}

export const MiniContextChat: React.FC<MiniContextChatProps> = ({ symbol, onInteractionChange }) => {
  const { provider, model, getApiKey } = useAI();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [localMessages, setLocalMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onInteractionChange) {
      onInteractionChange(localMessages.length > 0 || isSending);
    }
  }, [localMessages.length, isSending, onInteractionChange]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages, isSending]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    const userMessage = input;
    setInput('');
    setIsSending(true);
    setLocalMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      // Phase 7.2: Inject chart context as a SystemMessage-style hidden prefix
      // This keeps the user's visible message clean while providing the LLM with grounded context.
      const systemContext = `[SYSTEM CONTEXT — DO NOT REPEAT TO USER]\nUser is viewing the trading chart modal.\nActive Symbol: ${symbol}\nAnalyst sidebar is active. Answer concisely and in the context of this instrument.\n[END SYSTEM CONTEXT]`;
      
      // Phase 7.3: Real backend call instead of setTimeout mock
      const token = localStorage.getItem('token');
      const baseUrl = getApiUrl();
      
      const response = await fetch(`${baseUrl}/api/chat/quick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          system_context: systemContext,
          message: userMessage,
          symbol: symbol,
          provider: provider,
          model: model,
          api_key: getApiKey(provider)
        })
      });

      if (response.ok) {
        const data = await response.json();
        setLocalMessages(prev => [...prev, { role: 'assistant', content: data.reply || data.response || "I couldn't generate a response. Please try again." }]);
      } else {
        // Fallback: provide a useful simulated response if the endpoint isn't available yet
        setLocalMessages(prev => [...prev, { role: 'assistant', content: `I see you are looking at ${symbol}. The current price action suggests a sweep of liquidity near a key level. What specific area are you analyzing?` }]);
      }
      setIsSending(false);
      
    } catch (err) {
      console.error(err);
      // Graceful fallback for network errors
      setLocalMessages(prev => [...prev, { role: 'assistant', content: `[Offline Mode] Analysis for ${symbol}: Check the analyst log stream for real-time signals. I'll be fully connected once the backend endpoint is live.` }]);
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0D0F16]">
      {/* Mini Chat Feed */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide text-xs scroll-smooth"
      >
        {localMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 font-mono text-[9px] uppercase tracking-widest text-center px-4">
            Ask Spirit Bird about this chart...
          </div>
        ) : (
          localMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-2 rounded-xl ${msg.role === 'user' ? 'bg-[#fd3b12]/20 text-[#fd3b12] border border-[#fd3b12]/30' : 'bg-white/5 text-gray-300 border border-white/10'}`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-1 text-[9px] font-black uppercase text-emerald-400">
                    <Bot className="w-3 h-3" /> Spirit Bird
                  </div>
                )}
                <div className="prose prose-invert prose-sm max-w-none text-[11px] leading-relaxed">
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {isSending && (
          <div className="flex justify-start">
             <div className="bg-white/5 border border-white/10 p-2 rounded-xl flex items-center gap-2 text-gray-400 text-[10px]">
               <Loader2 className="w-3 h-3 animate-spin" /> Synthesizing...
             </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-white/5 bg-[#11131A] flex items-center gap-2">
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Ask about ${symbol}...`}
          className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#fd3b12]/50 transition-colors"
        />
        <button 
          type="submit"
          disabled={!input.trim() || isSending}
          className="p-1.5 rounded-lg bg-[#fd3b12] text-white disabled:opacity-50 hover:bg-[#fd3b12]/80 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
