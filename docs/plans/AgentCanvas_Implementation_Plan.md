# AgentCanvas IDE Upgrade – First Iteration Plan

**Location:** `docs/plans/AgentCanvas_Implementation_Plan.md`

> **⚠️ Superseded — historical draft, not the implemented design.**
> This was an early architecture sketch proposing a `zustand` workspace store, `rc-tree` file explorer, `xterm.js` terminal, and a dedicated `/api/sandbox/:id/...` REST surface. **None of these were built.** The actual implementation (see [`docs/plans/#78_implementation_plan.md`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/docs/plans/%2378_implementation_plan.md)) instead:
> - Uses plain React `useState` in [`AgentCanvas.tsx`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/AgentCanvas.tsx) — no global store, no `localStorage` persistence.
> - Renders the file tree with a hand-rolled recursive component in [`ModuleTree.tsx`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/canvas/ModuleTree.tsx) — no `rc-tree` dependency was added.
> - Uses `@monaco-editor/react` directly in [`CodeEditorPane.tsx`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/canvas/CodeEditorPane.tsx) (matches this doc's editor choice, but without the tabs-for-recent-files feature).
> - Renders execution output with a plain `<pre>` log list in [`TerminalConsole.tsx`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/canvas/TerminalConsole.tsx) — no `xterm.js`, no streaming.
> - Calls the existing `POST /api/v1/skills/shell_exec/test` REST endpoint directly for Run — no new `/sandbox/*` API was added to the backend.
> - File CRUD reuses the existing `POST /workspace/{id}/file|folder|delete` endpoints plus one new `POST /workspace/{id}/rename` endpoint — no Cloud-Run sandbox service, Firestore/Redis sandbox registry, or WebSocket log streaming was implemented.
>
> Keep this document for historical context on alternatives considered; refer to `#78_implementation_plan.md` for what actually shipped.

---

## 1. Goal
Transform the existing `AgentCanvas` component into a premium‑tier, IDE‑style experience that offers:
* A **file explorer tree** on the left.
* A **full‑featured Monaco code editor** on the right.
* Seamless **virtual workspace** state that mirrors a Cloud‑Run sandbox.
* CRUD operations (create/delete/rename files & folders) exposed to the Agent.
* A **terminal pane** that streams sandbox stdout/stderr.

## 2. High‑Level Architecture
```
[AgentCanvas] (UI) ──> WorkspaceProvider (zustand) ──> SandboxClient (REST/WS) ──> Cloud‑Run Sandbox Service
```
* **WorkspaceProvider** keeps an in‑memory representation of all files/folders (`{path, content, language, type}`) and synchronises changes to the sandbox.
* **SandboxClient** is a thin wrapper around the HTTP API (`/api/sandbox/:id/...`). It provides:
  - `writeFile(path, content)`
  - `readFile(path)`
  - `execCommand(cmd, cwd?)`
  - `createFolder(path)`
  - `deletePath(path)`
  - `streamLogs(callback)` (via SSE).
* **FileTree** renders the workspace hierarchy using `rc-tree`.
* **EditorPane** uses `react‑monaco-editor` with language workers for IntelliSense.
* **TerminalPane** displays streamed logs using `xterm.js`.

---

## 3. Implementation Tasks (First Iteration)
| # | Description | File(s) | Owner/Notes |
|---|-------------|----------|-------------|
| 1 | Add `zustand` workspace store (`useWorkspaceStore`). | `src/contexts/WorkspaceContext.ts` | Global, serialisable, persistent in `localStorage` for dev.
| 2 | Implement `SandboxClient` utilities. | `src/services/sandbox.ts` | Simple `fetch` + `EventSource` wrapper.
| 3 | Build **FileTree** component. | `src/components/FileTree.tsx` | Uses `rc-tree`; supports `onSelect`, `onCreateFile`, `onCreateFolder`, `onDelete`.
| 4 | Build **EditorPane** component with Monaco. | `src/components/EditorPane.tsx` | Handles change, save (calls workspace store + sandbox client).
| 5 | Build **TerminalPane** component using `xterm.js`. | `src/components/TerminalPane.tsx` | Subscribes to sandbox log stream.
| 6 | Refactor **AgentCanvas** to a thin layout wrapper that composes the above pieces. | `src/components/AgentCanvas.tsx` (major sections rewritten) |
| 7 | Add toolbar actions (Run, Commit, Open Sandbox). | `src/components/AgentCanvasToolbar.tsx` | Buttons that call `execCommand` and versioning stub.
| 8 | Update typings (`Artifact` → `WorkspaceFile`). | `src/types/workspace.ts` | New interface.
| 9 | Wire up authentication headers for sandbox calls (reuse existing token logic). | `src/services/sandbox.ts` |
|10| Write unit tests for workspace store & sandbox client. | `src/__tests__/workspace.*` |

### Estimated Time
* **Day 1** – Tasks 1‑3 (store, client, file tree).  ~4 h.
* **Day 2** – Tasks 4‑6 (editor, terminal, canvas refactor). ~6 h.
* **Day 3** – Tasks 7‑10 (toolbar, typings, auth, tests). ~4 h.

---

## 4. Detailed Code Sketches (First Iteration)
### 4.1 Workspace Store (`WorkspaceContext.ts`)
```ts
import create from 'zustand';
import { persist } from 'zustand/middleware';

export interface WorkspaceFile {
  path: string;          // e.g. "src/main.py"
  content: string;      // file contents
  language?: string;     // inferred from extension
  type: 'code' | 'docs' | 'research';
  isDirectory?: boolean; // true for folder nodes
}

export type WorkspaceState = {
  files: WorkspaceFile[];
  setFiles: (files: WorkspaceFile[]) => void;
  updateFile: (path: string, content: string) => void;
  deletePath: (path: string) => void;
  createFile: (path: string, language?: string) => void;
  createFolder: (path: string) => void;
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      files: [],
      setFiles: (files) => set({ files }),
      updateFile: (path, content) =>
        set((s) => ({
          files: s.files.map((f) => (f.path === path ? { ...f, content } : f)),
        })),
      deletePath: (path) =>
        set((s) => ({
          files: s.files.filter((f) => !f.path.startsWith(path)),
        })),
      createFile: (path, language = 'plaintext') =>
        set((s) => ({
          files: [...s.files, { path, content: '', language, type: 'code' }],
        })),
      createFolder: (path) =>
        set((s) => ({
          files: [...s.files, { path, content: '', type: 'code', isDirectory: true }],
        })),
    }),
    { name: 'workspace-store' }
  )
);
```
*Persisted to `localStorage` for rapid dev; production can swap to a backend sync.

---
### 4.2 Sandbox Client (`sandbox.ts`)
```ts
const API_BASE = (isPremium: boolean) => {
  const base = getApiUrl(isPremium);
  return `${base}${config.API_V1_STR}/sandbox`;
};

function authHeaders() {
  const token = localStorage.getItem('token');
  const hdr: Record<string, string> = { Authorization: `Bearer ${token}` };
  // Premium key injection if needed – same logic as existing calls
  const isPremium = Boolean(localStorage.getItem('isPremium'));
  if (isPremium && config.COLAB_SECRET) {
    hdr['X-Codex-Premium-Key'] = config.COLAB_SECRET;
  }
  return hdr;
}

export async function writeFile(sandboxId: string, path: string, content: string) {
  return fetch(`${API_BASE(false)}/${sandboxId}/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ path, content }),
  }).then((r) => r.json());
}

