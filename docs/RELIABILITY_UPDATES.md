# Reliability & Robustness Updates (May 2026)

This weekend, we implemented several critical updates to ensure AI_Codex remains stable across diverse model providers and local hardware configurations.

## 1. Tool-Calling Fallback Mechanism
We addressed the "400 Bad Request" errors occurring when users attempted to use reasoning models (like DeepSeek-R1) that do not support standard OpenAI-compatible tool binding.

- **Proactive Check**: The `init_node` now queries a capability heuristic engine (`backend/utils/telemetry.py`) before reasoning begins.
- **Dynamic Binding**: Tools are only bound if the model explicitly supports them, preventing initialization crashes.
- **Reactive Retry**: If a model still returns a tool-support error at runtime, the `reason_node` in `backend/agent/nodes.py` catches the exception and retries the request without tool binding.

## 2. Telemetry & Heuristics
Improved the `get_model_capabilities` logic to accurately categorize modern models:
- **Ollama Models**: Added support for Llama 3.1, 3.2, 3.3, Qwen 2.5, and Mistral Nemo as "Tool Capable".
- **DeepSeek Exception**: Explicitly excluded DeepSeek-R1 from tool-calling capability to avoid known 400 errors, forcing it into text-only reasoning mode.
- **Thinking Support**: Added telemetry markers for reasoning models like Gemini 2.0 Flash Thinking and DeepSeek Reasoner.

## 3. Bug Fixes & Stability
- **Variable Scope**: Resolved an `UnboundLocalError` where the `model` variable was referenced before assignment in `reason_node`.
- **History Management**: Fixed a session-handling bug in `backend/api/chat.py` related to `AIMessage` import scope during history reconstruction.
- **Data Integrity**: Implemented stringification for user messages before database persistence to prevent `sqlite3.InterfaceError` with complex payload types.

## 4. Observability
- **Structured Logging**: Migrated internal pipeline monitoring from `print` statements to a formal `logging` system.
- **Debug Logs**: Detailed execution traces are now recorded in `logs/debug.log`, including node transitions and latency benchmarks.

---
*These updates ensure that AI_Codex can leverage lower-weight or specialized reasoning models without compromising the overall system stability.*
