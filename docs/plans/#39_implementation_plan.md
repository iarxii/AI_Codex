# Dynamic Provider Fallback (Loop Engineering) — Implementation Plan

This plan details the implementation of a self-healing LLM provider fallback system (under the Loop Engineering paradigm) to handle transient failures, rate limits, or quota limits on any configured LLM provider by dynamically switching to a secondary/fallback provider.

## User Review Required

> [!IMPORTANT]
> **API Key Accessibility**: Since API keys are managed client-side in the VS Code extension, we must update the backend WebSocket endpoint in `chat.py` to forward the complete `api_keys` mapping dictionary to the graph configuration. This enables the backend to access secondary provider keys when a fallback is triggered.

> [!WARNING]
> **Fallback Hierarchy**: We define a static model/provider mapping hierarchy (e.g., Groq -> Gemini -> OpenRouter -> Local). Local Ollama is our ultimate zero-cost fallback if no cloud credentials succeed.

---

## Proposed Changes

### 1. Backend API Bridge

#### [MODIFY] [chat.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/chat.py)
Update the WebSocket config assembly (around L208-222) to pass the full `api_keys` dictionary to the graph:
```python
config = {
    "configurable": {
        "provider": provider, 
        "model": model, 
        "api_key": api_key,
        "api_keys": api_keys,  # Injected for dynamic provider fallback lookup
        "base_url": base_url,
        ...
    }
}
```

---

### 2. LLM Fallback Resolution in Nodes

#### [MODIFY] [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)

1. **Implement `get_fallback_provider` helper**:
   Resolves the fallback provider, model name, and API key based on the failing provider and the available API keys:
   ```python
   def resolve_llm_fallback(current_provider: str, current_model: str, api_keys: dict) -> tuple[str, str, str]:
       # Hierarchical chain: groq -> gemini -> openrouter -> local
       fallback_chain = ["groq", "gemini", "openrouter", "local"]
       
       # Normalize model mapping
       model_mappings = {
           "groq": {
               "default": "llama3-8b-8192",
               "llama3-8b-8192": "llama3-8b-8192",
               "llama3-70b-8192": "llama3-70b-8192"
           },
           "gemini": {
               "default": "gemini-1.5-flash",
               "gemini-1.5-flash": "gemini-1.5-flash",
               "gemini-1.5-pro": "gemini-1.5-pro"
           },
           "openrouter": {
               "default": "meta-llama/llama-3-8b-instruct",
               "llama-3": "meta-llama/llama-3-8b-instruct"
           },
           "local": {
               "default": "default"
           }
       }
       
       for provider in fallback_chain:
           if provider == current_provider:
               continue
           # Check if API key is available (local doesn't need a key)
           key = api_keys.get(provider)
           if key or provider == "local":
               # Resolve equivalent model name or use default
               provider_models = model_mappings.get(provider, {})
               fallback_model = provider_models.get(current_model, provider_models.get("default", "default"))
               return provider, fallback_model, key
               
       return None, None, None
   ```

2. **Intercept Failures inside `reason_node`**:
   Update the LLM invocation retry block to detect rate limits (`429`, `insufficient_quota`, `rate_limit_exceeded`, timeouts, or server errors `500/503`) and switch to the resolved fallback:
   ```python
   # Inside except block in reason_node:
   is_usage_limit = any(term in error_msg.lower() for term in [
       "429", "quota", "rate limit", "limit reached", "overloaded", "timeout"
   ])
   api_keys = config.get("configurable", {}).get("api_keys", {})
   
   if is_usage_limit and api_keys:
       fallback_prov, fallback_model, fallback_key = resolve_llm_fallback(provider, model, api_keys)
       if fallback_prov:
           # Notify user via websocket stream
           websocket = config.get("configurable", {}).get("websocket")
           if websocket:
               await websocket.send_json({
                   "type": "token",
                   "content": f"\n\n⚠️ *[{provider.upper()}] usage limit/error detected ({error_msg[:60]}...). Dynamic fallback: switching to [{fallback_prov.upper()}] ({fallback_model})...*\n\n",
                   "node": "provider_fallback"
               })
           
           # Build new configuration overrides
           config_copy = dict(config)
           config_copy["configurable"] = dict(config["configurable"])
           config_copy["configurable"]["provider"] = fallback_prov
           config_copy["configurable"]["model"] = fallback_model
           config_copy["configurable"]["api_key"] = fallback_key
           
           # Re-initialize LLM and retry invocation
           llm_fallback = await get_dynamic_llm(config_copy, bind_tools=True)
           response = await _asyncio.wait_for(llm_fallback.ainvoke(messages), timeout=request_timeout)
           invoke_err = None  # Clear error
   ```

---

### 3. Loop Engineering Documentation

#### [NEW] [loop_engineering_architecture.md](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/docs/loop_engineering_architecture.md)
Create a comprehensive design document describing the "Loop Engineering" paradigm for AICodex, including self-correcting validation cycles, defensive guards, dynamic provider fallback routing, and telemetry systems.

---

## Verification Plan

### Automated Tests
- Run Python syntax checks on `nodes.py` and `chat.py`.
- Mock API failures inside a unit-test wrapper for `reason_node` to verify the fallback logic triggers and resolves the alternative model.

### Manual Verification
- Deliberately input a dummy/expired API key for Groq (or trigger a rate limit), select Groq, and request a code generation task. Verify that the agent automatically catches the error, streams the warning to the UI, switches to Gemini/Local, and finishes the task.
