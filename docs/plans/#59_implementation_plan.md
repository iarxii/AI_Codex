# Workspace Path Standardization & Web Client Canvas/Performance Fix

## Goal

Fix three interconnected issues on the **web client** and its **shared backend services**:

1. **Backend path drift** — `save_scratchpad_file` in `storage.py` resolves workspace paths relative to the process's CWD (`os.path.join("data", "workspaces", ...)`). In contrast, `workspace.py`, `workspace_reader.py`, `workspace_patcher.py`, and `shell_exec.py` resolve paths relative to their own `__file__` locations. When the backend is started from a different directory than the project root (e.g., Cloud Run's `/app` vs local dev), these two strategies can point to **different physical directories**, causing files saved by the agent to be invisible to the workspace API, and vice versa.

2. **Web client loading waterfall** — `loadConversation` in `Chat.tsx` fetches chat history, waits for it to complete, then sequentially fetches workspace files. This serial waterfall adds unnecessary delay when opening a workspace.

3. **Canvas "View in Canvas" button shows nothing** — Message text contains `[CANVAS:code:filename.py]` which gets parsed into an artifact ID like `code-filename-py`. But files loaded from disk get IDs like `fs-filename-py`. The `AgentCanvas` does a strict `===` lookup and finds no match, so the canvas opens blank.

---

## Scope Guardrails

> [!IMPORTANT]
> **What this plan does NOT touch:**
>
> | Component | Why untouched |
> |---|---|
> | `vscode-extension/` (VSCodex) | All tool calling, `client_tool_call` delegation, `ChatViewProvider.ts` streaming, SCM handlers — completely untouched. The VSCodex extension has its own tool execution pipeline that is independent. |
> | AIDock client | Not a focus for integration. The `client_type: "aidock"` routing in `tools.py` and `nodes.py` is not modified. |
> | AIDroid client | Not a focus for integration. No files exist for this client yet. |
> | `backend/agent/tools.py` | The tool registry, client capability matrix (`FILESYSTEM_TOOLS`, `can_delegate`), and `get_agent_tools()` routing are not modified. |
> | `backend/agent/nodes.py` | The `get_dynamic_llm()` factory, `reason_node`, `execute_tool_node`, tool binding logic, and `client_type` short-process heuristics are all untouched. |
> | `backend/api/chat.py` | WebSocket handler, streaming pipeline — untouched. |
> | LLM provider routing | `models.py`, `genai_llm.py` — untouched by this plan. |

---

## What the Path Standardization Actually Changes (and Doesn't)

> [!NOTE]
> **Before:** Seven backend files each independently compute workspace paths using either `os.path.join("data", ...)` (CWD-relative) or `Path(__file__).resolve().parents[N]` (file-relative). Both strategies produce the same result **only when** the process CWD equals the project root. On Cloud Run, the entrypoint may `cd /app` before starting uvicorn, but some modules assume the CWD is the repo root — this is where drift occurs.
>
> **After:** `backend/config.py` defines `PROJECT_ROOT`, `DATA_DIR`, and `WORKSPACES_DIR` as constants computed once at import time from `Path(__file__).resolve().parent.parent`. Every module that needs a workspace path imports these constants instead of recomputing. The **actual directory structure does not change** — same `data/workspaces/{id}/scratch/` layout. Only the resolution strategy is unified.

**Implications:**
- **Zero impact on API contracts** — no request/response schemas change.
- **Zero impact on tool calling** — the tool functions (`workspace_writer`, `workspace_patcher`, etc.) still receive `conversation_id` and resolve to the same `data/workspaces/{id}/scratch/` directory. They just use an absolute import instead of relative path math.
- **Zero impact on GCS sync** — `storage.py` still syncs to `workspaces/{session_id}/scratch/` in GCS. Only the local path resolution changes.
- **Fixes Cloud Run drift** — In production, the agent writes a file via `save_scratchpad_file` → the workspace API can now always find it, because both resolve to the same absolute path.

---

## Proposed Changes

### Component: Backend Configuration (Shared Foundation)

#### [MODIFY] [config.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/config.py)

Replace the CWD-relative `DATA_DIR = Path("./data")` with absolute constants:

```diff
-# Ensure data directory exists
-DATA_DIR = Path("./data")
-DATA_DIR.mkdir(parents=True, exist_ok=True)
-UPLOAD_DIR = DATA_DIR / "uploads"
-UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
+# ── Canonical Directory Constants ──
+# All workspace/data paths in the project MUST import from here.
+# Resolved once at import time from config.py's location (backend/config.py → project root).
+PROJECT_ROOT = Path(__file__).resolve().parent.parent
+DATA_DIR = PROJECT_ROOT / "data"
+DATA_DIR.mkdir(parents=True, exist_ok=True)
+UPLOAD_DIR = DATA_DIR / "uploads"
+UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
+WORKSPACES_DIR = DATA_DIR / "workspaces"
+WORKSPACES_DIR.mkdir(parents=True, exist_ok=True)
```

