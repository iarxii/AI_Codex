export interface MarketCandle {
  close: number;
}

export type MarketSentiment = "BULLISH" | "BEARISH" | "NEUTRAL";

export interface MarketSignal {
  sentiment: MarketSentiment;
  strength: number;
  confidence: "Low" | "Medium" | "High";
  percentChange: number;
  description: string;
}

export const calculateMarketSignal = (symbol: string, candles: MarketCandle[], livePrice?: number): MarketSignal => {
  const prices = candles.map((candle) => candle.close).filter((price) => Number.isFinite(price) && price > 0);
  const currentPrice = livePrice && livePrice > 0 ? livePrice : prices.at(-1);
  const referencePrice = prices.at(Math.max(0, prices.length - 8));

  if (!currentPrice || !referencePrice) {
    return {
      sentiment: "NEUTRAL",
      strength: 0,
      confidence: "Low",
      percentChange: 0,
      description: `${symbol} is waiting for enough market data to establish a directional signal.`,
    };
  }

  const percentChange = ((currentPrice - referencePrice) / referencePrice) * 100;
  const absoluteChange = Math.abs(percentChange);
  const sentiment: MarketSentiment = absoluteChange < 0.08 ? "NEUTRAL" : percentChange > 0 ? "BULLISH" : "BEARISH";
  const strength = Math.min(99, Math.max(50, Math.round(50 + absoluteChange * 38)));
  const confidence: MarketSignal["confidence"] = prices.length >= 8 && absoluteChange >= 0.2 ? "High" : prices.length >= 4 ? "Medium" : "Low";
  const direction = sentiment === "NEUTRAL" ? "is consolidating" : sentiment === "BULLISH" ? "has moved higher" : "has moved lower";

  return {
    sentiment,
    strength,
    confidence,
    percentChange,
    description: `${symbol} ${direction} ${absoluteChange.toFixed(2)}% across the recent price window. This signal is calculated from market price movement, not external sentiment.`
  };
};