import React from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import AgentPulse from "../AgentPulse";
import ContextInspector from "../ContextInspector";
import type { ThoughtLogEntry } from "../../types/chat";

interface ThinkingTraceProps {
  loading: boolean;
  thoughtLog: ThoughtLogEntry[];
  thoughtStartTime: number | null;
  currentToolCalls: any[];
  currentContext: any[];
}

const ThinkingTrace: React.FC<ThinkingTraceProps> = ({
  loading,
  thoughtLog,
  thoughtStartTime,
  currentToolCalls,
  currentContext,
}) => {
  const TRACE_WINDOW_SIZE = 80;
  const TRACE_WINDOW_STEP = 60;
  const defaultStart = Math.max(0, thoughtLog.length - TRACE_WINDOW_SIZE);
  const [traceStartIndex, setTraceStartIndex] = React.useState(defaultStart);

  React.useEffect(() => {
    setTraceStartIndex(Math.max(0, thoughtLog.length - TRACE_WINDOW_SIZE));
  }, [thoughtLog.length]);

  const hiddenTraceCount = Math.max(0, traceStartIndex);
  const visibleTrace = thoughtLog.slice(traceStartIndex);

  if (
    !loading &&
    thoughtLog.length === 0 &&
    currentToolCalls.length === 0 &&
    currentContext.length === 0
  ) {
    return null;
  }

  return (
    <div className="flex justify-start pl-4 animate-in fade-in zoom-in-95 duration-300 mb-4">
      <div className="bg-[#D8DCE4]/40 backdrop-blur-sm border border-[#fd3b12]/40 p-4 rounded-xl max-w-2xl w-full shadow-sm shadow-[#fd3b12]/5">
        <details open={loading} className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none select-none">
            <div className="flex items-center gap-3">
              <span
                className={`text-[10px] font-bold uppercase tracking-[0.15em] ${loading ? "text-[#fd3b12]" : "text-[#7A7D8E]"}`}
              >
                {loading ? "Thinking Process" : "Neural Trace"}
              </span>
              <AgentPulse
                mode={loading ? "thinking" : "idle"}
                showText={false}
              />
              {!loading && thoughtStartTime && thoughtLog.length > 0 && (
                <span className="text-[#7A7D8E] lowercase font-mono">
                  (
                  {(() => {
                    const totalSecs =
                      (thoughtLog[thoughtLog.length - 1].timestamp -
                        thoughtStartTime) /
                      1000;
                    if (totalSecs < 60) return `${totalSecs.toFixed(2)}s`;
                    const m = Math.floor(totalSecs / 60);
                    const s = Math.floor(totalSecs % 60);
                    return `${m}m ${s}s`;
                  })()}
                  )
                </span>
              )}
            </div>
            <div className="text-[#7A7D8E] group-open:rotate-180 transition-transform">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </summary>
          <div className="mt-4 space-y-2 pl-5 border-l-2 border-[#fd3b12]/20">
            {hiddenTraceCount > 0 && (
              <div className="pb-2">
                <button
                  onClick={() =>
                    setTraceStartIndex((prev) =>
                      Math.max(0, prev - TRACE_WINDOW_STEP),
                    )
                  }
                  className="px-2.5 py-1 rounded-full bg-white/50 border border-[#fd3b12]/20 text-[9px] font-bold uppercase tracking-widest text-[#4A4D5E] hover:bg-white/80 transition-colors"
                >
                  Load Older Trace ({hiddenTraceCount} hidden)
                </button>
              </div>
            )}

            {visibleTrace.map((log, i) => {
              const absoluteIndex = traceStartIndex + i;
              const prevTime =
                absoluteIndex === 0
                  ? thoughtStartTime!
                  : thoughtLog[absoluteIndex - 1].timestamp;
              const delta = ((log.timestamp - prevTime) / 1000).toFixed(2);
              return (
                <div key={i} className="group/item">
                  {log.details ? (
                    <details className="group/details">
                      <summary className="text-[11px] font-mono text-[#4A4D5E] flex gap-3 cursor-pointer list-none hover:bg-white/40 p-1 rounded transition-colors">
                        <span className="text-[#fd3b12] opacity-40 font-bold">
                          [{absoluteIndex + 1}]
                        </span>
                        <span className="group-hover/item:text-[#1A1D2E] transition-colors flex-1 flex items-center gap-2">
                          {log.text}
                          <ChevronDownIcon className="w-3 h-3 opacity-50 group-open/details:rotate-180 transition-transform" />
                        </span>
                        <span className="text-[#7A7D8E] opacity-50 group-hover/item:opacity-100 transition-opacity text-[9px] w-8 text-right mt-0.5">
                          {delta}s
                        </span>
                      </summary>
                      <div className="mt-2 ml-7 mb-2 pl-3 border-l border-[#fd3b12]/20 text-[10px] font-mono text-[#7A7D8E] whitespace-pre-wrap max-h-60 overflow-y-auto bg-white/30 rounded p-2">
                        {log.details}
                      </div>
                    </details>
                  ) : (
                    <div className="text-[11px] font-mono text-[#4A4D5E] flex gap-3 p-1">
                      <span className="text-[#fd3b12] opacity-40 font-bold">
                        [{absoluteIndex + 1}]
                      </span>
                      <span className="group-hover/item:text-[#1A1D2E] transition-colors flex-1">
                        {log.text}
                      </span>
                      <span className="text-[#7A7D8E] opacity-50 group-hover/item:opacity-100 transition-opacity text-[9px] w-8 text-right mt-0.5">
                        {delta}s
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Inline Context Inspector */}
            <ContextInspector
              toolCalls={currentToolCalls}
              contextData={currentContext}
            />
          </div>
        </details>
      </div>
    </div>
  );
};

export default ThinkingTrace;
