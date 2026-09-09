# IDE‑Style AgentCanvas Roadmap

> **⚠️ Superseded — early-stage roadmap, not the implemented design.**
> This roadmap explored a Cloud-Run sandbox microservice (Docker-in-Docker, Firestore/Redis job registry, WebSocket log streaming), `rc-tree`/`react-treebeard` file trees, and `xterm.js` terminals. **None of the Cloud-Run sandbox service or streaming infrastructure described below was built.** The implemented version (tracked in [`docs/plans/#78_implementation_plan.md`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/docs/plans/%2378_implementation_plan.md)) is scoped much smaller:
> - It reuses the **existing** `backend/api/workspace.py` CRUD endpoints (`file`, `folder`, `delete`, plus a newly added `rename`) — no new sandbox microservice, GCS FUSE mount, or per-request container spawning.
> - It runs commands via the **existing** `POST /api/v1/skills/shell_exec/test` endpoint synchronously (request/response), not a streamed WebSocket/SSE log channel.
> - The editor and file tree ([`CodeEditorPane.tsx`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/canvas/CodeEditorPane.tsx), [`ModuleTree.tsx`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/canvas/ModuleTree.tsx)) use `@monaco-editor/react` and a hand-rolled tree component respectively — no `rc-tree`/`react-treebeard` or `xterm.js` dependency was added.
>
> Keep this document for its longer-term sandbox architecture ideas (Section 3 onward remains a reasonable future direction); it does not describe what currently exists in the codebase.

This document outlines the steps required to evolve **AgentCanvas** from a simple artifact viewer into a premium‑tier, IDE‑style component with a full file‑tree, code editor, and Cloud‑Run sandbox integration.

---

## 1. Core UI‑Level Changes

| Area | What to add / replace | Why it feels premium | Quick‑start libraries |
|------|-----------------------|-----------------------|------------------------|
| **Code tab** | Replace the flat‑list view with a **File‑Tree + Code‑Editor pane** (split‑view). | Engineers expect a familiar explorer‑side panel + editor. | • **Monaco Editor** (`react‑monaco‑editor`).<br>• **react‑treebeard** or **rc‑tree** for the explorer. |
| **Tabs layout** | Keep the tab bar but reserve the full canvas width for the IDE when `Code` is active. | Gives the canvas the look of a dedicated IDE window. | Use CSS grid (`grid-cols-2`) or flex with a “sidebar” (tree) and “main” (editor) region. |
| **Graph Tab** | Keep the existing Graph view but embed it inside the same layout so you can “pin” it next to the editor (optional split). | Allows power users to visualise dependencies while coding. | Wrap `GraphView` in a resizable pane (`react‑split‑pane`). |
| **Multi‑file handling** | Store a **virtual file‑system** in a single state object (`{ path: string, content: string, language?: string }[]`). | Gives the agent a deterministic view of the workspace. | Use `zustand` or `jotai` for simple global state, or extend the existing `useAI` context. |
| **Toolbar** | Add a “Run / Deploy / Open Sandbox” dropdown, a “Commit” button (for versioning) and a “Terminal” toggle. | Mirrors professional IDEs (VS Code, JetBrains). | Simple `<button>` components; later connect to the sandbox. |
| **Status Bar** | Show current sandbox status (running / stopped), active file, git‑like branch, and stack‑trace alerts. | Gives immediate feedback on agent actions. | Small component at the bottom of the canvas. |

### Sketch of the new layout (CSS‑grid)
```tsx
<div className="grid grid-cols-[250px_1fr] h-full">
  {/* ← File Tree */}
  <FileTree files={workspaceFiles} onSelect={setSelectedId} />

  {/* → Main panel */}
  <div className="flex flex-col">
    <EditorPane
      file={selectedFile}
      onChange={handleEditorChange}
      onSave={handleSave}
    />
    {/* Optional bottom bar – terminal / logs */}
    <TerminalPane sandboxId={sandboxId} />
  </div>
</div>
```

---

## 2. Rich Code Editing (Monaco)

1. **Installation**
   ```bash
   yarn add monaco-editor react-monaco-editor
   ```
2. **Component**
   ```tsx
   import { MonacoEditor } from 'react-monaco-editor';

   <MonacoEditor
     width="100%"
     height="calc(100vh - 120px)"
     language={selectedFile.language ?? 'plaintext'}
     theme="vs-dark"
     value={selectedFile.content}
     onChange={(newValue) => updateFileContent(selectedFile.path, newValue)}
     options={{
       automaticLayout: true,
       tabSize: 2,
       renderWhitespace: 'all',
     }}
   />
   ```
3. **Features to expose to the Agent**
   * `workspace.getFile(path)` – returns the current content.
   * `workspace.setFile(path, content)` – updates the in‑memory file (and optionally triggers a save).
   * `workspace.rename(oldPath, newPath)` – change path in the virtual FS.
   * `workspace.delete(path)` – remove a node.

   These helpers live in a new `useWorkspace` hook (or extend `useAI`) and act as the bridge between the UI and the Agent’s logic.

