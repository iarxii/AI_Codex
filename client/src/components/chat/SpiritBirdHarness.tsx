import React, { useState } from 'react';
import { TrendingUp, AlertTriangle, Target, Shield, Scale, Info, BarChart2 } from 'lucide-react';
import { useDiscipline } from '../../contexts/DisciplineContext';

interface SpiritBirdHarnessProps {
  spaceName: string;
}

export const SpiritBirdHarness: React.FC<SpiritBirdHarnessProps> = ({ spaceName }) => {
  const [activeTab, setActiveTab] = useState<'trade' | 'risk'>('trade');
  const [simulatedAction, setSimulatedAction] = useState<string | null>(null);
  const { state: disciplineState, updateExposure, recordTradeResult } = useDiscipline();

  const handleAction = (action: string, type: 'buy' | 'sell' | 'tighten' | 'flatten') => {
    setSimulatedAction(action);
    
    // Simulate updating the Discipline context to prove live state updates
    if (type === 'buy') {
      updateExposure(12.5); // Add 12.5% active exposure
      recordTradeResult(-0.4); // Simulate 0.4% current floating drawdown
    } else if (type === 'sell') {
      updateExposure(10.0); // Add 10% active exposure
      recordTradeResult(-0.2); // Simulate 0.2% floating drawdown
    } else if (type === 'tighten') {
      updateExposure(5.0); // Reduced exposure due to tight stops
      recordTradeResult(-0.1); // Recover some drawdown
    } else if (type === 'flatten') {
      updateExposure(0.0); // 0% active exposure
      // Reset drawdown limit back to full
      const currentDD = 3.0 - disciplineState.dailyLimitRemaining;
      recordTradeResult(currentDD); // This adds back the DD so remaining = 3.0
    }

    setTimeout(() => setSimulatedAction(null), 4000);
  };

  return (
    <div className="flex-1 p-4 flex flex-col items-center justify-start overflow-y-auto space-y-5 w-full scrollbar-hide">
      
      {/* HEADER CARD */}
      <div className="w-full bg-[#161922]/60 rounded-xl p-4 border border-white/5 flex items-center gap-3">
        <div className="w-10 h-10 border border-[#fd3b12]/30 rounded-xl bg-[#fd3b12]/5 flex items-center justify-center relative shrink-0">
          <div className="w-2 h-2 rounded-full bg-[#fd3b12] animate-ping absolute"></div>
          <Target className="w-5 h-5 text-[#fd3b12]" />
        </div>
        <div className="text-left">
          <h4 className="text-[11px] font-black uppercase tracking-widest text-white">Spirit Bird Harness</h4>
          <p className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">
            {spaceName} UI Projection
          </p>
        </div>
      </div>

      {/* INTERACTIVE HARNESS TABS */}
      <div className="w-full bg-[#0F111A] rounded-xl border border-white/5 overflow-hidden flex flex-col">
        <div className="flex border-b border-white/5 bg-black/20">
          <button 
            onClick={() => setActiveTab('trade')}
            className={`flex-1 py-2.5 text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'trade' ? 'bg-white/[0.03] text-[#fd3b12] border-b-2 border-[#fd3b12]' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <TrendingUp className="w-3 h-3" /> Execute
          </button>
          <button 
            onClick={() => setActiveTab('risk')}
            className={`flex-1 py-2.5 text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'risk' ? 'bg-white/[0.03] text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Shield className="w-3 h-3" /> Risk Rules
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          
          {/* TAB 1: EXECUTE */}
          {activeTab === 'trade' && (
            <div className="space-y-4 text-left">
              {/* Context Narrative */}
              <div className="bg-[#161922]/40 rounded-lg p-3 border border-white/5 flex gap-2">
                <Info className="w-4 h-4 text-[#fd3b12] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider">Market Intelligence Context</span>
                  <p className="text-[10px] text-gray-400 leading-relaxed font-sans">
                    BTCUSD indicates a classic liquidity sweep pattern near the $77,000 support. The algorithmic engine recommends scaling-in with a tight risk parameters window rather than loading full size.
                  </p>
                </div>
              </div>

              {/* Target Projection Table */}
              <div className="rounded-lg border border-white/5 overflow-hidden">
                <div className="bg-white/[0.02] px-3 py-1.5 border-b border-white/5 flex justify-between items-center">
                  <span className="text-[8px] font-bold uppercase text-gray-400 font-mono">Projection Targets</span>
                  <span className="text-[8px] text-emerald-400 font-mono font-bold">R:R Ratio 1:2.00</span>
                </div>
                <table className="w-full text-[9px] font-mono">
                  <tbody>
                    <tr className="border-b border-white/5">
                      <td className="px-3 py-2 text-gray-500">ENTRY TRIGGER</td>
                      <td className="px-3 py-2 text-white text-right font-bold">$77,100.00</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="px-3 py-2 text-gray-500">STOP LOSS</td>
                      <td className="px-3 py-2 text-rose-400 text-right font-bold">$76,324.77</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-gray-500">TAKE PROFIT</td>
                      <td className="px-3 py-2 text-emerald-400 text-right font-bold">$78,637.64</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Visual Slippage Graph */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[8px] uppercase text-gray-500 font-mono">
                  <span>Projected Slippage</span>
                  <span className="text-emerald-400 font-bold">Minimal (0.01%)</span>
                </div>
                <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-500 h-full" style={{ width: '85%' }}></div>
                  <div className="bg-amber-500 h-full" style={{ width: '12%' }}></div>
                  <div className="bg-rose-500 h-full" style={{ width: '3%' }}></div>
                </div>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                <button 
                  onClick={() => handleAction('EXECUTING: MARKET BUY (BTCUSD)', 'buy')}
                  className="py-2.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded border border-emerald-500/20 hover:bg-emerald-500/20 transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <TrendingUp className="w-3.5 h-3.5" /> Market Buy
                </button>
                <button 
                  onClick={() => handleAction('EXECUTING: MARKET SELL (BTCUSD)', 'sell')}
                  className="py-2.5 bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-wider rounded border border-rose-500/20 hover:bg-rose-500/20 transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <TrendingUp className="w-3.5 h-3.5 rotate-180" /> Market Sell
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: RISK RULES */}
          {activeTab === 'risk' && (
            <div className="space-y-4 text-left">
              {/* Context Narrative */}
              <div className="bg-[#161922]/40 rounded-lg p-3 border border-white/5 flex gap-2">
                <Scale className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider">Risk Mitigation Thresholds</span>
                  <p className="text-[10px] text-gray-400 leading-relaxed font-sans">
                    Trading Gate checks are fully active. Whitelisted trading is strictly locked to validated symbols. Current portfolio exposure status is evaluated before each order broadcast to MT5.
                  </p>
                </div>
              </div>

              {/* Whitelist and Limits Table */}
              <div className="rounded-lg border border-white/5 overflow-hidden">
                <div className="bg-white/[0.02] px-3 py-1.5 border-b border-white/5 flex justify-between items-center">
                  <span className="text-[8px] font-bold uppercase text-gray-400 font-mono">Discipline Limits</span>
                  <span className="text-[8px] text-amber-400 font-mono font-bold">Max Drawdown: 3.0%</span>
                </div>
                <table className="w-full text-[9px] font-mono">
                  <tbody>
                    <tr className="border-b border-white/5">
                      <td className="px-3 py-2 text-gray-500">MAX EXPOSURE</td>
                      <td className="px-3 py-2 text-white text-right font-bold">20.0%</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="px-3 py-2 text-gray-500">CURRENT STATUS</td>
                      <td className={`px-3 py-2 text-right font-bold ${disciplineState.isGateLocked ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {disciplineState.isGateLocked ? 'LOCKED' : 'NOMINAL'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-gray-500">WHITELIST</td>
                      <td className="px-3 py-2 text-white text-right truncate max-w-[120px]" title={disciplineState.allowedSymbolsWhitelist.join(', ')}>
                        {disciplineState.allowedSymbolsWhitelist.slice(0, 3).join(', ')}...
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Progress/Usage Indicator */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[8px] uppercase text-gray-500 font-mono">
                  <span>Exposure Usage</span>
                  <span className="text-orange-400 font-bold">{disciplineState.activeExposurePercent}% / 20%</span>
                </div>
                <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
                  <div className="bg-orange-500 h-full rounded-full transition-all duration-300" style={{ width: `${(disciplineState.activeExposurePercent / 20) * 100}%` }}></div>
                </div>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                <button 
                  onClick={() => handleAction('APPLYING: TIGHTEN STOP LOSS (1.5%)', 'tighten')}
                  className="py-2.5 bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase tracking-wider rounded border border-amber-500/20 hover:bg-amber-500/20 transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> Tighten Stops
                </button>
                <button 
                  onClick={() => handleAction('HALT: FLATTEN ALL POSITIONS', 'flatten')}
                  className="py-2.5 bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-wider rounded border border-rose-500/20 hover:bg-rose-500/20 transition-all text-center flex items-center justify-center gap-1.5"
                >
                  Flatten Risk
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Simulated Toast feedback */}
      {simulatedAction && (
        <div className="w-full p-3 bg-white/5 border border-[#fd3b12]/30 rounded-xl text-[10px] font-mono text-emerald-400 text-center animate-in slide-in-from-bottom-2 flex items-center justify-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          {simulatedAction}
        </div>
      )}

      {/* Prompt Stub Banner */}
      <div className="w-full text-left p-3 bg-black/20 rounded border border-white/5">
        <span className="opacity-60 text-[8px] font-mono leading-tight block">
          PROMPT_STUB: "Generate interactive UI Tool components that allow the user to trigger actions (e.g. trades, limits, analysis) directly via button clicks within this projection space, maintaining context with the chat stream."
        </span>
      </div>
    </div>
  );
};
