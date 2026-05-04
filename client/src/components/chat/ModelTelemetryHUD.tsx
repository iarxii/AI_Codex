import React from 'react';
import { 
  BoltIcon, 
  CpuChipIcon, 
  ClockIcon, 
  CircleStackIcon,
  ShieldCheckIcon,
  BeakerIcon,
  CodeBracketSquareIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import type { ModelTelemetry } from '../../types/chat';

interface ModelTelemetryHUDProps {
  telemetry: ModelTelemetry | null;
  isVisible: boolean;
}

const ModelTelemetryHUD: React.FC<ModelTelemetryHUDProps> = ({ telemetry, isVisible }) => {
  if (!telemetry || !isVisible) return null;

  const ttftMs = (telemetry.ttft * 1000).toFixed(0);
  const totalLatMs = telemetry.latencies.total ? (telemetry.latencies.total * 1000).toFixed(0) : null;
  
  const getCapabilityIcon = (cap: string) => {
    switch (cap.toLowerCase()) {
      case 'tools': return <BoltIcon className="w-3 h-3" />;
      case 'thinking': return <BeakerIcon className="w-3 h-3" />;
      case 'multimodal': return <CodeBracketSquareIcon className="w-3 h-3" />;
      case 'structured': return <ShieldCheckIcon className="w-3 h-3" />;
      default: return <BoltIcon className="w-3 h-3" />;
    }
  };

  return (
    <div className="flex flex-col items-center animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-4 bg-[#1A1D2E]/90 backdrop-blur-xl border border-white/10 rounded-full px-5 py-1.5 shadow-2xl transition-all">
        {/* Provider & Model */}
        <div className="flex items-center gap-2 pr-3 border-r border-white/10">
          <CpuChipIcon className="w-3.5 h-3.5 text-[#FF6600]" />
          <span className="text-[10px] font-black uppercase tracking-tighter text-white/90">
            {telemetry.model}
          </span>
        </div>

        {/* Latency Stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" title="Time to First Token">
            <ClockIcon className="w-3 h-3 text-cyan-400" />
            <span className="text-[9px] font-bold text-cyan-50/70 uppercase tracking-widest">
              TTFT: <span className="text-cyan-400">{ttftMs}ms</span>
            </span>
          </div>
          
          {totalLatMs && (
            <>
              <span className="text-white/5">|</span>
              <div className="flex items-center gap-1.5" title="Total Response Latency">
                <BoltIcon className="w-3 h-3 text-yellow-400" />
                <span className="text-[9px] font-bold text-yellow-50/70 uppercase tracking-widest">
                  LAT: <span className="text-yellow-400">{totalLatMs}ms</span>
                </span>
              </div>
            </>
          )}
        </div>

        <span className="text-white/5">|</span>

        {/* Token Usage */}
        <div className="flex items-center gap-1.5" title="Estimated Tokens Usage">
          <CircleStackIcon className="w-3 h-3 text-emerald-400" />
          <span className="text-[9px] font-bold text-emerald-50/70 uppercase tracking-widest">
            {telemetry.total_tokens} <span className="text-emerald-400/60 font-medium">TOKENS</span>
          </span>
        </div>

        <span className="text-white/5">|</span>

        {/* Capability Matrix */}
        <div className="flex items-center gap-2">
          {telemetry.capabilities.length > 0 ? (
            telemetry.capabilities.map(cap => (
              <div 
                key={cap} 
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/40"
                title={`Capable: ${cap}`}
              >
                {getCapabilityIcon(cap)}
                <span className="text-[8px] font-black uppercase">{cap}</span>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-1 text-white/20">
              <ChatBubbleLeftRightIcon className="w-3 h-3" />
              <span className="text-[8px] font-black uppercase">Standard</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelTelemetryHUD;
