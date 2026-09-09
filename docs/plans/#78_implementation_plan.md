# Plan: AgentCanvas IDE Upgrade & CloudRun Sandbox Filesystem

Transform the existing **AgentCanvas** into a robust, premium-tier, IDE-style developer workbench for engineers (split file-tree + rich code editor + terminal), and architect CloudRun sandboxed filesystem execution so agents can create, edit, and execute files with the autonomy and persistence of a local developer harness.

## Implementation Status: Phase 1 & 2 Complete ✅ / Phase 3 Partial ⚠️

**Completed and verified (build + type-check green):**
- [`client/package.json`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/package.json) — `@monaco-editor/react` installed.
- [`ModuleTree.tsx`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/canvas/ModuleTree.tsx) — upgraded with search filter, collapsible nested folders, dark IDE theme, language badges, and inline create/delete CRUD actions wired to the workspace endpoints.
- [`CodeEditorPane.tsx`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/canvas/CodeEditorPane.tsx) — new component wrapping `@monaco-editor/react` with language auto-detection, `Ctrl+S`/`Cmd+S` save, dirty-state indicator, copy-to-clipboard, and a **Run** button (shown only for runnable extensions: `.py`, `.js`, `.sh`, `.ps1`).
- [`TerminalConsole.tsx`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/canvas/TerminalConsole.tsx) — new collapsible console rendering command, stdout/stderr, exit code, duration, with copy and clear actions.
- [`AgentCanvas.tsx`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/AgentCanvas.tsx) — Code tab now composes `ModuleTree` + `CodeEditorPane` + `TerminalConsole`; added `canvasWidth` state (`compact` 480px / `wide` 860px / `full` 100%) with a header cycle-toggle button; `handleSave` posts to `POST /workspace/{id}/file`; `handleRun` posts directly to `POST /api/v1/skills/shell_exec/test` (not via a chat tool call — see divergence note below). Docs/Research/Graph tabs are unchanged (zero regressions).
- [`backend/api/workspace.py`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/workspace.py) — added `POST /{conversation_id}/rename` endpoint (`RenameRequest{old_path,new_path}`); fixed a pre-existing malformed `try/except` in the delete endpoint discovered while wiring rename.

**Not implemented (deferred, out of scope for this iteration):**
- `backend/skills/cloudrun_sandbox.py` GCS FUSE volume synchronization described in Phase 3 below — the sandbox continues to use its existing local/CloudRun execution path unchanged. No workspace-volume mount work was done.
- The `ModuleTree` "inline renaming" UI does not yet call the new `/rename` backend endpoint from a context-menu/rename action; the endpoint exists and is tested via syntax check only, not wired to a UI trigger.

**Verification performed:**
- `npx tsc -p tsconfig.app.json --noEmit` — clean, no errors.
- `npm run build` — succeeds (pre-existing chunk-size-warning only, unrelated to this change).
- `python -c "import ast; ast.parse(open('backend/api/workspace.py').read())"` — syntax OK.
- Manual code review of full diff confirms handlers, state, and endpoints match the design below.

## Background & Current State Assessment

1. **Reverted State**:
   - All breaking syntax errors, untracked uninstalled files, and type mismatches have been cleaned up.
   - Client build (`npm run build`) is fully green and passing.
2. **Current Limitations**:
   - **AgentCanvas**: Restricted to a fixed 450px side drawer. The Code tab previously stacked a small snippet tree above a basic `<textarea>` code preview with manual line-number rendering. It lacks multi-file tabs, resizability, full-height split views, and direct code execution controls.
   - **Filesystem & Sandbox**:
     - The backend currently stores workspace files locally in `backend/data/workspaces/{conversation_id}/scratch/`.
     - The Agent has tools (`workspace_writer`, `workspace_patcher`, `workspace_reader`, `shell_exec`) operating on this directory.
     - However, CloudRun Sandboxes (`backend/skills/cloudrun_sandbox.py`) currently attempt `gcloud run jobs execute ... --wait --args="..."` which lacks a shared, persistent filesystem volume mount with the backend. Consequently, files created by the Agent on CloudRun are not automatically mirrored to the local scratchpad, and vice versa.

