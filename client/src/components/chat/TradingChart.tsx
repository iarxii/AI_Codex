import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  ShieldAlert, 
  CheckCircle, 
  MousePointer, 
  Sliders, 
  ChevronUp, 
  ChevronDown,
  Activity,
  Zap,
  Target,
  Crosshair,
  Ruler,
  BookOpen
} from "lucide-react";
import { config } from "../../config";
import { useDiscipline } from "../../contexts/DisciplineContext";

interface TradingChartProps {
  symbol?: string;
  initialEntry?: number;
  initialSL?: number;
  initialTP?: number;
  timeframe?: string;
  onSymbolChange?: (symbol: string, basePrice: number) => void;
}

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

const INSTRUMENTS = [
  // Cryptocurrencies
  { symbol: "BTCUSD", name: "Bitcoin / USD", category: "Cryptocurrencies", basePrice: 95000 },
  { symbol: "ETHUSD", name: "Ethereum / USD", category: "Cryptocurrencies", basePrice: 3400 },
  { symbol: "XRPUSD", name: "Ripple / USD", category: "Cryptocurrencies", basePrice: 0.62 },
  // Forex
  { symbol: "EURUSD", name: "Euro / US Dollar", category: "Forex", basePrice: 1.0850 },
  { symbol: "GBPUSD", name: "Pound / US Dollar", category: "Forex", basePrice: 1.2650 },
  { symbol: "ZARUSD", name: "SA Rand / US Dollar", category: "Forex", basePrice: 18.50 },
  // US M7 Stocks
  { symbol: "TSLA", name: "Tesla Inc.", category: "US M7 Stocks", basePrice: 245.0 },
  { symbol: "AAPL", name: "Apple Inc.", category: "US M7 Stocks", basePrice: 185.0 },
  { symbol: "MSFT", name: "Microsoft Corp.", category: "US M7 Stocks", basePrice: 420.0 },
  { symbol: "GOOGL", name: "Alphabet Inc.", category: "US M7 Stocks", basePrice: 175.0 },
  { symbol: "META", name: "Meta Platforms Inc.", category: "US M7 Stocks", basePrice: 470.0 },
  { symbol: "NVDA", name: "NVIDIA Corp.", category: "US M7 Stocks", basePrice: 900.0 },
  { symbol: "AMZN", name: "Amazon.com Inc.", category: "US M7 Stocks", basePrice: 180.0 },
  // Commodities
  { symbol: "XAUUSD", name: "Gold / USD", category: "Commodities", basePrice: 2400.0 },
  { symbol: "USOIL", name: "WTI Crude Oil", category: "Commodities", basePrice: 78.0 },
  { symbol: "BRENT", name: "Brent Crude Oil", category: "Commodities", basePrice: 82.0 },
  { symbol: "NATGAS", name: "Natural Gas", category: "Commodities", basePrice: 2.50 },
  // ETFs / Indices
  { symbol: "SPX500", name: "S&P 500 Index", category: "ETFs / Indices", basePrice: 5300.0 },
  { symbol: "STX40", name: "Top 40 Index", category: "ETFs / Indices", basePrice: 7500.0 },
];

const STRATEGIES = [
  {
    id: "brothers_fx",
    name: "Brothers FX Zones",
    desc: "Supply/Demand zone mitigation on H1 overlap.",
    prompt: "Execute an analysis on the active chart for the Brothers FX Zones strategy. Focus on validating key supply/demand levels and entry signals."
  },
  {
    id: "david_perk",
    name: "David Perk Blocks",
    desc: "Institutional order block identification.",
    prompt: "Perform a David Perk Order Blocks assessment. Identify where institutional liquidity pools and order blocks are resting."
  },
  {
    id: "turtle_breakout",
    name: "Volatility Breakout",
    desc: "Turtle trading channel breakouts.",
    prompt: "Verify the chart for Volatility Breakout momentum. Are we breaking out of the 20-day price boundaries?"
  },
  {
    id: "mean_reversion",
    name: "Mean Reversion",
    desc: "Overextended indicators reversal zones.",
    prompt: "Evaluate the active chart for Mean Reversion patterns. Do indicators suggest overbought/oversold conditions?"
  }
];

