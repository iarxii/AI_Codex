import { useState, useEffect, useCallback, useRef } from 'react';
import { liteRtService, type SystemCapabilities, type AcceleratorType, AVAILABLE_MODELS } from '../services/liteRtService';
import { config, getApiUrl } from '../config';
import { getProviderApiKey, getProviderConnectionParams, ALL_CLOUD_PROVIDERS } from '../config/providerConfig';
import type { ProviderId } from '../components/providerMeta';
import {
  createInitialDownloadState,
  downloadArtifact,
  getCachedArtifactIds,
  getHuggingFaceAccessToken,
  checkDownloadReadiness,
  type DownloadReadiness,
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

/** Cloud providers that can never respond without a user-supplied API key.
 *  Ollama Cloud and Colab bridge are excluded (they can target keyless
 *  local/self-hosted instances). Mirrors the backend guard in quick_chat. */
const PROVIDERS_REQUIRING_KEY: ReadonlySet<string> = new Set([
  'groq', 'openrouter', 'gemini', 'anthropic', 'azure',
  'cloudflare_ai_gateway', 'workers_ai',
  'deepseek', 'xai', 'together', 'fireworks', 'nvidia', 'perplexity',
  'cohere', 'mistral', 'huggingface', 'cerebras',
]);

type CloudModel = { id: string; name: string };

/** Per-provider config sent to /chat/cloud-config so the backend can live-list
 *  models with the user's actual credentials (same values Workspace forwards
 *  via X-API-Key / X-Account-Id headers). */
const buildProviderConfig = (): Record<string, { api_key?: string; base_url?: string; account_id?: string; gateway_id?: string }> => {
  const out: Record<string, { api_key?: string; base_url?: string; account_id?: string; gateway_id?: string }> = {};
  for (const prov of ALL_CLOUD_PROVIDERS) {
    const key = getProviderApiKey(prov);
    const params = getProviderConnectionParams(prov);
    if (!key && !params.base_url && !params.account_id && !params.gateway_id) continue;
    out[prov] = {
      ...(key ? { api_key: key } : {}),
      ...(params.base_url ? { base_url: params.base_url } : {}),
      ...(params.account_id ? { account_id: params.account_id } : {}),
      ...(params.gateway_id ? { gateway_id: params.gateway_id } : {}),
    };
  }
  return out;
};

export const useLiteRtChat = () => {
  const [messages, setMessages] = useState<LiteMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [capabilities, setCapabilities] = useState<SystemCapabilities | null>(null);
  const [activeModelId, setActiveModelId] = useState<string>('google/gemma-3n-E4B-it-litert-lm');
  const [tps, setTps] = useState<number>(0);
  const [downloadStates, setDownloadStates] = useState<ArtifactDownloadState[]>(createInitialDownloadState);
  const downloadAbortRef = useRef<AbortController | null>(null);
  const [engineMode, setEngineMode] = useState<'local' | 'cloud'>('cloud');
  const [provider, setProvider] = useState<ProviderId>('ollama_cloud');
  const [cloudModels, setCloudModels] = useState<Record<string, CloudModel[]>>({});
  const [cloudConfigSource, setCloudConfigSource] = useState<'backend' | 'fallback'>('fallback');
  const [cloudProviderStatus, setCloudProviderStatus] = useState<Record<string, 'live' | 'none'>>({});
  const [downloadReadiness, setDownloadReadiness] = useState<DownloadReadiness | null>(null);

  // Whether the currently selected provider needs an API key that the user
  // hasn't saved yet. Surfaced in the UI so the user knows to configure it
  // instead of sending requests that are guaranteed to fail upstream.
  const missingApiKey = PROVIDERS_REQUIRING_KEY.has(provider) && !getProviderApiKey(provider);

  // Update model when provider changes (only for cloud)
  useEffect(() => {
    if (engineMode === 'cloud' && cloudModels[provider]?.length) {
      const firstModel = cloudModels[provider][0];
      setActiveModelId(firstModel.id);
    }
  }, [provider, engineMode, cloudModels]);

  // Hydrate the cloud provider/model catalog from the backend. There is no
  // bundled fallback catalog — the endpoint reports which providers are live.
  useEffect(() => {
    let cancelled = false;
    const fetchCloudConfig = async () => {
      try {
        const token = localStorage.getItem('token');
        const baseUrl = getApiUrl(false);
        const response = await fetch(`${baseUrl}${config.API_V1_STR}/chat/cloud-config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ providers: buildProviderConfig() })
        });
        if (!response.ok) throw new Error(`Cloud config failed with status ${response.status}`);
        const data = await response.json();
        if (cancelled || !data?.providers || !Array.isArray(data.providers)) return;

        const next: Record<string, CloudModel[]> = {};
        const status: Record<string, 'live' | 'none'> = {};
        for (const p of data.providers) {
          const models = Array.isArray(p?.models) ? p.models : [];
          next[p.id] = models.map((m: any) => ({ id: String(m.id ?? m.name), name: String(m.name ?? m.id) }));
          status[p.id] = p.source === 'live' ? 'live' : 'none';
        }
        setCloudModels(() => next);
        setCloudProviderStatus(() => status);
        setCloudConfigSource('backend');
      } catch (error) {
        console.warn('Cloud config fetch failed; no provider catalog available.', error);
        setCloudConfigSource('fallback');
      }
    };
    fetchCloudConfig();
    return () => { cancelled = true; };
  }, []);

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

  // Determine whether this machine/browser can store and execute the local
  // models (free storage + WebGPU buffer size) before offering a download.
  useEffect(() => {
    let cancelled = false;
    checkDownloadReadiness(LOCAL_ARTIFACT_TOTAL_BYTES).then((readiness) => {
      if (!cancelled) setDownloadReadiness(readiness);
    }).catch((error) => {
      console.warn('Local model download readiness check failed:', error);
    });
    return () => { cancelled = true; };
  }, []);

  const downloadLocalModels = useCallback(async () => {
    downloadAbortRef.current?.abort();
    const controller = new AbortController();
    downloadAbortRef.current = controller;

    // Gate the download on device readiness (free storage + WebGPU buffer).
    // Re-check live so the UI reflects the actual browser state at click time.
    try {
      const readiness = await checkDownloadReadiness(LOCAL_ARTIFACT_TOTAL_BYTES);
      setDownloadReadiness(readiness);
      if (!readiness.ok) {
        const message = readiness.reason ?? 'This device cannot store or run the local models.';
        setDownloadStates((previous) => previous.map((item) => (
          item.phase === 'cached' || item.phase === 'ready'
            ? item
            : { ...item, phase: 'error', error: message, receivedBytes: 0 }
        )));
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Device readiness check failed.';
      setDownloadStates((previous) => previous.map((item) => (
        item.phase === 'cached' || item.phase === 'ready'
          ? item
          : { ...item, phase: 'error', error: message, receivedBytes: 0 }
      )));
      return;
    }

    setDownloadStates((previous) => previous.map((state) => (
      state.phase === 'cached' || state.phase === 'ready'
        ? state
        : { ...state, phase: 'downloading', receivedBytes: 0, error: undefined }
    )));

    const hfToken = getHuggingFaceAccessToken();

    try {
      for (const state of createInitialDownloadState()) {
        const current = downloadStates.find((item) => item.id === state.id);
        if (current?.phase === 'cached' || current?.phase === 'ready') continue;

        await downloadArtifact(state, (receivedBytes) => {
          setDownloadStates((previous) => previous.map((item) => item.id === state.id
            ? { ...item, phase: 'downloading', receivedBytes }
            : item
          ));
        }, controller.signal, hfToken);

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
            provider: provider,
            model: activeModelId,
            api_key: getProviderApiKey(provider) || undefined,
            ...getProviderConnectionParams(provider),
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
  }, [loading, engineMode, provider, capabilities, selectModel, activeModelId]);

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
    downloadReadiness,
    downloadLocalModels,
    cancelLocalModelDownload,
    provider,
    setProvider,
    cloudModels,
    cloudProviderStatus,
    cloudConfigSource,
    missingApiKey,
  };
};