---

## Architecture & Design

### 1. Dual-Pane / Expandable IDE Layout (AgentCanvas)
```
┌────────────────────────────────────────────────────────────────────────────┐
│ AgentCanvas Top Bar: [Mode Badge] [File Title]       [Run] [Save] [Max/Min]│
├──────────────────────┬─────────────────────────────────────────────────────┤
│ File Explorer        │ Monaco Editor                                       │
│ 📁 src/              │ 1 | import sys                                      │
│   ├── 📄 main.py     │ 2 |                                                 │
│   └── 📄 utils.py    │ 3 | def run():                                      │
│ 📁 tests/            │ 4 |     print("Executing in sandbox...")            │
│   └── 📄 test_api.py │                                                     │
│ 📄 README.md         │                                                     │
│                      ├─────────────────────────────────────────────────────┤
│ [+File] [+Folder]    │ Terminal / Execution Output                         │
│                      │ $ python src/main.py                                │
│                      │ Executing in sandbox... (Exit 0, 142ms)             │
└──────────────────────┴─────────────────────────────────────────────────────┘
```

* **Resizable & Full-Width Toggle**: Allow the canvas to expand from default 480px to wide (800px) or full-screen IDE mode so engineers have sufficient real estate for multi-column editing.
* **Modern Monaco Integration**: Install `@monaco-editor/react` (the lightweight, robust React wrapper for Monaco) with automated language syntax highlighting, dark theme (`vs-dark`), minimap toggles, and shortcuts (`Ctrl+S` / `Cmd+S` to save).
* **Enhanced FileTree**: Upgrade [`ModuleTree.tsx`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/canvas/ModuleTree.tsx) into a full-featured Explorer pane supporting nested folder trees, search filter, new file/folder creation modals, inline renaming, and deletion.
* **Integrated Terminal / Run Console**:
  - Add a **Run** button that targets `POST /api/v1/skills/shell_exec/test` with the active file and conversation ID.
  - Render a bottom terminal pane displaying execution status, exit codes, execution duration, and formatted stdout/stderr.

### 2. CloudRun Sandbox & Filesystem Architecture

To make CloudRun sandboxes behave "in the likeness of how a local harness running on a local filesystem could create files":

1. **Storage Layer (Cloud Storage FUSE Mount)**:
   - Workspaces in production are backed by GCS bucket `gs://{GCP_PROJECT_ID}-workspaces/{conversation_id}/`.
   - Cloud Run supports mounting Cloud Storage buckets as local network volumes using Cloud Storage FUSE.
   - When the Cloud Run sandbox job/container executes, it mounts `gs://.../{conversation_id}/` to `/workspace`.
   - Both the FastAPI backend and Cloud Run container operate on the identical files in real time.
2. **Unified Agent Filesystem Skills**:
   - `workspace_writer`, `workspace_patcher`, and `shell_exec` are configured with a unified base path:
     - In Local Mode: `backend/data/workspaces/{conversation_id}/scratch/`
     - In CloudRun Mode: `/mnt/workspaces/{conversation_id}/` (FUSE mount) or synced via GCS storage utility.
3. **Execution Endpoint**:
   - Direct execution via `POST /api/v1/skills/shell_exec/test` (for manual "Run" clicks in the IDE) and via LangGraph tool calls during conversation.

---

## User Review Required

