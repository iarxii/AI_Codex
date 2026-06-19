# Implementation Plan: Dynamic & Secure LangSmith Telemetry

This plan outlines the integration of dynamic, multi-tenant safe LangSmith telemetry tracing into the existing FastAPI backend, the VSCode extension, and the Vite Web Client. Tracing will be dynamically configured per request, ensuring no hardcoded keys or shared process environments violate privacy.

---

## User Review Required

> [!IMPORTANT]
> **No Hardcoded Secrets**: LangSmith API keys are never stored in source code. They are managed in client settings (VSCode user configuration or Web Client LocalStorage) and passed securely via the WebSocket connection payload.
> 
> **Process-Level Isolation**: We bypass modifying global environment variables (`os.environ`) in the backend, utilizing async-safe `tracing_context` context variables instead. This prevents concurrent cross-tenant data leakage.
> 
> **Database Engines**: The backend remains database-engine agnostic. Tracing persistence does not compile graph checkpointers directly, keeping it fully compatible with both the production Cloud Run SQLite (with GCS syncing) and local Docker PostgreSQL databases.

---

## Proposed Changes

### Backend Components

#### [MODIFY] [chat.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/chat.py)
*   Extract `benchmark_mode`, `private_workspace`, `langsmith_api_key`, and `langsmith_project` from the incoming WebSocket payload inside the `run_agent_task` endpoint.
*   Initialize `langsmith.Client` dynamically if tracing is enabled.
*   Implement a payload scrubbing function `scrub_telemetry_payload` to truncate large `messages` content (e.g. content longer than 1000 characters) to avoid massive telemetry payloads, and pass it to `hide_inputs` and `hide_outputs`.
*   Wrap the `astream_events` call within a `langsmith.run_helpers.tracing_context` manager to execute traces under the correct project and key without affecting other concurrent tasks.

---

### VSCode Extension

#### [MODIFY] [package.json](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/vscode-extension/package.json)
*   Add configuration properties under `spiritBirdAiCodex`:
    *   `spiritBirdAiCodex.enableLangsmith` (boolean, default: `false`)
    *   `spiritBirdAiCodex.langsmithApiKey` (string, default: `""`)
    *   `spiritBirdAiCodex.langsmithProject` (string, default: `"vscode-agent-react-benchmarks"`)
    *   `spiritBirdAiCodex.privateWorkspace` (boolean, default: `true`)

#### [MODIFY] [ChatViewProvider.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/vscode-extension/src/panels/ChatViewProvider.ts)
*   Retrieve configuration keys inside `handleUserMessageWs`.
*   Include the new telemetry settings in the WebSocket outgoing payload object.

---

### Vite Web Client

#### [MODIFY] [SettingsModal.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/SettingsModal.tsx)
*   Add visual controls under a new "LangSmith Tracing Settings" section for toggling tracing, inputs for the API key and project name, and a toggle for "Private Workspace".
*   Save/retrieve these values from browser LocalStorage: `enable_langsmith`, `langsmith_api_key`, `langsmith_project`, and `private_workspace`.

#### [MODIFY] [Chat.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/Chat.tsx)
*   Extract the LangSmith tracing settings from LocalStorage.
*   Include them in the WebSocket chat event payload sent to the backend.

---

## Verification Plan

### Automated/Unit Tests
*   Run the FastAPI tests to confirm that normal websocket flows are unaffected when telemetry payload is absent.

### Manual Verification
1.  **Observability Isolation Check**:
    *   Initiate a chat session from VSCode with `enableLangsmith` set to `false`. Verify that no runs appear in LangSmith.
    *   Toggle `enableLangsmith` to `true` and supply a valid API key. Send a message. Verify that a trace session is created under your designated LangSmith project.
2.  **Privacy Scrubbing Check**:
    *   Paste a massive file context (e.g. 1500+ characters) in the chat.
    *   Verify the agent gets the full context and responds correctly.
    *   Inspect the LangSmith trace run. Verify that the input message payload has been successfully truncated (shows `...[TRUNCATED]...`), validating token and egress savings.
3.  **Cross-Tenant Concurrency Verification**:
    *   Start two concurrent client sessions (one with tracing enabled, one disabled).
    *   Verify that only the traced client's runs appear in LangSmith, with no data leakage from the private client's runs.