export async function readFile(sandboxId: string, path: string) {
  return fetch(`${API_BASE(false)}/${sandboxId}/read?path=${encodeURIComponent(path)}`, {
    headers: authHeaders(),
  }).then((r) => r.json());
}

export async function execCommand(
  sandboxId: string,
  cmd: string[],
  cwd?: string
) {
  return fetch(`${API_BASE(false)}/${sandboxId}/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ cmd, cwd }),
  }).then((r) => r.json());
}

export function streamLogs(
  sandboxId: string,
  onMessage: (msg: { type: string; data: string }) => void
) {
  const ev = new EventSource(`${API_BASE(false)}/${sandboxId}/stream`);
  ev.onmessage = (e) => onMessage(JSON.parse(e.data));
  ev.onerror = () => ev.close();
  return () => ev.close();
}
```
*Wraps the future Cloud‑Run sandbox endpoints.

---
### 4.3 FileTree Component (`FileTree.tsx`)
```tsx
import React from 'react';
import { Tree } from 'rc-tree';
import { WorkspaceFile } from '../contexts/WorkspaceContext';

interface Props {
  files: WorkspaceFile[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onCreateFile: (parent: string) => void;
  onCreateFolder: (parent: string) => void;
  onDelete: (path: string) => void;
}

export const FileTree: React.FC<Props> = ({
  files,
  selectedPath,
  onSelect,
  onCreateFile,
  onCreateFolder,
  onDelete,
}) => {
  // Convert flat list → tree nodes
  const buildTree = () => {
    const nodeMap: Record<string, any> = {};
    const roots: any[] = [];
    files.forEach((f) => {
      const parts = f.path.split('/');
      const name = parts.pop()!;
      const parentPath = parts.join('/');
      const key = f.path;
      const node = {
        key,
        title: name,
        isLeaf: !f.isDirectory,
        children: [],
      };
      nodeMap[key] = node;
      if (parentPath) {
        const parentNode = nodeMap[parentPath] || { children: [] };
        parentNode.children = parentNode.children || [];
        parentNode.children.push(node);
        nodeMap[parentPath] = parentNode;
      } else {
        roots.push(node);
      }
    });
    return roots;
  };

  const treeData = buildTree();

  return (
    <Tree
      treeData={treeData}
      selectedKeys={selectedPath ? [selectedPath] : []}
      onSelect={(_, info) => onSelect(info.node.key)}
      // Context menu placeholder – can be replaced with a proper UI later
      titleRender={(node) => (
        <div className="flex items-center justify-between">
          <span>{node.title}</span>
          <div className="space-x-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateFile(node.key);
              }}
              className="text-xs text-gray-500 hover:text-gray-800"
            >
              +File
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateFolder(node.key);
              }}
              className="text-xs text-gray-500 hover:text-gray-800"
            >
              +Folder
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.key);
              }}
              className="text-xs text-red-500 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    />
  );
};
```
*Provides basic CRUD actions via inline buttons (can be replaced by a right‑click context menu later).

---
### 4.4 EditorPane (`EditorPane.tsx`)
```tsx
import React, { useEffect, useState } from 'react';
import MonacoEditor from 'react-monaco-editor';
import { WorkspaceFile } from '../contexts/WorkspaceContext';
import { useWorkspaceStore } from '../contexts/WorkspaceContext';
import { writeFile as sandboxWrite } from '../services/sandbox';

interface Props {
  file: WorkspaceFile | undefined;
  sandboxId: string;
}

export const EditorPane: React.FC<Props> = ({ file, sandboxId }) => {
  const [value, setValue] = useState<string>(file?.content ?? '');
  const updateFile = useWorkspaceStore((s) => s.updateFile);

  useEffect(() => {
    setValue(file?.content ?? '');
  }, [file?.path]);

  const handleSave = async () => {
    if (!file) return;
    updateFile(file.path, value);
    await sandboxWrite(sandboxId, file.path, value);
  };

  const language = file?.language ?? 'plaintext';

  return (
    <div className="relative h-full flex-1">
      <MonacoEditor
        language={language}
        value={value}
        onChange={setValue}
        options={{ automaticLayout: true, scrollBeyondLastLine: false }}
      />
      <button
        onClick={handleSave}
        className="absolute bottom-2 right-2 bg-[var(--accent)] text-white px-3 py-1 rounded"
      >
        Save
      </button>
    </div>
  );
};
```
---
### 4.5 TerminalPane (`TerminalPane.tsx`)
```tsx
import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import { streamLogs } from '../services/sandbox';

interface Props {
  sandboxId: string;
}

export const TerminalPane: React.FC<Props> = ({ sandboxId }) => {
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!termRef.current) return;
    const term = new Terminal({
      rows: 15,
      theme: { background: 'var(--bg-surface)' },
    });
    term.open(termRef.current);
    const stop = streamLogs(sandboxId, (msg) => {
      if (msg.type === 'stdout') term.write(msg.data);
      else if (msg.type === 'stderr') term.write(`\r\n${msg.data}`);
    });
    return () => {
      stop();
      term.dispose();
    };
  }, [sandboxId]);

  return <div ref={termRef} className="w-full h-40 bg-black" />;
};
```
---
### 4.6 Refactored AgentCanvas (`AgentCanvas.tsx`)
We keep the surrounding header/footer unchanged and replace the content area when `activeTab === 'Code'` with a **split view**:
```tsx
// Inside the render function, after the tab bar
{activeTab === 'Code' ? (
  <div className="flex flex-1 overflow-hidden">
    {/* Left – File tree */}
    <div className="w-64 border-r border-black/[0.04] bg-black/[0.01] overflow-y-auto">
      <FileTree
        files={workspaceFiles}
        selectedPath={selectedId}
        onSelect={setSelectedId}
        onCreateFile={(parent) => {
          const name = prompt('New file name (with extension)');
          if (!name) return;
          const path = parent ? `${parent}/${name}` : name;
          createFile(path);
        }}
        onCreateFolder={(parent) => {
          const name = prompt('New folder name');
          if (!name) return;
          const path = parent ? `${parent}/${name}` : name;
          createFolder(path);
        }}
        onDelete={(path) => {
          if (confirm(`Delete ${path}?`)) deletePath(path);
        }}
      />
    </div>
    {/* Right – Editor */}
    <div className="flex flex-col flex-1 overflow-hidden">
      <EditorPane file={selectedFile} sandboxId={String(conversationId)} />
      <TerminalPane sandboxId={String(conversationId)} />
    </div>
  </div>
) : (
  /* existing Graph / Docs / Research rendering stays the same */
  ...
)}
```
*All CRUD actions call the workspace store, which in turn synchronises to the sandbox via the client functions (`writeFile`, `createFolder`, `deletePath`).

---

## 5. Next Steps After First Iteration
1. **Backend sandbox service** – spin up a Cloud‑Run container that implements the API used above.
2. **Authentication hardening** – integrate with existing JWT handling.
3. **Version control** – add a simple commit API (store snapshots in Firestore).
4. **Testing** – Cypress end‑to‑end tests for file creation, edit‑save, and terminal output.
5. **Polish UI** – add drag‑to‑resize splitter, better icons, and dark‑mode token support.

---

*All of the above is captured in this plan document, which will be kept up‑to‑date as implementation progresses.*
