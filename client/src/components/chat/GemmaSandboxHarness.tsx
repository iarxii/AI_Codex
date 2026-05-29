import React, { useState } from 'react';
import { Code, Cpu, Play, Info, Sparkles } from 'lucide-react';

export const GemmaSandboxHarness: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sandbox' | 'mtp'>('sandbox');
  const [code, setCode] = useState<string>(
    `// Write your code here to analyze with Gemma 4 MTP\nfunction calculateFibonacci(n: number): number {\n  if (n <= 1) return n;\n  return calculateFibonacci(n - 1) + calculateFibonacci(n - 2);\n}`
  );
  const [language, setLanguage] = useState<string>('typescript');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);

  // MTP Simulator states
  const [prefixInput, setPrefixInput] = useState<string>('def quick_sort(arr):');
  const [mtpTokens, setMtpTokens] = useState<any[]>([]);
  const [isSimulatingMtp, setIsSimulatingMtp] = useState<boolean>(false);

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setTimeout(() => {
      setAnalysisResult({
        healthScore: 92,
        complexity: 'O(2^N) - Exponential',
        recommendation: 'Refactor recursion to iterative memoization to improve execution speed.',
        optimizedCode: `// Optimized using Memoized approach\nfunction calculateFibonacci(n: number, memo: Record<number, number> = {}): number {\n  if (n <= 1) return n;\n  if (n in memo) return memo[n];\n  memo[n] = calculateFibonacci(n - 1, memo) + calculateFibonacci(n - 2, memo);\n  return memo[n];\n}`,
        mtpSpeedup: '3.1x faster compilation & token generation via Multi-Token Prediction (MTP)',
      });
      setIsAnalyzing(false);
    }, 1800);
  };

  const handleSimulateMtp = () => {
    setIsSimulatingMtp(true);
    setMtpTokens([]);
    
    // Simulate streaming groups of tokens generated simultaneously (MTP 4-token steps)
    const simulatedSteps = [
      { step: 1, tokens: ['if', ' len(arr)', ' <=', ' 1:'], explanation: 'Condition validation block predicted in one clock cycle.' },
      { step: 2, tokens: ['    return', ' arr', '\n  pivot', ' ='], explanation: 'Return statement and pivot assignment generated concurrently.' },
      { step: 3, tokens: [' arr[len(arr)', ' //', ' 2]', '\n  left'], explanation: 'Middle array element lookup and left partition initialization.' },
      { step: 4, tokens: [' = [x', ' for x', ' in arr', ' if x <'], explanation: 'List comprehension filter for elements smaller than pivot.' },
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < simulatedSteps.length) {
        setMtpTokens(prev => [...prev, simulatedSteps[currentStep]]);
        currentStep++;
      } else {
        clearInterval(interval);
        setIsSimulatingMtp(false);
      }
    }, 1200);
  };

  return (
    <div className="flex-1 p-4 flex flex-col items-center justify-start overflow-y-auto space-y-5 w-full scrollbar-hide">
      
      {/* HEADER CARD */}
      <div className="w-full bg-[#161922]/60 rounded-xl p-4 border border-white/5 flex items-center gap-3">
        <div className="w-10 h-10 border border-[#446EFF]/30 rounded-xl bg-[#446EFF]/5 flex items-center justify-center relative shrink-0">
          <div className="w-2 h-2 rounded-full bg-[#446EFF] animate-ping absolute"></div>
          <Cpu className="w-5 h-5 text-[#446EFF]" />
        </div>
        <div className="text-left">
          <h4 className="text-[11px] font-black uppercase tracking-widest text-white">Gemma Code Lab</h4>
          <p className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">
            Optimized Gemma 4 (31B) Sandbox
          </p>
        </div>
      </div>

      {/* TABS CONTROLLER */}
      <div className="w-full bg-[#0F111A] rounded-xl border border-white/5 overflow-hidden flex flex-col">
        <div className="flex border-b border-white/5 bg-black/20">
          <button 
            onClick={() => setActiveTab('sandbox')}
            className={`flex-1 py-2.5 text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'sandbox' ? 'bg-white/[0.03] text-[#446EFF] border-b-2 border-[#446EFF]' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Code className="w-3 h-3" /> Sandbox
          </button>
          <button 
            onClick={() => setActiveTab('mtp')}
            className={`flex-1 py-2.5 text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'mtp' ? 'bg-white/[0.03] text-[#a78bfa] border-b-2 border-[#a78bfa]' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Sparkles className="w-3 h-3" /> MTP Simulator
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* TAB 1: SANDBOX */}
          {activeTab === 'sandbox' && (
            <div className="space-y-4 text-left">
              {/* Language Selector */}
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

              {/* Code TextArea */}
              <div className="relative rounded-lg border border-white/5 overflow-hidden">
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  rows={6}
                  className="w-full bg-black/50 p-3 font-mono text-[10px] text-emerald-400 focus:outline-none focus:ring-0 leading-relaxed resize-none"
                />
              </div>

              {/* Action Button */}
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full py-2.5 bg-[#446EFF]/10 text-[#446EFF] text-[10px] font-black uppercase tracking-wider rounded border border-[#446EFF]/20 hover:bg-[#446EFF]/20 transition-all text-center flex items-center justify-center gap-1.5"
              >
                {isAnalyzing ? (
                  <>Analyzing Sandbox Code...</>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" /> Run AST & MTP Diagnostics
                  </>
                )}
              </button>

              {/* Diagnostic Report Panel */}
              {analysisResult && (
                <div className="space-y-3 animate-in fade-in duration-300">
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
                          <td className="py-1 text-gray-500">MTP EFFICIENCY</td>
                          <td className="py-1 text-sky-400 text-right font-bold">Optimal (MTP-4)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/10 flex gap-2">
                    <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-blue-300 uppercase tracking-wider">Gemma 4 Acceleration</span>
                      <p className="text-[9px] text-gray-400 leading-relaxed font-mono">
                        {analysisResult.mtpSpeedup}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[8px] uppercase text-gray-500 font-mono">Suggested Optimization</span>
                    <pre className="p-3 bg-black/40 rounded-lg border border-white/5 font-mono text-[9px] text-sky-300 overflow-x-auto">
                      {analysisResult.optimizedCode}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MTP SIMULATOR */}
          {activeTab === 'mtp' && (
            <div className="space-y-4 text-left">
              <div className="bg-[#161922]/40 rounded-lg p-3 border border-white/5 flex gap-2">
                <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-purple-300 uppercase tracking-wider">Multi-Token Prediction</span>
                  <p className="text-[9px] text-gray-400 leading-relaxed">
                    Standard LLMs generate one token per forward pass. Gemma 4 outputs multiple target tokens concurrently (MTP-4 structure), significantly improving training speed and execution throughput.
                  </p>
                </div>
              </div>

              {/* Prefix Input */}
              <div className="space-y-1">
                <span className="text-[8px] uppercase text-gray-500 font-mono">Prompt/Context Prefix</span>
                <input
                  type="text"
                  value={prefixInput}
                  onChange={(e) => setPrefixInput(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[10px] text-white font-mono focus:outline-none focus:border-purple-500/50"
                />
              </div>

              {/* Simulate Button */}
              <button
                onClick={handleSimulateMtp}
                disabled={isSimulatingMtp}
                className="w-full py-2.5 bg-purple-500/10 text-purple-400 text-[10px] font-black uppercase tracking-wider rounded border border-purple-500/20 hover:bg-purple-500/20 transition-all text-center flex items-center justify-center gap-1.5"
              >
                {isSimulatingMtp ? 'Decoding concurrently...' : 'Simulate 4-Token Parallel Generation'}
              </button>

              {/* MTP Visual Stream */}
              <div className="space-y-3">
                <span className="text-[8px] uppercase text-gray-500 font-mono">Concurrent Speculative Decoder Stream</span>
                
                <div className="min-h-[140px] bg-black/40 rounded-lg border border-white/5 p-3 space-y-3">
                  {mtpTokens.length === 0 && !isSimulatingMtp && (
                    <div className="h-full flex items-center justify-center text-[9px] font-mono text-gray-600 uppercase tracking-widest text-center py-8">
                      Stream Standing By
                    </div>
                  )}

                  {mtpTokens.map((step, sIdx) => (
                    <div key={sIdx} className="space-y-1 animate-in slide-in-from-bottom-2 duration-300">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1 py-0.5 rounded font-mono">Pass {step.step}</span>
                        <span className="text-[8px] text-gray-500 font-sans">{step.explanation}</span>
                      </div>
                      
                      {/* Parallel Tokens Blocks */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {step.tokens.map((tok: string, tIdx: number) => (
                          <div 
                            key={tIdx} 
                            className="bg-purple-600/10 border border-purple-500/30 rounded p-1.5 text-center font-mono text-[9px] text-purple-300 font-bold overflow-hidden truncate"
                            title={`Token: ${tok}`}
                          >
                            {tok.replace('\n', '\\n')}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {isSimulatingMtp && (
                    <div className="flex items-center gap-2 text-purple-400 text-[9px] font-mono animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span>
                      Evaluating next target sequence block...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
