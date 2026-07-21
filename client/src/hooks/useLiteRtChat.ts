import { useState, useEffect, useCallback } from 'react';
import { liteRtService, type SystemCapabilities, type AcceleratorType, AVAILABLE_MODELS } from '../services/liteRtService';
import { config, getApiUrl } from '../config';

export interface LiteMessage {
  id: string;
  sender: 'user' | 'bot';
  content: string;
  timestamp: number;
  engine: 'local' | 'cloud';
  accelerator?: AcceleratorType;
  tps?: number; // Tokens per second
}

export const useLiteRtChat = () => {
  const [messages, setMessages] = useState<LiteMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [capabilities, setCapabilities] = useState<SystemCapabilities | null>(null);
  const [activeModelId, setActiveModelId] = useState<string>('gemma-2b-quantized');
  const [loadModelProgress, setLoadModelProgress] = useState<number | null>(null);
  const [tps, setTps] = useState<number>(0);
  const [engineMode, setEngineMode] = useState<'local' | 'cloud'>('local');

  // Load capabilities on mount
  useEffect(() => {
    const fetchCapabilities = async () => {
      const caps = await liteRtService.checkCapabilities();
      setCapabilities(caps);
    };
    fetchCapabilities();
  }, []);

  const selectModel = useCallback(async (modelId: string) => {
    setLoadModelProgress(0);
    try {
      await liteRtService.loadModel(modelId, (prog) => {
        setLoadModelProgress(prog);
      });
      setActiveModelId(modelId);
    } catch (e) {
      console.error('Failed to load local model:', e);
    } finally {
      // Keep progress complete visible briefly, then clear it
      setTimeout(() => setLoadModelProgress(null), 1000);
    }
  }, []);

  // Pre-load default model on consent or when capabilities are determined
  useEffect(() => {
    if (capabilities) {
      selectModel('gemma-2b-quantized');
    }
  }, [capabilities, selectModel]);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || loading) return;

    const userMessage: LiteMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content,
      timestamp: Date.now(),
      engine: engineMode,
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    const botMessageId = `bot-${Date.now()}`;
    const botMessagePlaceholder: LiteMessage = {
      id: botMessageId,
      sender: 'bot',
      content: '',
      timestamp: Date.now(),
      engine: engineMode,
      accelerator: capabilities?.preferredAccelerator,
      tps: 0,
    };

    setMessages(prev => [...prev, botMessagePlaceholder]);

    const startTime = Date.now();
    let tokenCount = 0;

    // Detect if we should use local engine or fallback to cloud API
    const isCloudRequest = content.toLowerCase().includes('/cloud') || 
                           content.toLowerCase().includes('generate code') || 
                           content.toLowerCase().includes('deploy') || 
                           engineMode === 'cloud';

    if (isCloudRequest) {
      // Fallback: Query Cloud/Backend API
      try {
        const token = localStorage.getItem('token');
        const baseUrl = getApiUrl(false); // Base deployment endpoint
        
        const response = await fetch(`${baseUrl}${config.API_V1_STR}/chat/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            message: content,
            provider: 'local',
            model: 'gemma-2b',
            agent_mode: false
          })
        });

        if (response.ok) {
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let fullResponseText = '';

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              fullResponseText += chunk;
              tokenCount += chunk.split(/\s+/).length;
              
              const elapsed = (Date.now() - startTime) / 1000;
              const calculatedTps = elapsed > 0 ? Math.round(tokenCount / elapsed) : 0;

              setMessages(prev => prev.map(msg => 
                msg.id === botMessageId 
                  ? { ...msg, content: fullResponseText, engine: 'cloud', tps: calculatedTps } 
                  : msg
              ));
            }
          } else {
            const data = await response.json();
            setMessages(prev => prev.map(msg => 
              msg.id === botMessageId 
                ? { ...msg, content: data.response || 'Success', engine: 'cloud' } 
                : msg
            ));
          }
        } else {
          throw new Error('Cloud inference failed');
        }
      } catch (err) {
        console.error('Cloud query failure:', err);
        setMessages(prev => prev.map(msg => 
          msg.id === botMessageId 
            ? { ...msg, content: '⚠️ Cloud fallback failed. Using simulated offline edge response.', engine: 'local' } 
            : msg
        ));
        
        // Execute simulated local response on error
        await runLocalInference(content, botMessageId, startTime);
      } finally {
        setLoading(false);
      }
    } else {
      // Local Mode: LiteRT.js Edge inference
      await runLocalInference(content, botMessageId, startTime);
    }
  }, [loading, engineMode, capabilities, selectModel]);

  const runLocalInference = async (content: string, botMessageId: string, startTime: number) => {
    let tokenCount = 0;
    try {
      await liteRtService.generateLocalResponse(content, (chunk) => {
        tokenCount++;
        const elapsed = (Date.now() - startTime) / 1000;
        const calculatedTps = elapsed > 0 ? Math.round(tokenCount / elapsed) : 0;
        setTps(calculatedTps);

        setMessages(prev => prev.map(msg => 
          msg.id === botMessageId 
            ? { 
                ...msg, 
                content: msg.content + chunk,
                tps: calculatedTps,
                accelerator: capabilities?.preferredAccelerator || 'wasm'
              } 
            : msg
        ));
      });
    } catch (e) {
      console.error(e);
      setMessages(prev => prev.map(msg => 
        msg.id === botMessageId 
          ? { ...msg, content: 'Error running local LiteRT.js inference.' } 
          : msg
      ));
    } finally {
      setLoading(false);
    }
  };

  return {
    messages,
    loading,
    capabilities,
    activeModelId,
    loadModelProgress,
    tps,
    engineMode,
    setEngineMode,
    selectModel,
    sendMessage,
    clearChat,
    modelsList: AVAILABLE_MODELS
  };
};
