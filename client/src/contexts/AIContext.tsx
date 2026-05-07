import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { config } from '../config';

export type ProviderId = 'local' | 'groq' | 'openrouter' | 'gemini' | 'ollama_cloud';

export interface UserProfile {
  title?: string;
  first_name?: string;
  surname?: string;
  dob?: string;
  gender?: string;
  pronouns?: string;
  country?: string;
  profession?: string;
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

interface AIContextType {
  provider: ProviderId;
  model: string;
  userProfile: UserProfile | null;
  visualSettings: VisualSettings;
  modelConfig: ModelConfig;
  setProvider: (p: ProviderId) => void;
  setModel: (m: string) => void;
  updateVisualSetting: <K extends keyof VisualSettings>(key: K, value: VisualSettings[K]) => void;
  updateModelConfig: <K extends keyof ModelConfig>(key: K, value: ModelConfig[K]) => void;
  updateUserProfile: (profile: UserProfile) => Promise<void>;
  getApiKey: (p: ProviderId) => string | null;
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
    openrouter: localStorage.getItem('ai_model_openrouter') || '',
    gemini: localStorage.getItem('ai_model_gemini') || '',
    ollama_cloud: localStorage.getItem('ai_model_ollama_cloud') || '',
  });

  const [visualSettings, setVisualSettings] = useState<VisualSettings>(() => {
    const saved = localStorage.getItem('ai_visual_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return DEFAULT_VISUAL_SETTINGS;
  });

  const [modelConfigs, setModelConfigs] = useState<Record<string, ModelConfig>>(() => {
    const saved = localStorage.getItem('ai_model_configs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {};
  });

  const activeModel = models[provider];

  const refreshProfile = async () => {
    const token = localStorage.getItem('token');
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
      }
    } catch (e) {
      console.error('Failed to sync profile', e);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const syncSettingsToCloud = async (visual?: VisualSettings, models?: Record<string, ModelConfig>) => {
    const token = localStorage.getItem('token');
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

  const setModel = (m: string) => {
    setModels(prev => ({ ...prev, [provider]: m }));
    localStorage.setItem(`ai_model_${provider}`, m);
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

  const getApiKey = (p: ProviderId) => {
    switch (p) {
      case 'groq': return localStorage.getItem('groq_api_key');
      case 'openrouter': return localStorage.getItem('openrouter_api_key');
      case 'gemini': return localStorage.getItem('gemini_api_key');
      case 'ollama_cloud': return localStorage.getItem('ollama_cloud_key');
      default: return null;
    }
  };

  return (
    <AIContext.Provider value={{ 
      provider, 
      model: activeModel, 
      userProfile,
      visualSettings,
      modelConfig: activeModelConfig,
      setProvider, 
      setModel, 
      updateVisualSetting,
      updateModelConfig,
      updateUserProfile,
      getApiKey,
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
