import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getArtifactUrl,
  LOCAL_ARTIFACTS,
  LOCAL_ARTIFACT_TOTAL_BYTES,
  checkStorageCapacity,
  checkWebGpuReadiness,
  checkDownloadReadiness,
  downloadArtifact,
  getHuggingFaceAccessToken,
} from './localModelDownloadService';

describe('getArtifactUrl', () => {
  it('builds the Hugging Face resolve URL for an artifact', () => {
    const artifact = LOCAL_ARTIFACTS.find((a) => a.id === 'gecko-tokenizer')!;
    expect(getArtifactUrl(artifact)).toBe(
      'https://huggingface.co/litert-community/Gecko-110m-en/resolve/main/sentencepiece.model',
    );
  });

  it('sums the full payload bytes across artifacts', () => {
    const sum = LOCAL_ARTIFACTS.reduce((t, a) => t + a.bytes, 0);
    expect(LOCAL_ARTIFACT_TOTAL_BYTES).toBe(sum);
    expect(LOCAL_ARTIFACT_TOTAL_BYTES).toBeGreaterThan(4_000_000_000);
  });
});

describe('getHuggingFaceAccessToken', () => {
  afterEach(() => localStorage.clear());

  it('returns the saved HF token from localStorage', () => {
    localStorage.setItem('huggingface_api_key', 'hf_test_token');
    expect(getHuggingFaceAccessToken()).toBe('hf_test_token');
  });

  it('returns null when no token is saved', () => {
    expect(getHuggingFaceAccessToken()).toBeNull();
  });
});

describe('checkStorageCapacity', () => {
  const originalEstimate = navigator.storage?.estimate;
  const originalPersisted = navigator.storage?.persisted;

  const stubStorage = (quota: number, usage: number) => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: vi.fn().mockResolvedValue({ quota, usage }),
        persisted: vi.fn().mockResolvedValue(true),
      },
    });
  };

  beforeEach(() => {});

  afterEach(() => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: originalEstimate ? { estimate: originalEstimate, persisted: originalPersisted } : undefined,
    });
  });

  it('passes when free storage exceeds the payload plus headroom', async () => {
    stubStorage(40 * 1024 ** 3, 0); // 40 GB free
    const result = await checkStorageCapacity(LOCAL_ARTIFACT_TOTAL_BYTES);
    expect(result.ok).toBe(true);
    expect(result.availableBytes).toBeGreaterThan(result.requiredBytes);
  });

  it('fails when free storage is below the payload plus headroom', async () => {
    stubStorage(1 * 1024 ** 3, 0); // 1 GB free, ~4.3 GB payload
    const result = await checkStorageCapacity(LOCAL_ARTIFACT_TOTAL_BYTES);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Insufficient storage');
  });

  it('applies a headroom margin to the required bytes', async () => {
    stubStorage(50 * 1024 ** 3, 0);
    const result = await checkStorageCapacity(LOCAL_ARTIFACT_TOTAL_BYTES);
    expect(result.requiredBytes).toBe(Math.round(LOCAL_ARTIFACT_TOTAL_BYTES * 1.25));
  });

  it('does not block when the storage API is unavailable', async () => {
    Object.defineProperty(navigator, 'storage', { configurable: true, value: undefined });
    const result = await checkStorageCapacity(LOCAL_ARTIFACT_TOTAL_BYTES);
    expect(result.supported).toBe(false);
    expect(result.ok).toBe(true);
  });
});

describe('checkWebGpuReadiness', () => {
  const originalGpu = (navigator as any).gpu;

  const stubGpu = (adapter: any) => {
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: { requestAdapter: vi.fn().mockResolvedValue(adapter) },
    });
  };

  afterEach(() => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: originalGpu });
  });

  it('reports unsupported when navigator.gpu is missing', async () => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
    const result = await checkWebGpuReadiness(4 * 1024 ** 3);
    expect(result.supported).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('WebGPU is not supported');
  });

  it('passes when the adapter buffer limit can hold the model', async () => {
    stubGpu({ limits: { maxBufferSize: 8 * 1024 ** 3 }, info: { description: 'Test GPU' } });
    const result = await checkWebGpuReadiness(4 * 1024 ** 3);
    expect(result.ok).toBe(true);
    expect(result.adapterName).toBe('Test GPU');
  });

  it('fails when the adapter buffer limit is too small for the model', async () => {
    stubGpu({ limits: { maxBufferSize: 1 * 1024 ** 3 } });
    const result = await checkWebGpuReadiness(4 * 1024 ** 3);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('buffer limit');
  });

  it('fails when no adapter can be requested', async () => {
    stubGpu(null);
    const result = await checkWebGpuReadiness(4 * 1024 ** 3);
    expect(result.ok).toBe(false);
    expect(result.adapterAvailable).toBe(false);
  });
});

