import React from 'react';

export interface TerminalOutput {
  command: string;
  output?: string;
  error?: string;
  returnCode?: number | null;
  durationMs?: number;
  timestamp: number;
  isRunning?: boolean;
}

interface TerminalConsoleProps {
  logs: TerminalOutput[];
  onClear: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const TerminalConsole: React.FC<TerminalConsoleProps> = ({
  logs,
  onClear,
  isOpen,
  onToggle,
}) => {
  const terminalEndRef = React.useRef<HTMLDivElement>(null);
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (isOpen && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const activeLog = logs[logs.length - 1];

  return (
    <div className="border-t border-black/[0.08] bg-[#0c1017] text-slate-200 flex flex-col transition-all duration-200">
      {/* Terminal Titlebar */}
      <div className="h-9 px-3 flex items-center justify-between bg-[#161b22] border-b border-black/20 select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
            </svg>
            <span>Terminal / Console</span>
          </button>

          {activeLog && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
              activeLog.isRunning
                ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                : activeLog.returnCode === 0
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/20 text-rose-400'
            }`}>
              {activeLog.isRunning ? 'RUNNING' : `EXIT ${activeLog.returnCode ?? 0}`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <button
              onClick={onClear}
              className="text-[9px] text-slate-400 hover:text-white px-2 py-0.5 rounded hover:bg-white/[0.06] transition-colors"
              title="Clear output"
            >
              Clear
            </button>
          )}
          <button
            onClick={onToggle}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/[0.06]"
            title={isOpen ? 'Collapse terminal' : 'Expand terminal'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isOpen ? "M18 12H6" : "M5 15l7-7 7 7"} />
            </svg>
          </button>
        </div>
      </div>

      {/* Output Content */}
      {isOpen && (
        <div className="h-44 overflow-y-auto font-mono text-[11px] leading-[1.6] p-3 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-[10px] uppercase tracking-widest">
              Terminal ready. Click "Run" on any file to execute in the workspace sandbox.
            </div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="group rounded bg-black/30 p-2.5 border border-white/[0.04]">
                {/* Command Line Prompt */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-white/[0.04] pb-1.5 mb-1.5">
                  <div className="flex items-center gap-1.5 font-bold truncate">
                    <span className="text-emerald-400 font-black">$</span>
                    <span className="text-slate-200">{log.command}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {log.durationMs !== undefined && (
                      <span className="text-slate-500 text-[9px]">{log.durationMs}ms</span>
                    )}
                    <button
                      onClick={() => handleCopy(log.output || log.error || '', idx)}
                      className="opacity-0 group-hover:opacity-100 hover:text-white text-[9px] transition-opacity"
                    >
                      {copiedIndex === idx ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Output or Error */}
                {log.isRunning ? (
                  <div className="flex items-center gap-2 text-amber-300 animate-pulse text-[11px]">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    Executing in sandbox...
                  </div>
                ) : (
                  <>
                    {log.output && (
                      <pre className="whitespace-pre-wrap break-all text-slate-300 font-mono text-[11px]">
                        {log.output}
                      </pre>
                    )}
                    {log.error && (
                      <pre className="whitespace-pre-wrap break-all text-rose-400 font-mono text-[11px] mt-1">
                        {log.error}
                      </pre>
                    )}
                  </>
                )}
              </div>
            ))
          )}
          <div ref={terminalEndRef} />
        </div>
      )}
    </div>
  );
};

export default TerminalConsole;
