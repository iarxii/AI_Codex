import React from 'react';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import MetricsChart from '../MetricsChart';

interface MetricsStripProps {
  metrics: {
    cpu: number;
    ram: number;
    npu?: number;
    igpu?: number;
    latency: string | number;
  };
  metricsHistory: any[];
  isChartExpanded: boolean;
  setIsChartExpanded: (expanded: boolean) => void;
}

const MetricsStrip: React.FC<MetricsStripProps> = ({ 
  metrics, 
  metricsHistory, 
  isChartExpanded, 
  setIsChartExpanded 
}) => {
  return (
    <div className="mt-4 flex flex-col items-center">
      <div className="flex items-center gap-4 bg-white/80 backdrop-blur-md border border-black/[0.04] rounded-full px-5 py-1.5 shadow-sm transition-all hover:shadow-md hover:bg-white/95">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-[#4A4D5E] font-bold">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF6600]" />
            <span className={metrics.cpu > 80 ? 'text-red-500' : ''}>CPU {Math.round(metrics.cpu)}%</span>
          </div>
          <span className="text-black/10">|</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4A4D5E]" />
            <span className={metrics.ram > 80 ? 'text-red-500' : ''}>RAM {Math.round(metrics.ram)}%</span>
          </div>
          <span className="text-black/10">|</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />
            <span className={metrics.igpu && metrics.igpu > 80 ? 'text-red-500' : ''}>GPU {Math.round(metrics.igpu || 0)}%</span>
          </div>
          <span className="text-black/10">|</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
            <span className={metrics.npu && metrics.npu > 80 ? 'text-red-500' : ''}>NPU {Math.round(metrics.npu || 0)}%</span>
          </div>
          <span className="text-black/10">|</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            <span className="text-[#10B981]">LAT {metrics.latency}</span>
          </div>
        </div>

        <div className="w-px h-3 bg-black/10 mx-1" />

        <button
          type="button"
          onClick={() => setIsChartExpanded(!isChartExpanded)}
          className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full transition-all border ${
            isChartExpanded 
              ? 'bg-[#FF6600] border-[#FF6600] text-white' 
              : 'border-black/[0.08] text-[#7A7D8E] hover:border-[#FF6600] hover:text-[#FF6600]'
          }`}
        >
          <ChartBarIcon className="w-3 h-3" />
          {isChartExpanded ? 'Collapse' : 'Stats'}
        </button>
      </div>

      {/* Real-time Hardware Chart */}
      {isChartExpanded && (
        <div className="w-full max-w-2xl px-4 overflow-hidden">
          <MetricsChart data={metricsHistory} />
        </div>
      )}
    </div>
  );
};

export default MetricsStrip;
