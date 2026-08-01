import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { config, getApiUrl } from '../config';
import { getProviderApiKey } from '../config/providerConfig';
import type { ProviderId } from '../components/providerMeta';
import { clearAuthSession, getValidToken } from '../utils/authToken';

export type { ProviderId };

export interface UserProfile {
  title?: string;
  first_name?: string;
  surname?: string;
  dob?: string;
  gender?: string;
  pronouns?: string;
  country?: string;
  profession?: string;
  role?: string;
}

export interface VisualSettings {
  isDynamic: boolean;
  showScanlines: boolean;
  showGlitches: boolean;
  showGrain: boolean;
  showVideo: boolean;
  showTraces: boolean;
  showWaves: boolean;
  showNeuralStrings: boolean;
  stringColor: 'orange' | 'white' | 'dark';
  showMonochrome: boolean;
  showStillBackground: boolean;
}

export interface ModelConfig {
  temperature: number;
  top_k: number;
  top_p: number;
  max_tokens: number;
  thinking: boolean;
}

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  temperature: 0.7,
  top_k: 40,
  top_p: 0.9,
  max_tokens: 1024,
  thinking: false,
};

const DEFAULT_VISUAL_SETTINGS: VisualSettings = {
  isDynamic: true,
  showScanlines: true,
  showGlitches: true,
  showGrain: false,
  showVideo: false,
  showTraces: true,
  showWaves: true,
  showNeuralStrings: true,
  stringColor: 'white',
  showMonochrome: false,
  showStillBackground: true,
};

export interface CodexSpace {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string | null;
  color?: string;
  is_public: boolean;
  is_active: boolean;
  capacity: number;
  config_json?: string;
  recommended_provider?: string;
  recommended_model?: string;
}

interface AIContextType {
  provider: ProviderId;
  model: string;
  userProfile: UserProfile | null;
  visualSettings: VisualSettings;
  modelConfig: ModelConfig;
  activeSpace: CodexSpace | null;
  isPremiumSpace: boolean;
  isPremiumBackendOnline: boolean;
  availableSpaces: CodexSpace[];
  setActiveSpace: (space: CodexSpace | null) => void;
  setAvailableSpaces: (spaces: CodexSpace[]) => void;
  viewSpacesCatalog: boolean;
  setViewSpacesCatalog: (val: boolean) => void;
  setProvider: (p: ProviderId) => void;
  setModel: (m: string, p?: ProviderId) => void;
  updateVisualSetting: <K extends keyof VisualSettings>(key: K, value: VisualSettings[K]) => void;
  updateModelConfig: <K extends keyof ModelConfig>(key: K, value: ModelConfig[K]) => void;
  updateUserProfile: (profile: UserProfile) => Promise<void>;
  getApiKey: (p: ProviderId) => string | null;
  getAllApiKeys: () => Record<string, string | null>;
  refreshProfile: () => Promise<void>;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [provider, setProviderState] = useState<ProviderId>(
    (localStorage.getItem('ai_provider') as ProviderId) || 'local'
  );
  
  const [models, setModels] = useState<Record<ProviderId, string>>({
    local: localStorage.getItem('ai_model_local') || '',
    groq: localStorage.getItem('ai_model_groq') || '',
    openai: localStorage.getItem('ai_model_openai') || '',
    openrouter: localStorage.getItem('ai_model_openrouter') || '',
    gemini: localStorage.getItem('ai_model_gemini') || '',
    ollama_cloud: localStorage.getItem('ai_model_ollama_cloud') || '',
    colab_bridge: localStorage.getItem('ai_model_colab_bridge') || '',
    cloudflare_ai_gateway: localStorage.getItem('ai_model_cloudflare_ai_gateway') || '',
    workers_ai: localStorage.getItem('ai_model_workers_ai') || '',
    anthropic: localStorage.getItem('ai_model_anthropic') || '',
    azure: localStorage.getItem('ai_model_azure') || '',
    deepseek: localStorage.getItem('ai_model_deepseek') || '',
    xai: localStorage.getItem('ai_model_xai') || '',
    together: localStorage.getItem('ai_model_together') || '',
    fireworks: localStorage.getItem('ai_model_fireworks') || '',
    nvidia: localStorage.getItem('ai_model_nvidia') || '',
    perplexity: localStorage.getItem('ai_model_perplexity') || '',
    cohere: localStorage.getItem('ai_model_cohere') || '',
    mistral: localStorage.getItem('ai_model_mistral') || '',
    huggingface: localStorage.getItem('ai_model_huggingface') || '',
    cerebras: localStorage.getItem('ai_model_cerebras') || '',
    litert: localStorage.getItem('ai_model_litert') || '',
  });

