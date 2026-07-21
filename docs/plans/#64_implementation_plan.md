# Implementation Plan — Sandbox Safeguards & Frontend iFrame Preview Policy

Establish execution safeguards on Cloud Run sandboxes, restrict live backend server execution while permitting frontend web app builds, and project live hot-reload frontend previews into the `AgentCanvas` via iFrame.

## 1. Cloud Run Sandbox Safeguards

- **Strict Command Validation**: Intercept long-running backend server commands (`uvicorn`, `gunicorn`, `flask run`, `python -m http.server`, `node server.js`, `express`).
- **Resource & Execution Limits**: Enforce a strict execution timeout (`MAX_EXECUTION_TIME = 45s`), zero min-instances (scale-to-zero), and single vCPU / 1GB RAM caps.
- **Graceful Policy Notices**: Return structured A2UI notices when a backend server launch is intercepted, informing the user that backend code has been created in the workspace while the live preview uses simulated frontend mocks.

---

## 2. Agent Code Handling Strategy (Frontend vs Backend)

| Code Type | Live Execution Policy | Agent Handling Strategy |
| :--- | :--- | :--- |
| **Frontend Web Apps** (HTML/CSS/JS, React, Vite) | **ALLOWED** | Built in sandbox (`npm run build` or single-file HTML bundle) and delivered as an interactive live `iframe_preview` declaration in `AgentCanvas`. |
| **Backend Code** (Python FastAPI, Node Express, SQL, Go) | **RESTRICTED** (No live daemon process) | Written directly to workspace files. For live UI previews, the Agent injects in-memory mock endpoints or `fetch` interceptors into the frontend preview. |

---

## Proposed Changes

### Backend Execution Guardrails

#### [MODIFY] [cloudrun_sandbox.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/cloudrun_sandbox.py)
- Add `FORBIDDEN_SERVER_COMMANDS` set to intercept backend server launchers (`uvicorn`, `flask`, `gunicorn`, `fastapi`, `node server.js`, `express`).
- Add execution timeout wrapper and parameters for Cloud Run job limits.
- Return structured `SandboxResult` explaining backend guardrail policy when intercepted.

#### [MODIFY] [harness_bridge.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/builtin/harness_bridge.py)
- Enhance `harness_dispatch` to detect frontend output vs backend code and generate `iframe_preview` A2UI declarations for web applications.

---

### Frontend Preview & A2UI Renderer

#### [MODIFY] [A2UIRenderer.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/codex_spaces/client/src/components/A2UIRenderer.tsx)
- Add `iframe_preview` A2UI component renderer with sandboxed iframe attributes (`sandbox="allow-scripts allow-same-origin"`).
- Add support for live HTML/CSS/JS preview rendering in `AgentCanvas`.

---

## Verification Plan

### Automated Tests
- Test command interceptor in `CloudRunSandboxExecutor` using unit commands (`python -m uvicorn ...` -> intercepted; `npm run build` -> allowed).

### Manual Verification
- Test generating a React/HTML frontend in `harness_dispatch` and verify it renders interactively inside `AgentCanvas` in an iFrame.
- Verify backend Python files are saved to the workspace while displaying the guardrail notification.
