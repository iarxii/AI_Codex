import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { config, getWsUrl } from "../../../config";
import { calculateMarketSignal, type MarketCandle, type MarketSignal } from "./marketSignal";
import { getTradingInstrument } from "./instruments";

export interface MarketQuote {
  symbol: string;
  price: number;
  change_percent: number;
  source: "yfinance" | "fallback";
  timestamp: string;
}

interface TradingMarketContextValue {
  selectedSymbol: string;
  selectSymbol: (symbol: string) => void;
  price: number | null;
  quotes: Record<string, MarketQuote>;
  candles: MarketCandle[];
  signal: MarketSignal;
  isLoading: boolean;
}

const TradingMarketContext = createContext<TradingMarketContextValue | undefined>(undefined);

interface TradingMarketProviderProps {
  children: ReactNode;
  enabled?: boolean;
}

export const TradingMarketProvider: React.FC<TradingMarketProviderProps> = ({ children, enabled = true }) => {
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSD");
  const [price, setPrice] = useState<number | null>(null);
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    setIsLoading(true);
    setPrice(null);

    fetch(`${config.API_BASE_URL}${config.API_V1_STR}/market/history?symbol=${selectedSymbol}&range=1D`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load market history");
        return response.json();
      })
      .then((history: MarketCandle[]) => {
        if (!active) return;
        setCandles(history);
        setPrice(history.at(-1)?.close ?? getTradingInstrument(selectedSymbol).basePrice);
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          setCandles([]);
          setPrice(getTradingInstrument(selectedSymbol).basePrice);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled, selectedSymbol]);

  useEffect(() => {
    if (!enabled) {
      setQuotes({});
      return;
    }

    let active = true;
    const loadQuotes = async () => {
      try {
        const response = await fetch(`${config.API_BASE_URL}${config.API_V1_STR}/market/quotes`);
        if (!response.ok) throw new Error("Unable to load market quotes");
        const data = await response.json() as { quotes?: MarketQuote[] };
        if (!active || !data.quotes) return;
        setQuotes(Object.fromEntries(data.quotes.map((quote) => [quote.symbol, quote])));
      } catch {
        if (active) setQuotes({});
      }
    };

    loadQuotes();
    const intervalId = window.setInterval(loadQuotes, 30_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const socket = new WebSocket(`${getWsUrl()}/api/market/live?symbol=${selectedSymbol}`);
    socket.onmessage = (event) => {
      const update = JSON.parse(event.data) as { price?: number };
      if (typeof update.price === "number") setPrice(update.price);
    };
    return () => socket.close();
  }, [enabled, selectedSymbol]);

  const signal = useMemo(() => calculateMarketSignal(selectedSymbol, candles, price ?? undefined), [candles, price, selectedSymbol]);
  const value = useMemo(() => ({
    selectedSymbol,
    selectSymbol: setSelectedSymbol,
    price,
    quotes,
    candles,
    signal,
    isLoading,
  }), [candles, isLoading, price, quotes, selectedSymbol, signal]);

  return <TradingMarketContext.Provider value={value}>{children}</TradingMarketContext.Provider>;
};

export const useTradingMarket = (): TradingMarketContextValue => {
  const context = useContext(TradingMarketContext);
  if (!context) throw new Error("useTradingMarket must be used inside TradingMarketProvider");
  return context;
};