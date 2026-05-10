import React from 'react';
import { TrendingUpIcon, TrendingDownIcon } from 'lucide-react';

interface DebatePanelProps {
  bullArgument: string;
  bearArgument: string;
}

const DebatePanel: React.FC<DebatePanelProps> = ({ bullArgument, bearArgument }) => {
  return (
    <div className="w-full flex gap-4 my-4">
      <div className="flex-1 bg-[#1A1D27] border border-emerald-500/20 rounded-2xl p-4 shadow-lg shadow-emerald-900/10">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-500/10">
          <div className="p-1.5 bg-emerald-500/10 rounded-lg">
            <TrendingUpIcon className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest">Bull Thesis</h3>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed font-mono">
          {bullArgument || "Awaiting bullish perspective..."}
        </p>
      </div>

      <div className="flex-1 bg-[#1A1D27] border border-red-500/20 rounded-2xl p-4 shadow-lg shadow-red-900/10">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-500/10">
          <div className="p-1.5 bg-red-500/10 rounded-lg">
            <TrendingDownIcon className="w-4 h-4 text-red-400" />
          </div>
          <h3 className="text-xs font-black text-red-400 uppercase tracking-widest">Bear Thesis</h3>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed font-mono">
          {bearArgument || "Awaiting bearish perspective..."}
        </p>
      </div>
    </div>
  );
};

export default DebatePanel;
