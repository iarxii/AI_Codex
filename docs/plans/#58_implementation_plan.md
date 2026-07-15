# Standardizing Ollama Cloud Integration

Resolve the "Connection error" in the VS Code SCM commit message generator by propagating the user's `ollamaCloudUrl` setting through the `/codegen` request payload into the backend LLM factory.

## Architecture Principles

1. **Minimal footprint** — only touch code paths that `ollama_cloud` actually traverses.
2. **No speculative fallbacks** — each value has exactly one authoritative source per client path.
3. **Provider isolation** — changes to `ollama_cloud` resolution must not alter behavior for `groq`, `openrouter`, `gemini`, `local`, or `colab_bridge`.
4. **Document the "why"** — every branch and parameter gets a comment explaining its purpose.

## Root Cause

Two bugs cause the "Connection error" when `recommended_provider` is `ollama_cloud`:

1. **`spaces.py` L384–418**: API key resolution looks up `api_keys.get("ollama_cloud")` → `None`, then falls back to `google`/`gemini` → also `None`. This triggers `is_colab_bridge` (L401), which **hijacks the provider** to `colab_bridge`, or raises a 400 about missing Google keys.

2. **`models.py` L75**: When `get_llm` is reached with `provider="ollama_cloud"`, the base URL defaults to `settings.OLLAMA_CLOUD_BASE_URL` or `localhost:11434`. In Cloud Run, neither resolves to the user's remote Ollama instance.

## Client Path Analysis

Understanding which client uses which backend path prevents unnecessary fallback engineering:

```
VS Code Extension (SCM / inline codegen)
  └─ SpiritBirdClient.postCodegen()
       └─ POST /spaces/{slug}/codegen        ← spaces.py
            └─ get_code_lab_llm()             ← genai_llm.py
                 └─ LangChainCodeLabLLM
                      └─ get_llm()            ← models.py

Web Frontend (chat)
  └─ WebSocket /ws/agent                     ← chat.py
       └─ get_dynamic_llm()                  ← nodes.py (already reads base_url from config)
```

> [!IMPORTANT]
> The WebSocket path in `nodes.py` **already works** — it reads `base_url` from `config["configurable"]["base_url"]` at L108. No changes needed there beyond adding a log line. This plan focuses on the **`/codegen` REST path** which is broken.

---

## Proposed Changes

### Layer 1 — VS Code Extension (request originator)

#### [MODIFY] [types.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/vscode-extension/src/api/types.ts)

Add `base_url` to the `CodexRequest` interface. This is the only field addition — it mirrors the backend `CodegenRequest` schema.

```diff
 export interface CodexRequest {
     prompt: string;
     model?: string;
     provider?: string;
+    base_url?: string;   // Ollama Cloud endpoint override
 }
```

#### [MODIFY] [client.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/vscode-extension/src/api/client.ts)

Add `ollamaCloudUrl` as a constructor parameter. Set it on the request body in `postCodegen`. No header duplication — the payload is the single source of truth.

```diff
 export class SpiritBirdClient {
     constructor(
         private apiKey: string,
         private endpoint: string,
         private spaceSlug: string,
         private colabSecret?: string,
         private selectedModel?: string,
-        private selectedProvider?: string
+        private selectedProvider?: string,
+        private ollamaCloudUrl?: string
     ) {}
```

In `postCodegen`, after the provider/model override block (~L179):

```typescript
        // Inject Ollama Cloud base URL if configured
        if (this.ollamaCloudUrl) {
            body.base_url = this.ollamaCloudUrl;
            Logger.log(`Injecting Ollama Cloud base URL: ${this.ollamaCloudUrl}`);
        }
```

#### [MODIFY] [extension.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/vscode-extension/src/extension.ts)

Read `ollamaCloudUrl` from config and pass to `SpiritBirdClient` at both construction sites (L234, L543):

