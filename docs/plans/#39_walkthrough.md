# Walkthrough — Agent Tool Prioritization & Provider Fallbacks

## Problem

Cloud model providers (like Groq, Gemini, and OpenRouter) occasionally trigger rate limits (HTTP 429), quota exhaustion errors, or connection timeouts. Previously, these failures would crash the reasoning agent turn and return a hard error message to the client. Under the **Loop Engineering** paradigm, the system should treat these transient errors as recoverable faults and automatically failover to a working alternative provider using equivalent models.

---

## Changes Made

### 1. Backend API Bridge

#### [chat.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/chat.py)
- Updated payload parsing to defensively extract and normalize `api_keys` into a dictionary, ensuring full backward compatibility if a legacy or React client app passes `None` or leaves it out.
- Populated the primary `api_key` back into the `api_keys` map if it is resolved from a legacy single-key field.
- Forwarded the full `api_keys` mapping dictionary down to the LangGraph executor via the `configurable` config parameters.

### 2. Fallback Resolver

#### [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)
- Added a `resolve_llm_fallback` helper to determine the next best provider where credentials exist.
- Defines a priority hierarchy: Groq ➔ Gemini ➔ OpenRouter ➔ Local Ollama.
- Maps equivalent models dynamically (e.g. Groq's `llama3-8b-8192` maps to OpenRouter's `meta-llama/llama-3-8b-instruct` or Gemini's `gemini-1.5-flash`).
- Returns the local Ollama backend (zero cost, keyless) as the ultimate fail-safe if no other cloud credentials exist.

### 3. Self-Healing Failover Loop

#### [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py) (continued)
- Wrapped the LLM invocation (`ainvoke`/`astream`) try-except block in `reason_node` to intercept connection errors, timeouts, or quota/rate limit indicators.
- When an eligible error is caught and fallback credentials exist:
  1. Stream a warnings notification (e.g. `⚠️ [GROQ] rate/quota limit or connection error. Switching to [GEMINI]...`) directly to the active WebSocket stream so the user is informed of the self-healing switch in the chat interface.
  2. Instantiate a copy of the model context configuration with the fallback provider, model, and key overrides.
  3. Re-initialize the LLM client, re-bind tools, and immediately retry the reasoning query.
  4. Update reasoning telemetry to record the successful fallback switch.

---

## Verification

### Automated Validation Tests

I created and ran a temporary validation test suite (`backend/scratch/test_provider_fallback.py`) checking fallback scenarios:
1. **Cloud Switch Check**: When Groq fails and Gemini keys exist, validates switching to `gemini` with model `gemini-1.5-flash`.
2. **Multi-Step Fallback Check**: When Gemini fails and only OpenRouter keys exist, validates switching to `openrouter` with model `meta-llama/llama-3-8b-instruct`.
3. **Local Fail-safe Check**: When OpenRouter fails and no other cloud keys exist, validates falling back to `local` Ollama with model `default`.

**Result**: All test cases passed successfully!

```bash
python backend/scratch/test_provider_fallback.py
Fallback 1: gemini | gemini-1.5-flash | sk-gemini-test
Fallback 2: openrouter | meta-llama/llama-3-8b-instruct | sk-or-test
Fallback 3: local | default | None
ALL FALLBACK RESOLUTION CHECKS PASSED!
```
