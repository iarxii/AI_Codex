# Local Model Download: Hugging Face Wiring & Device Requirements

This document explains how the Lite Chat portal downloads local models (Gemma 3n, Gecko) into the browser, how the Hugging Face provider pipeline is reused for gated-model access, and what a user's machine/browser must satisfy before a download is offered.

## What changed for users

Previously the local model download hit the Hugging Face CDN anonymously. Gated repositories (such as `google/gemma-3n-E4B-it-litert-lm`) would fail with a 401/403 unless the user had already been granted access via an HF account, and there was no pre-flight check that the machine could store or run the models.

Now:

1. **Hugging Face token reuse** — The same API token the user saves for the **Hugging Face** cloud provider (Provider Settings → Hugging Face → API key, stored in `localStorage` as `huggingface_api_key`) is sent as a `Bearer` token on model downloads. Users who are approved for gated models can now download them without a separate flow.
2. **Storage capacity gate** — Before any download starts, the browser's free storage (`navigator.storage.estimate()`) is measured and must exceed the total payload (plus a 25% headroom). If not, the download is refused with a clear message.
3. **WebGPU adequacy gate** — The WebGPU adapter is probed; its `maxBufferSize` must be at least as large as the biggest single weight file (the Gemma model, ~4.3 GB). A machine without a big enough GPU buffer cannot load the model, so the download is refused with the reason.
4. **Requirements surfaced in the UI** — The download panel shows a live "Device requirements" checklist (free storage vs. required, WebGPU buffer status) and disables the download button while the machine is not ready.

## Compute / browser requirements

### Storage

| Asset | Payload |
| :--- | :--- |
| Gemma 3n E4B (int4, Web LiteRT-LM) | ~4.275 GB |
| Gecko 110m (quantized embeddings) | ~145.6 MB |
| Gecko SentencePiece tokenizer | ~0.8 MB |
| **Total** | **~4.42 GB** |
| **Required free quota (25% headroom)** | **~5.53 GB** |

The check requires the browser's *reported available quota* (`quota − usage`) to be at least the total payload × 1.25. Note the browser quota is **not** the same as free disk space: browsers cap per-origin storage (often far below the disk). Users should confirm the browser's site-storage allowance in their browser settings.

> If the Storage API is unavailable (non-secure context / unsupported browser), the storage check is skipped rather than blocking, but the download still requires a secure, cache-capable context.

### WebGPU

| Requirement | Value |
| :--- | :--- |
| API present | `navigator.gpu` |
| Adapter requestable | `navigator.gpu.requestAdapter()` resolves |
| Adapter `maxBufferSize` | ≥ the largest weight file (~4.3 GB) |

- **No WebGPU at all**: the download is blocked with "WebGPU is not supported in this browser." Local Gemma inference cannot run without a WebGPU adapter (LiteRT-LM requires it).
- **WebGPU present but buffer too small**: blocked with the adapter's reported limit so users know the specific gap.
- **Adapter exposes no limits** (older/lenient implementations): treated as adequate.

### Browser support

| Capability | Minimum |
| :--- | :--- |
| Cache Storage API | Chromium 40+ / modern browsers (secure context) |
| Storage estimate/persist | Chromium 55+ / Safari 15+ / Firefox 51+ (secure context) |
| WebGPU | Chrome 113+, Edge 113+, and other Chromium 113+ (experimental on Firefox/Safari) |
| Service-safe HTTP | `https://` or `localhost` |

> The frontend uses the Cache Storage API to store model weights so they survive reloads and can be served offline once downloaded.

## How it works end to end

```
User clicks "Download and enable local"
   └─ useLiteRtChat.downloadLocalModels()
        ├─ checkDownloadReadiness(totalBytes)
        │    ├─ checkStorageCapacity(totalBytes)   → quota/usage via navigator.storage.estimate()
        │    └─ checkWebGpuReadiness(largestFile)  → adapter probe + maxBufferSize
        │
        ├─ if !readiness.ok → mark all artifacts as error with reason, stop
        │
        └─ for each artifact:
             downloadArtifact(artifact, onProgress, signal, hfToken)
                  ├─ headers: Authorization: Bearer <hf_token>   (when saved)
                  ├─ stream response into Cache Storage (CACHE_NAME)
                  └─ reports receivedBytes for the progress bar
```

## Files touched

| File | Change |
| :--- | :--- |
| `client/src/services/localModelDownloadService.ts` | Added `getHuggingFaceAccessToken`, `getDeviceStorageSnapshot`, `checkStorageCapacity`, `checkWebGpuReadiness`, `checkDownloadReadiness`; `downloadArtifact` now accepts a token and sets a `Bearer` header; 401/403 message mentions the HF token. |
| `client/src/hooks/useLiteRtChat.ts` | Runs readiness check on mount and live before each download; passes the HF token; exposes `downloadReadiness`. |
| `client/src/components/chat/LocalModelDownloadPanel.tsx` | "Device requirements" checklist (storage + WebGPU), disabled button + tooltip when not ready, gated-model note. |
| `client/src/pages/LiteChat.tsx` | Threads `downloadReadiness` from the hook into the panel. |
| `client/src/services/localModelDownloadService.test.ts` | 19 unit tests covering URL building, token retrieval, storage gating, WebGPU gating, combined readiness, caching, bearer forwarding, and 401/403 handling. |
| `client/vitest.config.ts` | Vitest + jsdom config for the client test suite. |

## Testing

```bash
cd client
npm test            # run all unit tests
npm run test:watch  # watch mode
npm run test:coverage
```

The suite covers the two new gates the request asked for first: **sufficient storage** and **adequate WebGPU** resources, plus the download/caching handlers and the HF token plumbing.
