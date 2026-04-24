import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';

type Message = {
  id: string;
  sender: 'user' | 'bot';
  content: string;
  status?: 'typing' | 'done';
  tool_calls?: any[];
};

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Initialize WebSocket
    const socket = new WebSocket('ws://localhost:8000/ws/agent');
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      console.log('WS Connected');
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'token') {
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.sender === 'bot') {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...lastMsg,
              content: lastMsg.content + data.content,
              status: 'typing'
            };
            return updated;
          } else {
            return [...prev, { 
              id: Date.now().toString(), 
              sender: 'bot', 
              content: data.content,
              status: 'typing'
            }];
          }
        });
      } else if (data.type === 'tool_call') {
        setMessages(prev => [
          ...prev, 
          { 
            id: 'tool-' + Date.now(), 
            sender: 'bot', 
            content: `🔧 Using tool: **${data.tool_calls[0].name}**...`,
            status: 'done' 
          }
        ]);
      } else if (data.type === 'done') {
        setLoading(false);
        setMessages(prev => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1].sender === 'bot') {
            updated[updated.length - 1].status = 'done';
          }
          return updated;
        });
      } else if (data.type === 'error') {
        setMessages(prev => [...prev, { id: 'err-' + Date.now(), sender: 'bot', content: '❌ Error: ' + data.message }]);
        setLoading(false);
      }
    };

    socket.onclose = () => setConnected(false);

    return () => {
      socket.close();
    };
  }, [navigate]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !connected || loading) return;

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    
    ws.current?.send(JSON.stringify({
      message: input,
      conversation_id: "default"
    }));
    
    setInput('');
  };

  return (
    <div className="flex flex-col h-screen bg-[#0F172A] text-slate-200 font-sans">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 bg-white/5 backdrop-blur-md border-b border-white/10 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-lg shadow-lg shadow-indigo-500/20"></div>
          <span className="text-xl font-bold tracking-tight text-white">AICodex <span className="text-xs font-normal text-slate-500 ml-1">v0.1.0</span></span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-xs font-medium text-emerald-400">{connected ? 'Live' : 'Disconnected'}</span>
          </div>
          <button 
            onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
            <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-white/10">
              <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">How can I help you today?</h2>
            <p className="max-w-md text-slate-400">AICodex can help you browse files, execute code, search GitHub, and query your local knowledge base.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-5 py-3 rounded-2xl ${
              msg.sender === 'user' 
                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/20 rounded-tr-none' 
                : 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-none backdrop-blur-sm'
            }`}>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
              {msg.status === 'typing' && (
                <div className="mt-2 flex gap-1">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </main>

      {/* Input Area */}
      <footer className="p-6 bg-gradient-to-t from-[#0F172A] via-[#0F172A] to-transparent">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition-opacity"></div>
          <div className="relative flex items-center bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Ask anything or use /skill..."
              className="flex-1 bg-transparent border-none focus:ring-0 px-5 py-4 text-slate-200 placeholder:text-slate-500 resize-none h-14 max-h-40"
              rows={1}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className={`mr-3 p-2 rounded-xl transition-all ${
                loading || !input.trim() 
                  ? 'text-slate-600' 
                  : 'text-white bg-gradient-to-r from-indigo-600 to-cyan-600 shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          </div>
          <div className="mt-3 flex justify-center gap-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
            <span>RAG Active</span>
            <span>•</span>
            <span>4 Skills Loaded</span>
            <span>•</span>
            <span>Ollama Llama 3.2</span>
          </div>
        </form>
      </footer>
    </div>
  );
};

export default Chat;