---

## 3. Cloud‑Run Sandbox Integration

### 3.1 Goal
Provide each user (or each conversation) an **isolated container** that:
* Exposes a simple filesystem (read/write) via an HTTP JSON API.
* Can execute arbitrary commands (e.g., `python script.py`, `npm install`).
* Streams stdout/stderr back to the client (WebSocket or SSE).
* Lives only for the duration of the session.

### 3.2 Architecture Overview
```
[Frontend] <--REST/WS--> [API Gateway] <--gRPC/REST--> [Cloud Run Sandbox Service] <--Docker--> [User Container]
```
1. **Frontend** – calls `/api/sandbox/:id/...` (create, exec, read, write).
2. **API Gateway** – authenticates the request, forwards to the correct Cloud‑Run instance (uses the `conversationId` as sandbox identifier).
3. **Cloud‑Run “Sandbox Service”** – a lightweight wrapper that:
   * **Spawns a new Docker container** (using Cloud Run **Jobs** or **Cloud Run for Anthos**) per request.
   * Mounts a **tmpfs** volume that persists for the life of the job.
   * Exposes a **REST endpoint** for `GET /files/**`, `POST /files/**`, `POST /exec`.
   * Sends logs over a **WebSocket** back to the gateway.
4. **User Container** – a base image (`node:20` / `python:3.12`) with minimal tooling (git, build‑essentials).

### 3.3 Minimal Viable Implementation
| Step | Action | Reason |
|------|--------|--------|
| **a. Sandbox Service** | Deploy a **single Cloud Run service** that runs a **Docker‑in‑Docker** (DinD) or **podman‑run** command to launch an isolated child container per request. | You don’t need a full per‑user Cloud Run service yet; a single service can multiplex many sandboxes. |
| **b. API** | Add endpoints: <br>`POST /sandbox/:id/create` → launches a new container and stores its ID in Firestore/Redis.<br>`POST /sandbox/:id/write` → `{"path":"src/main.py","content":"..."}`<br>`GET /sandbox/:id/read?path=…` <br>`POST /sandbox/:id/exec` → `{cmd:["python","main.py"]}` | Mirrors a local filesystem API the Agent already knows (`workspace.createFile`, etc.). |
| **c. Streaming** | Use **Server‑Sent Events** (`/sandbox/:id/stream`) or **WebSocket** to push exec stdout/stderr. | Gives the UI real‑time feedback (like a terminal). |
| **d. Auth** | Pass the user's **JWT** (`Authorization: Bearer …`) from the front‑end; the API validates it and scopes the sandbox id to that user. | Prevents cross‑user sandbox attacks. |
| **e. Clean‑up** | Attach a **TTL** (e.g., 30 min idle) and a graceful shutdown endpoint (`POST /sandbox/:id/stop`). | Keeps cost low and respects security. |