describe('checkDownloadReadiness', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'storage', { configurable: true, value: undefined });
  });

  it('passes only when storage AND webgpu both pass', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: vi.fn().mockResolvedValue({ quota: 40 * 1024 ** 3, usage: 0 }),
        persisted: vi.fn().mockResolvedValue(true),
      },
    });
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: {
        requestAdapter: vi.fn().mockResolvedValue({ limits: { maxBufferSize: 8 * 1024 ** 3 } }),
      },
    });
    const result = await checkDownloadReadiness(LOCAL_ARTIFACT_TOTAL_BYTES);
    expect(result.ok).toBe(true);
  });

  it('fails when storage is insufficient even if webgpu is fine', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: vi.fn().mockResolvedValue({ quota: 1 * 1024 ** 3, usage: 0 }),
        persisted: vi.fn().mockResolvedValue(true),
      },
    });
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: {
        requestAdapter: vi.fn().mockResolvedValue({ limits: { maxBufferSize: 8 * 1024 ** 3 } }),
      },
    });
    const result = await checkDownloadReadiness(LOCAL_ARTIFACT_TOTAL_BYTES);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Insufficient storage');
  });

  it('fails when webgpu is inadequate even if storage is fine', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: vi.fn().mockResolvedValue({ quota: 40 * 1024 ** 3, usage: 0 }),
        persisted: vi.fn().mockResolvedValue(true),
      },
    });
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: {
        requestAdapter: vi.fn().mockResolvedValue({ limits: { maxBufferSize: 512 * 1024 ** 2 } }),
      },
    });
    const result = await checkDownloadReadiness(LOCAL_ARTIFACT_TOTAL_BYTES);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('buffer limit');
  });
});

describe('downloadArtifact', () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = (globalThis as any).caches;
  const artifact = LOCAL_ARTIFACTS.find((a) => a.id === 'gecko-tokenizer')!;

  const streamFrom = (bytes: Uint8Array) =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });

  const stubCaches = () => {
    const store = new Map<string, Response>();
    (globalThis as any).caches = {
      open: vi.fn().mockResolvedValue({
        match: vi.fn(async (url: string) => store.get(url) ?? undefined),
        put: vi.fn(async (url: string, res: Response) => { store.set(url, res); }),
      }),
      delete: vi.fn(),
    };
  };

  beforeEach(() => {
    stubCaches();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (globalThis as any).caches = originalCaches;
  });

  it('writes the fetched body to the cache and reports progress', async () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(streamFrom(payload), { status: 200 }),
    ) as unknown as typeof fetch;

    const onProgress = vi.fn();
    await downloadArtifact(artifact, onProgress);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      getArtifactUrl(artifact),
      expect.objectContaining({ signal: undefined, headers: expect.any(Headers) }),
    );
    expect(onProgress).toHaveBeenLastCalledWith(payload.byteLength);
  });

  it('skips the network when the artifact is already cached', async () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(streamFrom(payload), { status: 200 }),
    ) as unknown as typeof fetch;

    // Prime the cache by downloading once.
    await downloadArtifact(artifact, vi.fn());

    const onProgress = vi.fn();
    await downloadArtifact(artifact, onProgress);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1); // not called again
    expect(onProgress).toHaveBeenLastCalledWith(artifact.bytes);
  });

  it('forwards the HF token as a Bearer authorization header', async () => {
    const payload = new Uint8Array([9]);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(streamFrom(payload), { status: 200 }),
    ) as unknown as typeof fetch;

    await downloadArtifact(artifact, vi.fn(), undefined, 'hf_abc');

    const [, init] = (globalThis.fetch as any).mock.calls[0];
    expect(init.headers.get('Authorization')).toBe('Bearer hf_abc');
  });

  it('throws a clear error on 401/403 gated-model responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('gated', { status: 401 }),
    ) as unknown as typeof fetch;

    await expect(downloadArtifact(artifact, vi.fn())).rejects.toThrow('Hugging Face access approval');
  });
});
