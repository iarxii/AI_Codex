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
  Target
} from "lucide-react";

interface TradingChartProps {
  symbol?: string;
  initialEntry?: number;
  initialSL?: number;
  initialTP?: number;
  timeframe?: string;
}

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  symbol = "BTCUSD",
  initialEntry = 95200,
  initialSL = 94200,
  initialTP = 97200,
  timeframe = "H1",
}) => {
  const [entry] = useState(initialEntry);
  const [sl, setSl] = useState(initialSL);
  const [tp, setTp] = useState(initialTP);
  const [currentPrice, setCurrentPrice] = useState(initialEntry);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [dispatched, setDispatched] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<string>("");
  const [selectedTool, setSelectedTool] = useState<string>("cursor");
  const [decorations, setDecorations] = useState<{ type: string; y: number }[]>([]);
  const chartRef = useRef<SVGSVGElement | null>(null);

  // Generate initial historical candles
  useEffect(() => {
    const data: Candle[] = [];
    let basePrice = initialEntry - 800;
    const now = new Date();

    for (let i = 24; i > 0; i--) {
      const open = basePrice + (Math.random() - 0.5) * 400;
      const close = open + (Math.random() - 0.45) * 500; // slightly bullish bias
      const high = Math.max(open, close) + Math.random() * 200;
      const low = Math.min(open, close) - Math.random() * 200;
      
      const timeStr = new Date(now.getTime() - i * 60 * 60 * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      data.push({ time: timeStr, open, high, low, close });
      basePrice = close;
    }
    setCandles(data);
    setCurrentPrice(basePrice);
  }, [initialEntry]);

  // Live ticking price generator
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      setCurrentPrice((prev) => {
        const change = (Math.random() - 0.48) * 150; // slight bullish bias
        const nextPrice = Math.max(1000, Number((prev + change).toFixed(2)));
        
        // Update the last candle in real time
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

        return nextPrice;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isLive]);

  // Calculate Metrics
  const potentialProfit = Math.abs(tp - entry);
  const potentialLoss = Math.abs(entry - sl);
  const riskRewardRatio = potentialLoss > 0 ? (potentialProfit / potentialLoss).toFixed(2) : "0.00";
  
  // Discipline Check Rules (MQL5 Part 5 Risk Enforcement)
  const isRRCompliant = Number(riskRewardRatio) >= 1.5;
  const isDrawdownSafe = potentialLoss < entry * 0.03; // Under 3% risk on account

  // Click handler to adjust TP/SL precisely
  const adjustTP = (amount: number) => setTp(prev => Number((prev + amount).toFixed(2)));
  const adjustSL = (amount: number) => setSl(prev => Number((prev + amount).toFixed(2)));

  // Simulated MQL5 Tool Drawing (Part 31)
  const handleChartClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (selectedTool === "cursor" || !chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    setDecorations(prev => [...prev, { type: selectedTool, y: clickY }]);
    setSelectedTool("cursor");
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
  const svgWidth = 520;
  const svgHeight = 220;
  const padding = 15;

  const allPrices = candles.flatMap(c => [c.high, c.low, tp, sl, entry, currentPrice]);
  const maxPrice = Math.max(...allPrices) * 1.002;
  const minPrice = Math.min(...allPrices) * 0.998;
  const priceRange = maxPrice - minPrice;

  const getY = (price: number) => {
    return padding + ((maxPrice - price) / priceRange) * (svgHeight - 2 * padding);
  };

  const getX = (index: number) => {
    const count = candles.length;
    return padding + (index / (count - 1)) * (svgWidth - 2 * padding);
  };

  return (
    <div className="w-full bg-[#0D0F16] border border-white/5 rounded-3xl overflow-hidden shadow-2xl p-6 select-none font-sans text-slate-200">
      
      {/* Header Info */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#fd3b12]/20 to-amber-500/20 border border-[#fd3b12]/30 flex items-center justify-center shadow-lg shadow-[#fd3b12]/5">
            <Activity className="w-5 h-5 text-[#fd3b12]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-widest">{symbol}</h3>
              <span className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-bold text-white/50 border border-white/10">{timeframe}</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Real-time Trading Chart</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Live Price</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              <span className="text-lg font-black font-mono tracking-tight tabular-nums">
                {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
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

      {/* Main SVG Candlestick Chart */}
      <div className="relative border border-white/5 bg-[#090B0F]/50 rounded-2xl p-2 mb-6 group/chart overflow-hidden">
        <svg 
          ref={chartRef}
          width="100%" 
          height={svgHeight} 
          viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
          className="overflow-visible"
          onClick={handleChartClick}
        >
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const yVal = padding + ratio * (svgHeight - 2 * padding);
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

          {/* Render Candles */}
          {candles.map((c, i) => {
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
              TP: {tp.toFixed(0)}
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
              ENTRY: {entry}
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
              SL: {sl.toFixed(0)}
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
        </svg>

        {/* Interactive MT5 Tools Sidebar (Part 31) */}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5 bg-black/40 backdrop-blur-md p-1.5 rounded-xl border border-white/5">
          <button 
            onClick={() => setSelectedTool("cursor")}
            className={`p-1.5 rounded-lg transition-colors ${selectedTool === "cursor" ? 'bg-[#fd3b12] text-white' : 'hover:bg-white/10 text-slate-400'}`}
            title="Cursor Pointer"
          >
            <MousePointer className="w-3.5 h-3.5" />
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
                <span className="text-[10px] font-bold text-emerald-400 font-mono">+{potentialProfit.toFixed(0)} USD</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => adjustTP(-50)} className="p-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300"><ChevronDown className="w-3 h-3" /></button>
                <input 
                  type="range" 
                  min={entry + 100} 
                  max={entry + 5000} 
                  value={tp} 
                  onChange={(e) => setTp(Number(e.target.value))} 
                  className="flex-1 accent-[#10B981] h-1 bg-white/10 rounded-lg cursor-pointer"
                />
                <button onClick={() => adjustTP(50)} className="p-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300"><ChevronUp className="w-3 h-3" /></button>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-slate-400">Stop Loss</span>
                <span className="text-[10px] font-bold text-rose-400 font-mono">-{potentialLoss.toFixed(0)} USD</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => adjustSL(-50)} className="p-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300"><ChevronDown className="w-3 h-3" /></button>
                <input 
                  type="range" 
                  min={entry - 5000} 
                  max={entry - 100} 
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
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <ShieldAlert className="w-3 h-3 text-[#fd3b12]" /> Risk Enforcer Node
          </h4>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Risk-to-Reward Ratio</span>
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
              <div className="flex items-center gap-2 p-1.5 rounded bg-white/[0.02] border border-white/5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-slate-300">PCA ONNX Inputs Aligned</span>
              </div>
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
                disabled={!isRRCompliant || !isDrawdownSafe}
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
