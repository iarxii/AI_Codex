import React, { useState } from 'react';
import { Code, Cpu, Play, Info, Sparkles, Activity, Network, CheckCircle2, FastForward, Gauge, Database } from 'lucide-react';
import { config } from '../../config';

interface ThoughtLogEntry {
  text: string;
  timestamp: number;
  type?: string;
  details?: string;
}

interface GemmaSandboxHarnessProps {
  thoughtLog?: ThoughtLogEntry[];
  telemetry?: any;
}

export const GemmaSandboxHarness: React.FC<GemmaSandboxHarnessProps> = ({ thoughtLog = [], telemetry = null }) => {
  const [activeTab, setActiveTab] = useState<'chain' | 'telemetry' | 'analysis'>('chain');
  const [code, setCode] = useState<string>(
    `// Write your code here to analyze with Gemma 4 MTP\nfunction calculateFibonacci(n: number): number {\n  if (n <= 1) return n;\n  return calculateFibonacci(n - 1) + calculateFibonacci(n - 2);\n}`
  );
  const [language, setLanguage] = useState<string>('typescript');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.API_BASE_URL}${config.API_V1_STR}/spaces/code-lab/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ code, language })
      });
      if (!response.ok) {
        throw new Error(`Analysis failed with status ${response.status}`);
      }
      const data = await response.json();
      setAnalysisResult({
        healthScore: data.health_score,
        complexity: data.complexity,
        recommendation: data.recommendation,
        optimizedCode: data.optimized_code,
        mtpSpeedup: data.mtp_speedup,
        mtpSteps: data.mtp_steps
      });
    } catch (err: any) {
      console.error(err);
      setAnalysisResult({
        healthScore: 20,
        complexity: 'Error',
        recommendation: `Failed to analyze code: ${err.message}`,
        optimizedCode: code,
        mtpSpeedup: 'N/A'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isShortProcess = telemetry?.is_short_process === true;

  return (
    <div className="flex-1 p-4 flex flex-col items-center justify-start overflow-y-auto space-y-5 w-full scrollbar-hide">
      
      {/* HEADER CARD */}
      <div className="w-full bg-[#161922]/60 rounded-xl p-4 border border-white/5 flex items-center gap-3 shadow-lg">
        <div className="w-10 h-10 border border-[#446EFF]/30 rounded-xl bg-[#446EFF]/5 flex items-center justify-center relative shrink-0">
          <div className="w-2 h-2 rounded-full bg-[#446EFF] animate-ping absolute"></div>
          <Cpu className="w-5 h-5 text-[#446EFF]" />
        </div>
        <div className="text-left flex flex-col gap-1 w-full">
          <div className="flex justify-between items-start w-full">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-white">ADK Stack Observatory</h4>
            {telemetry && (
              <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20">
                <Activity className="w-2.5 h-2.5" /> LIVE
              </span>
            )}
          </div>
          <span className="self-start px-1.5 py-0.5 rounded bg-[#446EFF]/10 text-[7px] font-bold text-[#446EFF] border border-[#446EFF]/20 uppercase tracking-wider">
            Google Agentic Architecture
          </span>
        </div>
      </div>

      {/* TABS CONTROLLER */}
      <div className="w-full bg-[#0F111A] rounded-xl border border-white/5 overflow-hidden flex flex-col shadow-xl">
        <div className="flex border-b border-white/5 bg-black/20">
          <button 
            onClick={() => setActiveTab('chain')}
            className={`flex-1 py-2.5 text-[8px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'chain' ? 'bg-white/[0.03] text-[#a78bfa] border-b-2 border-[#a78bfa]' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Network className="w-3 h-3" /> Chain of Thought
          </button>
          <button 
            onClick={() => setActiveTab('telemetry')}
            className={`flex-1 py-2.5 text-[8px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'telemetry' ? 'bg-white/[0.03] text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Gauge className="w-3 h-3" /> Agent Telemetry
          </button>
          <button 
            onClick={() => setActiveTab('analysis')}
            className={`flex-1 py-2.5 text-[8px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'analysis' ? 'bg-white/[0.03] text-[#446EFF] border-b-2 border-[#446EFF]' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Code className="w-3 h-3" /> Code Analysis
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          
          {/* TAB 1: CHAIN OF THOUGHT */}
          {activeTab === 'chain' && (
            <div className="space-y-4 text-left">
              <div className="bg-[#161922]/40 rounded-lg p-3 border border-white/5 flex gap-2">
                <Info className="w-4 h-4 text-[#a78bfa] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-[#a78bfa] uppercase tracking-wider">Live Agent Trace</span>
                  <p className="text-[9px] text-gray-400 leading-relaxed">
                    Visualizing the execution graph of the agent. Short, conversational queries are heuristically routed via the fast-path bypass.
                  </p>
                </div>
              </div>

              <div className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
                {thoughtLog.length === 0 ? (
                  <div className="text-center py-8 text-[10px] text-gray-500 font-mono uppercase tracking-widest">
                    Awaiting agent execution...
                  </div>
                ) : (
                  thoughtLog.map((log, index) => {
                    const isEndNode = log.type === 'END' || log.type === 'idle';
                    
                    // Determine if we should show the fast path badge
                    const showFastPath = isEndNode && isShortProcess;

                    return (
                      <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active py-2">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0F111A] bg-slate-800 text-slate-400 group-[.is-active]:bg-[#a78bfa] group-[.is-active]:text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors">
                          {isEndNode ? <CheckCircle2 className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-lg bg-[#161922]/80 border border-white/10 shadow-md transition-all group-hover:border-[#a78bfa]/50">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black uppercase text-white font-mono tracking-wider">{log.type}</span>
                            <time className="text-[8px] font-mono text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</time>
                          </div>
                          <div className="text-[9px] text-gray-400 font-sans leading-snug">
                            {log.text}
                          </div>
                          {showFastPath && (
                            <div className="mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[8px] font-bold text-emerald-400 uppercase">
                              <FastForward className="w-2.5 h-2.5" /> FAST-PATH BYPASS
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: AGENT TELEMETRY */}
          {activeTab === 'telemetry' && (
            <div className="space-y-4 text-left">
              {!telemetry ? (
                <div className="text-center py-8 text-[10px] text-gray-500 font-mono uppercase tracking-widest">
                  No telemetry data available. Run the agent first.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#161922]/40 rounded-lg p-3 border border-white/5 space-y-1">
                      <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Database className="w-3 h-3 text-emerald-400" /> Total Tokens
                      </span>
                      <div className="text-lg font-black text-white font-mono">
                        {telemetry.total_tokens?.toLocaleString() || 0}
                      </div>
                    </div>
                    <div className="bg-[#161922]/40 rounded-lg p-3 border border-white/5 space-y-1">
                      <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="w-3 h-3 text-sky-400" /> Time to First Token
                      </span>
                      <div className="text-lg font-black text-white font-mono">
                        {(telemetry.ttft || 0).toFixed(2)}s
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#161922]/40 rounded-lg p-3 border border-white/5 space-y-3">
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Metrics Breakdown</span>
                    <table className="w-full text-[10px] font-mono">
                      <tbody>
                        <tr className="border-b border-white/5">
                          <td className="py-1.5 text-gray-400">Input Tokens</td>
                          <td className="py-1.5 text-white text-right font-bold">{telemetry.usage?.input?.toLocaleString() || 0}</td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="py-1.5 text-gray-400">Output Tokens</td>
                          <td className="py-1.5 text-white text-right font-bold">{telemetry.usage?.output?.toLocaleString() || 0}</td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="py-1.5 text-gray-400">Total Latency</td>
                          <td className="py-1.5 text-white text-right font-bold">{(telemetry.latencies?.total || 0).toFixed(2)}s</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 text-gray-400">Model</td>
                          <td className="py-1.5 text-emerald-300 text-right font-bold truncate max-w-[100px]">{telemetry.model || 'N/A'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {isShortProcess && (
                    <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 flex gap-2">
                      <FastForward className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Heuristic Optimization Applied</span>
                        <p className="text-[9px] text-gray-400 leading-relaxed font-mono">
                          Request matched conversational intent. Skipped Deep Reasoning phase, reducing overhead by ~3.2s.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 3: CODE ANALYSIS (Former Sandbox) */}
          {activeTab === 'analysis' && (
            <div className="space-y-4 text-left animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">Active Language</span>
                <select 
                  value={language} 
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-[#446EFF]/50"
                >
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="rust">Rust</option>
                </select>
              </div>

              <div className="relative rounded-lg border border-white/5 overflow-hidden shadow-inner">
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  rows={6}
                  className="w-full bg-black/50 p-3 font-mono text-[10px] text-[#446EFF] focus:outline-none focus:ring-0 leading-relaxed resize-none"
                />
              </div>

              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full py-2.5 bg-[#446EFF]/10 text-[#446EFF] text-[10px] font-black uppercase tracking-wider rounded border border-[#446EFF]/20 hover:bg-[#446EFF]/20 transition-all text-center flex items-center justify-center gap-1.5"
              >
                {isAnalyzing ? (
                  <>Analyzing AST & Requesting MTP...</>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" /> Run AST & MTP Diagnostics
                  </>
                )}
              </button>

              {analysisResult && (
                <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-[#161922]/40 rounded-lg p-3 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                      <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider">AST Metrics</span>
                      <span className="text-[9px] text-emerald-400 font-mono font-bold">Health: {analysisResult.healthScore}%</span>
                    </div>
                    <table className="w-full text-[9px] font-mono">
                      <tbody>
                        <tr className="border-b border-white/5">
                          <td className="py-1 text-gray-500">COMPLEXITY</td>
                          <td className="py-1 text-white text-right font-bold">{analysisResult.complexity}</td>
                        </tr>
                        <tr>
                          <td className="py-1 text-gray-500">RECOMMENDATION</td>
                          <td className="py-1 text-sky-400 text-right font-bold">{analysisResult.recommendation?.substring(0, 40)}...</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {analysisResult.mtpSpeedup && analysisResult.mtpSpeedup !== 'N/A' && (
                    <div className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/10 flex gap-2">
                      <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-blue-300 uppercase tracking-wider">MTP Speedup</span>
                        <p className="text-[9px] text-gray-400 leading-relaxed font-mono">
                          {analysisResult.mtpSpeedup}
                        </p>
                      </div>
                    </div>
                  )}

                  {analysisResult.mtpSteps && analysisResult.mtpSteps.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[8px] uppercase text-gray-500 font-mono">Speculative Execution Trace</span>
                      <div className="min-h-[100px] bg-black/40 rounded-lg border border-white/5 p-3 space-y-3">
                        {analysisResult.mtpSteps.map((step: any, sIdx: number) => (
                          <div key={sIdx} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] font-bold bg-[#446EFF]/20 text-[#446EFF] px-1 py-0.5 rounded font-mono">Block {step.step}</span>
                              <span className="text-[8px] text-gray-500">{step.explanation}</span>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {step.tokens?.map((tok: string, tIdx: number) => (
                                <div key={tIdx} className="bg-white/5 border border-white/10 rounded p-1 text-center font-mono text-[8px] text-gray-300 truncate" title={tok}>
                                  {tok}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
