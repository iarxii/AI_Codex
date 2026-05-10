import React from 'react';
import { TrendingUpIcon, ActivityIcon, DollarSignIcon } from 'lucide-react';

const TradingSpaceHeader: React.FC = () => {
  return (
    <div className="flex items-center justify-between px-6 py-3 bg-[#1A1D27] border-b border-white/5 shadow-md z-10 w-full animate-in fade-in slide-in-from-top-4">
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
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-xs font-bold text-gray-300 transition-all">
            <ActivityIcon className="w-3.5 h-3.5" />
            VIX: 14.2
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-xs font-bold text-gray-300 transition-all">
            <DollarSignIcon className="w-3.5 h-3.5" />
            DXY: 104.1
          </button>
        </div>
      </div>
    </div>
  );
};

export default TradingSpaceHeader;
