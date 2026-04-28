# Implementation Plan: Ollama Cloud Integration

Integration of Ollama Cloud as a first-class AI provider in AICodex to support remote inference and cloud-scale models.

## User Review Required

> [!IMPORTANT]
> **Endpoint Defaults**: By default, the plan uses `https://ollama.com` as the base URL for Ollama Cloud. If you are using a self-hosted "Ollama Cloud" instance (e.g., via Docker or a private proxy), you can override this in the Settings Modal.

## Proposed Changes

### Core Integration Details (Based on Docs)
- **Base URL**: `https://ollama.com`
- **Auth Strategy**: `Authorization: Bearer <API_KEY>`
- **Endpoints**:
    - Listing: `GET /api/tags`
    - Chat: `POST /api/chat`

---

### Backend Components

#### [MODIFY] [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)
Update `get_dynamic_llm` to use `ChatOllama` with the cloud endpoint and headers.
- **Goal**: Ensure the agent can stream tokens from remote Ollama models.
- **Logic**: Use `ChatOllama(base_url=base_url, headers={"Authorization": f"Bearer {api_key}"})`.

#### [MODIFY] [models.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/models.py)
Refine the `ollama_cloud` handler.
- **Goal**: Successfully pull the list of available cloud models.
- **Logic**: Use `requests.get("https://ollama.com/api/tags", headers=...)`.

---

### Frontend Components

#### [MODIFY] [AIContext.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/contexts/AIContext.tsx)
- Set `https://ollama.com` as the default `ollama_cloud_url` if empty.

#### [MODIFY] [SettingsModal.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/SettingsModal.tsx)
- Add a "Test Connection" button for Ollama Cloud to verify the remote URL and API key.

---

## Verification Plan

### Automated Tests
1. **Connectivity Check**:
   - `curl -H "Authorization: Bearer $OLLAMA_API_KEY" https://ollama.com/api/tags`
2. **Streaming Verification**:
   - Test a chat session using `ollama_cloud` in the UI and verify logs in `view_logs.bat`.

### Manual Verification
1. Open Settings -> AI Providers -> Ollama (Remote/Cloud).
2. Enter API Key.
3. Verify that the model dropdown populates with cloud models (e.g., `gpt-oss:120b`).
4. Start a new chat and confirm the pulse animation shows "Neural Cloud" activity.
