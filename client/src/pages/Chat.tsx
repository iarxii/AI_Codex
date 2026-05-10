// Chat.tsx — AICodex Agentic Chat Interface (Modularized v3)
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import AgentCanvas from '../components/AgentCanvas';
import SettingsModal from '../components/SettingsModal';
import { PROVIDER_MAP, getLocalBackendMode } from '../components/providerMeta';
import { useAI } from '../contexts/AIContext';
import { config, getApiUrl, getWsUrl } from '../config';
import WorkspaceOnboardingModal from '../components/WorkspaceOnboardingModal';

// Modular Components
import ChatHeader from '../components/chat/ChatHeader';
import MessageList from '../components/chat/MessageList';
import ChatInput from '../components/chat/ChatInput';
import MetricsStrip from '../components/chat/MetricsStrip';
import ModelTelemetryHUD from '../components/chat/ModelTelemetryHUD';
import SpacesCatalog from '../components/SpacesCatalog';
import TradingSpaceHeader from '../components/spaces/trading/TradingSpaceHeader';
import '../spaces.css';

// Types
import type { Message, ThoughtLogEntry, Artifact, ModelTelemetry } from '../types/chat';
import { parseArtifacts, inferDependencies, assignModuleFromBatch } from '../utils/artifactParser';

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
  const isCanvasOpenRef = useRef(false);
  const currentToolCallsRef = useRef<any[]>([]);
  const [telemetry, setTelemetry] = useState<ModelTelemetry | null>(null);
  const [metrics, setMetrics] = useState<any>({ cpu: 0, ram: 0, npu: 0, npu_available: false, igpu: 0, igpu_available: false, latency: '0ms' });
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);
  const [isChartExpanded, setIsChartExpanded] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [agentMode, setAgentMode] = useState(true);
  
  // Global AI State
  const { 
    provider: activeProvider, 
    model: activeModel, 
    modelConfig, 
    getApiKey, 
    getAllApiKeys,
    setProvider,
    setModel,
    viewSpacesCatalog, 
    activeSpace, 
    availableSpaces, 
    setActiveSpace 
  } = useAI();
  const [spaceNote, setSpaceNote] = useState<string | null>(null);
  const activeProviderInfo = PROVIDER_MAP[activeProvider] || PROVIDER_MAP['local'];

  const ws = useRef<WebSocket | null>(null);
  const metricsWs = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Sync canvas-open state to ref for use inside closures
  useEffect(() => {
    isCanvasOpenRef.current = isCanvasOpen;
  }, [isCanvasOpen]);

  // 1. Initial Auth Check
  const handleViewInCanvas = (artifactId: string) => {
    setSelectedArtifactId(artifactId);
    setIsCanvasOpen(true);
  };

  const saveToScratchpad = async (artifact: Artifact) => {
    const token = localStorage.getItem('token');
    if (!token || !artifact.content) return;

    try {
      const baseUrl = getApiUrl(activeSpace?.slug);
      await fetch(`${baseUrl}${config.API_V1_STR}/workspace/scratchpad`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...(baseUrl === config.COLAB_URL && config.COLAB_SECRET ? { 'X-Codex-Premium-Key': config.COLAB_SECRET } : {})
        },
        body: JSON.stringify({
          conversation_id: currentConvId,
          filename: artifact.title || 'scratchpad.py',
          content: artifact.content
        })
      });
      console.log('Scratchpad synced to filesystem.');
    } catch (err) {
      console.error('Failed to sync scratchpad:', err);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Restore last active conversation
    const lastId = localStorage.getItem('lastConvId');
    if (lastId && !currentConvId) {
      loadConversation(parseInt(lastId));
    }
  }, [navigate]);

  const handleExport = () => {
    const sessionData = {
      sessionId: currentConvId?.toString() || 'unsaved-session',
      timestamp: new Date().toISOString(),
      provider: {
        name: activeProvider,
        class: activeProviderInfo?.class || "standard",
      },
      telemetry: {
        totalTokens: telemetry?.total_tokens || 0,
        avgLatencyMs: telemetry?.ttft || 0,
        peakLatencyMs: telemetry?.ttft || 0,
      },
      config: {
        temperature: modelConfig.temperature,
        topK: modelConfig.top_k,
        topP: modelConfig.top_p,
        maxOutputTokens: modelConfig.max_tokens,
      },
      turns: messages.map(msg => ({
        role: msg.sender === 'user' ? "user" : "model",
        content: msg.content,
        metadata: {
          provider: msg.metadata?.provider || activeProvider,
          model: msg.metadata?.model || activeModel,
          latencyMs: msg.metadata?.latency || 0,
          tokenCount: msg.metadata?.tokens || 0,
          thinkingPath: msg.metadata?.thinking || undefined,
        }
      }))
    };

    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aicodex-session-${sessionData.sessionId}-${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 2. WebSockets management
  const [reconnectCount, setReconnectCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const wsUrl = getWsUrl(activeSpace?.slug);
    const handshakeQuery = (wsUrl.includes('ngrok') && config.COLAB_SECRET) ? `&handshake=${config.COLAB_SECRET}` : '';
    
    const socket = new WebSocket(`${wsUrl}${config.API_V1_STR}/chat/ws/agent?token=${token}${handshakeQuery}`);
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
      if (data.type === 'telemetry') {
        setTelemetry(data.data);
      } else if (data.type === 'token') {
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.sender === 'bot') {
            const updated = [...prev];
            updated[updated.length - 1] = { 
              ...lastMsg, 
              content: data.content, 
              status: 'typing',
              metadata: { 
                ...lastMsg.metadata,
                provider: data.provider || lastMsg.metadata?.provider || activeProvider, 
                model: data.model || lastMsg.metadata?.model || activeModel,
                latency: data.duration || lastMsg.metadata?.latency,
                tokens: data.tokens || lastMsg.metadata?.tokens,
                timestamp: lastMsg.metadata?.timestamp || Date.now()
              }
            };
            // Real-time Canvas Toggle: Open if [CANVAS: is detected in the stream
            if (typeof data.content === 'string' && data.content.includes('[CANVAS:') && !isCanvasOpenRef.current) {
              setIsCanvasOpen(true);
            }

            if (data.duration) setCurrentLatency(data.duration);
            return updated;
          } else {
            if (data.duration) setCurrentLatency(data.duration);
            
            // Real-time Canvas Toggle for new message
            if (typeof data.content === 'string' && data.content.includes('[CANVAS:') && !isCanvasOpenRef.current) {
              setIsCanvasOpen(true);
            }

            return [...prev, { 
              id: Date.now().toString(), 
              sender: 'bot', 
              content: data.content, 
              status: 'typing',
              metadata: { 
                provider: data.provider || activeProvider, 
                model: data.model || activeModel,
                latency: data.duration,
                tokens: data.tokens,
                timestamp: Date.now()
              }
            }];
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
        currentToolCallsRef.current = data.tool_calls;
        setThoughtLog(prev => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          const lastLog = { ...updated[updated.length - 1] };
          lastLog.details = JSON.stringify(data.tool_calls, null, 2);
          updated[updated.length - 1] = lastLog;
          return updated;
        });
      } else if (data.type === 'tool_result') {
        const updated = currentToolCallsRef.current.map(tc => 
          tc.id === data.tool_call_id ? { ...tc, result: data.content } : tc
        );
        setCurrentToolCalls(updated);
        currentToolCallsRef.current = updated;
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
        
        let extractedArtifacts: Artifact[] = [];
        
        setMessages(prev => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1].sender === 'bot') {
            const lastMsg = updated[updated.length - 1];
            updated[updated.length - 1] = {
              ...lastMsg,
              status: 'done',
              metadata: {
                ...lastMsg.metadata,
                latency: data.duration || lastMsg.metadata?.latency,
                tokens: data.tokens || lastMsg.metadata?.tokens,
                timestamp: lastMsg.metadata?.timestamp || Date.now()
              }
            };

            // Parse artifacts from final response (once, not on every token)
            extractedArtifacts = parseArtifacts(lastMsg.content, lastMsg.id);

            // Extract artifacts from tool calls (multi-modular aware)
            const toolArtifacts: Artifact[] = [];
            currentToolCallsRef.current.forEach(tc => {
              if (tc.name === 'workspace_writer' && tc.args) {
                let argsObj = tc.args;
                if (typeof argsObj === 'string') {
                  try { argsObj = JSON.parse(argsObj); } catch (e) { argsObj = {}; }
                }
                const type = (argsObj.type || 'code').toLowerCase();
                const typeNormMap: Record<string, Artifact['type']> = { 'code': 'code', 'docs': 'docs', 'doc': 'docs', 'research': 'research' };
                const artifactType = typeNormMap[type] || 'docs';
                const title = argsObj.filename || 'scratchpad';
                
                // Detect file extension for language
                const extMatch = title.match(/\.([a-zA-Z0-9]+)$/);
                const detectedLang = extMatch ? extMatch[1].toLowerCase() : (artifactType === 'code' ? 'text' : undefined);

                toolArtifacts.push({
                  id: `${artifactType}-${title.replace(/\s+/g, '-').toLowerCase()}`,
                  type: artifactType,
                  title: title,
                  content: argsObj.content || '',
                  language: detectedLang,
                  timestamp: Date.now(),
                  messageId: lastMsg.id,
                  filePath: argsObj.filename || undefined,
                });
              }
            });

            // Post-process: infer dependencies and assign module grouping
            if (toolArtifacts.length > 0) {
              inferDependencies(toolArtifacts);
              assignModuleFromBatch(toolArtifacts);
              extractedArtifacts.push(...toolArtifacts);
            }
          }
          return updated;
        });

        setTimeout(() => {
          if (extractedArtifacts.length > 0) {
            setArtifacts(prev => {
              const merged = [...prev];
              extractedArtifacts.forEach(art => {
                const idx = merged.findIndex(a => a.id === art.id);
                if (idx >= 0) merged[idx] = art;
                else merged.push(art);
              });
              return merged;
            });

            // Auto-sync code artifacts to scratchpad
            const codeArt = extractedArtifacts.find(a => a.type === 'code');
            if (codeArt) saveToScratchpad(codeArt);

            setSelectedArtifactId(prev => prev || extractedArtifacts[0].id);

            if (!isCanvasOpenRef.current) {
              setIsCanvasOpen(true);
            }
          }
        }, 0);
      } else if (data.type === 'error') {
        setMessages(prev => [...prev, { id: 'err-' + Date.now(), sender: 'bot', content: '❌ Error: ' + data.message }]);
        setLoading(false);
        isProcessing.current = false;
      }
    };

    // 2. Metrics Socket
    const metricsWsUrl = getWsUrl(activeSpace?.slug);
    const mHandshakeQuery = (metricsWsUrl.includes('ngrok') && config.COLAB_SECRET) ? `&handshake=${config.COLAB_SECRET}` : '';
    const mSocket = new WebSocket(`${metricsWsUrl}${config.API_V1_STR}/metrics/ws/metrics?token=${token}${mHandshakeQuery}`);
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
      const baseUrl = getApiUrl(activeSpace?.slug);
      const response = await fetch(`${baseUrl}${config.API_V1_STR}/conversations/${id}`, {
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          ...(baseUrl === config.COLAB_URL && config.COLAB_SECRET ? { 'X-Codex-Premium-Key': config.COLAB_SECRET } : {})
        }
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
        
        // Update active space context based on conversation space_type
        const space = availableSpaces.find(s => s.slug === data.space_type);
        setActiveSpace(space || null);

        // Auto-apply recommended settings if available
        if (space && (space.recommended_provider || space.recommended_model)) {
          const prevProvider = localStorage.getItem('ai_provider');
          const prevModel = localStorage.getItem(`ai_model_${space.recommended_provider}`);

          if (space.recommended_provider && prevProvider !== space.recommended_provider) {
            setProvider(space.recommended_provider as any);
          }
          if (space.recommended_model && prevModel !== space.recommended_model) {
            setModel(space.recommended_model, space.recommended_provider as any);
          }

          setSpaceNote(`Codex: Applied recommended settings for ${space.name}`);
          setTimeout(() => setSpaceNote(null), 5000);
        }
        
        // Re-parse artifacts from history
        const allArtifacts: Artifact[] = [];
        data.messages.forEach((m: any) => {
          if (m.role === 'assistant') {
            const found = parseArtifacts(m.content);
            found.forEach(art => {
              const index = allArtifacts.findIndex(a => a.id === art.id);
              if (index >= 0) allArtifacts[index] = art;
              else allArtifacts.push(art);
            });
          }
        });
        setArtifacts(allArtifacts);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = async () => {
    try {
      let endpoint = `${config.API_BASE_URL}${config.API_V1_STR}/conversations/`;
      if (activeSpace) {
          endpoint = `${config.API_BASE_URL}${config.API_V1_STR}/spaces/${activeSpace.slug}/conversations`;
      }
      
      const response = await fetch(endpoint, {
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
        setArtifacts([]);
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
    currentToolCallsRef.current = [];
    setThoughtStartTime(Date.now());
    setThoughtLog([]);
    setTelemetry(null); // Reset telemetry for new request
    
    const apiKey = getApiKey(activeProvider) || '';

    try {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
        throw new Error('Neural link disconnected. Please refresh or check connection.');
      }

      const payload = {
        message: input,
        conversation_id: currentConvId,
        provider: activeProvider,
        model: activeModel,
        api_key: apiKey,
        api_keys: getAllApiKeys(),
        agent_mode: agentMode,
        local_backend_mode: getLocalBackendMode(),
        config: modelConfig,
        base_url: localStorage.getItem('ollama_cloud_url') || ''
      };
      ws.current.send(JSON.stringify(payload));
      
      setInput('');
    } catch (err: any) {
      console.error('Send error:', err);
      setMessages(prev => [...prev, { id: 'err-' + Date.now(), sender: 'bot', content: `❌ Send Failed: ${err.message}` }]);
      setLoading(false);
      isProcessing.current = false;
    }
  };
  const handleCancel = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN || !loading) return;
    
    ws.current.send(JSON.stringify({ type: 'cancel' }));
    
    // Optimistic UI update
    setLoading(false);
    isProcessing.current = false;
    setMessages(prev => {
      const updated = [...prev];
      if (updated.length > 0 && updated[updated.length - 1].sender === 'bot') {
        updated[updated.length - 1].status = 'done';
        updated[updated.length - 1].content += '\n\n*(Operation cancelled by user)*';
      }
      return updated;
    });
  };

  // Dynamic styling based on active space
  const themeClass = activeSpace && !viewSpacesCatalog ? `space-theme-${activeSpace.slug}` : '';

  return (
    <div className={`flex h-screen bg-transparent font-sans overflow-hidden transition-colors duration-500 ${themeClass}`}>
      
      <Sidebar 
        currentConversationId={currentConvId} 
        onSelectConversation={loadConversation} 
        onNewChat={handleNewChat}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
        {spaceNote && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-[var(--accent-primary)] text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-bounce border border-white/20 backdrop-blur-md">
            ✨ {spaceNote}
          </div>
        )}
        
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
          artifactCount={artifacts.length}
        />

        {/* Trading Space Header — contextual sub-header */}
        {activeSpace?.slug === 'trading-space' && !viewSpacesCatalog && (
          <TradingSpaceHeader />
        )}
        
        {/* Floating Hardware Telemetry — Moved to Top to prevent input obstruction */}
        <div className={`absolute left-0 right-0 pointer-events-none flex flex-col items-center gap-2 z-30 transition-all duration-500 ${activeSpace?.slug === 'trading-space' && !viewSpacesCatalog ? 'top-32' : 'top-16'}`}>
          <div className={`pointer-events-auto transition-all duration-300 transform ${showTelemetry ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-4 opacity-0 scale-95 pointer-events-none'}`}>
            <MetricsStrip 
              metrics={metrics}
              metricsHistory={metricsHistory}
              isChartExpanded={isChartExpanded}
              setIsChartExpanded={setIsChartExpanded}
            />
          </div>
          
          <div className="pointer-events-auto">
            <ModelTelemetryHUD telemetry={telemetry} isVisible={showTelemetry} />
          </div>
        </div>

        {viewSpacesCatalog ? (
            <SpacesCatalog onSpaceSelected={() => {
                setMessages([]);
                setCurrentConvId(null);
            }} />
        ) : (
            <>
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
                  activeSpace={activeSpace}
                  onCancel={handleCancel}
                  onViewInCanvas={handleViewInCanvas}
                />

                <ChatInput 
                  input={input}
                  setInput={setInput}
                  onSend={handleSend}
                  loading={loading}
                  currentConvId={currentConvId}
                  showTelemetry={showTelemetry}
                  setShowTelemetry={setShowTelemetry}
                  agentMode={agentMode}
                  setAgentMode={setAgentMode}
                  onExport={handleExport}
                />
            </>
        )}
      </div>

      <AgentCanvas 
        isOpen={isCanvasOpen} 
        onClose={() => setIsCanvasOpen(false)} 
        artifacts={artifacts}
        externalSelectedId={selectedArtifactId}
        conversationId={currentConvId}
      />
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
