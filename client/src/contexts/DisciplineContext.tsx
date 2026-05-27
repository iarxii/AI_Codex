import React, { createContext, useContext, useState, useEffect } from 'react';

interface DisciplineState {
  dailyLimitRemaining: number;
  activeSessionRules: {
    isOpen: boolean;
    name: string;
  };
  allowedSymbolsWhitelist: string[];
  isGateLocked: boolean;
  activeExposurePercent: number;
}

interface DisciplineContextType {
  state: DisciplineState;
  updateExposure: (exposure: number) => void;
  recordTradeResult: (pnl: number) => void;
}

const defaultState: DisciplineState = {
  dailyLimitRemaining: 2.8, // 2.8% remaining of 3% limit (drawdown = 0.2%)
  activeSessionRules: {
    isOpen: true,
    name: "London/NY Overlap"
  },
  allowedSymbolsWhitelist: [
    "BTCUSD", "ETHUSD", "XRPUSD",
    "EURUSD", "GBPUSD", "ZARUSD",
    "TSLA", "AAPL", "MSFT", "GOOGL", "META", "NVDA", "AMZN",
    "XAUUSD", "USOIL", "BRENT", "NATGAS",
    "SPX500", "STX40"
  ],
  isGateLocked: false,
  activeExposurePercent: 7.5, // 7.5% active exposure initial state
};

const DisciplineContext = createContext<DisciplineContextType | undefined>(undefined);

export const DisciplineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DisciplineState>(defaultState);

  // Simulate MQL5 Background Scan for Gate Locking
  useEffect(() => {
    setState(prev => {
      const isLocked = prev.dailyLimitRemaining <= 0 || !prev.activeSessionRules.isOpen || prev.activeExposurePercent >= 20;
      if (prev.isGateLocked !== isLocked) {
        return { ...prev, isGateLocked: isLocked };
      }
      return prev;
    });
  }, [state.dailyLimitRemaining, state.activeSessionRules.isOpen, state.activeExposurePercent]);

  const updateExposure = (exposure: number) => {
    setState(prev => ({ ...prev, activeExposurePercent: exposure }));
  };

  const recordTradeResult = (pnlPercent: number) => {
    setState(prev => ({
      ...prev,
      dailyLimitRemaining: Math.min(3.0, prev.dailyLimitRemaining + pnlPercent) // Cap at initial limit if we want, or let it grow if profit
    }));
  };

  return (
    <DisciplineContext.Provider value={{ state, updateExposure, recordTradeResult }}>
      {children}
    </DisciplineContext.Provider>
  );
};

export const useDiscipline = () => {
  const context = useContext(DisciplineContext);
  if (context === undefined) {
    throw new Error('useDiscipline must be used within a DisciplineProvider');
  }
  return context;
};
