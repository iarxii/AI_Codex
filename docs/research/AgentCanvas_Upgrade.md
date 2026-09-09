# AgentCanvas Upgrade – Re‑evaluation & Front‑End‑Only Recommendation

> **⚠️ Partially superseded — recommendation adjusted during implementation.**
> This research correctly identified that no dedicated `/sandbox` backend API exists and that file CRUD should reuse the existing `workspace_writer`/`workspace_reader`/`workspace_patcher` endpoints — that guidance was followed. However, its specific recommendation to invoke `ShellExec` **via a chat tool call** (`POST /chat` with `{tool: "shell_exec", ...}`) was **not** what shipped. The implemented [`AgentCanvas.tsx`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/AgentCanvas.tsx) `handleRun` instead calls the existing **direct REST endpoint** `POST /api/v1/skills/shell_exec/test` with `{ command, cwd, shell, conversation_id }`, matching [`docs/plans/#78_implementation_plan.md`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/docs/plans/%2378_implementation_plan.md) instead of the `executeCommandViaSkill` helper sketched below. No `src/services/command.ts` or `src/services/sandbox.ts` file was created; the fetch call lives inline in `AgentCanvas.tsx`. The `TerminalConsole.tsx` that was built also differs from the `TerminalPane` sketch below — it keeps a list of past command runs (not a single `log` string) and shows exit code/duration/running-state per entry.

## 1️⃣ Quick Backend Snapshot (what *already* exists)
| Area | Existing backend implementation | How the front‑end currently talks to it |
|------|--------------------------------|-----------------------------------------|
| **Workspace CRUD** | `backend/skills/builtin/workspace_writer.py`, `workspace_reader.py`, `workspace_patcher.py` expose `POST /workspace/{conversationId}/file`, `POST /workspace/{conversationId}/folder`, `POST /workspace/{conversationId}/delete` (plus a GET for read). | `AgentCanvas.handleCreateFile / handleCreateFolder / handleDelete` already call those endpoints – they work. |
| **Command / sandbox execution** | `backend/skills/builtin/shell_exec.py` (and `cloudrun_sandbox.py`) implement the **ShellExec** skill. The skill decides whether to run locally or dispatch a Cloud‑Run job (see `CloudRunSandboxExecutor`). | The UI never calls a raw `/sandbox` route; instead an LLM‑generated tool call **“shell_exec”** is sent to the server, which runs the command in a controlled sandbox and returns the result as part of the chat response. |
| **Terminal output** | When the *ShellExec* skill finishes, its `SandboxResult` (stdout / stderr) is sent back as the normal skill‑response payload. The client already receives that payload via the normal chat‑message flow; there is **no dedicated SSE/Server‑Sent‑Events** endpoint for streaming live output. | The chat UI shows the result inside the message list (`MessageItem` → `MessageList`). |
| **What the recent front‑end changes added** | `src/services/sandbox.ts` (write/read/exec/stream endpoints) and `TerminalPane` (SSE stream). | Those endpoints **do not exist** in the current backend – they would 404 and break the UI. |

**Bottom line:** The backend already gives us everything we need for a premium‑tier IDE experience (file‑tree, editor, command execution). The new sandbox client introduces a *new* HTTP surface that the backend never implemented.

---

## 2️⃣ Revised Front‑End‑Only Plan (no backend changes)
| Phase | What to do (front‑end only) | Why / notes |
|------|----------------------------|-------------|
| **1️⃣ Align sandbox client** | **Remove** `src/services/sandbox.ts` (or turn it into a thin wrapper that simply forwards to the existing *ShellExec* skill). Create a helper `executeCommandViaSkill(command, cwd?, shell?, conversationId)` that sends a **tool request** to the chat endpoint (`POST /chat`). | Re‑uses the already‑implemented `ShellExec` skill; no new REST routes required. |
| **2️⃣ Keep file‑tree CRUD** | Continue using the existing `/workspace/{conversationId}/file|folder|delete` endpoints (already used by `handleCreateFile`, `handleCreateFolder`, `handleDelete`). No changes needed. | These routes are stable and already wired to `WorkspaceWriterSkill` etc. |
| **3️⃣ Terminal UI** | Replace the SSE‑based `TerminalPane` with a component that **displays the result of the ShellExec tool call**. When the user clicks *Run*, invoke the new helper, await the response, and render `stdout`/`stderr` inside the terminal pane. |
| **4️⃣ UI integration (save)** | The **Save** button in `EditorPane` should: 1️⃣ update the local Zustand store, 2️⃣ call the existing `POST /workspace/.../file` endpoint (still works), and 3️⃣ optionally fire a *workspace_writer* skill call to embed the `[CANVAS:…]` marker (the back‑end already does that when the skill is used). |
| **5️⃣ Execution “Run” button** | Add a **Run** button next to the Monaco editor. On click: – read the current file content, – build an appropriate command (e.g. `python main.py` or `npm install`), – call `executeCommandViaSkill`, – pipe the `output` / `error` into the terminal pane. |
| **6️⃣ Preserve premium/standard modes** | The CodeSpace UI already shows the file tree + editor + terminal for premium users; the Standard mode still shows the flat snippet list. No backend changes required. |
| **7️⃣ Docs & tests** | Update front‑end README / docs to explain that **sandbox execution is performed via the *ShellExec* skill**, not via a raw `/sandbox` API. Add unit tests for the new helper using a mocked chat response. |
| **8️⃣ CI/CD** | No changes to `deploy_production.bat.example` or Dockerfiles – the backend API surface is unchanged, so the existing deployment pipeline continues to work. |

