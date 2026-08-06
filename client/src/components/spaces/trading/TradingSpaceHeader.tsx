import React, { useEffect, useRef, useState } from 'react';
import { TrendingUpIcon, ActivityIcon, X, BarChart2 } from 'lucide-react';
import { TradingChart } from '../../chat/TradingChart';
import { AnalystSidebar } from './AnalystSidebar';
import { formatTradingPrice, getTradingInstrument, TRADING_INSTRUMENTS } from './instruments';
import { type MarketQuote, useTradingMarket } from './TradingMarketContext';

interface MarketTickerProps {
  onLaunchChart: (symbol: string) => void;
  quotes: Record<string, MarketQuote>;
  selectedSymbol: string;
}

const MarketTicker: React.FC<MarketTickerProps> = ({ onLaunchChart, quotes, selectedSymbol }) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const lastPointerXRef = useRef(0);

  const normalizeScrollPosition = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const loopWidth = viewport.scrollWidth / 2;
    if (!loopWidth) return;
    if (viewport.scrollLeft >= loopWidth) viewport.scrollLeft -= loopWidth;
    if (viewport.scrollLeft <= 0) viewport.scrollLeft = loopWidth - 1;
  };

  useEffect(() => {
    let frameId = 0;
    let previousTime = performance.now();
    const advance = (time: number) => {
      const viewport = viewportRef.current;
      if (viewport && !isDraggingRef.current) {
        viewport.scrollLeft += (time - previousTime) * 0.04;
        normalizeScrollPosition();
      }
      previousTime = time;
      frameId = requestAnimationFrame(advance);
    };
    frameId = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    isDraggingRef.current = true;
    didDragRef.current = false;
    lastPointerXRef.current = event.clientX;
    viewport.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !viewportRef.current) return;
    const delta = event.clientX - lastPointerXRef.current;
    if (Math.abs(delta) > 2) didDragRef.current = true;
    viewportRef.current.scrollLeft -= delta;
    lastPointerXRef.current = event.clientX;
    normalizeScrollPosition();
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    isDraggingRef.current = false;
    if (viewport?.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  };

  return (
    <div
      ref={viewportRef}
      className="w-full bg-[#090B0F] border-b border-white/5 py-1.5 overflow-hidden flex items-center relative z-20 shadow-inner cursor-grab active:cursor-grabbing touch-pan-y select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#090B0F] to-transparent z-10 pointer-events-none"></div>
      <div className="flex whitespace-nowrap min-w-max">
        {[...TRADING_INSTRUMENTS, ...TRADING_INSTRUMENTS].map((instrument, index) => {
          const quote = quotes[instrument.symbol];
          const change = quote?.change_percent ?? 0;
          const isSelected = instrument.symbol === selectedSymbol;
          const changeClass = change > 0 ? 'text-emerald-400' : change < 0 ? 'text-rose-400' : 'text-slate-500';
          return (
            <button
              key={`${instrument.symbol}-${index}`}
              type="button"
              className={`flex items-center gap-2 mx-4 px-2 py-0.5 rounded transition-colors group ${isSelected ? 'bg-[#fd3b12]/15' : 'hover:bg-white/5'}`}
              title={`${instrument.symbol}: ${quote?.source === 'fallback' ? 'fallback price' : 'market quote'}`}
              onClick={() => {
                if (!didDragRef.current) onLaunchChart(instrument.symbol);
              }}
            >
              <BarChart2 className={`w-3 h-3 transition-colors ${isSelected ? 'text-[#fd3b12]' : 'text-slate-500 group-hover:text-[#fd3b12]'}`} />
              <span className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{instrument.symbol}</span>
              <span className="text-[10px] font-mono text-slate-400">{formatTradingPrice(instrument.symbol, quote?.price ?? instrument.basePrice)}</span>
              <span className={`text-[9px] font-bold ${changeClass}`}>{change > 0 ? '+' : ''}{change.toFixed(2)}%</span>
            </button>
          );
        })}
      </div>
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#090B0F] to-transparent z-10 pointer-events-none"></div>
    </div>
  );
};

interface TradingSpaceHeaderProps {
  connected?: boolean;
}