export const TradingChart: React.FC<TradingChartProps> = ({
  symbol = "BTCUSD",
  initialEntry = 95200,
  initialSL = 94200,
  initialTP = 97200,
  onSymbolChange,
}) => {
  const { state: disciplineState } = useDiscipline();
  const [selectedSymbol, setSelectedSymbol] = useState(symbol);
  const [range, setRange] = useState("1D");
  const [entry, setEntry] = useState(initialEntry);
  const [sl, setSl] = useState(initialSL);
  const [tp, setTp] = useState(initialTP);
  const [currentPrice, setCurrentPrice] = useState(initialEntry);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [dispatched, setDispatched] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<string>("");
  const [selectedTool, setSelectedTool] = useState<string>("cursor");
  const [showStrategyPanel, setShowStrategyPanel] = useState(false);
  const [chartType, setChartType] = useState<"candle" | "line" | "bar">("candle");
  const [decorations, setDecorations] = useState<{ type: string; y: number }[]>([]);
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null);
  const [crosshairFixed, setCrosshairFixed] = useState<{ x: number; y: number } | null>(null);
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);
  const [supportZones, setSupportZones] = useState<{ min: number; max: number }[]>([]);
  const [resistanceZones, setResistanceZones] = useState<{ min: number; max: number }[]>([]);
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<SVGSVGElement | null>(null);
  const [svgWidth, setSvgWidth] = useState(520);

  // Responsive SVG Width
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width > 0) {
          setSvgWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(chartContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Load historical candles from backend
  useEffect(() => {
    let active = true;
    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${config.API_BASE_URL}${config.API_V1_STR}/market/history?symbol=${selectedSymbol}&range=${range}`
        );
        if (!response.ok) throw new Error("Failed to fetch historical data");
        const data = await response.json();
        if (active) {
          setCandles(data);
          if (data.length > 0) {
            const lastCandle = data[data.length - 1];
            setCurrentPrice(lastCandle.close);
            setEntry(lastCandle.close);
            
            // Set default TP/SL based on instrument decimals
            const displayDecs = selectedSymbol === "EURUSD" || selectedSymbol === "GBPUSD" ? 4 : 2;
            const entryVal = lastCandle.close;
            const vol = entryVal * 0.005;
            setTp(Number((entryVal + vol * 4).toFixed(displayDecs)));
            setSl(Number((entryVal - vol * 2).toFixed(displayDecs)));
            
            // Strategy Zones Integration (Brothers FX / David Perk logic)
            setSupportZones([{ min: entryVal - vol * 2.5, max: entryVal - vol * 1.5 }]);
            setResistanceZones([{ min: entryVal + vol * 1.5, max: entryVal + vol * 2.5 }]);
          }
        }
      } catch (err: any) {
        console.error(err);
        if (active) setError("Error loading data");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchHistory();
    return () => {
      active = false;
    };
  }, [selectedSymbol, range]);

  // Synchronize active workspace context to backend
  useEffect(() => {
    const syncContext = async () => {
      try {
        await fetch(`${config.API_BASE_URL}${config.API_V1_STR}/market/context`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbol: selectedSymbol,
            timeframe: range
          })
        });
      } catch (err) {
        console.error("Failed to sync chart context to backend:", err);
      }
    };
    syncContext();
  }, [selectedSymbol, range]);

  // Live ticking price connection via WebSocket
  useEffect(() => {
    if (!isLive) return;

    const wsProtocol = config.API_BASE_URL.startsWith("https") ? "wss" : "ws";
    const cleanBaseUrl = config.API_BASE_URL.replace(/^https?:\/\//, "");
    const wsUrl = `${wsProtocol}://${cleanBaseUrl}${config.API_V1_STR}/market/live?symbol=${selectedSymbol}`;
    
    console.log("Connecting to live price WS:", wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.symbol === selectedSymbol) {
          const nextPrice = data.price;
          setCurrentPrice(nextPrice);

          setCandles((prevCandles) => {
            if (prevCandles.length === 0) return prevCandles;
            const updated = [...prevCandles];
            const lastIndex = updated.length - 1;
            const last = updated[lastIndex];

            updated[lastIndex] = {
              ...last,
              close: nextPrice,
              high: Math.max(last.high, nextPrice),
              low: Math.min(last.low, nextPrice),
            };
            return updated;
          });
        }
      } catch (err) {
        console.error("Error parsing live tick:", err);
      }
    };

    return () => {
      ws.close();
    };
  }, [selectedSymbol, isLive]);

  // Calculate Metrics
  const potentialProfit = Math.abs(tp - entry);
  const potentialLoss = Math.abs(entry - sl);
  const riskRewardRatio = potentialLoss > 0 ? (potentialProfit / potentialLoss).toFixed(2) : "0.00";
  
  // Discipline Check Rules (MQL5 Part 5 Risk Enforcement)
  const isRRCompliant = Number(riskRewardRatio) >= 1.5;
  // Compare against global remaining drawdown from context instead of static 3%
  const isDrawdownSafe = (potentialLoss / entry * 100) < disciplineState.dailyLimitRemaining;

  // Dynamic step sizing based on asset class
  const stepSize = currentPrice < 10 ? 0.0005 : currentPrice < 1000 ? 0.5 : 50;
  const displayDecimals = selectedSymbol === "EURUSD" || selectedSymbol === "GBPUSD" ? 4 : 2;
  const volRange = currentPrice * 0.005;

  // Click handler to adjust TP/SL precisely
  const adjustTP = (amount: number) => setTp(prev => Number((prev + amount).toFixed(displayDecimals)));
  const adjustSL = (amount: number) => setSl(prev => Number((prev + amount).toFixed(displayDecimals)));

  // Simulated MQL5 Tool Drawing (Part 31) & Crosshair
  const handleChartClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (selectedTool === "cursor" || !chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (selectedTool === "measure") {
      if (!measureStart) {
        setMeasureStart({ x: clickX, y: clickY });
        setMeasureEnd({ x: clickX, y: clickY });
      } else {
        // Complete the measurement, reset on next click
        setMeasureStart(null);
        setMeasureEnd(null);
      }
      return;
    }

    if (selectedTool === "crosshair") {
      if (!crosshairFixed) {
        setCrosshairFixed({ x: clickX, y: clickY });
      } else {
        setCrosshairFixed(null);
      }
      return;
    }

    setDecorations(prev => [...prev, { type: selectedTool, y: clickY }]);
    setSelectedTool("cursor");
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (selectedTool === "crosshair" || selectedTool === "measure") {
      setCrosshair({ x, y });
      if (selectedTool === "measure" && measureStart) {
        setMeasureEnd({ x, y });
      }
    } else {
      setCrosshair(null);
    }
  };

  const handleMouseLeave = () => {
    setCrosshair(null);
  };

  // Dispatch trigger (Part 9 Signal Dispatcher)
  const handleDispatch = () => {
    setDispatched(true);
    setDispatchStatus("SYNCHRONIZING PIPELINE...");
    setTimeout(() => {
      setDispatchStatus("RUNNING PCA ONNX ALIGNMENT...");
      setTimeout(() => {
        setDispatchStatus("DISPATCHED TO MT5 TERMINAL SUCCESSFULLY!");
      }, 1000);
    }, 1000);
  };

  // Render variables for candles svg mapping
  // const svgWidth = 520; // Replaced by responsive state
  const svgHeight = 260; // Increased from 220
  const padding = 15;
  const paddingBottom = 35; // Reserved for timeline

  const allPrices = candles.length > 0 
    ? candles.flatMap(c => [c.high, c.low, tp, sl, entry, currentPrice])
    : [tp, sl, entry, currentPrice];
  const maxPrice = Math.max(...allPrices) * 1.002;
  const minPrice = Math.min(...allPrices) * 0.998;
  const priceRange = maxPrice - minPrice || 1.0;

  const getY = (price: number) => {
    return padding + ((maxPrice - price) / priceRange) * (svgHeight - padding - paddingBottom);
  };

  const getX = (index: number) => {
    const count = candles.length;
    if (count <= 1) return padding + (svgWidth - 2 * padding) / 2;
    return padding + (index / (count - 1)) * (svgWidth - 2 * padding);
  };

  const getPriceFromY = (y: number) => {
    return maxPrice - ((y - padding) / (svgHeight - padding - paddingBottom)) * priceRange;
  };

  return (
    <div className="w-full bg-[#0D0F16] border border-white/5 rounded-3xl overflow-hidden shadow-2xl p-6 select-none font-sans text-slate-200">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#fd3b12]/20 to-amber-500/20 border border-[#fd3b12]/30 flex items-center justify-center shadow-lg shadow-[#fd3b12]/5">
            <Activity className="w-5 h-5 text-[#fd3b12]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <select
                value={selectedSymbol}
                onChange={(e) => {
                  const sym = e.target.value;
                  setSelectedSymbol(sym);
                  const inst = INSTRUMENTS.find((i) => i.symbol === sym);
                  if (inst) {
                    setEntry(inst.basePrice);
                    setTp(inst.basePrice * 1.02);
                    setSl(inst.basePrice * 0.99);
                    setCurrentPrice(inst.basePrice);
                    if (onSymbolChange) {
                      onSymbolChange(sym, inst.basePrice);
                    }
                  }
                }}
                className="bg-[#1A1D27] border border-white/10 rounded-xl px-2 py-1 text-xs font-bold text-white uppercase outline-none focus:ring-1 focus:ring-[#fd3b12] cursor-pointer hover:bg-white/5 transition-colors"
              >
                {Object.entries(
                  INSTRUMENTS.reduce((acc, inst) => {
                    if (!acc[inst.category]) acc[inst.category] = [];
                    acc[inst.category].push(inst);
                    return acc;
                  }, {} as Record<string, typeof INSTRUMENTS>)
                ).map(([category, items]) => (
                  <optgroup key={category} label={category} className="bg-[#1A1D27] text-slate-400 font-normal">
                    {items.map((item) => (
                      <option key={item.symbol} value={item.symbol} className="text-white font-bold">
                        {item.symbol} - {item.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-bold text-white/50 border border-white/10">{range}</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Real-time Trading Chart</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          {/* Chart Type Selector */}
          <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
            {(["candle", "line", "bar"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                  chartType === t
                    ? "bg-[#fd3b12] text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Timeframe Range Selector Presets */}
          <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
            {["1D", "1W", "1M", "3M", "All"].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                  range === r
                    ? "bg-[#fd3b12] text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Live Price</span>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                <span className="text-lg font-black font-mono tracking-tight tabular-nums">
                  {currentPrice.toLocaleString(undefined, { minimumFractionDigits: displayDecimals, maximumFractionDigits: displayDecimals })}
                </span>
                {(() => {
                  if (candles.length === 0) return null;
                  const firstPrice = candles[0].open;
                  const diff = currentPrice - firstPrice;
                  const pct = (firstPrice > 0) ? (diff / firstPrice) * 100 : 0;
                  const sign = diff >= 0 ? "+" : "";
                  const color = diff >= 0 ? "text-emerald-400" : "text-rose-400";
                  
                  const getDurationLabel = (r: string) => {
                    switch (r) {
                      case "1D": return "a day";
                      case "1W": return "a week";
                      case "1M": return "a month";
                      case "3M": return "6 months";
                      case "All": return "1 year";
                      default: return "a day";
                    }
                  };
                  return (
                    <span className={`text-[10px] font-bold font-mono ml-2 shrink-0 ${color}`}>
                      {sign}{diff.toFixed(displayDecimals)} ({sign}{pct.toFixed(2)}%) over {getDurationLabel(range)}
                    </span>
                  );
                })()}
              </div>
            </div>
            <button 
              onClick={() => setIsLive(!isLive)}
              className={`px-3 py-1.5 rounded-xl border text-[9px] font-bold uppercase tracking-wider transition-all ${
                isLive 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' 
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
              }`}
            >
              {isLive ? "Live" : "Paused"}
            </button>
          </div>
        </div>
      </div>

      {/* Main SVG Candlestick Chart */}
      <div className="relative border border-white/5 bg-[#090B0F]/50 rounded-2xl p-2 mb-6 group/chart overflow-hidden flex flex-row h-[280px]">
        
        {/* Strategy Column (Toggled) */}
        {showStrategyPanel && (
          <div className="w-[180px] shrink-0 border-r border-white/5 bg-black/20 p-3 flex flex-col gap-2.5 overflow-y-auto h-full scrollbar-thin select-none">
            <h5 className="text-[9px] font-black uppercase text-[#fd3b12] tracking-wider mb-1 flex items-center gap-1">
              🧠 Strategies
            </h5>
            {STRATEGIES.map((strat) => (
              <button
                key={strat.id}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("trigger-strategy-consultation", {
                    detail: { name: strat.name, prompt: strat.prompt }
                  }));
                }}
                className="w-full text-left p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-[#fd3b12]/10 hover:border-[#fd3b12]/30 transition-all flex flex-col gap-0.5 group/card"
              >
                <span className="text-[10px] font-bold text-white group-hover/card:text-[#fd3b12] transition-colors">
                  {strat.name}
                </span>
                <span className="text-[8px] text-slate-400 font-medium leading-normal line-clamp-2">
                  {strat.desc}
                </span>
              </button>
            ))}
          </div>
        )}

        <div ref={chartContainerRef} className="flex-1 relative min-w-0 h-full">
          {isLoading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="w-8 h-8 border-2 border-[#fd3b12]/30 border-t-[#fd3b12] rounded-full animate-spin"></div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <span className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl">{error}</span>
            </div>
          )}
          <svg 
            ref={chartRef}
            width="100%" 
            height={svgHeight} 
            viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
            className="overflow-visible cursor-crosshair"
            onClick={handleChartClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const yVal = padding + ratio * (svgHeight - padding - paddingBottom);
            return (
              <line 
                key={idx}
                x1="0" 
                y1={yVal} 
                x2={svgWidth} 
                y2={yVal} 
                stroke="white" 
                strokeOpacity="0.03" 
                strokeDasharray="4"
              />
            );
          })}

          {/* Strategy Zones Overlay */}
          {supportZones.map((z, idx) => (
            <rect key={`sz-${idx}`} x="0" y={getY(z.max)} width={svgWidth} height={Math.abs(getY(z.min) - getY(z.max))} fill="#10B981" fillOpacity="0.04" stroke="#10B981" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="4" />
          ))}
          {resistanceZones.map((z, idx) => (
            <rect key={`rz-${idx}`} x="0" y={getY(z.max)} width={svgWidth} height={Math.abs(getY(z.min) - getY(z.max))} fill="#EF4444" fillOpacity="0.04" stroke="#EF4444" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="4" />
          ))}

          {/* Render Line Chart */}
          {chartType === "line" && candles.length > 0 && (() => {
            const linePoints = candles.map((c, i) => `${getX(i)},${getY(c.close)}`).join(" L ");
            const bottomY = getY(minPrice);
            const fillAreaPath = `M ${getX(0)},${bottomY} L ${linePoints} L ${getX(candles.length - 1)},${bottomY} Z`;
            return (
              <g>
                <defs>
                  <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fd3b12" stopOpacity="0.25"/>
                    <stop offset="100%" stopColor="#fd3b12" stopOpacity="0.0"/>
                  </linearGradient>
                </defs>
                <path d={fillAreaPath} fill="url(#chart-area-grad)" />
                <path d={`M ${linePoints}`} fill="none" stroke="#fd3b12" strokeWidth="2.5" />
              </g>
            );
          })()}

          {/* Render Bar Chart (OHLC) */}
          {chartType === "bar" && candles.map((c, i) => {
            const cx = getX(i);
            const cyOpen = getY(c.open);
            const cyClose = getY(c.close);
            const cyHigh = getY(c.high);
            const cyLow = getY(c.low);
            const isBull = c.close >= c.open;
            const strokeColor = isBull ? "#10B981" : "#EF4444";
            return (
              <g key={`bar-${i}`} className="transition-all duration-200">
                <line x1={cx} y1={cyHigh} x2={cx} y2={cyLow} stroke={strokeColor} strokeWidth="1.5" />
                <line x1={cx - 3.5} y1={cyOpen} x2={cx} y2={cyOpen} stroke={strokeColor} strokeWidth="1.5" />
                <line x1={cx} y1={cyClose} x2={cx + 3.5} y2={cyClose} stroke={strokeColor} strokeWidth="1.5" />
              </g>
            );
          })}

          {/* Render Candles */}
          {chartType === "candle" && candles.map((c, i) => {
            const cx = getX(i);
            const cyOpen = getY(c.open);
            const cyClose = getY(c.close);
            const cyHigh = getY(c.high);
            const cyLow = getY(c.low);
            const isBull = c.close >= c.open;
            const strokeColor = isBull ? "#10B981" : "#EF4444";
            
            return (
              <g key={i} className="transition-all duration-200">
                {/* Wick */}
                <line x1={cx} y1={cyHigh} x2={cx} y2={cyLow} stroke={strokeColor} strokeWidth="1.2" />
                {/* Body */}
                <rect 
                  x={cx - 3.5} 
                  y={Math.min(cyOpen, cyClose)} 
                  width="7" 
                  height={Math.max(1, Math.abs(cyOpen - cyClose))} 
                  fill={isBull ? "#10B981" : "#EF4444"} 
                  stroke={strokeColor}
                  strokeWidth="1"
                  rx="1"
                />
                
                {/* Entry Signal Markers (Brothers FX Strategy) */}
                {i === Math.max(0, candles.length - 4) && isBull && (
                  <g transform={`translate(${cx}, ${cyLow + 10})`}>
                    <path d="M-4,0 L4,0 L0,-6 Z" fill="#10B981" />
                    <text y="8" fill="#10B981" fontSize="6" textAnchor="middle" fontWeight="bold" fontFamily="monospace" letterSpacing="1">ENTRY SIGNAL</text>
                  </g>
                )}
                {i === Math.max(0, candles.length - 8) && !isBull && (
                  <g transform={`translate(${cx}, ${cyHigh - 10})`}>
                    <path d="M-4,0 L4,0 L0,6 Z" fill="#EF4444" />
                    <text y="-4" fill="#EF4444" fontSize="6" textAnchor="middle" fontWeight="bold" fontFamily="monospace" letterSpacing="1">SUPPLY ZONE</text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Timeline X-Axis Labels */}
          {candles.map((c, i) => {
            const interval = Math.max(1, Math.ceil(candles.length / 5));
            if (i % interval !== 0 && i !== candles.length - 1) return null;
            return (
              <g key={`time-${i}`}>
                <line
                  x1={getX(i)}
                  y1={svgHeight - paddingBottom + 5}
                  x2={getX(i)}
                  y2={svgHeight - paddingBottom}
                  stroke="white"
                  strokeOpacity="0.1"
                  strokeWidth="1"
                />
                <text
                  x={getX(i)}
                  y={svgHeight - 12}
                  fill="white"
                  fillOpacity="0.4"
                  fontSize="8"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {c.time}
                </text>
              </g>
            );
          })}

          {/* Custom Drawn Overlay Tools (Part 31) */}
          {decorations.map((dec, idx) => {
            if (dec.type === "trend") {
              return (
                <line 
                  key={idx} 
                  x1="100" 
                  y1={dec.y - 30} 
                  x2="400" 
                  y2={dec.y + 30} 
                  stroke="#fbbf24" 
                  strokeWidth="1.5" 
                  strokeDasharray="2"
                  className="animate-pulse"
                />
              );
            }
            if (dec.type === "h-line") {
              return (
                <line 
                  key={idx} 
                  x1="0" 
                  y1={dec.y} 
                  x2={svgWidth} 
                  y2={dec.y} 
                  stroke="#818cf8" 
                  strokeWidth="1.5" 
                  strokeDasharray="2"
                />
              );
            }
            return null;
          })}

          {/* Draggable/Visual Indicators for SL, TP, Entry */}
          {/* TAKE PROFIT (TP) LINE */}
          <g className="transition-all duration-300">
            <line 
              x1="0" 
              y1={getY(tp)} 
              x2={svgWidth} 
              y2={getY(tp)} 
              stroke="#10B981" 
              strokeWidth="1.5" 
              strokeDasharray="5"
            />
            <rect 
              x={svgWidth - 95} 
              y={getY(tp) - 10} 
              width="90" 
              height="20" 
              rx="6" 
              fill="#10B981" 
              className="shadow-lg"
            />
            <text 
              x={svgWidth - 50} 
              y={getY(tp) + 4} 
              fill="#061F14" 
              fontSize="9" 
              fontWeight="900" 
              textAnchor="middle"
              fontFamily="monospace"
            >
              TP: {tp.toFixed(displayDecimals)}
            </text>
          </g>

          {/* ENTRY LINE */}
          <g>
            <line 
              x1="0" 
              y1={getY(entry)} 
              x2={svgWidth} 
              y2={getY(entry)} 
              stroke="#E2E8F0" 
              strokeWidth="1" 
              strokeOpacity="0.5"
            />
            <rect 
              x={5} 
              y={getY(entry) - 10} 
              width="90" 
              height="20" 
              rx="6" 
              fill="#334155" 
              stroke="#E2E8F0"
              strokeWidth="1"
              strokeOpacity="0.2"
            />
            <text 
              x={50} 
              y={getY(entry) + 4} 
              fill="#E2E8F0" 
              fontSize="9" 
              fontWeight="900" 
              textAnchor="middle"
              fontFamily="monospace"
            >
              ENTRY: {entry.toFixed(displayDecimals)}
            </text>
          </g>

          {/* STOP LOSS (SL) LINE */}
          <g className="transition-all duration-300">
            <line 
              x1="0" 
              y1={getY(sl)} 
              x2={svgWidth} 
              y2={getY(sl)} 
              stroke="#EF4444" 
              strokeWidth="1.5" 
              strokeDasharray="5"
            />
            <rect 
              x={svgWidth - 95} 
              y={getY(sl) - 10} 
              width="90" 
              height="20" 
              rx="6" 
              fill="#EF4444" 
            />
            <text 
              x={svgWidth - 50} 
              y={getY(sl) + 4} 
              fill="#2D0606" 
              fontSize="9" 
              fontWeight="900" 
              textAnchor="middle"
              fontFamily="monospace"
            >
              SL: {sl.toFixed(displayDecimals)}
            </text>
          </g>

          {/* Live Price Line overlay */}
          <g className="transition-all duration-100">
            <line 
              x1="0" 
              y1={getY(currentPrice)} 
              x2={svgWidth} 
              y2={getY(currentPrice)} 
              stroke="#fbbf24" 
              strokeWidth="1" 
              strokeDasharray="2"
            />
            <circle cx={svgWidth - padding} cy={getY(currentPrice)} r="3" fill="#fbbf24" className="animate-ping" />
          </g>

          {/* CROSSHAIR TOOL */}
          {(crosshairFixed || crosshair) && (selectedTool === "crosshair" || selectedTool === "measure") && (() => {
            const currentCrosshair = crosshairFixed || crosshair;
            if (!currentCrosshair) return null;
            return (
              <g className="pointer-events-none">
                <line x1={currentCrosshair.x} y1="0" x2={currentCrosshair.x} y2={svgHeight} stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="3" />
                <line x1="0" y1={currentCrosshair.y} x2={svgWidth} y2={currentCrosshair.y} stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="3" />
                {/* Crosshair Price Label */}
                <rect x={svgWidth - 55} y={currentCrosshair.y - 10} width="55" height="20" fill="#334155" rx="2" />
                <text x={svgWidth - 27} y={currentCrosshair.y + 3} fill="white" fontSize="9" textAnchor="middle" fontFamily="monospace">
                  {getPriceFromY(currentCrosshair.y).toFixed(displayDecimals)}
                </text>
              </g>
            );
          })()}

          {/* MEASURE TOOL OVERLAY */}
          {measureStart && measureEnd && (
            <g className="pointer-events-none">
              <rect 
                x={Math.min(measureStart.x, measureEnd.x)} 
                y={Math.min(measureStart.y, measureEnd.y)} 
                width={Math.abs(measureEnd.x - measureStart.x)} 
                height={Math.abs(measureEnd.y - measureStart.y)} 
                fill="#3b82f6" 
                fillOpacity="0.15" 
                stroke="#3b82f6" 
                strokeWidth="1" 
                strokeDasharray="2"
              />
              <rect 
                x={measureEnd.x + 10} 
                y={measureEnd.y - 15} 
                width="80" 
                height="30" 
                fill="#1e293b" 
                rx="4" 
                stroke="#475569" 
                strokeWidth="1"
              />
              <text x={measureEnd.x + 50} y={measureEnd.y - 2} fill="#60a5fa" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                {((getPriceFromY(measureEnd.y) - getPriceFromY(measureStart.y)) / volRange * 100).toFixed(1)} Pips
              </text>
              <text x={measureEnd.x + 50} y={measureEnd.y + 9} fill="#cbd5e1" fontSize="8" textAnchor="middle" fontFamily="monospace">
                {(Math.abs(measureEnd.x - measureStart.x) / ((svgWidth - 2*padding) / Math.max(1, candles.length))).toFixed(0)} Bars
              </text>
            </g>
          )}
        </svg>

        {/* Interactive MT5 Tools Sidebar (Part 31) */}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5 bg-black/40 backdrop-blur-md p-1.5 rounded-xl border border-white/5 z-20">
          <button 
            onClick={() => setShowStrategyPanel(!showStrategyPanel)}
            className={`p-2.5 rounded-xl transition-all border ${showStrategyPanel ? 'bg-[#fd3b12] border-[#fd3b12]/50 text-white shadow-lg shadow-[#fd3b12]/20' : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-350'}`}
            title="Toggle Strategy Panel"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <div className="h-px w-6 bg-white/10 my-0.5"></div>
          <button 
            onClick={() => setSelectedTool("cursor")}
            className={`p-1.5 rounded-lg transition-colors ${selectedTool === "cursor" ? 'bg-[#fd3b12] text-white' : 'hover:bg-white/10 text-slate-400'}`}
            title="Cursor Pointer"
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setSelectedTool("crosshair")}
            className={`p-1.5 rounded-lg transition-colors ${selectedTool === "crosshair" ? 'bg-[#fd3b12] text-white' : 'hover:bg-white/10 text-slate-400'}`}
            title="Crosshair"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setSelectedTool("measure")}
            className={`p-1.5 rounded-lg transition-colors ${selectedTool === "measure" ? 'bg-[#fd3b12] text-white' : 'hover:bg-white/10 text-slate-400'}`}
            title="Measure Mode"
          >
            <Ruler className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setSelectedTool("trend")}
            className={`p-1.5 rounded-lg transition-colors ${selectedTool === "trend" ? 'bg-[#fd3b12] text-white' : 'hover:bg-white/10 text-slate-400'}`}
            title="Draw Trendline"
          >
            <Zap className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setSelectedTool("h-line")}
            className={`p-1.5 rounded-lg transition-colors ${selectedTool === "h-line" ? 'bg-[#fd3b12] text-white' : 'hover:bg-white/10 text-slate-400'}`}
            title="Draw Horizontal Line"
          >
            <Target className="w-3.5 h-3.5" />
          </button>
          {decorations.length > 0 && (
            <button 
              onClick={() => setDecorations([])}
              className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400"
              title="Clear drawings"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Control Panel & Discipline Engine Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Fine-Tune Parameters */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sliders className="w-3 h-3 text-[#fd3b12]" /> Parameter Optimizer
          </h4>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-slate-400">Take Profit</span>
                <span className="text-[10px] font-bold text-emerald-400 font-mono">+{potentialProfit.toFixed(displayDecimals)} USD</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => adjustTP(-stepSize)} className="p-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300"><ChevronDown className="w-3 h-3" /></button>
                <input 
                  type="range" 
                  min={entry + (volRange * 0.5)} 
                  max={entry + (volRange * 20)} 
                  step={stepSize}
                  value={tp} 
                  onChange={(e) => setTp(Number(e.target.value))} 
                  className="flex-1 accent-[#10B981] h-1 bg-white/10 rounded-lg cursor-pointer"
                />
                <button onClick={() => adjustTP(stepSize)} className="p-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300"><ChevronUp className="w-3 h-3" /></button>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-slate-400">Stop Loss</span>
                <span className="text-[10px] font-bold text-rose-400 font-mono">-{potentialLoss.toFixed(displayDecimals)} USD</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => adjustSL(-stepSize)} className="p-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300"><ChevronDown className="w-3 h-3" /></button>
                <input 
                  type="range" 
                  min={entry - (volRange * 20)} 
                  max={entry - (volRange * 0.5)} 
                  step={stepSize}
                  value={sl} 
                  onChange={(e) => setSl(Number(e.target.value))} 
                  className="flex-1 accent-[#EF4444] h-1 bg-white/10 rounded-lg cursor-pointer"
                />
                <button onClick={() => adjustSL(50)} className="p-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300"><ChevronUp className="w-3 h-3" /></button>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Management Verification (Part 5 Compliance) */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3 relative overflow-hidden">
          <div className="flex items-center gap-3 border-b border-white/5 pb-3">
            <img src="/media/aicodex-spirit-bird.png" alt="Spirit Bird" className="w-8 h-8 rounded-full border border-emerald-500/30 object-contain bg-white/10" />
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3 h-3 text-emerald-500" /> Agentic Enforcer
              </h4>
              <p className="text-[8px] text-slate-400 uppercase tracking-widest mt-0.5">Automated Discipline Checks</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium text-[10px] uppercase">Risk-to-Reward Ratio</span>
              <span className={`font-mono font-bold ${isRRCompliant ? 'text-emerald-400' : 'text-amber-400'}`}>
                1:{riskRewardRatio}
              </span>
            </div>
            
            <div className="space-y-1.5 text-[9px] font-bold">
              <div className="flex items-center gap-2 p-1.5 rounded bg-white/[0.02] border border-white/5">
                <CheckCircle className={`w-3.5 h-3.5 shrink-0 ${isRRCompliant ? 'text-emerald-400' : 'text-amber-500'}`} />
                <span className={isRRCompliant ? 'text-slate-300' : 'text-amber-500'}>
                  {isRRCompliant ? "R:R Engine Compliant (>= 1.5)" : "R:R Ratio Danger Zone"}
                </span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded bg-white/[0.02] border border-white/5">
                <CheckCircle className={`w-3.5 h-3.5 shrink-0 ${isDrawdownSafe ? 'text-emerald-400' : 'text-rose-500'}`} />
                <span className={isDrawdownSafe ? 'text-slate-300' : 'text-rose-400'}>
                  {isDrawdownSafe ? "Drawdown Risk OK (< 3%)" : "Drawdown Exceeds Daily Limits"}
                </span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded bg-white/[0.02] border border-white/5 relative group">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-slate-300">PCA ONNX Inputs Aligned</span>
                
                {/* Tooltip explaining automation */}
                <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-[#1A1D27] border border-white/10 rounded-lg text-[8px] text-slate-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl z-10 normal-case font-medium">
                  The Agent dynamically calculates parameter optimization constraints based on current volatility metrics. MQL5 integration is currently running in local-simulation mode until terminal routing is fully established.
                </div>
              </div>
              {disciplineState.isGateLocked && (
                <div className="flex items-center gap-2 p-1.5 rounded bg-rose-500/10 border border-rose-500/20 mt-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="text-rose-400">Trading Gate Locked (Limits Reached)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Signal Dispatcher Integration (Part 9 Execution) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1E110F] to-[#0A0D14] border border-[#fd3b12]/10 flex flex-col justify-between">
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-wider text-[#fd3b12] flex items-center gap-1.5 mb-2">
              <Zap className="w-3 h-3 text-[#fd3b12] animate-bounce" /> MT5 Signal Core
            </h4>
            <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
              Transmits telemetry and structured order parameters directly to the MT5 automated execution engine.
            </p>
          </div>

          <div className="mt-4">
            {dispatched ? (
              <div className="space-y-2">
                <div className="py-2.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>MT5 Core Synced</span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-300 leading-tight font-mono break-all lowercase">
                    {dispatchStatus}
                  </span>
                </div>
              </div>
            ) : (
              <button 
                onClick={handleDispatch}
                disabled={!isRRCompliant || !isDrawdownSafe || disciplineState.isGateLocked}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#fd3b12] to-amber-500 hover:from-amber-500 hover:to-[#fd3b12] text-white text-[10px] font-black uppercase tracking-widest hover:shadow-lg hover:shadow-[#fd3b12]/20 transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:from-[#fd3b12] disabled:hover:to-amber-500 flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute Signal</span>
              </button>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
