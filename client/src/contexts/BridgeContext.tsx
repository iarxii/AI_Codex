import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAI } from './AIContext';
import { config } from '../config';

interface BridgeContextType {
  isConnected: boolean;
  isConnecting: boolean;
  pingLatency: number | null;
  activeModel: string | null;
  availableModels: string[];
  countdown: number; // in seconds
  token: string | null;
  requestToken: () => Promise<string | null>;
  checkStatus: () => Promise<void>;
  resetCountdown: () => void;
  setActiveModel: (model: string | null) => void;
}

const BridgeContext = createContext<BridgeContextType | undefined>(undefined);

export const BridgeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { activeSpace, isPremiumSpace } = useAI();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [countdown, setCountdown] = useState(900); // 15 mins
  const [token, setToken] = useState<string | null>(null);

  const resetCountdown = useCallback(() => {
    setCountdown(900);
  }, []);

  const requestToken = useCallback(async () => {
    if (!activeSpace) return null;
    setIsConnecting(true);
    try {
      const authToken = localStorage.getItem('token');
      const res = await fetch(`${config.API_BASE_URL}${config.API_V1_STR}/spaces/bridge/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ space_slug: activeSpace.slug })
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setIsConnecting(false);
        return data.token;
      }
    } catch (e) {
      console.error('[BridgeContext] Failed to fetch handshake token', e);
    }
    setIsConnecting(false);
    return null;
  }, [activeSpace]);

  const checkStatus = useCallback(async () => {
    if (!activeSpace || !isPremiumSpace) {
      setIsConnected(false);
      setPingLatency(null);
      setActiveModel(null);
      setAvailableModels([]);
      return;
    }
    try {
      const authToken = localStorage.getItem('token');
      const res = await fetch(`${config.API_BASE_URL}${config.API_V1_STR}/spaces/bridge/status/${activeSpace.slug}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setIsConnected(data.is_connected);
        setPingLatency(data.latency_ms);
        setAvailableModels(data.active_models || []);
        if (data.active_models && data.active_models.length > 0) {
          // Default active model to first one if not set
          if (!activeModel || !data.active_models.includes(activeModel)) {
            setActiveModel(data.active_models[0]);
          }
        } else {
          setActiveModel(null);
        }
      }
    } catch (e) {
      console.error('[BridgeContext] Failed to check bridge status', e);
    }
  }, [activeSpace, isPremiumSpace, activeModel]);

  // Polling loop for status checking
  useEffect(() => {
    if (!activeSpace || !isPremiumSpace) return;
    
    // Check status immediately, then poll every 6 seconds
    checkStatus();
    const interval = setInterval(checkStatus, 6000);
    return () => clearInterval(interval);
  }, [activeSpace, isPremiumSpace, checkStatus]);

  // Countdown timer decrement and user activity listeners
  useEffect(() => {
    if (!isConnected) return;
    
    const handleActivity = () => {
      resetCountdown();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          return 0; // Countdown reached zero
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(interval);
    };
  }, [isConnected, resetCountdown]);

  return (
    <BridgeContext.Provider value={{
      isConnected,
      isConnecting,
      pingLatency,
      activeModel,
      availableModels,
      countdown,
      token,
      requestToken,
      checkStatus,
      resetCountdown,
      setActiveModel
    }}>
      {children}
    </BridgeContext.Provider>
  );
};

export const useBridge = () => {
  const context = useContext(BridgeContext);
  if (context === undefined) throw new Error('useBridge must be used within a BridgeProvider');
  return context;
};
