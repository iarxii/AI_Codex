# Walkthrough — Sandbox Safeguards & Hot-Reload Live iFrame Previews

We have implemented execution safeguards on Cloud Run sandboxes, established strict guardrails against running live backend server daemons, and added support for live interactive web app previews inside the `AgentCanvas` using a sandboxed `<iframe>` component.

---

## 1. Accomplishments

### Phase 1: Cloud Run Sandbox Guardrails
- **Forbidden Server Interceptor**: Added `FORBIDDEN_SERVER_COMMANDS` in [`cloudrun_sandbox.py`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/cloudrun_sandbox.py) to block attempts to run live backend daemons (`uvicorn`, `gunicorn`, `flask run`, `fastapi dev`, `node server.js`, `express`, `nodemon`, `python -m http.server`).
- **Policy Enforcement**: Intercepted backend server executions return a `403` guardrail result explaining that backend source files are written to the workspace repository, while live UI previews run using client-side API mocks.

### Phase 2: Agent Frontend vs Backend Code Strategy
- **`CodeLabOutput` Schema Expansion**: Updated [`a2ui_renderer.py`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/codex_spaces/backend/agent/a2ui_renderer.py) with `html_preview` and `preview_url` fields.
- **`a2ui_iframe_preview` Helper**: Added Python constructor to emit A2UI `iframe_preview` declarations.

### Phase 3: Live iFrame Preview Renderer (`A2UIRenderer.tsx`)
- **`IFramePreviewRenderer`**: Added a responsive iFrame renderer to [`A2UIRenderer.tsx`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/codex_spaces/client/src/components/A2UIRenderer.tsx) featuring a status header (`⚡ Hot-Reload Live Preview`), fullscreen toggle, and sandboxed iframe attributes (`sandbox="allow-scripts allow-same-origin allow-forms"`).
- **Verified Production Build**: Tested `npm run build` in `client`; compiled cleanly with **0 errors**.

---

## 2. Key Code Changes

| File | Changes |
| :--- | :--- |
| [`cloudrun_sandbox.py`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/cloudrun_sandbox.py) | Added `FORBIDDEN_SERVER_COMMANDS` guardrail check and policy output. |
| [`a2ui_renderer.py`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/codex_spaces/backend/agent/a2ui_renderer.py) | Added `html_preview`/`preview_url` to `CodeLabOutput` and `a2ui_iframe_preview` helper. |
| [`A2UIRenderer.tsx`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/codex_spaces/client/src/components/A2UIRenderer.tsx) | Added `A2UIIFramePreview` interface and `IFramePreviewRenderer` component with fullscreen controls. |

---

## 3. Verification & Testing

- **Backend Guardrail Interceptor Test**: Ran `CloudRunSandboxExecutor.execute("python -m uvicorn main:app --reload")`. Successfully intercepted the call and returned guardrail status:
  `🛑 Backend Server Execution Guardrail: Live backend server processes (FastAPI, Express, Flask) are disabled in sandbox previews...`
- **Frontend Build**: Ran `npm run build` in `client`. Output built cleanly in 10.59s.