### Minimal helper example (`src/services/command.ts`)
```ts
// src/services/command.ts
import { config, getApiUrl } from '../config';

/**
 * Executes a shell command using the existing `shell_exec` skill.
 * The backend decides whether to run locally or via Cloud Run.
 */
export async function executeCommandViaSkill(
  command: string,
  cwd = '.',
  shell: 'default' | 'cmd' | 'powershell' | 'bash' = 'default',
  conversationId: string | number
) {
  const payload = {
    tool: 'shell_exec',
    arguments: { command, cwd, shell },
    conversation_id: conversationId,
  };

  const resp = await fetch(
    `${getApiUrl(false)}${config.API_V1_STR}/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(payload),
    }
  );
  return resp.json(); // { success, output, error, data, ... }
}
```
The UI can now do:
```tsx
const result = await executeCommandViaSkill(
  `python ${selectedFile.path}`,
  '.',
  'default',
  conversationId!
);
setTerminalLog(result.output ?? result.error ?? '');
```

### Updated `TerminalPane` sketch (no SSE)
```tsx
import React, { useState } from 'react';

export const TerminalPane: React.FC<{log?: string}> = ({log}) => (
  <div className="w-full h-40 bg-black p-2 text-[var(--text-primary)] overflow-y-auto">
    <pre>{log}</pre>
  </div>
);
```
`AgentCanvas` will hold a `terminalLog` state and pass it down.

---

## 3️⃣ Action Checklist (what to edit in the repo)
1. **Delete / comment out** `src/services/sandbox.ts` (or rename to `sandbox_unused.ts`).
2. **Add** `src/services/command.ts` with the helper shown above.
3. **Update** `src/components/EditorPane.tsx`:
   - Keep the existing save logic (calls workspace API).
   - Add a **Run** button that calls the new helper and updates a `terminalLog` state in `AgentCanvas`.
4. **Create / modify** `src/components/TerminalPane.tsx` to accept a `log` prop and render it (no SSE).
5. **Add state** in `AgentCanvas.tsx`:
   ```tsx
   const [terminalLog, setTerminalLog] = useState('');
   ```
   Pass it to `<TerminalPane log={terminalLog} />`.
6. **Wire the Run button** (inside `EditorPane`) to call:
   ```tsx
   const result = await executeCommandViaSkill(command, '.', 'default', conversationId!);
   setTerminalLog(result.output ?? result.error ?? '');
   ```
7. **Update docs** (`README.md` or a new `docs/research/AgentCanvas_Upgrade.md` entry) to describe the *ShellExec*‑via‑skill flow.
8. **Add unit test** (`src/__tests__/command.test.ts`) mocking the `/chat` endpoint and asserting the helper returns the parsed JSON.
9. Run the full test suite (`npm test`) and verify the UI still loads, file‑tree works, and the Run button displays output.
10. Commit the changes; the existing `deploy_production.bat.example` and Dockerfiles remain untouched.

---

## 4️⃣ Why this satisfies the “do not touch backend” constraint
* **No new backend routes** are added – we only consume what is already present (`/workspace/*` and the chat‑tool endpoint). 
* **Sandbox execution** continues to happen inside the safe `ShellExec` skill (which already contains the Cloud‑Run guardrails and command allow‑list). 
* **Existing CI/CD** (`deploy_production.bat.example`) needs no changes because the container images, environment variables, and artifact registry stay the same.
* **Future extensibility** – if a dedicated `/sandbox` API ever becomes desirable, the front‑end already has a clean abstraction (`executeCommandViaSkill`) that can be swapped without touching the UI components.

---

### TL;DR (the one‑liner for the next agent)
> Keep the front‑end file‑tree & Monaco editor, drop the raw `/sandbox` client, and implement a tiny `executeCommandViaSkill` helper that calls the existing **ShellExec** skill via the chat API; render its result in a simple terminal component. All existing backend endpoints stay untouched, so the current deployment script works unchanged.

---

*Prepared for review by the next evaluating agent.*