---

### Component: Backend Modules (Consumers of Path Constants)

Each of these files gets a **one-line import change** and a **one-line path resolution change**. No logic, tool behavior, or API contracts are altered.

#### [MODIFY] [storage.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/utils/storage.py)

```diff
-    workspace_dir = os.path.abspath(os.path.join("data", "workspaces", session_id, "scratch"))
+    from backend.config import WORKSPACES_DIR
+    workspace_dir = str((WORKSPACES_DIR / session_id / "scratch").resolve())
```

#### [MODIFY] [workspace.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/workspace.py)

```diff
+from backend.config import WORKSPACES_DIR
+
 def _get_workspace_root(conversation_id: str) -> Path:
-    root = Path(__file__).resolve().parents[2]
-    return (root / "data" / "workspaces" / str(conversation_id) / "scratch").resolve()
+    return (WORKSPACES_DIR / str(conversation_id) / "scratch").resolve()
```

#### [MODIFY] [admin_ops.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/utils/admin_ops.py)

```diff
+from backend.config import WORKSPACES_DIR, DATA_DIR
+
 def generate_global_knowledge_map():
-    workspaces_root = Path("data/workspaces")
-    output_dir = Path("data/admin/global-graph")
+    workspaces_root = WORKSPACES_DIR
+    output_dir = DATA_DIR / "admin" / "global-graph"
```

#### [MODIFY] [workspace_reader.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/builtin/workspace_reader.py)

```diff
+from backend.config import PROJECT_ROOT, WORKSPACES_DIR
+
     def _get_abs_path(self, rel_path: str, conversation_id: Optional[str] = None) -> Path:
-        root = Path(__file__).resolve().parents[3]
         if conversation_id:
-            base_dir = (root / "data" / "workspaces" / conversation_id / "scratch").resolve()
+            base_dir = (WORKSPACES_DIR / conversation_id / "scratch").resolve()
         else:
-            base_dir = root.resolve()
+            base_dir = PROJECT_ROOT.resolve()
```

#### [MODIFY] [workspace_patcher.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/builtin/workspace_patcher.py)

```diff
-            from pathlib import Path
-            root = Path(__file__).resolve().parents[3]
+            from backend.config import PROJECT_ROOT, WORKSPACES_DIR
             if conversation_id:
-                base_dir = (root / "data" / "workspaces" / conversation_id / "scratch").resolve()
+                base_dir = (WORKSPACES_DIR / conversation_id / "scratch").resolve()
             else:
-                base_dir = root.resolve()
+                base_dir = PROJECT_ROOT.resolve()
```

#### [MODIFY] [shell_exec.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/builtin/shell_exec.py)

```diff
-            root = Path(__file__).resolve().parents[3]
+            from backend.config import PROJECT_ROOT, WORKSPACES_DIR
             if conversation_id:
-                base_dir = (root / "data" / "workspaces" / conversation_id / "scratch").resolve()
+                base_dir = (WORKSPACES_DIR / conversation_id / "scratch").resolve()
             else:
-                base_dir = root.resolve()
+                base_dir = PROJECT_ROOT.resolve()
```

#### [MODIFY] [graphify_skill.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/builtin/graphify_skill.py)

```diff
+        from backend.config import WORKSPACES_DIR
-        workspace_dir = Path(f"data/workspaces/{conversation_id}/scratch")
-        output_dir = Path(f"data/workspaces/{conversation_id}/graphify-out")
+        workspace_dir = WORKSPACES_DIR / conversation_id / "scratch"
+        output_dir = WORKSPACES_DIR / conversation_id / "graphify-out"
```

#### [MODIFY] [workspace_sentinel.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/workspace_sentinel.py)

```diff
+from backend.config import WORKSPACES_DIR
+
 def get_status_file(conversation_id: str) -> Path:
-    return Path(f"./data/workspaces/{conversation_id}/workspace_status.md")
+    return WORKSPACES_DIR / conversation_id / "workspace_status.md"
```

#### [MODIFY] [main.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/main.py)

```diff
+from backend.config import settings, DATA_DIR, WORKSPACES_DIR
+
-admin_graph_dir = Path("data/admin/global-graph")
+admin_graph_dir = DATA_DIR / "admin" / "global-graph"

-    path = Path(f"data/workspaces/{session_id}/graphify-out/graph.html")
+    path = WORKSPACES_DIR / session_id / "graphify-out" / "graph.html"

-Path("data/workspaces").mkdir(parents=True, exist_ok=True)
-app.mount("/graph", StaticFiles(directory="data/workspaces", html=True), name="workspace-graphs")
+app.mount("/graph", StaticFiles(directory=str(WORKSPACES_DIR), html=True), name="workspace-graphs")
```

