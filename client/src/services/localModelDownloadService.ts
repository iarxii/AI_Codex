export type LocalArtifactId = 'gemma-generation' | 'gecko-embedding' | 'gecko-tokenizer';
export type DownloadPhase = 'idle' | 'awaiting-consent' | 'downloading' | 'cached' | 'ready' | 'cancelled' | 'error';

export interface LocalArtifact {
  id: LocalArtifactId;
  label: string;
  repository: string;
  path: string;
  purpose: 'generation' | 'embedding' | 'tokenizer';
  bytes: number;
  requiresGemmaLicense: boolean;
}

export interface ArtifactDownloadState extends LocalArtifact {
  phase: DownloadPhase;
  receivedBytes: number;
  error?: string;
}

const HUGGING_FACE_BASE = 'https://huggingface.co';
const CACHE_NAME = 'aicodex-litechat-local-models-v1';

/** Headroom multiplier applied to the raw payload when checking free storage.
 *  Browsers need extra space for metadata and subsequent cache writes, and we
 *  want room for future model updates without hitting a hard quota error. */
const STORAGE_HEADROOM = 1.25;

/**
 * HuggingFace access token read from localStorage (set via SettingsModal /
 * MoreProvidersModal for the `huggingface` provider). Enables downloads of
 * gated repositories such as google/gemma-3n-E4B-it-litert-lm by sending the
 * token as a Bearer header, matching the same credential the cloud provider
 * pipeline uses for inference.
 */
export const getHuggingFaceAccessToken = (): string | null =>
  typeof localStorage !== 'undefined' ? localStorage.getItem('huggingface_api_key') : null;

export const LOCAL_ARTIFACTS: LocalArtifact[] = [
  {
    id: 'gemma-generation',
    label: 'Gemma 3n E4B Web',
    repository: 'google/gemma-3n-E4B-it-litert-lm',
    path: 'gemma-3n-E4B-it-int4-Web.litertlm',
    purpose: 'generation',
    bytes: 4_275_044_352,
    requiresGemmaLicense: true,
  },
  {
    id: 'gecko-embedding',
    label: 'Gecko 110m quantized',
    repository: 'litert-community/Gecko-110m-en',
    path: 'Gecko_1024_quant.tflite',
    purpose: 'embedding',
    bytes: 145_598_464,
    requiresGemmaLicense: false,
  },
  {
    id: 'gecko-tokenizer',
    label: 'Gecko SentencePiece tokenizer',
    repository: 'litert-community/Gecko-110m-en',
    path: 'sentencepiece.model',
    purpose: 'tokenizer',
    bytes: 794_346,
    requiresGemmaLicense: false,
  },
];

export const LOCAL_ARTIFACT_TOTAL_BYTES = LOCAL_ARTIFACTS.reduce(
  (total, artifact) => total + artifact.bytes,
  0,
);

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
};

export const getArtifactUrl = (artifact: LocalArtifact): string =>
  `${HUGGING_FACE_BASE}/${artifact.repository}/resolve/main/${artifact.path}`;

export const createInitialDownloadState = (): ArtifactDownloadState[] =>
  LOCAL_ARTIFACTS.map((artifact) => ({
    ...artifact,
    phase: 'idle',
    receivedBytes: 0,
  }));

// ── Device / Browser Capacity Handlers ────────────────────────────────────
// Before committing to a multi-gigabyte download we verify the machine and
// browser can actually store and execute the model. Two independent checks:
//   1. Storage — the browser Cache Storage quota minus current usage must be
//      greater than the total payload (plus a headroom margin).
//   2. WebGPU  — the adapter must be present and able to address a buffer of
//      at least the largest model weight file.

export interface StorageCapacityResult {
  ok: boolean;
  /** Bytes the browser reports as available (quota minus usage). */
  availableBytes: number;
  /** Total payload the download will store (headroom already applied). */
  requiredBytes: number;
  quotaBytes: number;
  usageBytes: number;
  /** Whether navigator.storage.estimate() was available at all. */
  supported: boolean;
  reason?: string;
}

export interface WebGpuReadinessResult {
  ok: boolean;
  /** Whether navigator.gpu exists. */
  supported: boolean;
  /** Whether an adapter could actually be requested. */
  adapterAvailable: boolean;
  adapterName?: string;
  /** Adapter maxBufferSize in bytes, when the adapter exposes limits. */
  maxBufferSize?: number;
  /** Largest single model weight file we need to address. */
  requiredBufferBytes: number;
  reason?: string;
}

export interface DownloadReadiness {
  storage: StorageCapacityResult;
  webgpu: WebGpuReadinessResult;
  /** True only when BOTH checks pass (or the check is unsupported). */
  ok: boolean;
  reason?: string;
}

export interface DeviceStorageSnapshot {
  quota: number;
  usage: number;
  availableBytes: number;
}

/** Best-effort snapshot of the browser's Cache Storage budget. Returns a
 *  zeroed snapshot when the Storage API is unavailable (e.g. non-secure
 *  contexts or older engines). */
export async function getDeviceStorageSnapshot(): Promise<DeviceStorageSnapshot> {
  const empty: DeviceStorageSnapshot = { quota: 0, usage: 0, availableBytes: 0 };
  if (typeof navigator === 'undefined' || !('storage' in navigator) || !navigator.storage?.estimate) {
    return empty;
  }
  try {
    const estimate = await navigator.storage.estimate();
    const quota = estimate.quota ?? 0;
    const usage = estimate.usage ?? 0;
    return { quota, usage, availableBytes: Math.max(0, quota - usage) };
  } catch {
    return empty;
  }
}

