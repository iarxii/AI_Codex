import { useState, useEffect, useCallback, useRef } from 'react';
import { liteRtService, type SystemCapabilities, type AcceleratorType, AVAILABLE_MODELS } from '../services/liteRtService';
import { config, getApiUrl } from '../config';
import { getProviderApiKey, getProviderConnectionParams, ALL_CLOUD_PROVIDERS } from '../config/providerConfig';
import type { ProviderId } from '../components/providerMeta';
import { clearAuthSession, getValidToken } from '../utils/authToken';
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
  'groq', 'openai', 'openrouter', 'gemini', 'anthropic', 'azure',
  'cloudflare_ai_gateway', 'workers_ai',
  'deepseek', 'xai', 'together', 'fireworks', 'nvidia', 'perplexity',
  'cohere', 'mistral', 'huggingface', 'cerebras',
]);

type CloudModel = { id: string; name: string };
type ConversationSummary = {
  id: number;
  title: string;
  updated_at: string;
};

type ConversationDetail = {
  id: number;
  title: string;
  updated_at: string;
  messages: Array<{
    id: number;
    role: string;
    content: string;
    created_at: string;
  }>;
};

type ActiveSession = ConversationSummary | null;

const DEFAULT_CLOUD_PROVIDER: ProviderId = 'ollama_cloud';

const resolveCloudProvider = (): ProviderId => {
  const persisted = localStorage.getItem('ai_provider') as ProviderId | null;
  if (persisted && ALL_CLOUD_PROVIDERS.includes(persisted)) return persisted;
  return DEFAULT_CLOUD_PROVIDER;
};

const readPersistedModelFor = (prov: ProviderId): string =>
  localStorage.getItem(`ai_model_${prov}`) || '';

