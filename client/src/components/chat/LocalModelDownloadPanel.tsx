import React from 'react';
import { CheckCircle, Download, HardDrive, Loader2, XCircle } from 'lucide-react';
import {
  formatBytes,
  type ArtifactDownloadState,
} from '../../services/localModelDownloadService';

interface LocalModelDownloadPanelProps {
  states: ArtifactDownloadState[];
  totalBytes: number;
  onDownload: () => void;
  onCancel: () => void;
}

const isComplete = (state: ArtifactDownloadState) => state.phase === 'cached' || state.phase === 'ready';

export const LocalModelDownloadPanel: React.FC<LocalModelDownloadPanelProps> = ({
  states,
  totalBytes,
  onDownload,
  onCancel,
}) => {
  const receivedBytes = states.reduce((total, state) => total + Math.min(state.receivedBytes, state.bytes), 0);
  const isDownloading = states.some((state) => state.phase === 'downloading');
  const hasError = states.some((state) => state.phase === 'error');
  const percent = totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : 0;
  const gemma = states.find((state) => state.id === 'gemma-generation');

  return (
    <section className="rounded-2xl border border-[#fd3b12]/20 bg-white/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h5 className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-h)]">
            <HardDrive className="h-3.5 w-3.5 text-[#fd3b12]" />
            Local model downloads
          </h5>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
            Gemma generates replies. Gecko adds optional local embeddings for retrieval.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#fd3b12]/10 px-2 py-1 text-[10px] font-bold text-[#fd3b12]">
          {percent}%
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.06]">
        <div className="h-full rounded-full bg-[#fd3b12] transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-[var(--text-muted)]">
        {formatBytes(receivedBytes)} of {formatBytes(totalBytes)}
      </p>

      <div className="mt-3 space-y-2">
        {states.map((state) => (
          <div key={state.id} className="rounded-xl border border-black/[0.06] bg-[#F8FAFC] p-2.5">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="font-semibold text-[var(--text)]">{state.label}</span>
              <span className="flex items-center gap-1 font-mono text-[var(--text-muted)]">
                {isComplete(state) && <CheckCircle className="h-3 w-3 text-emerald-600" />}
                {state.phase === 'downloading' && <Loader2 className="h-3 w-3 animate-spin text-[#fd3b12]" />}
                {state.phase === 'error' && <XCircle className="h-3 w-3 text-red-600" />}
                {isComplete(state) ? 'READY' : state.phase.toUpperCase()}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-[var(--text-muted)]">
              <span>{state.purpose}</span>
              <span>{formatBytes(Math.min(state.receivedBytes, state.bytes))} / {formatBytes(state.bytes)}</span>
            </div>
            {state.error && <p className="mt-1 text-[10px] leading-relaxed text-red-600">{state.error}</p>}
          </div>
        ))}
      </div>

      {gemma?.phase !== 'cached' && gemma?.phase !== 'ready' && (
        <p className="mt-3 text-[10px] leading-relaxed text-amber-700">
          Gemma requires Hugging Face access approval and a one-time download of about {formatBytes(gemma?.bytes ?? 0)}. Your browser will cache the files locally.
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {isDownloading ? (
          <button
            type="button"
            onClick={onCancel}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-[10px] font-bold text-[var(--text)] hover:bg-[#F8FAFC]"
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancel download
          </button>
        ) : (
          <button
            type="button"
            onClick={onDownload}
            disabled={percent === 100}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#fd3b12] px-3 py-2 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#d6320f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {hasError ? 'Retry local models' : 'Download and enable local'}
          </button>
        )}
      </div>
    </section>
  );
};
