// Chat.tsx — AICodex Agentic Chat Interface (Modularized v3)
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import AgentCanvas from '../components/AgentCanvas';
import SettingsModal from '../components/SettingsModal';
import { PROVIDER_MAP } from '../components/providerMeta';
import { useAI } from '../contexts/AIContext';
import { config } from '../config';
import WorkspaceOnboardingModal from '../components/WorkspaceOnboardingModal';

// Modular Components
import ChatHeader from '../components/chat/ChatHeader';
import MessageList from '../components/chat/MessageList';
import ChatInput from '../components/chat/ChatInput';
import MetricsStrip from '../components/chat/MetricsStrip';

// Types
import type { Message, ThoughtLogEntry } from '../types/chat';

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
  const [thoughtLog, setThoughtLog] = useState<ThoughtLogEntry[]>([]);
  const [thoughtStartTime, setThoughtStartTime] = useState<number | null>(null);

  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isProcessing = useRef(false);
  const [metrics, setMetrics] = useState<any>({ cpu: 0, ram: 0, npu: 0, npu_available: false, igpu: 0, igpu_available: false, latency: '0ms' });
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
    const token = localStorage.getItem('token');
    const socket = new WebSocket(`${config.WS_BASE_URL}${config.API_V1_STR}/chat/ws/agent?token=${token}`);
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      setReconnectCount(0);
    };

    socket.onclose = (event: CloseEvent) => {
      setConnected(false);
      setLoading(false);
      
      // If unauthorized, redirect to login instead of looping
      if (event.code === 4401 || event.code === 401) {
        console.warn('Neural Link: Authentication failed. Redirecting to login.');
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }

      if ((socket as any).wasCleanlyClosed) return;

      // Exponential backoff with a 2s minimum floor
      if (reconnectCount < 5) {
        const delay = Math.max(2000, Math.pow(2, reconnectCount) * 1000);
        setTimeout(() => {
          setReconnectCount(prev => prev + 1);
        }, delay);
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
          
          // Ensure content is a string for regex matching (safety check for multimodal/malformed data)
          const contentStr = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
          
          if (lastLog.text.includes('reason')) {
            const thinkMatch = contentStr.match(/<think>([\s\S]*?)(<\/think>|$)/);
            if (thinkMatch) {
              lastLog.details = thinkMatch[1].trim();
            } else if (contentStr.length > 0) {
              lastLog.details = contentStr.length > 500 ? '...' + contentStr.substring(contentStr.length - 500) : contentStr;
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
        isProcessing.current = false;
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
        isProcessing.current = false;
      }
    };

    // 2. Metrics Socket
    const mSocket = new WebSocket(`${config.WS_BASE_URL}${config.API_V1_STR}/metrics/ws/metrics?token=${token}`);
    metricsWs.current = mSocket;
    
    mSocket.onclose = (event) => {
      if (event.code === 4401 || event.code === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      }
    };

    mSocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Pass through availability flags from backend
      setMetrics({
        ...data,
        npu_available: data.npu_available ?? false,
        igpu_available: data.igpu_available ?? false,
      });
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
        return updated.slice(-50);
      });
    };

    return () => {
      (socket as any).wasCleanlyClosed = true;
      if (socket.readyState !== WebSocket.CLOSED) socket.close();
      if (mSocket.readyState !== WebSocket.CLOSED) mSocket.close();
    };
  }, [reconnectCount]);

  // 3. Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversation = async (id: number) => {
    setLoading(true);
    setCurrentConvId(id);
    setMessages([]);
    setCurrentContext([]);
    setCurrentToolCalls([]);

    try {
      const response = await fetch(`${config.API_BASE_URL}${config.API_V1_STR}/conversations/${id}`, {
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

  const handleNewChat = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}${config.API_V1_STR}/conversations/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ title: `Workspace ${new Date().toLocaleTimeString()}` })
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentConvId(data.id);
        setMessages([]);
        setCurrentLatency(null);
        setIsOnboardingOpen(true);
      }
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !connected || loading || isProcessing.current) return;

    if (!currentConvId) {
      handleNewChat().then(() => {});
      alert("Please select or create a workspace first.");
      isProcessing.current = false;
      return;
    }

    isProcessing.current = true;
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
        api_key: apiKey,
        base_url: localStorage.getItem('ollama_cloud_url') || ''
      }));
      
      setInput('');
    } catch (err: any) {
      console.error('Send error:', err);
      setMessages(prev => [...prev, { id: 'err-' + Date.now(), sender: 'bot', content: `❌ Send Failed: ${err.message}` }]);
      setLoading(false);
      isProcessing.current = false;
    }
  };

  return (
    <div className="flex h-screen bg-transparent text-[#1A1D2E] font-[Poppins] overflow-hidden relative">
      <div className="absolute inset-0 bg-[#C8CDD5]/30 pointer-events-none -z-10"></div>
      
      <Sidebar 
        currentConversationId={currentConvId} 
        onSelectConversation={loadConversation} 
        onNewChat={handleNewChat}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
        <ChatHeader 
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          currentConvId={currentConvId}
          setIsOnboardingOpen={setIsOnboardingOpen}
          isCanvasOpen={isCanvasOpen}
          setIsCanvasOpen={setIsCanvasOpen}
          setIsSettingsOpen={setIsSettingsOpen}
          connected={connected}
          activeProvider={activeProvider}
          activeProviderInfo={activeProviderInfo}
          currentLatency={currentLatency}
          loading={loading}
        />
        
        {/* Floating Hardware Telemetry — Moved to Top to prevent input obstruction */}
        <div className="absolute top-16 left-0 right-0 pointer-events-none flex justify-center z-30">
          <div className="pointer-events-auto">
            <MetricsStrip 
              metrics={metrics}
              metricsHistory={metricsHistory}
              isChartExpanded={isChartExpanded}
              setIsChartExpanded={setIsChartExpanded}
            />
          </div>
        </div>

        <MessageList 
          messages={messages}
          loading={loading}
          thoughtLog={thoughtLog}
          thoughtStartTime={thoughtStartTime}
          currentToolCalls={currentToolCalls}
          currentContext={currentContext}
          scrollRef={scrollRef}
          currentConvId={currentConvId}
          activeProvider={activeProvider}
          activeModel={activeModel}
        />

        <ChatInput 
          input={input}
          setInput={setInput}
          onSend={handleSend}
          loading={loading}
          currentConvId={currentConvId}
        />
      </div>

      <AgentCanvas isOpen={isCanvasOpen} onClose={() => setIsCanvasOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} setIsOpen={setIsSettingsOpen} />
      
      <WorkspaceOnboardingModal 
        isOpen={isOnboardingOpen} 
        setIsOpen={setIsOnboardingOpen} 
        onSubmit={({ profile, goals }) => {
          const initPrompt = `WORKSPACE INITIALIZATION:\n\nProfile Context:\n${profile}\n\nProject Goals:\n${goals}\n\nPlease acknowledge these goals and outline your initial execution plan.`;
          setInput(initPrompt);
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