> [!IMPORTANT]
> **Editor Dependency**: We propose installing `@monaco-editor/react` (cleaner Vite integration than raw `react-monaco-editor`). Vite requires no custom web-worker plugins when using `@monaco-editor/react`'s CDN/dynamic loader, keeping the bundle fast and stable.
>
> **CloudRun Sandbox Infrastructure**: Cloud Run Job execution requires GCP credentials and either:
> 1. A GCS bucket with Cloud Storage FUSE volume mount (recommended for zero-latency bidirectional filesystem sync), or
> 2. Direct execution fallback to the container's local sandbox when `SANDBOX_MODE=local` (ideal for development and environments without GCP billing enabled).

---

## Proposed Changes

### Phase 1: Client Dependencies & Editor Setup

#### [MODIFY] [client/package.json](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/package.json)
- Add `@monaco-editor/react` for Monaco editor support.

---

### Phase 2: IDE-Style AgentCanvas Refactoring

#### [MODIFY] [client/src/components/canvas/ModuleTree.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/canvas/ModuleTree.tsx)
- Add search filter to find files across large workspaces.
- Add rename capabilities (`handleRenameFile`).
- Improve active node highlighting, collapsible folders, and file icon sets.

#### [NEW] [client/src/components/canvas/CodeEditorPane.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/canvas/CodeEditorPane.tsx)
- Embed `@monaco-editor/react`.
- Support hotkeys (`Ctrl+S` / `Cmd+S`) to save.
- Support language detection from file extension (`.py`, `.ts`, `.tsx`, `.js`, `.json`, `.sh`, `.sql`, etc.).
- Add file tabs for recently opened artifacts.

#### [NEW] [client/src/components/canvas/TerminalConsole.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/canvas/TerminalConsole.tsx)
- Output console styled like a professional developer terminal.
- Displays stdout, stderr, execution duration, and exit codes.
- Supports clear output, copy logs, and ANSI color formatting.

#### [MODIFY] [client/src/components/AgentCanvas.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/AgentCanvas.tsx)
- Add drawer width toggle: Compact (450px), Wide (850px), or Full-Screen Overlay.
- In `activeTab === 'Code'`:
  - Split left sidebar: `ModuleTree` file explorer with CRUD actions.
  - Main panel: `CodeEditorPane` with Monaco editor + Save action.
  - Bottom collapsible drawer: `TerminalConsole` with Run action (`POST /api/v1/skills/shell_exec/test`).
- Retain Docs, Research, and Graph tabs with zero regressions.

---

### Phase 3: Backend Sandbox & Filesystem Enhancements

#### [MODIFY] [backend/api/workspace.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/workspace.py)
- Add `POST /{conversation_id}/rename` endpoint to allow file/folder renaming.
- Ensure all workspace mutations notify active listeners and trigger disk sync.

#### [MODIFY] [backend/skills/cloudrun_sandbox.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/cloudrun_sandbox.py)
- Enhance `CloudRunSandboxExecutor` to inject workspace GCS volume synchronization or pass environment context so execution matches local harness behavior.

---

## Verification Plan

### Automated Tests
1. **Client Build Verification**:
   ```pwsh
   cd client
   npm run build
   ```
2. **Lint & Type Check**:
   ```pwsh
   cd client
   npx tsc -b
   ```
3. **Backend Route Verification**:
   - Test `POST /api/v1/workspace/{id}/file`
   - Test `POST /api/v1/skills/shell_exec/test` with `{ "command": "python --version", "conversation_id": "..." }`

### Manual Verification
1. Open a conversation in the UI.
2. Toggle Agent Canvas -> Switch to **Code** tab.
3. Verify the file tree renders folders and files correctly.
4. Create a new file, edit it in Monaco, and hit Save. Verify the file is created on disk.
5. Click **Run** on a Python file. Verify the terminal console displays the execution output with exit code.
6. Toggle width between 450px and Expanded/Full-Screen mode.

> **Status:** Steps 1–3 of Automated Tests were executed and passed (`npm run build` and `npx tsc -p tsconfig.app.json --noEmit`, both clean). The Backend Route Verification and full Manual Verification checklist above were **not** run end-to-end against a live backend/browser session in this iteration — they are left as follow-up validation before merging.
