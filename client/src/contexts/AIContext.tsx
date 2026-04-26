import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ProviderId = 'local' | 'groq' | 'openrouter' | 'gemini';

interface AIContextType {
  provider: ProviderId;
  model: string;
  setProvider: (p: ProviderId) => void;
  setModel: (m: string) => void;
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

  const getApiKey = (p: ProviderId) => {
    switch (p) {
      case 'groq': return localStorage.getItem('groq_api_key');
      case 'openrouter': return localStorage.getItem('openrouter_api_key');
      case 'gemini': return localStorage.getItem('gemini_api_key');
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
      });
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
    <AIContext.Provider value={{ provider, model: activeModel, setProvider, setModel, getApiKey }}>
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