/**
 * Determines whether the browser has enough free storage for the combined
 * local-model payload. `requiredBytes` is the raw payload; a headroom margin
 * is added internally so the write does not run flush against the quota.
 */
export async function checkStorageCapacity(requiredBytes: number): Promise<StorageCapacityResult> {
  const required = Math.round(requiredBytes * STORAGE_HEADROOM);
  const snapshot = await getDeviceStorageSnapshot();
  const result: StorageCapacityResult = {
    ok: true,
    availableBytes: snapshot.availableBytes,
    requiredBytes: required,
    quotaBytes: snapshot.quota,
    usageBytes: snapshot.usage,
    supported: snapshot.quota > 0 || snapshot.usage > 0 || snapshot.availableBytes > 0,
  };

  if (!result.supported) {
    // Storage API missing — cannot verify, do not block.
    result.reason = 'Storage quota could not be measured in this browser.';
    return result;
  }

  if (snapshot.availableBytes < required) {
    result.ok = false;
    result.reason =
      `Insufficient storage: ${formatBytes(snapshot.availableBytes)} free, ` +
      `${formatBytes(required)} required (${formatBytes(requiredBytes)} payload + headroom).`;
  }
  return result;
}

/**
 * Determines whether the WebGPU adapter can address the largest single model
 * weight file. A present adapter that reports a maxBufferSize below the model
 * size would OOM at load time, so we fail fast and surface a clear reason.
 */
export async function checkWebGpuReadiness(requiredBufferBytes: number): Promise<WebGpuReadinessResult> {
  const result: WebGpuReadinessResult = {
    ok: false,
    supported: false,
    adapterAvailable: false,
    requiredBufferBytes,
    reason: 'WebGPU is not supported in this browser.',
  };

  if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) {
    return result;
  }
  result.supported = true;
  result.reason = 'WebGPU adapter could not be requested.';

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return result;
    result.adapterAvailable = true;
    result.reason = undefined;

    const info = adapter.info ?? (adapter as any).requestAdapterInfo?.();
    const name = info && typeof info === 'object' && 'description' in info
      ? String((info as any).description)
      : undefined;
    if (name) result.adapterName = name;

    const limits = adapter.limits;
    const maxBufferSize = limits?.maxBufferSize;
    if (typeof maxBufferSize === 'number') {
      result.maxBufferSize = maxBufferSize;
      if (maxBufferSize >= requiredBufferBytes) {
        result.ok = true;
      } else {
        result.reason =
          `WebGPU adapter buffer limit (${formatBytes(maxBufferSize)}) is smaller than ` +
          `the model (${formatBytes(requiredBufferBytes)}).`;
      }
    } else {
      // No limits exposed (old/lenient adapter) — assume adequate.
      result.ok = true;
    }
  } catch (error) {
    result.reason = `WebGPU probe failed: ${error instanceof Error ? error.message : String(error)}`;
  }
  return result;
}

/**
 * Combined gate used before starting a local-model download. Requires enough
 * free storage AND a WebGPU adapter able to hold the model weights.
 */
export async function checkDownloadReadiness(requiredBytes: number): Promise<DownloadReadiness> {
  const [storage, webgpu] = await Promise.all([
    checkStorageCapacity(requiredBytes),
    checkWebGpuReadiness(Math.max(...LOCAL_ARTIFACTS.map((a) => a.bytes))),
  ]);
  const ok = storage.ok && webgpu.ok;
  const reasons: string[] = [];
  if (!storage.ok) reasons.push(storage.reason ?? 'Storage check failed.');
  if (!webgpu.ok) reasons.push(webgpu.reason ?? 'WebGPU check failed.');
  return { storage, webgpu, ok, reason: ok ? undefined : reasons.join(' ') };
}

export async function getCachedArtifactIds(): Promise<Set<LocalArtifactId>> {
  if (!('caches' in window)) return new Set();
  const cache = await caches.open(CACHE_NAME);
  const cachedIds = new Set<LocalArtifactId>();

  await Promise.all(LOCAL_ARTIFACTS.map(async (artifact) => {
    const response = await cache.match(getArtifactUrl(artifact));
    if (response) cachedIds.add(artifact.id);
  }));

  return cachedIds;
}

export async function downloadArtifact(
  artifact: LocalArtifact,
  onProgress: (receivedBytes: number) => void,
  signal?: AbortSignal,
  accessToken?: string | null,
): Promise<void> {
  if (!('caches' in window)) {
    throw new Error('This browser does not support model caching.');
  }

  const cache = await caches.open(CACHE_NAME);
  const url = getArtifactUrl(artifact);
  const existing = await cache.match(url);
  if (existing) {
    onProgress(artifact.bytes);
    return;
  }

  const headers = new Headers();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(url, { signal, headers });
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `${artifact.label} requires Hugging Face access approval. ` +
      `Add a Hugging Face API token in Provider Settings (HF provider) to download gated models.`,
    );
  }
  if (!response.ok || !response.body) {
    throw new Error(`Unable to download ${artifact.label} (HTTP ${response.status}).`);
  }

  const cacheWrite = cache.put(url, response.clone());
  const reader = response.body.getReader();
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    receivedBytes += value.byteLength;
    onProgress(receivedBytes);
  }

  await cacheWrite;
  onProgress(receivedBytes);
}

export const clearCachedArtifacts = async (): Promise<void> => {
  if ('caches' in window) await caches.delete(CACHE_NAME);
};
