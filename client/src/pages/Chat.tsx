// Chat.tsx — AICodex Agentic Chat Interface (Modularized v3)
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { SpiritBirdHarness } from '../components/chat/SpiritBirdHarness';
import { GemmaSandboxHarness } from '../components/chat/GemmaSandboxHarness';
import { SpiritBirdChatHarness } from '../components/chat/SpiritBirdChatHarness';
import SpacesCatalog from 'codex_spaces/client/src/components/SpacesCatalog';
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
  const [isHarnessOpen, setIsHarnessOpen] = useState(false);
  const [isHarnessCollapsed, setIsHarnessCollapsed] = useState(false);
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
    isPremiumSpace,
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
      const baseUrl = getApiUrl(isPremiumSpace);
      await fetch(`${baseUrl}${config.API_V1_STR}/workspace/scratchpad`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...(isPremiumSpace && config.COLAB_SECRET ? { 'X-Codex-Premium-Key': config.COLAB_SECRET } : {})
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
    const wsUrl = getWsUrl(isPremiumSpace);
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
        let shouldAutoOpenCanvas = false;
        
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

            // Check for explicit CANVAS tags in the raw response text
            if (typeof lastMsg.content === 'string' && lastMsg.content.includes('[CANVAS:')) {
              shouldAutoOpenCanvas = true;
            }

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
              shouldAutoOpenCanvas = true;
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

            if (shouldAutoOpenCanvas && !isCanvasOpenRef.current) {
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
    const metricsWsUrl = getWsUrl(isPremiumSpace);
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
  }, [reconnectCount, isPremiumSpace]);

  // 3. Auto-scroll
  const lastScrolledMsgId = useRef<string | null>(null);
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg) {
      if (lastMsg.sender === 'user') {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else if (lastMsg.sender === 'bot') {
        if (lastScrolledMsgId.current !== lastMsg.id) {
          setTimeout(() => {
            const element = document.getElementById(`msg-${lastMsg.id}`);
            const container = scrollRef.current?.parentElement;
            if (element && container) {
              const elementTop = element.offsetTop;
              const headerOffset = activeSpace?.slug === 'trading-space' ? 120 : 76;
              const targetScrollTop = Math.max(0, elementTop - headerOffset);
              container.scrollTo({
                top: targetScrollTop,
                behavior: 'smooth'
              });
              lastScrolledMsgId.current = lastMsg.id;
            }
          }, 50);
        }
      }
    }
  }, [messages, activeSpace]);

  const loadConversation = async (id: number) => {
    setLoading(true);
    setCurrentConvId(id);
    setMessages([]);
    setCurrentContext([]);
    setCurrentToolCalls([]);

    try {
      const baseUrl = getApiUrl(isPremiumSpace);
      const response = await fetch(`${baseUrl}${config.API_V1_STR}/conversations/${id}`, {
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          ...(isPremiumSpace && config.COLAB_SECRET ? { 'X-Codex-Premium-Key': config.COLAB_SECRET } : {})
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
      let endpoint = `${getApiUrl(isPremiumSpace)}${config.API_V1_STR}/conversations/`;
      if (activeSpace) {
          endpoint = `${getApiUrl(isPremiumSpace)}${config.API_V1_STR}/spaces/${activeSpace.slug}/conversations`;
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

  const handleRetry = useCallback((errorMsgId: string, newProvider?: string, newModel?: string) => {
    const errorIndex = messages.findIndex(m => m.id === errorMsgId);
    if (errorIndex === -1) return;

    let triggerText = '';
    for (let j = errorIndex - 1; j >= 0; j--) {
      if (messages[j].sender === 'user') {
        triggerText = messages[j].content;
        break;
      }
    }

    if (!triggerText) {
      alert("Could not find the query to retry.");
      return;
    }

    let providerToUse = activeProvider;
    let modelToUse = activeModel;
    if (newProvider && newModel) {
      setProvider(newProvider as any);
      setModel(newModel, newProvider as any);
      providerToUse = newProvider as any;
      modelToUse = newModel;
    }

    setMessages(prev => prev.filter(m => m.id !== errorMsgId));

    if (!currentConvId) {
      alert("Please select or create a workspace first.");
      return;
    }

    isProcessing.current = true;
    setLoading(true);
    setCurrentToolCalls([]);
    currentToolCallsRef.current = [];
    setThoughtStartTime(Date.now());
    setThoughtLog([]);
    setTelemetry(null);

    const apiKey = getApiKey(providerToUse) || '';

    try {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
        throw new Error('Neural link disconnected. Please refresh or check connection.');
      }

      const payload = {
        message: triggerText,
        conversation_id: currentConvId,
        provider: providerToUse,
        model: modelToUse,
        api_key: apiKey,
        api_keys: getAllApiKeys(),
        agent_mode: agentMode,
        local_backend_mode: getLocalBackendMode(),
        config: modelConfig,
        base_url: localStorage.getItem('ollama_cloud_url') || ''
      };
      ws.current.send(JSON.stringify(payload));
    } catch (err: any) {
      console.error('Retry error:', err);
      setMessages(prev => [...prev, { id: 'err-' + Date.now(), sender: 'bot', content: `❌ Send Failed: ${err.message}` }]);
      setLoading(false);
      isProcessing.current = false;
    }
  }, [messages, activeProvider, activeModel, currentConvId, agentMode, modelConfig, getApiKey, getAllApiKeys, setProvider, setModel]);

  // Dynamic styling based on active space
  const themeClass = activeSpace && !viewSpacesCatalog ? `space-theme-${activeSpace.slug}` : '';

  return (
    <div className={`flex h-screen bg-transparent font-sans overflow-hidden transition-colors duration-500 ${themeClass}`}>
      
      <Sidebar 
        currentConversationId={currentConvId} 
        onSelectConversation={loadConversation} 
        onNewChat={handleNewChat}
        isOpen={isSidebarOpen && !isCanvasOpen}
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
          isHarnessOpen={isHarnessOpen}
          setIsHarnessOpen={setIsHarnessOpen}
        />

        {/* Trading Space Header — contextual sub-header */}
        {activeSpace?.slug === 'trading-space' && !viewSpacesCatalog && (
          <TradingSpaceHeader connected={connected} />
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
            <div className="flex-1 flex flex-row overflow-hidden relative">
              {/* Left Column: Chat Stream */}
              <div className="flex-1 flex flex-col min-w-0 relative">
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
                  onRetry={handleRetry}
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
              </div>

              {/* Contextual Interaction Harnesses for spaces */}
              {activeSpace && ['trading-space', 'code-lab', 'spirit-book'].includes(activeSpace.slug) && (
                <>
                  {/* Mobile Right Slide-Over Side Drawer */}
                  {isHarnessOpen && (
                    <div className="lg:hidden fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={() => setIsHarnessOpen(false)}>
                      <div 
                        className="bg-[#090A0E] border-l border-white/10 w-full sm:w-[400px] h-full flex flex-col animate-in slide-in-from-right duration-300 safe-area-y"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between p-4 border-b border-white/5 safe-area-top">
                          <div>
                            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${activeSpace.slug === 'code-lab' ? 'text-[#446EFF]' : activeSpace.slug === 'spirit-book' ? 'text-[#6366f1]' : 'text-[#fd3b12]'}`}>
                              {activeSpace.slug === 'code-lab' ? 'Gemma Code Lab' : activeSpace.slug === 'spirit-book' ? 'SpiritBook Helper' : 'Spirit Bird Interaction'}
                            </h3>
                            <p className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5 font-mono">Agent UI Projection Space</p>
                          </div>
                          <button onClick={() => setIsHarnessOpen(false)} className="p-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-white transition-colors cursor-pointer touch-44">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto safe-area-bottom">
                          {activeSpace.slug === 'trading-space' && <SpiritBirdHarness spaceName={activeSpace.name} />}
                          {activeSpace.slug === 'code-lab' && <GemmaSandboxHarness />}
                          {activeSpace.slug === 'spirit-book' && <SpiritBirdChatHarness />}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Right Column: Contextual Tools Harness — Desktop */}
                  <div className={`hidden lg:flex flex-col border-l border-white/5 bg-[#090A0E] z-10 transition-all duration-300 ${isHarnessCollapsed ? 'w-[60px]' : 'w-[350px] xl:w-[400px]'}`}>
                    {isHarnessCollapsed ? (
                      <div className="flex flex-col items-center py-4 space-y-6 h-full select-none">
                        <button 
                          onClick={() => setIsHarnessCollapsed(false)} 
                          className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="Expand HUD"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        </button>
                        <div className="h-px w-8 bg-white/5"></div>
                        <div className="flex flex-col items-center space-y-4 flex-1">
                          {activeSpace.slug === 'trading-space' ? (
                            <>
                              <div className="w-8 h-8 rounded-lg bg-[#fd3b12]/10 flex items-center justify-center border border-[#fd3b12]/20 text-[#fd3b12] cursor-pointer" onClick={() => setIsHarnessCollapsed(false)} title="Target Tracker">
                                <span className="text-[10px] font-black font-mono">🎯</span>
                              </div>
                              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500 cursor-pointer animate-pulse" onClick={() => setIsHarnessCollapsed(false)} title="Risk Monitor">
                                <span className="text-[10px] font-black font-mono">🛡️</span>
                              </div>
                              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400 cursor-pointer" onClick={() => setIsHarnessCollapsed(false)} title="Market State">
                                <span className="text-[10px] font-black font-mono">📈</span>
                              </div>
                            </>
                          ) : activeSpace.slug === 'code-lab' ? (
                            <>
                              <div className="w-8 h-8 rounded-lg bg-[#446EFF]/10 flex items-center justify-center border border-[#446EFF]/20 text-[#446EFF] cursor-pointer" onClick={() => setIsHarnessCollapsed(false)} title="Sandbox Code">
                                <span className="text-[10px] font-black font-mono">💻</span>
                              </div>
                              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400 cursor-pointer" onClick={() => setIsHarnessCollapsed(false)} title="MTP Simulator">
                                <span className="text-[10px] font-black font-mono">⚡</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-8 h-8 rounded-lg bg-[#6366f1]/10 flex items-center justify-center border border-[#6366f1]/20 text-[#6366f1] cursor-pointer" onClick={() => setIsHarnessCollapsed(false)} title="Spirit Bird Chat">
                                <span className="text-[10px] font-black font-mono">💬</span>
                              </div>
                              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400 cursor-pointer" onClick={() => setIsHarnessCollapsed(false)} title="Mindful Breaks">
                                <span className="text-[10px] font-black font-mono">🧘</span>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-600 font-mono tracking-[0.25em] font-black uppercase [writing-mode:vertical-lr] rotate-180 py-4 select-none">
                          {activeSpace.slug === 'code-lab' ? 'GEMMA LAB' : activeSpace.slug === 'spirit-book' ? 'SPIRIT BOOK' : 'SPIRIT BIRD'}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
                        <div className="p-4 border-b border-white/5 sticky top-0 bg-[#090A0E]/80 backdrop-blur-md flex items-center justify-between z-10">
                          <div>
                            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${activeSpace.slug === 'code-lab' ? 'text-[#446EFF]' : activeSpace.slug === 'spirit-book' ? 'text-[#6366f1]' : 'text-[#fd3b12]'}`}>
                              {activeSpace.slug === 'code-lab' ? 'Gemma Code Lab (Gemma 4)' : activeSpace.slug === 'spirit-book' ? 'SpiritBook Helper' : `Spirit Bird Interaction (${activeSpace.name})`}
                            </h3>
                            <p className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5 font-mono">Agent UI Projection Space</p>
                          </div>
                          <button 
                            onClick={() => setIsHarnessCollapsed(true)} 
                            className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            title="Collapse Panel"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto flex flex-col">
                          {activeSpace.slug === 'trading-space' && <SpiritBirdHarness spaceName={activeSpace.name} />}
                          {activeSpace.slug === 'code-lab' && <GemmaSandboxHarness />}
                          {activeSpace.slug === 'spirit-book' && <SpiritBirdChatHarness />}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
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
