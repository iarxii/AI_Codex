import React from 'react';
import { useAI } from '../../contexts/AIContext';

interface ModelConfigPanelProps {
  isOpen: boolean;
}

const ModelConfigPanel: React.FC<ModelConfigPanelProps> = ({ isOpen }) => {
  const { modelConfig, updateModelConfig } = useAI();

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 bg-white/90 backdrop-blur-xl border border-black/[0.08] rounded-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 z-50">
      <div className="flex flex-col gap-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#FF6600]">Engine Parameters</h3>
        
        {/* Temperature */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-[#4A4D5E] uppercase tracking-tight">Temperature</label>
            <span className="text-[10px] font-mono text-[#FF6600]">{modelConfig.temperature.toFixed(1)}</span>
          </div>
          <input 
            type="range" 
            min="0" max="2" step="0.1" 
            value={modelConfig.temperature}
            onChange={(e) => updateModelConfig('temperature', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-black/[0.06] rounded-lg appearance-none cursor-pointer accent-[#FF6600]"
          />
        </div>

        {/* Max Tokens */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-[#4A4D5E] uppercase tracking-tight">Max Tokens</label>
            <span className="text-[10px] font-mono text-[#FF6600]">{modelConfig.max_tokens}</span>
          </div>
          <input 
            type="range" 
            min="256" max="32768" step="256" 
            value={modelConfig.max_tokens}
            onChange={(e) => updateModelConfig('max_tokens', parseInt(e.target.value))}
            className="w-full h-1.5 bg-black/[0.06] rounded-lg appearance-none cursor-pointer accent-[#FF6600]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Top K */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-[#4A4D5E] uppercase tracking-tight">Top K</label>
            <input 
              type="number" 
              value={modelConfig.top_k}
              onChange={(e) => updateModelConfig('top_k', parseInt(e.target.value))}
              className="bg-black/[0.04] border-none rounded-lg px-2 py-1.5 text-xs font-mono text-[#1A1D2E] focus:ring-1 focus:ring-[#FF6600]/20"
            />
          </div>

          {/* Top P */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-[#4A4D5E] uppercase tracking-tight">Top P</label>
            <input 
              type="number" 
              step="0.05"
              value={modelConfig.top_p}
              onChange={(e) => updateModelConfig('top_p', parseFloat(e.target.value))}
              className="bg-black/[0.04] border-none rounded-lg px-2 py-1.5 text-xs font-mono text-[#1A1D2E] focus:ring-1 focus:ring-[#FF6600]/20"
            />
          </div>
        </div>

        {/* Thinking Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-black/[0.04]">
          <label className="text-[10px] font-bold text-[#4A4D5E] uppercase tracking-tight">Step-by-Step Thinking</label>
          <button 
            type="button"
            onClick={() => updateModelConfig('thinking', !modelConfig.thinking)}
            className={`w-8 h-4 rounded-full transition-all relative ${modelConfig.thinking ? 'bg-[#FF6600]' : 'bg-black/[0.1]'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${modelConfig.thinking ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModelConfigPanel;
