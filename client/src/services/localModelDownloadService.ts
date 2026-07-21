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

  const response = await fetch(url, { signal });
  if (response.status === 401 || response.status === 403) {
    throw new Error(`${artifact.label} requires Hugging Face access approval before downloading.`);
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
