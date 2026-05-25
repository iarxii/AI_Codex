import React, { useState, useEffect } from 'react';
import { ShieldCheck, TrendingDown, Activity, AlertTriangle, ShieldAlert, Terminal } from 'lucide-react';
import { useDiscipline } from '../../../contexts/DisciplineContext';
import { MiniContextChat } from '../../chat/MiniContextChat';

interface AnalystSidebarProps {
  symbol: string;
}

export const AnalystSidebar: React.FC<AnalystSidebarProps> = ({ symbol }) => {
  const { state: disciplineState } = useDiscipline();
  const [isChatActive, setIsChatActive] = useState(false);
  
  // Mock Data for Phase 1
  const [logs, setLogs] = useState<{ id: number; time: string; msg: string; type: 'info' | 'warn' | 'alert' }[]>([]);
  
  useEffect(() => {
    // Simulate streaming logs
    const initialLogs = [
      { id: 1, time: new Date(Date.now() - 60000).toLocaleTimeString(), msg: `Analyst Session Started. Listening to ${symbol}...`, type: 'info' as const },
      { id: 2, time: new Date(Date.now() - 30000).toLocaleTimeString(), msg: 'Volumetric expansion detected in sub-minute timeframe.', type: 'warn' as const },
    ];
    setLogs(initialLogs);

    const interval = setInterval(() => {
      if (Math.random() > 0.6) {
        setLogs(prev => [
          ...prev.slice(-15), 
          { 
            id: Date.now(), 
            time: new Date().toLocaleTimeString(), 
            msg: `[${symbol}] ${Math.random() > 0.5 ? 'Liquidity grab forming at resistance.' : 'Order block mitigated on LTF.'}`,
            type: Math.random() > 0.8 ? 'alert' : 'info'
          }
        ]);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [symbol]);

  // Derived Metrics from Context
  const gateOpen = !disciplineState.isGateLocked;
  const drawdown = (3.0 - disciplineState.dailyLimitRemaining).toFixed(1);
  const exposure = disciplineState.activeExposurePercent;

  return (
    <div className="w-full h-full flex flex-col bg-[#11131A] rounded-2xl border border-white/5 overflow-hidden">
      
      {/* TRADING GATE STATUS */}
      <div className={`px-5 py-4 border-b border-white/5 flex items-center justify-between ${gateOpen ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
        <div className="flex items-center gap-3">
          {gateOpen ? <ShieldCheck className="w-5 h-5 text-emerald-400" /> : <ShieldAlert className="w-5 h-5 text-rose-400" />}
          <div>
            <h3 className={`text-xs font-black tracking-widest uppercase ${gateOpen ? 'text-emerald-400' : 'text-rose-400'}`}>
              Trading Gate
            </h3>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">
              {gateOpen ? 'System Active • Execution Allowed' : 'Locked • Daily Limit Reached'}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs font-bold text-white font-mono">{symbol}</span>
          <span className="text-[9px] text-gray-500 uppercase">Context</span>
        </div>
      </div>

      {/* METRICS DASHBOARD */}
      <div className="grid grid-cols-2 gap-px bg-white/5 border-b border-white/5">
        <div className="bg-[#11131A] p-4 flex flex-col gap-1">
          <span className="text-[9px] uppercase tracking-widest text-gray-500 flex items-center gap-1.5"><Activity className="w-3 h-3" /> Win Rate</span>
          <span className="text-lg font-black text-white">68.4%</span>
        </div>
        <div className="bg-[#11131A] p-4 flex flex-col gap-1">
          <span className="text-[9px] uppercase tracking-widest text-gray-500 flex items-center gap-1.5"><TrendingDown className="w-3 h-3" /> Daily DD</span>
          <span className="text-lg font-black text-rose-400">-{drawdown}%</span>
        </div>
        <div className="bg-[#11131A] p-4 flex flex-col gap-1 col-span-2 border-t border-white/5">
          <div className="flex justify-between items-end">
            <span className="text-[9px] uppercase tracking-widest text-gray-500">Active Exposure</span>
            <span className="text-sm font-black text-orange-400">{exposure}% / 20%</span>
          </div>
          <div className="w-full bg-black/40 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-orange-500 h-full rounded-full" style={{ width: `${(exposure / 20) * 100}%` }}></div>
          </div>
        </div>
      </div>

      {/* LIVE SYSTEM LOGS */}
      <div className={`flex flex-col transition-all duration-300 ${isChatActive ? 'h-24 min-h-0' : 'flex-1 min-h-[250px]'}`}>
        <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center justify-between">
            <span className="flex items-center gap-2"><Terminal className="w-3.5 h-3.5" /> Analyst Log Stream</span>
            {isChatActive && <span className="text-[8px] bg-[#fd3b12]/20 text-[#fd3b12] px-2 py-0.5 rounded-full">Collapsed</span>}
          </h4>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide font-mono">
          {(isChatActive ? logs.slice(0, 1) : logs).map(log => (
            <div key={log.id} className={`flex flex-col gap-1 p-2 rounded border-l-2 ${
              log.type === 'alert' ? 'border-rose-500 bg-rose-500/5' : 
              log.type === 'warn' ? 'border-amber-500 bg-amber-500/5' : 
              'border-[#fd3b12] bg-white/[0.02]'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-gray-500 opacity-80">{log.time}</span>
                {log.type === 'alert' && <AlertTriangle className="w-3 h-3 text-rose-500" />}
              </div>
              <p className={`text-[11px] leading-relaxed ${
                log.type === 'alert' ? 'text-rose-200' :
                log.type === 'warn' ? 'text-amber-200' :
                'text-gray-300'
              }`}>
                {log.msg}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* MINI CONTEXT CHAT */}
      <div className={isChatActive ? 'flex-1 flex flex-col' : ''}>
        <MiniContextChat symbol={symbol} onInteractionChange={setIsChatActive} />
      </div>

    </div>
  );
};
