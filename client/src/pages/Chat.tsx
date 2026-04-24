import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ContextInspector from '../components/ContextInspector';

type Message = {
  id: string;
  sender: 'user' | 'bot';
  content: string;
  status?: 'typing' | 'done';
  tool_calls?: any[];
  metadata?: any;
};

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [currentConvId, setCurrentConvId] = useState<number | null>(null);
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [currentToolCalls, setCurrentToolCalls] = useState<any[]>([]);
  const [currentContext, setCurrentContext] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({ cpu: 0, ram: 0, npu: 15, latency: '0ms' });

  const ws = useRef<WebSocket | null>(null);
  const metricsWs = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // 1. Initial Auth Check
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
  }, [navigate]);

  // 2. WebSockets management
  useEffect(() => {
    // Main Agent WS
    const socket = new WebSocket('ws://localhost:8000/ws/agent');
    ws.current = socket;
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'token') {
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.sender === 'bot') {
            const updated = [...prev];
            updated[updated.length - 1] = { ...lastMsg, content: data.content, status: 'typing' };
            return updated;
          } else {
            return [...prev, { id: Date.now().toString(), sender: 'bot', content: data.content, status: 'typing' }];
          }
        });
      } else if (data.type === 'tool_call') {
        setCurrentToolCalls(data.tool_calls);
        setIsInspectorOpen(true);
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

    // Metrics WS
    const mSocket = new WebSocket('ws://localhost:8000/ws/metrics');
    metricsWs.current = mSocket;
    mSocket.onmessage = (event) => {
      setMetrics(JSON.parse(event.data));
    };

    return () => {
      socket.close();
      mSocket.close();
    };
  }, []);

  // 3. Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 4. Load Conversation History
  const loadConversation = async (id: number) => {
    setLoading(true);
    setCurrentConvId(id);
    setMessages([]);
    setCurrentContext([]);
    setCurrentToolCalls([]);

    try {
      const response = await fetch(`http://localhost:8000/api/conversations/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        const mappedMsgs: Message[] = data.messages.map((m: any) => ({
          id: m.id.toString(),
          sender: m.role === 'user' ? 'user' : 'bot',
          content: m.content,
          status: 'done'
        }));
        setMessages(mappedMsgs);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  // 5. Create New Conversation
  const handleNewChat = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/conversations/', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ title: `Session ${new Date().toLocaleTimeString()}` })
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentConvId(data.id);
        setMessages([]);
        // Force sidebar refresh would be better via state lift, 
        // but for now we'll just let the user see the new active ID
      }
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !connected || loading) return;

    if (!currentConvId) {
      // Auto-create conversation if none active
      handleNewChat().then(() => {
         // This is a bit racey, in real app we'd wait or buffer
      });
      // For now, alert or just return
      alert("Please select or create a workspace first.");
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setCurrentToolCalls([]);
    
    ws.current?.send(JSON.stringify({
      message: input,
      conversation_id: currentConvId
    }));
    
    setInput('');
  };

  return (
    <div className="flex h-screen bg-[#0F172A] text-slate-200 font-sans overflow-hidden">
      {/* Sidebar - The Shelf */}
      <Sidebar 
        currentConversationId={currentConvId} 
        onSelectConversation={loadConversation} 
        onNewChat={handleNewChat}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Circuit Pattern Overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/circuit-board.png')]"></div>
        
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 bg-white/5 backdrop-blur-md border-b border-white/10 z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">
              {currentConvId ? `Workspace_ID: ${currentConvId}` : 'No Workspace Selected'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsInspectorOpen(!isInspectorOpen)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                isInspectorOpen ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              Inspector
            </button>
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">{connected ? 'Live' : 'Off'}</span>
            </div>
            <button 
              onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}
              className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors"
              title="Logout"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide relative z-10">
          {!currentConvId && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mb-8 border border-white/10 rotate-12 hover:rotate-0 transition-transform duration-500 shadow-2xl">
                <svg className="w-12 h-12 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-3xl font-black text-white mb-4 tracking-tighter">INITIALIZE_NEURAL_LINK</h2>
              <p className="max-w-sm text-slate-500 text-sm leading-relaxed">Select a previous session from the shelf or create a new workspace to begin agentic execution.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[85%] px-5 py-3 rounded-2xl shadow-2xl ${
                msg.sender === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-none backdrop-blur-sm'
              }`}>
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                {msg.status === 'typing' && (
                  <div className="mt-2 flex gap-1">
                    <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </main>

        {/* Input Area */}
        <footer className="p-6 bg-gradient-to-t from-[#0F172A] to-transparent z-20">
          <form onSubmit={handleSend} className="max-w-4xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
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
                placeholder={currentConvId ? "Input command or objective..." : "Select workspace to start..."}
                disabled={!currentConvId}
                className="flex-1 bg-transparent border-none focus:ring-0 px-6 py-4 text-sm text-slate-200 placeholder:text-slate-600 resize-none h-14 max-h-40"
                rows={1}
              />
              <button
                type="submit"
                disabled={loading || !input.trim() || !currentConvId}
                className={`mr-3 p-2.5 rounded-xl transition-all ${
                  loading || !input.trim() || !currentConvId
                    ? 'text-slate-700' 
                    : 'text-white bg-indigo-600 shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="mt-3 flex justify-center gap-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
              <span className={metrics.cpu > 80 ? 'text-red-400' : ''}>CPU: {Math.round(metrics.cpu)}%</span>
              <span>•</span>
              <span className={metrics.ram > 80 ? 'text-red-400' : ''}>RAM: {Math.round(metrics.ram)}%</span>
              <span>•</span>
              <span className="text-indigo-400">LATENCY: {metrics.latency}</span>
              <span>•</span>
              <span>MOD: {metrics.model}</span>
            </div>
          </form>
        </footer>
      </div>

      {/* Context Inspector - The Grounding Panel */}
      <ContextInspector 
        isOpen={isInspectorOpen} 
        onClose={() => setIsInspectorOpen(false)} 
        toolCalls={currentToolCalls}
        contextData={currentContext}
      />
    </div>
  );
};

export default Chat;
