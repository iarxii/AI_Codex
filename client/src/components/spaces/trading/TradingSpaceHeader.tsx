import React, { useState } from 'react';
import { TrendingUpIcon, ActivityIcon, X, BarChart2 } from 'lucide-react';
import { TradingChart } from '../../chat/TradingChart';

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-4xl max-h-full overflow-y-auto bg-[#1A1D27] rounded-3xl border border-white/10 shadow-2xl relative">
            <button 
              onClick={() => setActiveChart(null)}
              className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 rounded-full transition-colors z-20"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-6">
              <h2 className="text-lg font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-[#fd3b12]" /> Global Chart Module
              </h2>
              <TradingChart 
                key={activeChart.symbol}
                symbol={activeChart.symbol} 
                initialEntry={activeChart.entry} 
                initialSL={activeChart.entry * 0.99} 
                initialTP={activeChart.entry * 1.02} 
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TradingSpaceHeader;
