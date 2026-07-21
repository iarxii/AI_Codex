import { useState, useEffect, useCallback, useRef } from 'react';
import { liteRtService, type SystemCapabilities, type AcceleratorType, AVAILABLE_MODELS } from '../services/liteRtService';
import { config, getApiUrl } from '../config';
import {
  createInitialDownloadState,
  downloadArtifact,
  getCachedArtifactIds,
  LOCAL_ARTIFACT_TOTAL_BYTES,
  type ArtifactDownloadState,
} from '../services/localModelDownloadService';

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
  const [activeModelId, setActiveModelId] = useState<string>('google/gemma-3n-E4B-it-litert-lm');
  const [tps, setTps] = useState<number>(0);
  const [downloadStates, setDownloadStates] = useState<ArtifactDownloadState[]>(createInitialDownloadState);
  const downloadAbortRef = useRef<AbortController | null>(null);
  const [engineMode, setEngineMode] = useState<'local' | 'cloud'>('cloud');

  // Load capabilities on mount
  useEffect(() => {
    const fetchCapabilities = async () => {
      const caps = await liteRtService.checkCapabilities();
      setCapabilities(caps);
    };
    fetchCapabilities();
  }, []);

  useEffect(() => {
    getCachedArtifactIds().then((cachedIds) => {
      setDownloadStates((previous) => previous.map((state) => cachedIds.has(state.id)
        ? { ...state, phase: 'cached', receivedBytes: state.bytes }
        : state
      ));
    }).catch((error) => {
      console.warn('Unable to inspect local model cache:', error);
    });
  }, []);

  const downloadLocalModels = useCallback(async () => {
    downloadAbortRef.current?.abort();
    const controller = new AbortController();
    downloadAbortRef.current = controller;

    setDownloadStates((previous) => previous.map((state) => (
      state.phase === 'cached' || state.phase === 'ready'
        ? state
        : { ...state, phase: 'downloading', receivedBytes: 0, error: undefined }
    )));

    try {
      for (const state of createInitialDownloadState()) {
        const current = downloadStates.find((item) => item.id === state.id);
        if (current?.phase === 'cached' || current?.phase === 'ready') continue;

        await downloadArtifact(state, (receivedBytes) => {
          setDownloadStates((previous) => previous.map((item) => item.id === state.id
            ? { ...item, phase: 'downloading', receivedBytes }
            : item
          ));
        }, controller.signal);

        setDownloadStates((previous) => previous.map((item) => item.id === state.id
          ? { ...item, phase: 'ready', receivedBytes: item.bytes }
          : item
        ));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Local model download failed.';
      setDownloadStates((previous) => previous.map((item) => item.phase === 'downloading'
        ? { ...item, phase: controller.signal.aborted ? 'cancelled' : 'error', error: message }
        : item
      ));
    } finally {
      downloadAbortRef.current = null;
    }
  }, [downloadStates]);

  const cancelLocalModelDownload = useCallback(() => {
    downloadAbortRef.current?.abort();
  }, []);

  const selectModel = useCallback(async (modelId: string) => {
    setActiveModelId(modelId);
  }, []);

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
      // Query the real AICodex Cloud Agent via the lightweight /chat/quick endpoint.
      try {
        const token = localStorage.getItem('token');
        const baseUrl = getApiUrl(false); // Base deployment endpoint

        const response = await fetch(`${baseUrl}${config.API_V1_STR}/chat/quick`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            system_context: 'You are the AICodex Chat assistant, a fast, friendly conversational agent embedded in the AICodex Chat (LiteRT) portal. Keep replies concise, clear, and helpful.',
            message: content,
            provider: 'ollama_cloud',
            model: activeModelId
          })
        });

        if (response.ok) {
          const data = await response.json();
          const reply = data.reply || 'Sorry, I could not generate a response.';
          if (typeof reply === 'string' && /^Sorry, I (encountered an error|could not)/i.test(reply.trim())) {
            throw new Error(reply);
          }
          tokenCount = reply.split(/\s+/).length;
          const elapsed = (Date.now() - startTime) / 1000;
          const calculatedTps = elapsed > 0 ? Math.round(tokenCount / elapsed) : 0;

          setMessages(prev => prev.map(msg =>
            msg.id === botMessageId
              ? { ...msg, content: reply, engine: 'cloud', tps: calculatedTps }
              : msg
          ));
        } else {
          throw new Error(`Cloud inference failed with status ${response.status}`);
        }
      } catch (err) {
        console.error('Cloud query failure:', err);
        setMessages(prev => prev.map(msg => 
          msg.id === botMessageId 
            ? { ...msg, content: `Cloud Agent request failed: ${err instanceof Error ? err.message : 'Unknown connection error.'}`, engine: 'cloud' } 
            : msg
        ));
      } finally {
        setLoading(false);
      }
    } else {
      // Local Mode: LiteRT.js Edge inference
      await runLocalInference(content, botMessageId, startTime);
    }
  }, [loading, engineMode, capabilities, selectModel, activeModelId]);

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
          ? { ...msg, content: `Local model unavailable: ${e instanceof Error ? e.message : 'Unknown inference error.'}` } 
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
    tps,
    engineMode,
    setEngineMode,
    selectModel,
    sendMessage,
    clearChat,
    modelsList: AVAILABLE_MODELS,
    downloadStates,
    downloadTotalBytes: LOCAL_ARTIFACT_TOTAL_BYTES,
    downloadLocalModels,
    cancelLocalModelDownload,
  };
};