---

### Component: Web Client — Performance Fix (Chat.tsx)

#### [MODIFY] [Chat.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/Chat.tsx)

**Change 1: Parallelize `loadConversation`** — Fire both the conversation history fetch and workspace files fetch simultaneously using `Promise.all`:

```diff
  const loadConversation = async (id: number) => {
    // ...
    try {
      const baseUrl = getApiUrl(isPremiumSpace);
+     const headers = {
+       'Authorization': `Bearer ${localStorage.getItem('token')}`,
+       ...(isPremiumSpace && config.COLAB_SECRET ? { 'X-Codex-Premium-Key': config.COLAB_SECRET } : {})
+     };
+
+     // Fire both requests in parallel — eliminates sequential waterfall
+     const [response, filesResponse] = await Promise.all([
+       fetch(`${baseUrl}${config.API_V1_STR}/conversations/${id}`, { headers }),
+       fetch(`${baseUrl}${config.API_V1_STR}/workspace/${id}/files`, { headers }).catch(() => null)
+     ]);
-     const response = await fetch(`${baseUrl}${config.API_V1_STR}/conversations/${id}`, { headers });
      if (response.ok) {
        const data = await response.json();
        // ... set messages, parse metadata (unchanged) ...

-       // Load actual files from workspace disk to replace/augment parsed artifacts
-       await loadWorkspaceFiles(id);
+       // Process workspace files from the parallel response
+       let diskFiles: Artifact[] = [];
+       if (filesResponse?.ok) {
+         const files = await filesResponse.json();
+         diskFiles = files.map((file: any) => ({ /* existing mapping logic */ }));
+       }

        // Parse artifacts from history
        const allArtifacts: Artifact[] = [];
        // ... existing parsing loop (unchanged) ...

-       setArtifacts(prev => { /* old merge */ });
+       // Merge: disk files are source of truth, parsed artifacts fill gaps
+       setArtifacts(() => {
+         const merged = [...diskFiles];
+         allArtifacts.forEach(parsed => {
+           if (!merged.find(a => (a.filePath || a.title) === (parsed.filePath || parsed.title))) {
+             merged.push(parsed);
+           }
+         });
+         return merged;
+       });
```

**Change 2: Fix `loadWorkspaceFiles` to merge instead of overwrite** — Preserve non-file artifacts (research text blocks, conversation-parsed docs) when refreshing workspace files:

```diff
  const loadWorkspaceFiles = async (id: number) => {
    // ... fetch logic unchanged ...
-       setArtifacts(mappedArtifacts);
+       setArtifacts(prev => {
+         const merged = [...mappedArtifacts];
+         prev.forEach(art => {
+           if (!art.filePath && !merged.find(m => m.id === art.id || m.title === art.title)) {
+             merged.push(art);
+           }
+         });
+         return merged;
+       });
```

---

### Component: Web Client — Canvas ID Normalization (AgentCanvas.tsx)

#### [MODIFY] [AgentCanvas.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/AgentCanvas.tsx)

Add a fuzzy fallback when the exact `externalSelectedId` doesn't match any artifact. This handles the `code-filename-py` → `fs-filename-py` mismatch:

```diff
  useEffect(() => {
    if (externalSelectedId) {
      let art = artifacts.find(a => a.id === externalSelectedId);
+
+     // Fuzzy fallback: strip type prefixes (code-, docs-, fs-) and normalize
+     // to match across message-parsed IDs and filesystem-derived IDs
+     if (!art) {
+       const normalize = (s: string) =>
+         s.replace(/^(code|docs|doc|research|fs)-/, '').toLowerCase().replace(/[/\\._\-]/g, '');
+       const target = normalize(externalSelectedId);
+       art = artifacts.find(a =>
+         normalize(a.id) === target ||
+         (a.filePath && normalize(a.filePath) === target) ||
+         (a.title && normalize(a.title) === target)
+       );
+     }

      if (art) {
        setSelectedId(art.id);
        // ... tab switching (unchanged)
      }
    }
  }, [externalSelectedId, artifacts]);
```

---

## Verification Plan

### Automated
- `python -c "from backend.config import PROJECT_ROOT, DATA_DIR, WORKSPACES_DIR; print(PROJECT_ROOT, DATA_DIR, WORKSPACES_DIR)"` — verify constants resolve correctly.
- `python -c "import backend.utils.storage; import backend.api.workspace; import backend.utils.admin_ops"` — verify imports don't break.
- `npm run build` in `client/` — verify TypeScript compiles.

### Manual
1. Open a workspace in the web app → verify history and files load simultaneously (check network waterfall in devtools).
2. Ask the agent to generate a code file → verify "View in Canvas" button opens the correct artifact instead of a blank tab.
