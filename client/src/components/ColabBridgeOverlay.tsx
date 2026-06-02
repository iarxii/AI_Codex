import React, { useState } from 'react';
import { useAI } from '../contexts/AIContext';
import { useBridge } from '../contexts/BridgeContext';

const ColabBridgeOverlay: React.FC = () => {
  const { isPremiumSpace, setModel } = useAI();
  const {
    isConnected,
    isConnecting,
    pingLatency,
    activeModel,
    availableModels,
    countdown,
    token,
    requestToken,
    setActiveModel,
    resetCountdown
  } = useBridge();

  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Only render overlay if user is inside a Premium Space
  if (!isPremiumSpace) return null;

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setActiveModel(selected);
    // Sync to AIContext so agent chat uses the correct model name
    setModel(selected, 'colab_bridge');
  };

  // Calculate countdown percentage for progress bar
  const pct = Math.max(0, Math.min(100, (countdown / 900) * 100));

  // Determine indicator color based on status
  const statusColor = isConnected ? '#22c55e' : isConnecting ? '#eab308' : '#ef4444';
  const progressColor = countdown > 300 ? 'bg-green-500' : countdown > 60 ? 'bg-yellow-500' : 'bg-red-600';

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* ─── COLLAPSED TRIGGER BADGE ─── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-3 px-4 py-3 rounded-full bg-black/85 hover:bg-black/95 text-white shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/10 transition-all hover:scale-105 active:scale-95 duration-300 backdrop-blur-md"
        >
          {/* Pulsing indicator */}
          <span className="relative flex h-3.5 w-3.5">
            {isConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            )}
            <span
              className="relative inline-flex rounded-full h-3.5 w-3.5"
              style={{ backgroundColor: statusColor }}
            ></span>
          </span>
          <span className="text-xs font-bold tracking-wider uppercase">
            {isConnected ? 'Bridge: Connected' : isConnecting ? 'Bridge: Syncing...' : 'Bridge: Offline'}
          </span>
          {isConnected && pingLatency !== null && (
            <span className="text-[10px] font-mono opacity-60">
              {pingLatency}ms
            </span>
          )}
          {isConnected && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${countdown < 300 ? 'text-red-400 bg-red-950/30' : 'text-green-400 bg-green-950/30'}`}>
              {formatTime(countdown)}
            </span>
          )}
        </button>
      )}

      {/* ─── EXPANDED GLASSMORPHIC PANEL ─── */}
      {isOpen && (
        <div className="w-[340px] rounded-2xl bg-black/90 text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)] border border-white/15 p-5 backdrop-blur-lg transition-all duration-300 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {isConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                )}
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: statusColor }}></span>
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Neural Bridge Engine
              </h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Connection Status & Latency */}
          <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] rounded-xl p-3 mb-4">
            <div>
              <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Status</div>
              <div className="text-sm font-semibold mt-0.5">
                {isConnected ? 'Active & Bridged' : isConnecting ? 'Verifying handshakes...' : 'Idle / Offline'}
              </div>
            </div>
            {isConnected && pingLatency !== null && (
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Latency</div>
                <div className="text-sm font-mono font-bold text-green-400 mt-0.5">
                  {pingLatency}ms
                </div>
              </div>
            )}
          </div>

          {/* Countdown & Keep-Alive */}
          {isConnected && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  Inactivity Standby
                </span>
                <span className={`text-xs font-mono font-bold ${countdown < 300 ? 'text-red-400 animate-pulse' : 'text-neutral-300'}`}>
                  {formatTime(countdown)}
                </span>
              </div>
              {/* Progress gauge */}
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full transition-all duration-1000 ${progressColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <p className="text-[9px] text-neutral-400 leading-normal max-w-[200px]">
                  {countdown < 300 
                    ? 'Colab session entering standby soon due to inactivity.'
                    : 'System will automatically preserve connection state.'}
                </p>
                <button
                  onClick={resetCountdown}
                  className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/15 text-[9px] font-bold uppercase transition-colors"
                >
                  Keep Alive
                </button>
              </div>
            </div>
          )}

          {/* Model Selection */}
          {isConnected && (
            <div className="mb-4">
              <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1.5">
                Active Colab Model
              </label>
              {availableModels.length > 0 ? (
                <select
                  value={activeModel || ''}
                  onChange={handleModelChange}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-white/30"
                >
                  {availableModels.map((m) => (
                    <option key={m} value={m} className="bg-neutral-900 text-white">
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs text-yellow-400 bg-yellow-950/20 border border-yellow-800/30 rounded-lg p-2.5">
                  ⚠️ No models found. Pull model in Colab (e.g. <code>qwen2.5-coder:3b</code>).
                </div>
              )}
            </div>
          )}

          {/* Actions panel */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            {/* Open Colab */}
            <a
              href="https://colab.research.google.com/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider transition-all"
            >
              <span>Launch Colab Notebook</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            {/* Request Handshake Key */}
            {!isConnected && (
              <div className="space-y-2">
                <button
                  onClick={requestToken}
                  disabled={isConnecting}
                  className="w-full py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                  {isConnecting ? 'Generating token...' : 'Request Handshake Key'}
                </button>

                {token && (
                  <div className="flex gap-2 items-center bg-white/5 border border-white/10 rounded-xl p-2 animate-fade-in">
                    <input
                      type="text"
                      readOnly
                      value={token}
                      className="bg-transparent border-none text-[10px] font-mono text-neutral-300 flex-1 focus:outline-none px-2 select-all"
                    />
                    <button
                      onClick={handleCopyToken}
                      className="px-3 py-1.5 rounded bg-white/15 hover:bg-white/20 text-[9px] font-bold uppercase tracking-wider transition-colors"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColabBridgeOverlay;
