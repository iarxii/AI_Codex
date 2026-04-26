// Chat.tsx — AICodex Agentic Chat Interface (v2 - Light Gray + AdaptivOrange)
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ContextInspector from '../components/ContextInspector';
import SettingsModal from '../components/SettingsModal';
import { PROVIDER_MAP, getActiveProvider, getActiveProviderInfo } from '../components/providerMeta';
import OllamaLogo from '../assets/ai_online_services/ollama-color.svg';
import GeminiLogo from '../assets/ai_online_services/gemini-color.svg';
import ProviderSelector from '../components/ProviderSelector';
import { useAI } from '../contexts/AIContext';

type Message = {
  id: string;
  sender: 'user' | 'bot';
  content: string;
  status?: 'typing' | 'done';
  tool_calls?: any[];
  metadata?: any;
};

/** Inline provider icons for the header badge */
const ProviderBadgeIcon: React.FC<{ providerId: string }> = ({ providerId }) => {
  switch (providerId) {
    case 'local':
      return <img src={OllamaLogo} alt="Ollama" className="w-4 h-4" />;
    case 'groq':
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#FF6600" />
        </svg>
      );
    case 'openrouter':
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#06B6D4" strokeWidth="1.5"/>
          <path d="M2 12h20M12 2c-3 3-4.5 6-4.5 10s1.5 7 4.5 10c3-3 4.5-6 4.5-10S15 5 12 2z" stroke="#06B6D4" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      );
    case 'gemini':
      return <img src={GeminiLogo} alt="Gemini" className="w-4 h-4" />;
    default:
      return <span className="text-xs">🤖</span>;
  }
};

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [currentLatency, setCurrentLatency] = useState<number | null>(null);
  const [currentConvId, setCurrentConvId] = useState<number | null>(null);
  
  // UI State
  const [currentToolCalls, setCurrentToolCalls] = useState<any[]>([]);
  const [currentContext, setCurrentContext] = useState<any[]>([]);
  const [thoughtLog, setThoughtLog] = useState<string[]>([]);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [metrics, setMetrics] = useState<any>({ cpu: 0, ram: 0, npu: 15, latency: '0ms' });
  
  // Global AI State
  const { provider: activeProvider, model: activeModel, getApiKey } = useAI();
  const activeProviderInfo = PROVIDER_MAP[activeProvider] || PROVIDER_MAP['local'];

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
  const [reconnectCount, setReconnectCount] = useState(0);

  useEffect(() => {
    console.log('Connecting WebSocket...');
    const socket = new WebSocket('ws://127.0.0.1:8000/api/chat/ws/agent');
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      setReconnectCount(0);
    };

    socket.onclose = () => {
      setConnected(false);
      setLoading(false); // Reset loading on disconnect
      // Simple reconnect with backoff
      if (reconnectCount < 5) {
        setTimeout(() => {
          setReconnectCount(prev => prev + 1);
        }, Math.pow(2, reconnectCount) * 1000);
      }
    };

    socket.onerror = () => {
      setConnected(false);
      setLoading(false);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'token') {
        setThoughtLog([]); // Clear thinking process when bot starts talking
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.sender === 'bot') {
            const updated = [...prev];
            updated[updated.length - 1] = { ...lastMsg, content: data.content, status: 'typing' };
            if (data.duration) setCurrentLatency(data.duration);
            return updated;
          } else {
            if (data.duration) setCurrentLatency(data.duration);
            return [...prev, { id: Date.now().toString(), sender: 'bot', content: data.content, status: 'typing' }];
          }
        });
      } else if (data.type === 'status') {
        setThoughtLog(prev => [...prev, data.status]);
      } else if (data.type === 'tool_call') {
        setCurrentToolCalls(data.tool_calls);
        setIsInspectorOpen(true);
      } else if (data.type === 'tool_result') {
        setCurrentToolCalls(prev => prev.map(tc => 
          tc.id === data.tool_call_id ? { ...tc, result: data.content } : tc
        ));
      } else if (data.type === 'done') {
        setLoading(false);
        setThoughtLog([]);
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

    const mSocket = new WebSocket('ws://127.0.0.1:8000/api/metrics/ws/metrics');
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
        setCurrentLatency(null);
      }
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !connected || loading) return;

    if (!currentConvId) {
      handleNewChat().then(() => {});
      alert("Please select or create a workspace first.");
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setCurrentToolCalls([]);
    
    const apiKey = getApiKey(activeProvider) || '';

    try {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
        throw new Error('Neural link disconnected. Please refresh or check connection.');
      }

      ws.current.send(JSON.stringify({
        message: input,
        conversation_id: currentConvId,
        provider: activeProvider,
        model: activeModel,
        api_key: apiKey
      }));
      
      setInput(''); // Clear input immediately
    } catch (err: any) {
      console.error('Send error:', err);
      setMessages(prev => [...prev, { 
        id: 'err-' + Date.now(), 
        sender: 'bot', 
        content: `❌ Send Failed: ${err.message}` 
      }]);
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#C8CDD5] text-[#1A1D2E] font-[Poppins] overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        currentConversationId={currentConvId} 
        onSelectConversation={loadConversation} 
        onNewChat={handleNewChat}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Subtle circuit-trace overlay */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/circuit-board.png')]"></div>
        
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-5 bg-[#D8DCE4]/80 backdrop-blur-md border-b border-black/[0.06] z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#4A4D5E]">
              {currentConvId ? `Workspace #${currentConvId}` : 'No Workspace'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Inspector Toggle */}
            <button 
              onClick={() => setIsInspectorOpen(!isInspectorOpen)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                isInspectorOpen 
                  ? 'bg-[#FF6600]/10 border-[#FF6600]/30 text-[#FF6600]' 
                  : 'bg-black/[0.04] border-black/[0.08] text-[#4A4D5E] hover:text-[#1A1D2E] hover:border-black/[0.15]'
              }`}
            >
              Inspector
            </button>

            {/* Provider Badge — clickable, opens SettingsModal */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                connected
                  ? 'bg-[#FF6600]/10 border-[#FF6600]/25 hover:bg-[#FF6600]/20 hover:border-[#FF6600]/40'
                  : 'bg-red-100 border-red-300'
              }`}
              title={`Provider: ${activeProviderInfo.label} — Click to change`}
            >
              <ProviderBadgeIcon providerId={activeProvider} />
              <span className={`text-[10px] font-bold uppercase tracking-tight ${
                connected ? 'text-[#FF6600]' : 'text-red-600'
              }`}>
                {activeProviderInfo.label}
              </span>
              <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            </button>

            {/* Latency */}
            {currentLatency && (
              <div className="flex items-center gap-2 px-3 py-1 bg-black/[0.04] rounded-full border border-black/[0.06]">
                <span className="text-[10px] font-semibold text-[#4A4D5E] uppercase tracking-tight">
                  {currentLatency.toFixed(2)}s
                </span>
              </div>
            )}

            {/* Logout */}
            <button 
              onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}
              className="p-2 hover:bg-black/[0.06] rounded-lg text-[#7A7D8E] hover:text-[#1A1D2E] transition-colors"
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
              <div className="w-20 h-20 bg-[var(--accent-light)] rounded-2xl flex items-center justify-center mb-6 border border-[var(--border-accent)] rotate-6 hover:rotate-0 transition-transform duration-500 shadow-lg">
                <svg className="w-10 h-10 text-[#FF6600]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-3 tracking-tight">Initialize Neural Link</h2>
              <p className="max-w-sm text-[var(--text-secondary)] text-sm leading-relaxed">Select a session from the shelf or create a new workspace to begin agentic execution.</p>
            </div>
          )}

          {/* Message List */}
          <div className="space-y-6">
            {messages.map((msg, index) => {
              const isUser = msg.sender === 'user';
              const isError = msg.content.startsWith('❌ Error:');
              
              // Anchor the thinking process to the LAST user message only if loading
              const lastUserIndex = [...messages].reverse().findIndex(m => m.sender === 'user');
              const isLastUserMsg = lastUserIndex !== -1 && index === (messages.length - 1 - lastUserIndex);

              return (
                <div key={msg.id} className="space-y-4">
                  {isError ? (
                    <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
                      <div className="bg-[var(--bg-surface)] border-l-4 border-red-500 p-4 rounded-xl rounded-tl-none shadow-sm max-w-3xl flex gap-4">
                        <div className="text-red-500 shrink-0 mt-0.5">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="text-xs text-[var(--text-primary)] leading-relaxed font-medium">
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
                          <div className="flex gap-1 mt-3">
                            <div className="w-1.5 h-1.5 bg-[#FF6600] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-1.5 h-1.5 bg-[#FF6600] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-1.5 h-1.5 bg-[#FF6600] rounded-full animate-bounce"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Thinking Process — Appear BELOW the user message but ABOVE the bot message if possible */}
                  {/* Or specifically below the last user message when loading */}
                  {isLastUserMsg && loading && thoughtLog.length > 0 && (
                    <div className="flex justify-start pl-4 animate-in fade-in zoom-in-95 duration-300">
                      <div className="bg-[#D8DCE4]/40 backdrop-blur-sm border border-black/[0.05] p-4 rounded-xl max-w-2xl w-full">
                        <details open className="group">
                          <summary className="flex items-center justify-between cursor-pointer list-none select-none">
                            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#FF6600]">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#FF6600] animate-pulse shadow-[0_0_8px_#FF6600]"></div>
                              Thinking Process
                            </div>
                            <div className="text-[#7A7D8E] group-open:rotate-180 transition-transform">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                          </summary>
                          <div className="mt-4 space-y-2 pl-5 border-l-2 border-[#FF6600]/20">
                            {thoughtLog.map((log, i) => (
                              <div key={i} className="text-[11px] font-mono text-[#4A4D5E] flex gap-3 group/item">
                                <span className="text-[#FF6600] opacity-40 font-bold">[{i + 1}]</span>
                                <span className="group-hover/item:text-[#1A1D2E] transition-colors">{log}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div ref={scrollRef} />
        </main>

        {/* Input Area — Enriched */}
        <footer className="px-6 pb-5 pt-3 bg-[#C8CDD5] border-t border-black/[0.04] z-20">
          <div className="max-w-4xl mx-auto mb-3">
            <ProviderSelector />
          </div>
          <form onSubmit={handleSend} className="max-w-4xl mx-auto">
            {/* Main Input Container */}
            <div className="relative bg-[#E2E6EC] border border-black/[0.08] rounded-2xl overflow-hidden shadow-md transition-all focus-within:border-[#FF6600]/40 focus-within:shadow-lg focus-within:shadow-[#FF6600]/5">
              {/* Function Buttons Row */}
              <div className="flex items-center gap-1 px-3 pt-2.5 pb-0">
                {/* Attachments */}
                <button
                  type="button"
                  onClick={() => alert('File attachments — coming soon!')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#4A4D5E] hover:text-[#1A1D2E] hover:bg-black/[0.05] transition-all"
                  title="Attach files"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  Attach
                </button>

                {/* Tools */}
                <button
                  type="button"
                  onClick={() => alert('Tools selector — coming soon!')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#4A4D5E] hover:text-[#1A1D2E] hover:bg-black/[0.05] transition-all"
                  title="Select tools"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Tools
                  <svg className="w-2.5 h-2.5 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Agent Mode */}
                <button
                  type="button"
                  onClick={() => alert('Agent mode — coming soon!')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#4A4D5E] hover:text-[#FF6600] hover:bg-[#FF6600]/8 transition-all"
                  title="Toggle agent mode"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Agent
                </button>

                <div className="flex-1" />
              </div>

              {/* Textarea + Send Row */}
              <div className="flex items-end gap-3 px-3 pb-3 pt-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                  placeholder={currentConvId ? "What would you like to build today?" : "Select a workspace to begin..."}
                  disabled={!currentConvId}
                  className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none px-2 py-2 text-sm text-[#1A1D2E] placeholder:text-[#7A7D8E] resize-none min-h-[44px] max-h-[160px]"
                  rows={1}
                />
                {/* Send Button — Prominent Round Orange */}
                <button
                  type="submit"
                  disabled={loading || !input.trim() || !currentConvId}
                  className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    loading || !input.trim() || !currentConvId
                      ? 'bg-[#BFC4CC] text-[#7A7D8E] cursor-not-allowed' 
                      : 'bg-[#FF6600] text-white hover:bg-[#E65C00] shadow-lg shadow-[#FF6600]/30 hover:shadow-[#FF6600]/50 active:scale-95'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Metrics Strip */}
            <div className="mt-2.5 flex justify-center gap-4 text-[10px] uppercase tracking-widest text-[#7A7D8E] font-medium">
              <span className={metrics.cpu > 80 ? 'text-red-500' : ''}>CPU: {Math.round(metrics.cpu)}%</span>
              <span className="text-[#BFC4CC]">•</span>
              <span className={metrics.ram > 80 ? 'text-red-500' : ''}>RAM: {Math.round(metrics.ram)}%</span>
              <span className="text-[#BFC4CC]">•</span>
              <span className="text-[#FF6600]/70">LATENCY: {metrics.latency}</span>
              <span className="text-[#BFC4CC]">•</span>
              <span>MOD: {metrics.model}</span>
            </div>
          </form>
        </footer>
      </div>

      {/* Context Inspector */}
      <ContextInspector 
        isOpen={isInspectorOpen} 
        onClose={() => setIsInspectorOpen(false)} 
        toolCalls={currentToolCalls}
        contextData={currentContext}
      />

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} setIsOpen={setIsSettingsOpen} />
    </div>
  );
};

export default Chat;
