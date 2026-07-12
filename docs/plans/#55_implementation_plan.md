# Implementation Plan: Agentic Routing & Chat UI Stabilization

This plan addresses two distinct issues identified in the feedback:
1. **Extension Model Routing (Code Lab Provider Error)**: The `Gemma Code Lab` agent restricts providers to Google SDK defaults, throwing an `Unsupported provider` error when Ollama Cloud or OpenRouter are selected.
2. **Web Client UI & State Persistence**: Intermediate reasoning streams overwrite the main chat bubble, getting replaced by the final response, and tool execution metadata is not persisted across page reloads.

## 1. Fix Code Lab Provider Routing (`genai_llm.py`)
Currently, `get_code_lab_llm()` strictly requires `google`, `gemini`, or `colab_bridge`.
**Proposed Change:**
- Create a `LangChainCodeLabLLM` adapter class in `genai_llm.py`.
- If the selected provider is not natively supported by the Google SDK (e.g., `ollama_cloud`, `openrouter`, `groq`), we will route it through our universal `backend.agent.models.get_llm()` factory and wrap it in the adapter so it seamlessly matches the `ChatMessage` interface expected by the Code Lab.

## 2. Stabilize Web Client Chat UI & Persistence

### A. Fix Streaming Overwrites (`chat.py`)
- **Issue**: During a multi-turn ReAct loop, the `reason` node streams text to the main chat bubble. When the next turn starts, or when `on_chain_end` fires, the backend overwrites `full_ai_response` with the new content, replacing what the user just saw.
- **Proposed Change**: We will append to `full_ai_response` (e.g., `full_ai_response += "\n\n" + new_content`) between agent loops instead of resetting it. This ensures all intermediate reasoning and tool usage descriptions remain visible in the main chat bubble.

### B. Fix Database Persistence (`chat.py`)
- **Issue**: The backend saves every intermediate tool call and reasoning step as separate rows in the database. When the page reloads, `Chat.tsx` ignores tool rows and renders multiple disjointed AI chat bubbles, losing the cohesive `ThoughtProcess` trace.
- **Proposed Change**: We will consolidate the agent's graph run into a **single** DB `Message` row representing the final AI response. We will capture all `tool_calls` and tool outputs during the run and serialize them into the `metadata_json` of that single AI message.

### C. Fix Frontend Reloading (`Chat.tsx`)
- **Issue**: `loadConversation()` completely ignores message metadata.
- **Proposed Change**: Update `loadConversation` in `Chat.tsx` to read the `metadata` JSON (specifically `tool_calls` and `thought_log`) so that if the user refreshes the page, the "Thought Process" dropdown and tool execution state are perfectly restored.

## User Review Required
Please review the proposed approach. Consolidating the database persistence to save **one** AI message per turn (with tools nested in metadata) is a significant shift but aligns perfectly with modern chat UI standards (like ChatGPT or Claude). Do you approve of this approach?
