# BYOK (Bring Your Own Key) & Cloud Run Alignment

This plan outlines the architecture to implement the Hybrid Model Router. By allowing users to provide their own API keys (Groq, OpenRouter), we can offload GPU inference costs and run the Python backend on Google Cloud Run's Always Free tier, while still supporting the local Ollama instance for private development.

## User Review Required

> [!IMPORTANT]
> To support external providers, we will need to install two new backend dependencies: `langchain-groq` and `langchain-openai` (OpenAI library is used to talk to OpenRouter's OpenAI-compatible API).

## Open Questions

> [!WARNING]
> 1. **Key Storage:** Should we provide separate input fields for Groq and OpenRouter keys in the Settings menu, or just one generic "API Key" field that applies to whatever provider is currently selected?
> 2. **Default Models:** For external providers, should we hardcode the target model (e.g. `llama3-8b-8192` for Groq) or add a dropdown so users can pick their preferred cloud model?

## Proposed Changes

### Frontend (React)

#### [MODIFY] `client/src/components/ProviderSelector.tsx`
- Update the dropdown to support three options: `Local (Ollama)`, `Groq (Cloud)`, and `OpenRouter (Cloud)`.

#### [NEW] `client/src/components/SettingsModal.tsx`
- Create a UI modal allowing users to securely enter their API keys.
- Implement logic to save these keys to the browser's `localStorage` (never to the database).

#### [MODIFY] `client/src/pages/Chat.tsx`
- Read the active provider and corresponding API key from `localStorage`.
- Append these credentials as query parameters when establishing the WebSocket connection to the backend: 
  `ws://127.0.0.1:8000/api/chat/ws/agent?provider=groq&api_key=sk-...`

---

### Backend (FastAPI / LangGraph)

#### [MODIFY] `backend/requirements.txt`
- Add `langchain-groq` and `langchain-openai`.

#### [MODIFY] `backend/api/chat.py`
- Update the `@router.websocket("/ws/agent")` endpoint to parse `provider` and `api_key` query parameters.
- Pass these parameters into the LangGraph execution stream via the `RunnableConfig` dictionary:
  `config = {"configurable": {"provider": provider, "api_key": api_key}}`

#### [MODIFY] `backend/agent/nodes.py`
- Remove the global static `llm = ChatOllama(...)` instantiation.
- Implement a `get_llm(config)` factory function inside `reason_node` that dynamically spins up the correct LLM class (`ChatOllama`, `ChatGroq`, or `ChatOpenAI`) based on the incoming configuration.
- Ensure all dynamic LLMs are correctly bound to our local agent tools (`.bind_tools()`).

## Verification Plan

### Automated Tests
- Validate that if an invalid API key is provided, the backend gracefully catches the `401 Unauthorized` error and sends it to the UI via the `on_error` WebSocket stream.

### Manual Verification
- Ensure Local Ollama still works perfectly when no key is provided.
- Ensure Groq streaming works and is perceptibly faster (or equal to) local execution.
