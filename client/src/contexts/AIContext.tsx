import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ProviderId = 'local' | 'groq' | 'openrouter' | 'gemini' | 'ollama_cloud';

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

interface AIContextType {
  provider: ProviderId;
  model: string;
  visualSettings: VisualSettings;
  setProvider: (p: ProviderId) => void;
  setModel: (m: string) => void;
  updateVisualSetting: <K extends keyof VisualSettings>(key: K, value: VisualSettings[K]) => void;
  getApiKey: (p: ProviderId) => string | null;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [provider, setProviderState] = useState<ProviderId>(
    (localStorage.getItem('ai_provider') as ProviderId) || 'local'
  );
  
  // We store a separate state for each provider's model
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
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse visual settings', e);
      }
    }
    return {
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
  });

  const activeModel = models[provider];

  const setProvider = (p: ProviderId) => {
    setProviderState(p);
    localStorage.setItem('ai_provider', p);
  };

  const setModel = (m: string) => {
    setModels(prev => ({ ...prev, [provider]: m }));
    localStorage.setItem(`ai_model_${provider}`, m);
    // Backward compatibility for components still reading 'ai_model'
    localStorage.setItem('ai_model', m);
  };

  const updateVisualSetting = <K extends keyof VisualSettings>(key: K, value: VisualSettings[K]) => {
    setVisualSettings(prev => {
      let next = { ...prev, [key]: value };
      
      // Mutual exclusion: Still Background vs Video Layer
      if (key === 'showStillBackground' && value === true) {
        next.showVideo = false;
      } else if (key === 'showVideo' && value === true) {
        next.showStillBackground = false;
      }

      localStorage.setItem('ai_visual_settings', JSON.stringify(next));
      return next;
    });
    // Notify components not using context if necessary
    window.dispatchEvent(new Event('ai-settings-changed'));
  };

  const getApiKey = (p: ProviderId) => {
    switch (p) {
      case 'groq': return localStorage.getItem('groq_api_key');
      case 'openrouter': return localStorage.getItem('openrouter_api_key');
      case 'gemini': return localStorage.getItem('gemini_api_key');
      case 'ollama_cloud': return localStorage.getItem('ollama_cloud_key');
      default: return null;
    }
  };

  // Sync with localStorage changes from other components (like SettingsModal)
  useEffect(() => {
    const handleStorageChange = () => {
      const p = (localStorage.getItem('ai_provider') as ProviderId) || 'local';
      setProviderState(p);
      setModels({
        local: localStorage.getItem('ai_model_local') || '',
        groq: localStorage.getItem('ai_model_groq') || '',
        openrouter: localStorage.getItem('ai_model_openrouter') || '',
        gemini: localStorage.getItem('ai_model_gemini') || '',
        ollama_cloud: localStorage.getItem('ai_model_ollama_cloud') || '',
      });

      const savedVisuals = localStorage.getItem('ai_visual_settings');
      if (savedVisuals) {
        try {
          setVisualSettings(JSON.parse(savedVisuals));
        } catch (e) {}
      }
    };

    window.addEventListener('storage', handleStorageChange);
    // Also listen to custom 'ai-settings-changed' event if we use it
    window.addEventListener('ai-settings-changed', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('ai-settings-changed', handleStorageChange);
    };
  }, []);

  return (
    <AIContext.Provider value={{ 
      provider, 
      model: activeModel, 
      visualSettings,
      setProvider, 
      setModel, 
      updateVisualSetting,
      getApiKey 
    }}>
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
};
