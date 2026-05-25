import React, { useState } from 'react';
import { TrendingUp, AlertTriangle } from 'lucide-react';

interface SpiritBirdHarnessProps {
  spaceName: string;
}

export const SpiritBirdHarness: React.FC<SpiritBirdHarnessProps> = ({ spaceName }) => {
  const [activeTab, setActiveTab] = useState<'trade' | 'risk'>('trade');
  const [simulatedAction, setSimulatedAction] = useState<string | null>(null);

  const handleAction = (action: string) => {
    setSimulatedAction(action);
    setTimeout(() => setSimulatedAction(null), 3000);
  };

  return (
    <div className="flex-1 p-4 flex flex-col items-center justify-start overflow-y-auto space-y-6 w-full">
      <div className="w-16 h-16 border border-white/10 rounded-2xl bg-white/5 flex items-center justify-center mt-4">
        <div className="w-2 h-2 rounded-full bg-emerald-500/50 animate-ping"></div>
      </div>
      
      <div className="text-center w-full">
        <h4 className="text-xs font-bold text-white mb-1">Active Space: {spaceName}</h4>
        <p className="text-[10px] text-slate-400 mb-4">
          Agent UI Projection Space Active.
        </p>
      </div>

      <div className="w-full bg-[#0F111A] rounded-xl border border-white/5 overflow-hidden">
        <div className="flex border-b border-white/5">
          <button 
            onClick={() => setActiveTab('trade')}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider ${activeTab === 'trade' ? 'bg-white/5 text-[#fd3b12]' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Execute
          </button>
          <button 
            onClick={() => setActiveTab('risk')}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider ${activeTab === 'risk' ? 'bg-white/5 text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Risk Rules
          </button>
        </div>

        <div className="p-4">
          {activeTab === 'trade' && (
            <div className="space-y-3">
              <button 
                onClick={() => handleAction('EXECUTING: MARKET BUY (BTCUSD)')}
                className="w-full py-2 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-colors"
              >
                <TrendingUp className="w-3.5 h-3.5" /> Market Buy
              </button>
              <button 
                onClick={() => handleAction('EXECUTING: MARKET SELL (BTCUSD)')}
                className="w-full py-2 bg-rose-500/10 text-rose-400 text-xs font-bold rounded flex items-center justify-center gap-2 hover:bg-rose-500/20 transition-colors"
              >
                <TrendingUp className="w-3.5 h-3.5 rotate-180" /> Market Sell
              </button>
            </div>
          )}

          {activeTab === 'risk' && (
            <div className="space-y-3">
              <button 
                onClick={() => handleAction('APPLYING: TIGHTEN STOP LOSS (1.5%)')}
                className="w-full py-2 bg-amber-500/10 text-amber-400 text-xs font-bold rounded flex items-center justify-center gap-2 hover:bg-amber-500/20 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Tighten Stops
              </button>
              <button 
                onClick={() => handleAction('HALT: FLATTEN ALL POSITIONS')}
                className="w-full py-2 bg-rose-500/10 text-rose-400 text-xs font-bold rounded flex items-center justify-center gap-2 hover:bg-rose-500/20 transition-colors"
              >
                Flatten Risk
              </button>
            </div>
          )}
        </div>
      </div>

      {simulatedAction && (
        <div className="w-full p-3 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-emerald-400 text-center animate-in slide-in-from-bottom-2">
          {simulatedAction}
        </div>
      )}

      <div className="w-full text-left p-3 bg-black/20 rounded border border-white/5">
        <span className="opacity-60 text-[8px] font-mono leading-tight block">
          PROMPT_STUB: "Generate interactive UI Tool components that allow the user to trigger actions (e.g. trades, limits, analysis) directly via button clicks within this projection space, maintaining context with the chat stream."
        </span>
      </div>
    </div>
  );
};