export const useLiteRtChat = () => {
  const [messages, setMessages] = useState<LiteMessage[]>([]);
  const [sessions, setSessions] = useState<ConversationSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [capabilities, setCapabilities] = useState<SystemCapabilities | null>(null);
  const [provider, setProviderState] = useState<ProviderId>(resolveCloudProvider);
  const [activeModelId, setActiveModelId] = useState<string>(readPersistedModelFor(resolveCloudProvider()) || 'google/gemma-3n-E4B-it-litert-lm');
  const [tps, setTps] = useState<number>(0);
  const [downloadStates, setDownloadStates] = useState<ArtifactDownloadState[]>(createInitialDownloadState);
  const downloadAbortRef = useRef<AbortController | null>(null);
  const [engineMode, setEngineMode] = useState<'local' | 'cloud'>('cloud');
  const [cloudModels, setCloudModels] = useState<Record<string, CloudModel[]>>({});
  const [cloudConfigSource, setCloudConfigSource] = useState<'backend' | 'fallback'>('fallback');
  const [cloudProviderStatus, setCloudProviderStatus] = useState<Record<string, 'live' | 'none'>>({});
  const [downloadReadiness, setDownloadReadiness] = useState<DownloadReadiness | null>(null);
  const [cloudConfigRevision, setCloudConfigRevision] = useState(0);

  const mapDbMessagesToLite = useCallback((rows: ConversationDetail['messages']): LiteMessage[] => (
    rows
      .filter((row) => row.role === 'user' || row.role === 'assistant')
      .map((row) => ({
        id: `db-${row.id}`,
        sender: row.role === 'assistant' ? 'bot' : 'user',
        content: row.content,
        timestamp: Date.parse(row.created_at) || Date.now(),
        engine: 'cloud',
      }))
  ), []);

  const getAuthHeadersOptional = useCallback((): Record<string, string> => {
    const token = getValidToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const hasValidAuth = useCallback(() => Boolean(getValidToken()), []);

  const refreshSessions = useCallback(async (): Promise<ConversationSummary[]> => {
    if (!hasValidAuth()) {
      setSessions([]);
      return [];
    }
    setSessionsLoading(true);
    try {
      const baseUrl = getApiUrl(false);
      const response = await fetch(`${baseUrl}${config.API_V1_STR}/conversations/`, {
        headers: getAuthHeadersOptional(),
      });

      if (response.status === 401) {
        clearAuthSession();
        setSessions([]);
        return [];
      }
      if (!response.ok) throw new Error(`Failed to load sessions (${response.status})`);

      const data = await response.json();
      const list: ConversationSummary[] = Array.isArray(data) ? data : [];
      setSessions(list);
      return list;
    } catch (error) {
      console.error('Failed to refresh LiteChat sessions:', error);
      setSessions([]);
      return [];
    } finally {
      setSessionsLoading(false);
    }
  }, [getAuthHeadersOptional, hasValidAuth]);

  const loadConversation = useCallback(async (conversationId: number) => {
    if (!hasValidAuth()) return;
    const baseUrl = getApiUrl(false);
    const response = await fetch(`${baseUrl}${config.API_V1_STR}/conversations/${conversationId}`, {
      headers: getAuthHeadersOptional(),
    });

    if (response.status === 401) {
      clearAuthSession();
      return;
    }
    if (!response.ok) throw new Error(`Failed to load conversation (${response.status})`);

    const detail = await response.json() as ConversationDetail;
    setActiveConversationId(detail.id);
    setMessages(mapDbMessagesToLite(detail.messages || []));
  }, [getAuthHeadersOptional, hasValidAuth, mapDbMessagesToLite]);

  const createConversation = useCallback(async (): Promise<number | null> => {
    if (!hasValidAuth()) return null;
    try {
      const baseUrl = getApiUrl(false);
      const response = await fetch(`${baseUrl}${config.API_V1_STR}/conversations/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeadersOptional(),
        },
        body: JSON.stringify({ title: 'New Conversation' }),
      });

      if (response.status === 401) {
        clearAuthSession();
        return null;
      }
      if (!response.ok) throw new Error(`Failed to create conversation (${response.status})`);

      const created = await response.json() as ConversationSummary;
      setActiveConversationId(created.id);
      setMessages([]);
      await refreshSessions();
      return created.id;
    } catch (error) {
      console.error('Failed to create LiteChat conversation:', error);
      return null;
    }
  }, [getAuthHeadersOptional, hasValidAuth, refreshSessions]);

  const deleteConversation = useCallback(async (conversationId: number) => {
    if (!hasValidAuth()) return;
    try {
      const baseUrl = getApiUrl(false);
      const response = await fetch(`${baseUrl}${config.API_V1_STR}/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: getAuthHeadersOptional(),
      });
      if (!response.ok) throw new Error(`Failed to delete conversation (${response.status})`);

      const remaining = await refreshSessions();
      if (activeConversationId === conversationId) {
        if (remaining[0]?.id) {
          await loadConversation(remaining[0].id);
        } else {
          setActiveConversationId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Failed to delete LiteChat conversation:', error);
    }
  }, [activeConversationId, getAuthHeadersOptional, hasValidAuth, loadConversation, refreshSessions]);

  const activeSession: ActiveSession =
    sessions.find((session) => session.id === activeConversationId) || null;

  // Whether the currently selected provider needs an API key that the user
  // hasn't saved yet. Surfaced in the UI so the user knows to configure it
  // instead of sending requests that are guaranteed to fail upstream.
  const missingApiKey = PROVIDERS_REQUIRING_KEY.has(provider) && !getProviderApiKey(provider);

  // Update model when provider changes (only for cloud).
  // Preference order: current selection (if still valid), persisted provider model,
  // then first available model from live catalog.
  useEffect(() => {
    if (engineMode !== 'cloud' || !cloudModels[provider]?.length) return;

    const models = cloudModels[provider];
    if (models.some((m) => m.id === activeModelId)) return;

    const persistedModel = readPersistedModelFor(provider);
    const nextModel =
      models.find((m) => m.id === persistedModel)?.id || models[0].id;

    setActiveModelId(nextModel);
    localStorage.setItem(`ai_model_${provider}`, nextModel);
    localStorage.setItem('ai_model', nextModel);
  }, [provider, engineMode, cloudModels, activeModelId]);

  // Re-hydrate provider/model when Settings are saved.
  useEffect(() => {
    const onSettingsChanged = () => {
      const nextProvider = resolveCloudProvider();
      setProviderState(nextProvider);
      const nextModel = readPersistedModelFor(nextProvider);
      setActiveModelId(nextModel);
      setCloudConfigRevision((revision) => revision + 1);
    };

    const onStorageChanged = (event: StorageEvent) => {
      if (!event.key || (
        event.key !== 'ai_provider' &&
        !event.key.startsWith('ai_model_') &&
        !event.key.endsWith('_api_key') &&
        !event.key.endsWith('_base_url') &&
        !event.key.endsWith('_url')
      )) return;
      onSettingsChanged();
    };

    window.addEventListener('ai-settings-changed', onSettingsChanged);
    window.addEventListener('storage', onStorageChanged);
    return () => {
      window.removeEventListener('ai-settings-changed', onSettingsChanged);
      window.removeEventListener('storage', onStorageChanged);
    };
  }, []);

  // Load models for the selected provider directly. This matches the Settings
  // connection test and avoids holding model selection hostage to a bulk
  // request for every configured provider.
  useEffect(() => {
    let cancelled = false;
    const fetchProviderModels = async () => {
      const apiKey = getProviderApiKey(provider);
      const connectionParams = getProviderConnectionParams(provider);
      const token = getValidToken();
      const headers: Record<string, string> = {};

      if (token) headers.Authorization = `Bearer ${token}`;
      if (apiKey) headers['X-API-Key'] = apiKey;
      if (connectionParams.base_url) headers['X-Base-Url'] = connectionParams.base_url;
      if (connectionParams.account_id) headers['X-Account-Id'] = connectionParams.account_id;
      if (connectionParams.gateway_id) headers['X-Gateway-Id'] = connectionParams.gateway_id;

      try {
        const baseUrl = getApiUrl(false);
        const response = await fetch(
          `${baseUrl}${config.API_V1_STR}/models?provider=${encodeURIComponent(provider)}`,
          { headers },
        );
        if (response.status === 401) {
          clearAuthSession();
          setCloudConfigSource('fallback');
          return;
        }
        if (!response.ok) throw new Error(`Model lookup failed with status ${response.status}`);
        const data = await response.json();
        if (cancelled || !Array.isArray(data)) return;

        const models = data.map((model: any) => ({
          id: String(model.id ?? model.name),
          name: String(model.name ?? model.id),
        }));
        setCloudModels((previous) => ({ ...previous, [provider]: models }));
        setCloudProviderStatus((previous) => ({
          ...previous,
          [provider]: models.length ? 'live' : 'none',
        }));
        setCloudConfigSource('backend');
      } catch (error) {
        console.warn(`Model lookup failed for ${provider}; no provider catalog available.`, error);
        if (!cancelled) {
          setCloudModels((previous) => ({ ...previous, [provider]: [] }));
          setCloudProviderStatus((previous) => ({ ...previous, [provider]: 'none' }));
        }
        setCloudConfigSource('fallback');
      }
    };
    fetchProviderModels();
    return () => { cancelled = true; };
  }, [provider, cloudConfigRevision]);

  // Load capabilities on mount
  useEffect(() => {
    const fetchCapabilities = async () => {
      const caps = await liteRtService.checkCapabilities();
      setCapabilities(caps);
    };
    fetchCapabilities();
  }, []);

  // Hydrate conversation sessions and load the latest one by default.
  useEffect(() => {
    let cancelled = false;
    const hydrateSessions = async () => {
      if (!hasValidAuth()) {
        setSessions([]);
        return;
      }
      const list = await refreshSessions();
      if (cancelled || activeConversationId || !list[0]?.id) return;
      try {
        await loadConversation(list[0].id);
      } catch (error) {
        console.error('Failed to load latest LiteChat session:', error);
      }
    };
    hydrateSessions();
    return () => { cancelled = true; };
  }, [refreshSessions, loadConversation, activeConversationId, hasValidAuth]);

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

  const setProvider = useCallback((nextProvider: ProviderId) => {
    const normalized = ALL_CLOUD_PROVIDERS.includes(nextProvider)
      ? nextProvider
      : DEFAULT_CLOUD_PROVIDER;

    setProviderState(normalized);
    localStorage.setItem('ai_provider', normalized);

    const persistedModel = readPersistedModelFor(normalized);
    setActiveModelId(persistedModel);
  }, []);

  const selectModel = useCallback(async (modelId: string) => {
    setActiveModelId(modelId);
    localStorage.setItem(`ai_model_${provider}`, modelId);
    localStorage.setItem('ai_model', modelId);
  }, [provider]);

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
        const headers = getAuthHeadersOptional();
        const isAuthenticated = hasValidAuth();
        let conversationId = activeConversationId;
        if (isAuthenticated && !conversationId) {
          conversationId = await createConversation();
        }

        const baseUrl = getApiUrl(false); // Base deployment endpoint

        const response = await fetch(`${baseUrl}${config.API_V1_STR}/chat/quick`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            system_context: 'You are the AICodex Chat assistant, a fast, friendly conversational agent embedded in the AICodex Chat (LiteRT) portal. Keep replies concise, clear, and helpful.',
            message: content,
            ...(conversationId ? { conversation_id: conversationId } : {}),
            provider: provider,
            model: activeModelId,
            api_key: getProviderApiKey(provider) || undefined,
            ...getProviderConnectionParams(provider),
          })
        });

        if (response.status === 401) {
          clearAuthSession();
          throw new Error('Authentication required. Please log in to enable persisted chat sessions.');
        }

        if (response.ok) {
          const data = await response.json();
          if (data?.conversation_id && Number.isFinite(Number(data.conversation_id))) {
            setActiveConversationId(Number(data.conversation_id));
          }
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
          if (isAuthenticated) await refreshSessions();
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
  }, [
    loading,
    engineMode,
    provider,
    capabilities,
    selectModel,
    activeModelId,
    activeConversationId,
    hasValidAuth,
    createConversation,
    getAuthHeadersOptional,
    refreshSessions,
  ]);

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
    sessions,
    sessionsLoading,
    activeConversationId,
    activeSession,
    loading,
    capabilities,
    activeModelId,
    tps,
    engineMode,
    setEngineMode,
    selectModel,
    sendMessage,
    clearChat,
    refreshSessions,
    loadConversation,
    createConversation,
    deleteConversation,
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