  const [visualSettings, setVisualSettings] = useState<VisualSettings>(() => {
    const saved = localStorage.getItem('ai_visual_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return DEFAULT_VISUAL_SETTINGS;
  });

  // Removed unused modelConfig state
  
  const [activeSpace, setActiveSpace] = useState<CodexSpace | null>(() => {
    const saved = localStorage.getItem('ai_active_space');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
  });

  const [availableSpaces, setAvailableSpaces] = useState<CodexSpace[]>([]);
  const [viewSpacesCatalog, setViewSpacesCatalog] = useState<boolean>(false);
  const [isPremiumBackendOnline, setIsPremiumBackendOnline] = useState<boolean>(false);

  const updateActiveSpace = (space: CodexSpace | null) => {
    setActiveSpace(space);
    if (space) {
        localStorage.setItem('ai_active_space', JSON.stringify(space));
        localStorage.setItem('ai_sidebar_tab', 'spaces');
        setViewSpacesCatalog(false);
    } else {
        localStorage.removeItem('ai_active_space');
    }
  };

  const [modelConfigs, setModelConfigs] = useState<Record<string, ModelConfig>>(() => {
    const saved = localStorage.getItem('ai_model_configs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {};
  });

  let isPremiumSpace = false;
  try { isPremiumSpace = !!(activeSpace?.config_json && JSON.parse(activeSpace.config_json).premium); } catch { /* malformed config_json */ }

  const activeModel = models[provider];

  const refreshProfile = async () => {
    const token = getValidToken();
    if (!token) return;

    try {
      const res = await fetch(`${config.API_BASE_URL}${config.API_V1_STR}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data.profile);
        if (data.settings) {
          try {
            const synced = JSON.parse(data.settings);
            if (synced.visual) setVisualSettings(synced.visual);
            if (synced.models) setModelConfigs(synced.models);
          } catch (e) {}
        }

        // Validate stored active space against server authorization
        const savedSpaceStr = localStorage.getItem('ai_active_space');
        if (savedSpaceStr) {
          try {
            const savedSpace = JSON.parse(savedSpaceStr);
            const spaceRes = await fetch(`${config.API_BASE_URL}${config.API_V1_STR}/spaces/${savedSpace.slug}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (spaceRes.ok) {
              const validatedSpace = await spaceRes.json();
              setActiveSpace(validatedSpace);
              localStorage.setItem('ai_active_space', JSON.stringify(validatedSpace));
            } else {
              console.warn(`[AIContext] Space ${savedSpace.slug} validation failed (${spaceRes.status}). Clearing active space.`);
              setActiveSpace(null);
              localStorage.removeItem('ai_active_space');
              localStorage.setItem('ai_sidebar_tab', 'workspaces');
            }
          } catch (e) {
            console.error('Failed to validate active space', e);
          }
        }
      } else if (res.status === 401) {
        clearAuthSession();
        setUserProfile(null);
        setActiveSpace(null);
      }
    } catch (e) {
      console.error('Failed to sync profile', e);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  // Premium Backend Pulse (Neural Keep-Alive)
  useEffect(() => {
    let pulseInterval: any;
    
    const sendPulse = async () => {
      // getApiUrl(true) will return Colab URL if available, then Premium URL, then Base URL
      const premiumUrl = getApiUrl(true);
      
      // We only pulse if it's actually a separate premium/colab endpoint
      if (!premiumUrl || premiumUrl === config.API_BASE_URL) return;
      
      try {
        await fetch(`${premiumUrl}/healthz`, {
          headers: { 
            'X-Codex-Premium-Key': config.COLAB_SECRET || 'fallback_key' 
          }
        });
        setIsPremiumBackendOnline(true);
        console.log("[Neural Pulse] Premium connection maintained.");
      } catch (e) {
        setIsPremiumBackendOnline(false);
        console.warn("[Neural Pulse] Heartbeat failed - Premium instance may be sleeping.");
      }
    };

    // Initial pulse after 5s, then every 45s
    const timeout = setTimeout(() => {
      sendPulse();
      pulseInterval = setInterval(sendPulse, 45000);
    }, 5000);

    return () => {
      clearTimeout(timeout);
      if (pulseInterval) clearInterval(pulseInterval);
    };
  }, [activeSpace]); // Re-initialize pulse if activeSpace changes (to ensure we hit the right endpoint)

  const syncSettingsToCloud = async (visual?: VisualSettings, models?: Record<string, ModelConfig>) => {
    const token = getValidToken();
    if (!token) return;

    const settings_json = JSON.stringify({
      visual: visual || visualSettings,
      models: models || modelConfigs
    });

    try {
      await fetch(`${config.API_BASE_URL}${config.API_V1_STR}/profile/settings`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ settings_json })
      });
    } catch (e) {
      console.error('Cloud sync failed', e);
    }
  };

  const setProvider = (p: ProviderId) => {
    setProviderState(p);
    localStorage.setItem('ai_provider', p);
  };

  const setModel = (m: string, p?: ProviderId) => {
    const targetProvider = p || provider;
    setModels(prev => ({ ...prev, [targetProvider]: m }));
    localStorage.setItem(`ai_model_${targetProvider}`, m);
    localStorage.setItem('ai_model', m);
  };

  const updateVisualSetting = <K extends keyof VisualSettings>(key: K, value: VisualSettings[K]) => {
    setVisualSettings(prev => {
      let next = { ...prev, [key]: value };
      if (key === 'showStillBackground' && value === true) next.showVideo = false;
      else if (key === 'showVideo' && value === true) next.showStillBackground = false;

      localStorage.setItem('ai_visual_settings', JSON.stringify(next));
      syncSettingsToCloud(next);
      return next;
    });
    window.dispatchEvent(new Event('ai-settings-changed'));
  };

  const updateModelConfig = <K extends keyof ModelConfig>(key: K, value: ModelConfig[K]) => {
    setModelConfigs(prev => {
      const currentModelKey = `${provider}:${activeModel || 'default'}`;
      const currentConfig = prev[currentModelKey] || DEFAULT_MODEL_CONFIG;
      const next = { 
        ...prev, 
        [currentModelKey]: { ...currentConfig, [key]: value } 
      };
      localStorage.setItem('ai_model_configs', JSON.stringify(next));
      syncSettingsToCloud(undefined, next);
      return next;
    });
  };

  const updateUserProfile = async (profile: UserProfile) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${config.API_BASE_URL}${config.API_V1_STR}/profile/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        setUserProfile(prev => ({ ...prev, ...profile }));
      }
    } catch (e) {
      console.error('Profile update failed', e);
    }
  };

  const currentModelKey = `${provider}:${activeModel || 'default'}`;
  const activeModelConfig = modelConfigs[currentModelKey] || DEFAULT_MODEL_CONFIG;

  const getApiKey = (p: ProviderId) => getProviderApiKey(p);

  const getAllApiKeys = () => {
    return {
      groq: localStorage.getItem('groq_api_key'),
      openai: localStorage.getItem('openai_api_key'),
      openrouter: localStorage.getItem('openrouter_api_key'),
      gemini: localStorage.getItem('gemini_api_key'),
      ollama_cloud: localStorage.getItem('ollama_cloud_key'),
      cloudflare_ai_gateway: localStorage.getItem('cloudflare_ai_gateway_key'),
      workers_ai: localStorage.getItem('workers_ai_key'),
      anthropic: localStorage.getItem('anthropic_api_key'),
      azure: localStorage.getItem('azure_api_key'),
      deepseek: localStorage.getItem('deepseek_api_key'),
      xai: localStorage.getItem('xai_api_key'),
      together: localStorage.getItem('together_api_key'),
      fireworks: localStorage.getItem('fireworks_api_key'),
      nvidia: localStorage.getItem('nvidia_api_key'),
      perplexity: localStorage.getItem('perplexity_api_key'),
      cohere: localStorage.getItem('cohere_api_key'),
      mistral: localStorage.getItem('mistral_api_key'),
      huggingface: localStorage.getItem('huggingface_api_key'),
      cerebras: localStorage.getItem('cerebras_api_key'),
    };
  };

  return (
    <AIContext.Provider value={{ 
      provider, 
      model: activeModel, 
      userProfile,
      visualSettings,
      modelConfig: activeModelConfig,
      activeSpace,
      isPremiumSpace,
      isPremiumBackendOnline,
      availableSpaces,
      setActiveSpace: updateActiveSpace,
      setAvailableSpaces,
      viewSpacesCatalog,
      setViewSpacesCatalog,
      setProvider, 
      setModel, 
      updateVisualSetting,
      updateModelConfig,
      updateUserProfile,
      getApiKey,
      getAllApiKeys,
      refreshProfile
    }}>
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => {
  const context = useContext(AIContext);
  if (context === undefined) throw new Error('useAI must be used within an AIProvider');
  return context;
};