const TradingSpaceHeader: React.FC<TradingSpaceHeaderProps> = ({ connected = false }) => {
  const [activeChart, setActiveChart] = useState<{ symbol: string; entry: number } | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'chart' | 'analyst'>('chart');
  const { selectedSymbol, selectSymbol, price, quotes } = useTradingMarket();
  const resolveEntryPrice = (symbol: string) =>
    symbol === selectedSymbol && price ? price : quotes[symbol]?.price ?? getTradingInstrument(symbol).basePrice;

  useEffect(() => {
    setActiveChart((currentChart) => currentChart
      ? { symbol: selectedSymbol, entry: resolveEntryPrice(selectedSymbol) }
      : currentChart);
  }, [price, quotes, selectedSymbol]);

  const openChart = (symbol: string) => {
    selectSymbol(symbol);
    setActiveChart({ symbol, entry: resolveEntryPrice(symbol) });
  };

  return (
    <>
      <div className="flex flex-col w-full z-10">
        <div className="flex items-center justify-between px-6 py-3 bg-[#1A1D27] border-b border-white/5 shadow-md">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <TrendingUpIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white tracking-widest uppercase flex items-center gap-2">
                FinQuant Terminal <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{connected ? 'LIVE' : 'ERROR'}</span>
              </h1>
              <p className="text-[10px] text-gray-400 font-medium">Quantitative Analysis & Strategy Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Market Status</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-bold text-emerald-400">OPEN</span>
              </div>
            </div>

            <div className="h-8 w-px bg-white/10"></div>

            <div className="flex gap-3">
              <button
                onClick={() => openChart(selectedSymbol)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#fd3b12]/10 hover:bg-[#fd3b12]/20 border border-[#fd3b12]/20 rounded-lg text-xs font-bold text-[#fd3b12] transition-all cursor-pointer touch-44"
              >
                <ActivityIcon className="w-3.5 h-3.5" />
                Global Market Chart
              </button>
            </div>
          </div>
        </div>

        {/* Market Ticker Strip */}
        <MarketTicker onLaunchChart={openChart} quotes={quotes} selectedSymbol={selectedSymbol} />
      </div>

      {/* Global Chart Modal */}
      {activeChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full h-full max-h-[95vh] max-w-[95vw] 2xl:max-w-[1600px] flex flex-col bg-[#0B0D14] rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">

            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 sm:px-6 sm:py-4 border-b border-white/5 bg-[#1A1D27]/50 gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-[#fd3b12]" /> Global Chart Module
                </h2>
                {/* Close Button on Mobile (aligned right in header row) */}
                <button
                  onClick={() => setActiveChart(null)}
                  className="sm:hidden p-2.5 bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 rounded-full transition-colors z-20 cursor-pointer touch-44"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tab Selector on Mobile/Tablet */}
              <div className="flex lg:hidden bg-black/40 p-1 rounded-xl border border-white/5 self-center sm:self-auto w-full sm:w-auto">
                <button
                  onClick={() => setActiveModalTab('chart')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase transition-all tracking-wider ${activeModalTab === 'chart'
                      ? 'bg-[#fd3b12] text-white shadow-md shadow-[#fd3b12]/20'
                      : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  Chart
                </button>
                <button
                  onClick={() => setActiveModalTab('analyst')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase transition-all tracking-wider ${activeModalTab === 'analyst'
                      ? 'bg-[#fd3b12] text-white shadow-md shadow-[#fd3b12]/20'
                      : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  Analyst Panel
                </button>
              </div>

              {/* Close Button on Desktop */}
              <button
                onClick={() => setActiveChart(null)}
                className="hidden sm:block p-2 bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 rounded-full transition-colors z-20 cursor-pointer touch-44"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
              {/* Main Chart Area (70% on desktop, visible when tab is active on mobile) */}
              <div className={`flex-1 lg:w-[70%] p-3 sm:p-4 overflow-y-auto flex-col ${activeModalTab === 'chart' ? 'flex' : 'hidden lg:flex'}`}>
                <div className="flex-1 min-h-[350px] lg:min-h-0">
                  <TradingChart
                    key={activeChart.symbol}
                    symbol={activeChart.symbol}
                    initialEntry={activeChart.entry}
                    initialSL={activeChart.entry * 0.99}
                    initialTP={activeChart.entry * 1.02}
                    onSymbolChange={(newSymbol: string, basePrice: number) => {
                      selectSymbol(newSymbol);
                      setActiveChart({ symbol: newSymbol, entry: basePrice });
                    }}
                  />
                </div>
              </div>

              {/* Analyst Sidebar (30% on desktop, visible when tab is active on mobile) */}
              <div className={`w-full lg:w-[350px] xl:w-[400px] border-t lg:border-t-0 lg:border-l border-white/5 bg-[#090B0F] overflow-y-auto ${activeModalTab === 'analyst' ? 'flex' : 'hidden lg:flex'} flex-col h-full`}>
                <AnalystSidebar symbol={activeChart.symbol} />
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default TradingSpaceHeader;