```diff
+           const ollamaCloudUrl = config.get<string>('ollamaCloudUrl') || '';
-           const client = new SpiritBirdClient(apiKey, endpoint, spaceSlug, colabSecret, selectedModel, selectedProvider);
+           const client = new SpiritBirdClient(apiKey, endpoint, spaceSlug, colabSecret, selectedModel, selectedProvider, ollamaCloudUrl);
```

---

### Layer 2 — Backend Submodule (`codex_spaces`) — request handler

#### [MODIFY] [spaces.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/codex_spaces/backend/api/spaces.py)

**Schema** (L228) — add `base_url`:

```diff
 class CodegenRequest(BaseModel):
     prompt: str
     model: Optional[str] = None
     provider: Optional[str] = None
     session_id: Optional[str] = None
+    base_url: Optional[str] = None   # Ollama Cloud endpoint override from client
```

**API key resolution fix** (insert before L394) — `ollama_cloud` uses a placeholder key and must not fall through to the colab_bridge hijack or the "missing Google key" error:

```python
    # Provider-specific key defaults:
    # ollama_cloud uses a placeholder key — it authenticates via URL, not API key
    if provider == "ollama_cloud" and not api_key:
        api_key = "sk-ollama"
```

**Pass `base_url` to agent calls** (L458 and L512):

```diff
             llm = get_code_lab_llm(
                 provider=provider,
                 model=model,
                 api_key=api_key if not is_colab_bridge else None,
                 user_id=current_user.id if is_colab_bridge else None,
                 space_slug=slug if is_colab_bridge else None,
+                base_url=payload.base_url,
             )
```

```diff
             output = await run_code_lab(
                 prompt=payload.prompt,
                 provider=provider,
                 model=model,
                 api_key=api_key if not is_colab_bridge else None,
                 user_id=current_user.id if is_colab_bridge else None,
                 space_slug=slug if is_colab_bridge else None,
                 space_system_prompt=s_config.get("system_prompt_prefix", ""),
                 use_adk=s_config.get("adk_enabled", False),
+                base_url=payload.base_url,
             )
```

---

### Layer 3 — Agent Conduit (pass-through)

#### [MODIFY] [code_lab_agent.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/codex_spaces/backend/agent/code_lab_agent.py)

Accept and forward — no logic here, pure conduit:

```diff
 async def run_code_lab(
     prompt: str,
     provider: str,
     model: str,
     api_key: Optional[str] = None,
     user_id: Optional[int] = None,
     space_slug: Optional[str] = None,
     space_system_prompt: str = "",
     use_adk: bool = True,
+    base_url: Optional[str] = None,
 ) -> CodeLabOutput:
```

```diff
         llm = get_code_lab_llm(
             provider=provider,
             model=model,
             api_key=api_key,
             user_id=user_id,
             space_slug=space_slug,
+            base_url=base_url,
         )
```

#### [MODIFY] [genai_llm.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/codex_spaces/backend/agent/genai_llm.py)

Accept and forward in both adapter and factory:

```diff
 class LangChainCodeLabLLM:
-    def __init__(self, provider: str, model: str, api_key: Optional[str] = None):
+    def __init__(self, provider: str, model: str, api_key: Optional[str] = None, base_url: Optional[str] = None):
         self.provider = provider
         self.model = model
         self.api_key = api_key
+        self.base_url = base_url

     async def ainvoke(self, messages: list) -> str:
         from backend.agent.models import get_llm
-        llm = get_llm(provider=self.provider, model=self.model, api_key=self.api_key)
+        llm = get_llm(provider=self.provider, model=self.model, api_key=self.api_key, base_url=self.base_url)
```

```diff
 def get_code_lab_llm(
     provider: str,
     model: str,
     api_key: Optional[str] = None,
     user_id: Optional[int] = None,
     space_slug: Optional[str] = None,
+    base_url: Optional[str] = None,
 ):
     ...
-    return LangChainCodeLabLLM(provider=provider, model=model, api_key=api_key)
+    return LangChainCodeLabLLM(provider=provider, model=model, api_key=api_key, base_url=base_url)
```

