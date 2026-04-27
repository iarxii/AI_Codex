// Chat.tsx — AICodex Agentic Chat Interface (v2 - Light Gray + AdaptivOrange)
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ContextInspector from '../components/ContextInspector';
import AgentCanvas from '../components/AgentCanvas';
import SettingsModal from '../components/SettingsModal';
import { PROVIDER_MAP, getActiveProvider, getActiveProviderInfo } from '../components/providerMeta';
import OllamaLogo from '../assets/ai_online_services/ollama-color.svg';
import GeminiLogo from '../assets/ai_online_services/gemini-color.svg';
import ProviderSelector from '../components/ProviderSelector';
import { useAI, type ProviderId } from '../contexts/AIContext';
import P5Loader from '../components/P5Loader';
import MetricsChart from '../components/MetricsChart';
import WorkspaceOnboardingModal from '../components/WorkspaceOnboardingModal';
import { ChevronUpIcon, ChevronDownIcon, ChartBarIcon } from '@heroicons/react/24/outline';

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
  
  type ThoughtLogEntry = { text: string; timestamp: number; details?: string; type?: string; };
  const [thoughtLog, setThoughtLog] = useState<ThoughtLogEntry[]>([]);
  const [thoughtStartTime, setThoughtStartTime] = useState<number | null>(null);

  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [metrics, setMetrics] = useState<any>({ cpu: 0, ram: 0, npu: 0, igpu: 0, latency: '0ms' });
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);
  const [isChartExpanded, setIsChartExpanded] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  
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
        
        setThoughtLog(prev => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          const lastLog = { ...updated[updated.length - 1] };
          if (lastLog.text.includes('reason')) {
            const thinkMatch = data.content.match(/<think>([\s\S]*?)(<\/think>|$)/);
            if (thinkMatch) {
              lastLog.details = thinkMatch[1].trim();
            } else if (data.content.length > 0) {
              lastLog.details = data.content.length > 500 ? '...' + data.content.substring(data.content.length - 500) : data.content;
            }
          }
          updated[updated.length - 1] = lastLog;
          return updated;
        });
      } else if (data.type === 'status') {
        setThoughtLog(prev => [...prev, { text: data.status, timestamp: Date.now(), type: data.node }]);
      } else if (data.type === 'tool_call') {
        setCurrentToolCalls(data.tool_calls);
        setThoughtLog(prev => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          const lastLog = { ...updated[updated.length - 1] };
          lastLog.details = JSON.stringify(data.tool_calls, null, 2);
          updated[updated.length - 1] = lastLog;
          return updated;
        });
      } else if (data.type === 'tool_result') {
        setCurrentToolCalls(prev => prev.map(tc => 
          tc.id === data.tool_call_id ? { ...tc, result: data.content } : tc
        ));
        setThoughtLog(prev => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          const lastLog = { ...updated[updated.length - 1] };
          const resText = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
          lastLog.details = (lastLog.details ? lastLog.details + '\n\n' : '') + `Result:\n${resText}`;
          updated[updated.length - 1] = lastLog;
          return updated;
        });
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

    const mSocket = new WebSocket('ws://127.0.0.1:8000/api/metrics/ws/metrics');
    metricsWs.current = mSocket;
    mSocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMetrics(data);
      
      setMetricsHistory(prev => {
        const newEntry = {
          time: new Date().toLocaleTimeString(),
          cpu: data.cpu,
          ram: data.ram,
          igpu: data.igpu || 0,
          npu: data.npu || 0,
          latency: parseInt(data.latency) || 0
        };
        const updated = [...prev, newEntry];
        return updated.slice(-50); // Keep last 50 points
      });
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
    setThoughtStartTime(Date.now());
    setThoughtLog([]);
    
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
    <div className="flex h-screen bg-transparent text-[#1A1D2E] font-[Poppins] overflow-hidden relative">
      {/* Semi-transparent overlay to ensure readability while showing P5 */}
      <div className="absolute inset-0 bg-[#C8CDD5]/30 pointer-events-none -z-10"></div>
      {/* Sidebar */}
      <Sidebar 
        currentConversationId={currentConvId} 
        onSelectConversation={loadConversation} 
        onNewChat={handleNewChat}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* P5Background is now global in App.tsx */}
        
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-5 bg-[#D8DCE4]/60 backdrop-blur-xl border-b border-black/[0.06] z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { if (currentConvId) setIsOnboardingOpen(true); }}
              className="text-left group/card hover:bg-black/5 p-1.5 -ml-1.5 rounded-lg transition-colors"
            >
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#4A4D5E] group-hover/card:text-[#FF6600] flex items-center gap-2">
                {currentConvId ? `Workspace #${currentConvId}` : 'No Workspace'}
                {currentConvId && (
                  <span className="opacity-0 group-hover/card:opacity-100 text-[9px] font-bold tracking-widest bg-[#FF6600]/10 text-[#FF6600] px-1.5 py-0.5 rounded transition-opacity">
                    PROFILE
                  </span>
                )}
              </h2>
            </button>
          </div>
          <div className="flex items-center gap-3">
            {/* Canvas Toggle */}
            <button 
              onClick={() => setIsCanvasOpen(!isCanvasOpen)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                isCanvasOpen 
                  ? 'bg-[#FF6600]/10 border-[#FF6600]/30 text-[#FF6600]' 
                  : 'bg-black/[0.04] border-black/[0.08] text-[#4A4D5E] hover:text-[#1A1D2E] hover:border-black/[0.15]'
              }`}
            >
              Canvas
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
                {activeProviderInfo.label} API
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
          {!currentConvId && (() => {
            const config = {
              local: { label: 'Neural Core', icon: '/media/brand-icons/ollama-color.svg', desc: 'Execute models directly on your hardware for maximum privacy and low latency.' },
              groq: { label: 'Linked Velocity', icon: '/media/brand-icons/white-grok-logo_svgstack_com_37181777229567.svg', desc: 'Harness LPU technology for lightning-fast inference and real-time agentic reasoning.' },
              openrouter: { label: 'Omni Interface', icon: '/media/brand-icons/openrouter.webp', desc: 'Unified gateway to the world\'s most powerful LLMs and specialist expert models.' },
              gemini: { label: 'Expert Reasoning', icon: '/media/brand-icons/gemini-logo_svgstack_com_37141777229654.svg', desc: 'Leverage Google\'s most capable multimodal models for complex problem solving.' }
            }[activeProvider as ProviderId] || { label: 'Neural Link', icon: null, desc: 'Select a session from the shelf or create a new workspace to begin agentic execution.' };

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
                          <div className="mt-3 flex items-center gap-2">
                            <P5Loader />
                            <span className="text-[10px] font-bold text-[#FF6600]/60 uppercase tracking-widest animate-pulse">Synthesizing...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Thinking Process — Appear BELOW the user message but ABOVE the bot message if possible */}
                  {/* Or specifically below the last user message when loading */}
                  {isLastUserMsg && (loading || thoughtLog.length > 0) && (thoughtLog.length > 0 || currentToolCalls.length > 0 || currentContext.length > 0) && (
                    <div className="flex justify-start pl-4 animate-in fade-in zoom-in-95 duration-300">
                      <div className="bg-[#D8DCE4]/40 backdrop-blur-sm border border-[#FF6600]/40 p-4 rounded-xl max-w-2xl w-full shadow-sm shadow-[#FF6600]/5">
                        <details open={loading} className="group">
                          <summary className="flex items-center justify-between cursor-pointer list-none select-none">
                            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#FF6600]">
                              {loading && <P5Loader />}
                              Thinking Process
                              {!loading && thoughtStartTime && thoughtLog.length > 0 && (
                                <span className="text-[#7A7D8E] lowercase font-mono">
                                  ({(() => {
                                    const totalSecs = (thoughtLog[thoughtLog.length - 1].timestamp - thoughtStartTime) / 1000;
                                    if (totalSecs < 60) return `${totalSecs.toFixed(2)}s`;
                                    const m = Math.floor(totalSecs / 60);
                                    const s = Math.floor(totalSecs % 60);
                                    return `${m}m ${s}s`;
                                  })()})
                                </span>
                              )}
                            </div>
                            <div className="text-[#7A7D8E] group-open:rotate-180 transition-transform">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                          </summary>
                          <div className="mt-4 space-y-2 pl-5 border-l-2 border-[#FF6600]/20">
                            {thoughtLog.map((log, i) => {
                              const prevTime = i === 0 ? thoughtStartTime! : thoughtLog[i - 1].timestamp;
                              const delta = ((log.timestamp - prevTime) / 1000).toFixed(2);
                              return (
                                <div key={i} className="group/item">
                                  {log.details ? (
                                    <details className="group/details">
                                      <summary className="text-[11px] font-mono text-[#4A4D5E] flex gap-3 cursor-pointer list-none hover:bg-white/40 p-1 rounded transition-colors">
                                        <span className="text-[#FF6600] opacity-40 font-bold">[{i + 1}]</span>
                                        <span className="group-hover/item:text-[#1A1D2E] transition-colors flex-1 flex items-center gap-2">
                                          {log.text}
                                          <ChevronDownIcon className="w-3 h-3 opacity-50 group-open/details:rotate-180 transition-transform" />
                                        </span>
                                        <span className="text-[#7A7D8E] opacity-50 group-hover/item:opacity-100 transition-opacity text-[9px] w-8 text-right mt-0.5">
                                          {delta}s
                                        </span>
                                      </summary>
                                      <div className="mt-2 ml-7 mb-2 pl-3 border-l border-[#FF6600]/20 text-[10px] font-mono text-[#7A7D8E] whitespace-pre-wrap max-h-60 overflow-y-auto bg-white/30 rounded p-2">
                                        {log.details}
                                      </div>
                                    </details>
                                  ) : (
                                    <div className="text-[11px] font-mono text-[#4A4D5E] flex gap-3 p-1">
                                      <span className="text-[#FF6600] opacity-40 font-bold">[{i + 1}]</span>
                                      <span className="group-hover/item:text-[#1A1D2E] transition-colors flex-1">{log.text}</span>
                                      <span className="text-[#7A7D8E] opacity-50 group-hover/item:opacity-100 transition-opacity text-[9px] w-8 text-right mt-0.5">
                                        {delta}s
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Inline Context Inspector */}
                            <ContextInspector 
                              toolCalls={currentToolCalls}
                              contextData={currentContext}
                            />
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
        <footer className="px-6 pb-5 pt-3 bg-transparent border-t border-black/[0.04] z-20">
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

            {/* Enhanced Metrics Strip */}
            <div className="mt-4 flex flex-col items-center">
              <div className="flex items-center gap-4 bg-white/80 backdrop-blur-md border border-black/[0.04] rounded-full px-5 py-1.5 shadow-sm transition-all hover:shadow-md hover:bg-white/95">
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-[#4A4D5E] font-bold">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FF6600]" />
                    <span className={metrics.cpu > 80 ? 'text-red-500' : ''}>CPU {Math.round(metrics.cpu)}%</span>
                  </div>
                  <span className="text-black/10">|</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#4A4D5E]" />
                    <span className={metrics.ram > 80 ? 'text-red-500' : ''}>RAM {Math.round(metrics.ram)}%</span>
                  </div>
                  <span className="text-black/10">|</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />
                    <span className={metrics.igpu > 80 ? 'text-red-500' : ''}>GPU {Math.round(metrics.igpu || 0)}%</span>
                  </div>
                  <span className="text-black/10">|</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                    <span className={metrics.npu > 80 ? 'text-red-500' : ''}>NPU {Math.round(metrics.npu || 0)}%</span>
                  </div>
                  <span className="text-black/10">|</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                    <span className="text-[#10B981]">LAT {metrics.latency}</span>
                  </div>
                </div>

                <div className="w-px h-3 bg-black/10 mx-1" />

                <button
                  type="button"
                  onClick={() => setIsChartExpanded(!isChartExpanded)}
                  className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full transition-all border ${
                    isChartExpanded 
                      ? 'bg-[#FF6600] border-[#FF6600] text-white' 
                      : 'border-black/[0.08] text-[#7A7D8E] hover:border-[#FF6600] hover:text-[#FF6600]'
                  }`}
                >
                  <ChartBarIcon className="w-3 h-3" />
                  {isChartExpanded ? 'Collapse' : 'Stats'}
                </button>
              </div>

              {/* Real-time Hardware Chart */}
              {isChartExpanded && (
                <div className="w-full max-w-2xl px-4 overflow-hidden">
                  <MetricsChart data={metricsHistory} />
                </div>
              )}
            </div>
          </form>
        </footer>
      </div>

      {/* Agent Canvas Drawer */}
      <AgentCanvas 
        isOpen={isCanvasOpen} 
        onClose={() => setIsCanvasOpen(false)} 
      />

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} setIsOpen={setIsSettingsOpen} />

      {/* Onboarding Modal */}
      <WorkspaceOnboardingModal 
        isOpen={isOnboardingOpen} 
        setIsOpen={setIsOnboardingOpen} 
        onSubmit={({ profile, goals }) => {
          const initPrompt = `WORKSPACE INITIALIZATION:\n\nProfile Context:\n${profile}\n\nProject Goals:\n${goals}\n\nPlease acknowledge these goals and outline your initial execution plan.`;
          setInput(initPrompt);
          // Small delay to allow react state to update before submit
          setTimeout(() => {
            const form = document.querySelector('form');
            if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }, 100);
        }}
      />
    </div>
  );
};

export default Chat;
