import React, { useState } from 'react';
import { TrendingUpIcon, ActivityIcon, X, BarChart2 } from 'lucide-react';
import { TradingChart } from '../../chat/TradingChart';
import { AnalystSidebar } from './AnalystSidebar';

const ASSETS = [
  { symbol: "EURUSD", price: "1.0852", change: "+0.12%" },
  { symbol: "GBPUSD", price: "1.2641", change: "-0.05%" },
  { symbol: "BTCUSD", price: "95240", change: "+2.4%" },
  { symbol: "ETHUSD", price: "3420", change: "+1.1%" },
  { symbol: "SPX500", price: "5304", change: "+0.8%" },
  { symbol: "TSLA", price: "245.10", change: "-1.2%" },
];

const MarketTicker: React.FC<{ onLaunchChart: (symbol: string, price: number) => void }> = ({ onLaunchChart }) => {
  return (
    <div className="w-full bg-[#090B0F] border-b border-white/5 py-1.5 overflow-hidden flex items-center relative z-20 shadow-inner">
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#090B0F] to-transparent z-10 pointer-events-none"></div>
      <div className="flex animate-marquee whitespace-nowrap">
        {[...ASSETS, ...ASSETS, ...ASSETS].map((asset, i) => {
          const isUp = asset.change.startsWith('+');
          return (
            <div 
              key={i} 
              className="flex items-center gap-2 mx-6 cursor-pointer hover:bg-white/5 px-2 py-0.5 rounded transition-colors group"
              onClick={() => onLaunchChart(asset.symbol, Number(asset.price))}
            >
              <BarChart2 className="w-3 h-3 text-slate-500 group-hover:text-[#fd3b12] transition-colors" />
              <span className="text-[10px] font-bold text-slate-300">{asset.symbol}</span>
              <span className="text-[10px] font-mono text-slate-400">{asset.price}</span>
              <span className={`text-[9px] font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>{asset.change}</span>
            </div>
          );
        })}
      </div>
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#090B0F] to-transparent z-10 pointer-events-none"></div>
    </div>
  );
};

const TradingSpaceHeader: React.FC = () => {
  const [activeChart, setActiveChart] = useState<{ symbol: string; entry: number } | null>(null);

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
                Alpha Terminal <span className="px-1.5 py-0.5 rounded text-[8px] bg-red-500/20 text-red-400 font-bold">LIVE</span>
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
                onClick={() => setActiveChart({ symbol: 'BTCUSD', entry: 95200 })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#fd3b12]/10 hover:bg-[#fd3b12]/20 border border-[#fd3b12]/20 rounded-lg text-xs font-bold text-[#fd3b12] transition-all"
              >
                <ActivityIcon className="w-3.5 h-3.5" />
                Launch Chart
              </button>
            </div>
          </div>
        </div>

        {/* Market Ticker Strip */}
        <MarketTicker onLaunchChart={(symbol, price) => setActiveChart({ symbol, entry: price })} />
      </div>

      {/* Global Chart Modal */}
      {activeChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full h-full max-h-[95vh] max-w-[95vw] 2xl:max-w-[1600px] flex flex-col bg-[#0B0D14] rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#1A1D27]/50">
              <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-[#fd3b12]" /> Global Chart Module
              </h2>
              <button 
                onClick={() => setActiveChart(null)}
                className="p-2 bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 rounded-full transition-colors z-20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row min-h-0">
              {/* Main Chart Area (70%) */}
              <div className="flex-1 lg:w-[70%] p-4 overflow-y-auto">
                <TradingChart 
                  key={activeChart.symbol}
                  symbol={activeChart.symbol} 
                  initialEntry={activeChart.entry} 
                  initialSL={activeChart.entry * 0.99} 
                  initialTP={activeChart.entry * 1.02} 
                  onSymbolChange={(newSymbol: string, basePrice: number) => {
                    setActiveChart({ symbol: newSymbol, entry: basePrice });
                  }}
                />
              </div>

              {/* Analyst Sidebar (30%) */}
              <div className="w-full lg:w-[350px] xl:w-[400px] border-t lg:border-t-0 lg:border-l border-white/5 bg-[#090B0F]">
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