---

### Layer 4 — LLM Factory (terminal consumer)

#### [MODIFY] [models.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/models.py)

Add `base_url` parameter. Only the `ollama_cloud` branch reads it — all other branches ignore it. This is documented in the docstring.

```diff
-def get_llm(provider: str, model: str, temperature: float = 0.7, api_key: Optional[str] = None):
+def get_llm(provider: str, model: str, temperature: float = 0.7, api_key: Optional[str] = None, base_url: Optional[str] = None):
     """
     Unified LLM factory for AICodex Agent.
+
+    Args:
+        base_url: Optional endpoint override. Currently used only by the
+                  'ollama_cloud' provider to point at a user's remote instance.
+                  All other providers use fixed endpoints and ignore this value.
     """
```

```diff
     elif provider == "ollama_cloud":
-        base_url = getattr(settings, "OLLAMA_CLOUD_BASE_URL", None) or "http://localhost:11434"
-        if not base_url.endswith("/v1"):
-            base_url = f"{base_url.rstrip('/')}/v1"
+        # Resolution: client payload → env var → localhost fallback
+        resolved_url = base_url or getattr(settings, "OLLAMA_CLOUD_BASE_URL", None) or "http://localhost:11434"
+        if not resolved_url.endswith("/v1"):
+            resolved_url = f"{resolved_url.rstrip('/')}/v1"
+        logger.info(f"Initializing ollama_cloud: base_url={resolved_url}, model={model_name}")
         return ChatOpenAI(
             model=model_name,
             openai_api_key=api_key or "sk-ollama",
-            openai_api_base=base_url,
+            openai_api_base=resolved_url,
             temperature=temperature
         )
```

`get_llm_for_tier` — forward the parameter:

```diff
 def get_llm_for_tier(
     tier: str, provider: str, model: str,
     temperature: float = 0.7, api_key: Optional[str] = None,
-    api_keys: Optional[dict] = None
+    api_keys: Optional[dict] = None, base_url: Optional[str] = None
 ):
     ...
-    return get_llm(resolved_provider, resolved_model, temperature, resolved_api_key)
+    return get_llm(resolved_provider, resolved_model, temperature, resolved_api_key, base_url)
```

#### [MODIFY] [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)

Logging only — the resolution logic is already correct:

```diff
         elif provider == "ollama_cloud":
             from langchain_openai import ChatOpenAI
             target_model = model or "llama3"
             base_url = config.get("configurable", {}).get("base_url") or "https://ollama.com"
+            logger.info(f"Initializing ollama_cloud: base_url={base_url}, model={target_model}")
             if not base_url.endswith("/v1"):
```

---

## What Is NOT Changed

| File / Path | Why untouched |
|---|---|
| `chat.py` WebSocket handler | Already passes `base_url` into `config["configurable"]` at L353. `get_dynamic_llm` in `nodes.py` reads it. Working as-is. |
| `trading_nodes.py` | Uses `get_llm` for trading — not an `ollama_cloud` use case. The new `base_url=None` default means zero impact. |
| `arcade.py` | Same — `base_url=None` default, no behavioral change. |
| `ChatViewProvider.ts` | Web frontend sends `base_url` via WebSocket payload, already handled by `chat.py` → `nodes.py`. |
| Request headers | Removed from plan. Payload body is the single transport mechanism. No header duplication. |
| `user.settings_json` parsing | Removed from plan. Web frontend uses WebSocket (already working), VS Code uses payload. No cross-path fallback needed. |

## Verification Plan

### Build
- `npm run compile` in `vscode-extension/` — no TypeScript errors
- `python -m py_compile` on modified `.py` files

### Functional
1. Configure `spiritBirdAiCodex.ollamaCloudUrl` in VS Code settings
2. Trigger SCM commit message generation
3. Confirm backend logs show: `Initializing ollama_cloud: base_url=<configured_url>, model=<model>`
4. Confirm commit message is generated without "Connection error"
