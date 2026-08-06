export interface TradingInstrument {
  symbol: string;
  name: string;
  category: string;
  basePrice: number;
  displayDecimals: number;
}

export const TRADING_INSTRUMENTS: TradingInstrument[] = [
  { symbol: "BTCUSD", name: "Bitcoin / USD", category: "Cryptocurrencies", basePrice: 95000, displayDecimals: 2 },
  { symbol: "ETHUSD", name: "Ethereum / USD", category: "Cryptocurrencies", basePrice: 3400, displayDecimals: 2 },
  { symbol: "XRPUSD", name: "Ripple / USD", category: "Cryptocurrencies", basePrice: 0.62, displayDecimals: 4 },
  { symbol: "EURUSD", name: "Euro / US Dollar", category: "Forex", basePrice: 1.085, displayDecimals: 4 },
  { symbol: "GBPUSD", name: "Pound / US Dollar", category: "Forex", basePrice: 1.265, displayDecimals: 4 },
  { symbol: "ZARUSD", name: "SA Rand / US Dollar", category: "Forex", basePrice: 18.5, displayDecimals: 4 },
  { symbol: "TSLA", name: "Tesla Inc.", category: "US M7 Stocks", basePrice: 245, displayDecimals: 2 },
  { symbol: "AAPL", name: "Apple Inc.", category: "US M7 Stocks", basePrice: 185, displayDecimals: 2 },
  { symbol: "MSFT", name: "Microsoft Corp.", category: "US M7 Stocks", basePrice: 420, displayDecimals: 2 },
  { symbol: "GOOGL", name: "Alphabet Inc.", category: "US M7 Stocks", basePrice: 175, displayDecimals: 2 },
  { symbol: "META", name: "Meta Platforms Inc.", category: "US M7 Stocks", basePrice: 470, displayDecimals: 2 },
  { symbol: "NVDA", name: "NVIDIA Corp.", category: "US M7 Stocks", basePrice: 900, displayDecimals: 2 },
  { symbol: "AMZN", name: "Amazon.com Inc.", category: "US M7 Stocks", basePrice: 180, displayDecimals: 2 },
  { symbol: "XAUUSD", name: "Gold / USD", category: "Commodities", basePrice: 2400, displayDecimals: 2 },
  { symbol: "USOIL", name: "WTI Crude Oil", category: "Commodities", basePrice: 78, displayDecimals: 2 },
  { symbol: "BRENT", name: "Brent Crude Oil", category: "Commodities", basePrice: 82, displayDecimals: 2 },
  { symbol: "NATGAS", name: "Natural Gas", category: "Commodities", basePrice: 2.5, displayDecimals: 3 },
  { symbol: "SPX500", name: "S&P 500 Index", category: "ETFs / Indices", basePrice: 5300, displayDecimals: 2 },
  { symbol: "STX40", name: "Top 40 Index", category: "ETFs / Indices", basePrice: 7500, displayDecimals: 2 },
];

export const getTradingInstrument = (symbol: string): TradingInstrument =>
  TRADING_INSTRUMENTS.find((instrument) => instrument.symbol === symbol) ?? TRADING_INSTRUMENTS[0];

export const formatTradingPrice = (symbol: string, price: number): string =>
  price.toLocaleString(undefined, {
    minimumFractionDigits: getTradingInstrument(symbol).displayDecimals,
    maximumFractionDigits: getTradingInstrument(symbol).displayDecimals,
  });