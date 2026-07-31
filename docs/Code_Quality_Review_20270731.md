## Pre-commit review — AI_Codex root (staged changes)

**Verdict: do not commit yet.** Verified with `tsc -b` (fails) and `python -m py_compile` (passes).

### Blockers (build-breaking / dead)
1. `client/src/components/MoreProvidersModal.tsx:418` — uses `ExclamationCircleIcon` but only `XMarkIcon, CheckCircleIcon, ArrowPathIcon` are imported (line 3). `TS2304`.
2. `client/src/components/MoreProvidersModal.tsx:4` — `PROVIDERS` imported, never used. `TS6133`.
3. `client/src/components/ProviderSelector.tsx:8` — `ProviderId` imported, never used. `TS6196`.
4. `MoreProvidersModal.tsx` is **not rendered anywhere** — grep finds only its own file. New 463-line component is dead code.

### Functional gaps
5. `client/src/pages/Chat.tsx` WS payload still sends only `base_url: localStorage.getItem("ollama_cloud_url")`. The Cloudflare gateway URL/account/gateway-ID and Workers AI account-ID configured in Settings are **never forwarded to the backend for chat**. For `workers_ai`, `backend/agent/models.py:137` then falls back to `https://api.cloudflare.com/client/v4/accounts/your-account-id/ai/v1` — chat with these two new providers is effectively broken.
6. `client/src/components/providerMeta.ts:107` references `/media/brand-icons/litert.svg`, but the file does not exist in `brand-icons/` (only `cloudflare-color.svg` was added). Broken LiteRT card icon.
7. `MoreProvidersModal.tsx:393` — the "Test & Load Models" button calls both `fetchModels()` and `testConnection()`: two identical requests per click on one shared `loading` state (race).
8. `MoreProvidersModal.tsx:315-328` — `handleSave` only writes non-empty keys/URLs, so a stored key can never be cleared.
9. `MoreProvidersModal.tsx:158-163` — dead filter branch: `p.id === 'local'` can never match since `MORE_PROVIDERS` has no `local` entry.

### Design / quality
10. `ProviderId` is duplicated in `providerMeta.ts:7` and `AIContext.tsx:4`, both expanded independently; `SettingsModal` imports from AIContext while `ProviderSelector` imports from providerMeta. Consolidate to one source of truth.
11. `litert` now means two things: a `LocalBackendMode` (ProviderSelector button) and a `ProviderId` (PortalSwitcher `setProvider('litert')`). Backend `get_llm` returns a fake `ChatOpenAI` pointed at `localhost:11434` for litert, while the real path is client-side `useLiteRtChat` — confusing and a silent-fallback trap if chat is attempted.
12. `Chat.tsx` (1298 changed lines) is ~95% Prettier reformatting (single→double quotes, reflow) mixed with the two real changes. This buries the diff; recommend standardizing formatter config and splitting cosmetic vs functional commits. Also added `\ No newline at end of file` on `providerMeta.ts`/`ProviderSelector.tsx`.
13. `backend/agent/models.py:179` — comment `# 1. Determine target provider/model...` lost its indentation; `litert` branch's `openai_api_base="http://localhost:11434/v1"` with "fallback, not used" is misleading. (`openai_api_base` is deprecated in newer langchain, but consistent with existing code.)
14. `backend/api/models.py:227-247` — gateway listing builds `{base_url}/v1/models` where the default is the bare host `https://gateway.ai.cloudflare.com` (no `/{account}/{gateway}` path), while `X-Account-Id`/`X-Gateway-Id` are custom headers the OpenAI-compatible endpoint won't use. Listing will likely 404 unless the user manually pastes the full gateway path — verify this is actually functional.
15. `SettingsModal.tsx` test functions omit `X-Space-Slug`/`X-Is-Premium` headers that `ProviderSelector` sends, and both new testers share one `testResult` state.

### Fine / consistent
- LangSmith project rename `vscode-agent-react-benchmarks` → `aicodex-agent-react-benchmarks` is consistent across `chat.py`, `Chat.tsx`, `SettingsModal.tsx`, and all docs. Good.
- Docs changes are markdown-format only; `skills/AGENT_DO_NOT_DELETE.md` is harmless.

Minimum to unblock: fix items 1-3, wire in (or delete) `MoreProvidersModal`, add `litert.svg`, and either fix the chat payload (item 5) or scope the new providers to model-listing only.