### 3.4 Front‑end Hook Integration
```ts
// src/services/sandbox.ts
export async function createSandbox(conversationId) {
  return fetch(`/api/sandbox/${conversationId}/create`, { method: 'POST' })
    .then(r => r.json());
}
export async function writeFile(sandboxId, path, content) {
  return fetch(`/api/sandbox/${sandboxId}/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content })
  });
}
export async function execCmd(sandboxId, cmd) {
  return fetch(`/api/sandbox/${sandboxId}/exec`, {
    method: 'POST',
    body: JSON.stringify({ cmd })
  });
}
export function attachStream(sandboxId, onMessage) {
  const ev = new EventSource(`/api/sandbox/${sandboxId}/stream`);
  ev.onmessage = e => onMessage(JSON.parse(e.data));
  return () => ev.close();
}
```
The editor UI can call `writeFile` on each save, and the **Agent** (via the `useAI` context) can call `execCmd` to run generated code automatically.

---

## 4. Agent‑Side Enhancements

| Feature | How the Agent would use it | Implementation hint |
|--------|--------------------------|---------------------|
| **`workspace.createFolder(path)`** | When the Agent decides it needs a module folder, it invokes the API → sandbox → creates a folder inside the container. | Add a new endpoint `POST /sandbox/:id/mkdir`. |
| **`workspace.runCommand(command, cwd?)`** | The Agent can compile, lint, test, or run a script and then read the output. | `execCmd` returns a job‑id; use the stream to collect logs. |
| **`workspace.listFiles(pattern?)`** | Allows the Agent to discover existing files, useful for refactoring. | Provide a `GET /sandbox/:id/list?glob=**/*.py`. |
| **`workspace.installDeps(deps)`** | Example: `pip install -r requirements.txt` – the Agent can trigger a dependency install. | Expose a generic `exec` endpoint; the Agent can pass `["pip","install","-r","requirements.txt"]`. |

These functions should be wrapped in a **`sandboxClient`** module used by the Agent’s prompt chain (the same way `useAI` provides `activeSpace`). The client can be injected into the prompt system so the LLM can “reason” about file‑system state.

---

## 5. Incremental Migration Path

| Phase | Deliverable | Approx. effort |
|------|--------------|----------------|
| **0 – Baseline** | Existing `AgentCanvas` (already in repo). | – |
| **1 – UI Refactor** | Replace Code tab with a two‑pane layout (Tree + Monaco). | 1–2 days (install monaco, build tree component). |
| **2 – Virtual FS** | Introduce a global `workspace` store mirroring files on the front‑end. | 1 day (zustand + helper functions). |
| **3 – Backend Stub** | Add simple in‑memory sandbox API (Express/FastAPI) that stores files in a map and echoes exec commands (no real container). | 2 days – lets the front‑end and Agent code be written and tested. |
| **4 – Cloud‑Run Sandbox** | Deploy the full sandbox service (Docker‑in‑Docker) to Cloud Run, add auth & streaming. | 3–5 days (container image, IAM, Firestore for state, websockets). |
| **5 – Agent Integration** | Extend the Agent prompt chain to call `workspace.*` functions via the new client. | 1 day (add to `useAI` / prompt executor). |
| **6 – Polish** | Add “Run”, “Terminal”, “Git‑like commit”, error handling, UI theming (dark mode, accent colors). | 2–3 days. |
| **7 – Optional** | **Live debugging** – attach a remote VS Code server inside the sandbox and forward it via an iframe. | Longer term (requires OAuth, port‑forwarding). |

---

## 6. Security & Operational Considerations

1. **Isolation** – Each sandbox must run with **no root privileges** and with a **read‑only root filesystem** (only the tmpfs volume is writable). 
2. **Resource Limits** – Set CPU/memory caps (e.g., 1 vCPU, 512 MiB) in the Cloud Run service to avoid runaway processes.
3. **Network Egress** – Disable outbound internet unless explicitly needed (e.g., `pip install`).
4. **File‑Size Quotas** – Enforce a max total size (e.g., 20 MiB) to protect the host.
5. **Audit Logging** – Log every `writeFile` / `execCmd` request with the user id for compliance.

---

## 7. Rough Code Sketch (File‑Tree + Editor)

```tsx
// FileTree.tsx
import { Tree } from 'rc-tree';
export default function FileTree({ files, onSelect }) {
  const treeData = files.map(f => ({
    key: f.path,
    title: f.path.split('/').pop(),
    isLeaf: !f.isDirectory,
    children: [] // build recursively if you need directories
  }));
  return <Tree treeData={treeData} onSelect={(_, node) => onSelect(node.key as string)} />;
}

// EditorPane.tsx
export default function EditorPane({ file, onSave }) {
  const [value, setValue] = useState(file?.content ?? '');
  useEffect(() => setValue(file?.content ?? ''), [file?.path]);

  const handleSave = () => onSave(file.path, value);
  return (
    <div className="relative flex-1">
      <MonacoEditor
        language={file?.language ?? 'plaintext'}
        value={value}
        onChange={setValue}
        options={{ automaticLayout: true }}
      />
      <button
        onClick={handleSave}
        className="absolute bottom-2 right-2 bg-[var(--accent)] text-white px-3 py-1 rounded"
      >
        Save
      </button>
    </div>
  );
}
```

**Wire‑up in `AgentCanvas` (simplified)**
```tsx
const [workspaceFiles, setWorkspaceFiles] = useState<FileNode[]>(initialFiles);
const selectedFile = workspaceFiles.find(f => f.path === selectedId);

const handleSave = async (path: string, content: string) => {
  // UI state update
  setWorkspaceFiles(prev =>
    prev.map(f => (f.path === path ? { ...f, content } : f))
  );
  // Persist to sandbox (if live)
  await writeFile(sandboxId, path, content);
};

<FileTree files={workspaceFiles} onSelect={setSelectedId} />
<EditorPane file={selectedFile} onSave={handleSave} />
```

---

## 8. What to Prioritize for a “Premium‑Tier” Feel

1. **Monaco editor with IntelliSense** – add language‑specific workers (JS/TS, Python) so the Agent can get auto‑completion and syntax highlighting.
2. **Responsive split‑view** – allow the user to resize the tree / editor panes.
3. **Live terminal** – embed a small terminal component that streams the sandbox’s stdout/stderr (e.g., `xterm.js`).
4. **Fast file operations** – batch updates (debounce saves) to avoid hammering the sandbox API.
5. **Polished animations** – keep the existing `animate-in` transitions but add subtle hover/focus states for the tree nodes and editor toolbar.

---

**Next Steps**
1. Add this `IDE_Roadmap.md` file to the repository.
2. Begin Phase 1 by integrating Monaco and a tree component.
3. Parallel‑track the sandbox service prototype (Phase 3).

Feel free to ask for deeper details on any specific phase (e.g., Cloud‑Run Docker‑in‑Docker setup, Zustand workspace store, or the Monaco configuration).
