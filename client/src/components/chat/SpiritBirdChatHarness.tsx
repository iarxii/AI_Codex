import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, Sparkles, Calendar, BookOpen, Smile } from 'lucide-react';
import { useAI } from '../../contexts/AIContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getApiUrl } from '../../config';

export const SpiritBirdChatHarness: React.FC = () => {
  const { provider, model, getApiKey } = useAI();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>(() => {
    const saved = localStorage.getItem('spirit_bird_harness_chat');
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [
      {
        role: 'assistant',
        content: "Hello! I am **Spirit Bird**, your agentic mascot. 🐦\n\nI am here in the SpiritBook to help you organize your daily goals, coordinate professional habits, or just chat during a well-deserved mental break. How can I assist you today?"
      }
    ];
  });
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('spirit_bird_harness_chat', JSON.stringify(messages));
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const sendPrompt = async (promptText: string) => {
    if (!promptText.trim() || isSending) return;
    setIsSending(true);
    setMessages(prev => [...prev, { role: 'user', content: promptText }]);

    try {
      const systemContext = `You are Spirit Bird, the friendly and supportive agentic mascot of the AI Codex workspace. Your goal is to help the user casually yet professionally. Assist with organization, productivity, mental health breaks, habit building, and general professional feedback. Keep your tone encouraging, professional, structured, and helpful. You must remain a restrained assistant (no financial advice, keep responses relatively brief, clear, and highly readable). Always maintain professional boundaries.`;
      
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
          message: promptText,
          provider: provider,
          model: model,
          api_key: getApiKey(provider)
        })
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.reply || data.response || "I couldn't connect. Please check your neural core config.";
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      } else {
        // Fallback simulated response
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "I'm offline but standing by! Let's focus on setting up a clean 30-minute block for coding, followed by a 5-minute stretch. Keep pushing forward! 🚀"
        }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Connection paused. Remember to step away from the keyboard for a moment, hydrate, and align your priorities. I'll be here when you return!" 
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;
    const userMsg = input;
    setInput('');
    sendPrompt(userMsg);
  };

  const handleQuickAction = (action: string) => {
    sendPrompt(action);
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-[#0D0F16] min-h-0 select-none">
      
      {/* QUICK SUGGESTIONS DRAWER */}
      <div className="p-3 border-b border-white/5 bg-[#10131E]/60 space-y-1.5 shrink-0 text-left">
        <span className="text-[8px] font-black uppercase text-gray-500 tracking-wider font-mono">Suggested Activities</span>
        <div className="flex flex-wrap gap-1.5">
          <button 
            onClick={() => handleQuickAction("Generate a quick professional schedule block for today to balance deep work and learning.")}
            className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-[9px] font-bold border border-white/5 transition-colors cursor-pointer"
          >
            <Calendar className="w-2.5 h-2.5 text-purple-400" /> Plan Work Blocks
          </button>
          <button 
            onClick={() => handleQuickAction("Guide me through a 2-minute mindful mental break for focus alignment.")}
            className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-[9px] font-bold border border-white/5 transition-colors cursor-pointer"
          >
            <Smile className="w-2.5 h-2.5 text-emerald-400" /> Mental Break
          </button>
          <button 
            onClick={() => handleQuickAction("Review my project goals and help me design 3 actionable daily habits.")}
            className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-[9px] font-bold border border-white/5 transition-colors cursor-pointer"
          >
            <BookOpen className="w-2.5 h-2.5 text-amber-400" /> Target Habits
          </button>
        </div>
      </div>

      {/* CHAT VIEWPORT */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide text-xs"
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl ${msg.role === 'user' ? 'bg-[#6366f1]/20 text-[#a5b4fc] border border-[#6366f1]/30' : 'bg-white/5 text-gray-300 border border-white/10'}`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1.5 text-[9px] font-black uppercase text-[#6366f1]">
                  <Bot className="w-3.5 h-3.5" /> Spirit Bird
                </div>
              )}
              <div className="prose prose-invert prose-sm max-w-none text-[11px] leading-relaxed font-sans text-left space-y-1">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
             <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl flex items-center gap-2 text-gray-400 text-[10px]">
               <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6366f1]" /> Spirit Bird is typing...
             </div>
          </div>
        )}
      </div>

      {/* RESET BUTTON */}
      <div className="px-4 py-1 text-right shrink-0">
        <button 
          onClick={() => {
            if (confirm("Clear chat history?")) {
              setMessages([
                {
                  role: 'assistant',
                  content: "Hello! I am **Spirit Bird**, your agentic mascot. 🐦\n\nI am here in the SpiritBook to help you organize your daily goals, coordinate professional habits, or just chat during a well-deserved mental break. How can I assist you today?"
                }
              ]);
            }
          }}
          className="text-[8px] font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 opacity-60 hover:opacity-100 transition-all cursor-pointer"
        >
          Clear History
        </button>
      </div>

      {/* INPUT FORM */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-white/5 bg-[#11131A] flex items-center gap-2 shrink-0">
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask Spirit Bird for support or structure..."
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#6366f1]/50 transition-colors"
        />
        <button 
          type="submit"
          disabled={!input.trim() || isSending}
          className="p-2 rounded-xl bg-[#6366f1] text-white disabled:opacity-50 hover:bg-[#6366f1]/80 transition-colors cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
