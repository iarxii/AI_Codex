# Fix Graph Viewers & Enhance Agent Canvas for Multi-Modular Artifact Support

Two interconnected issues need addressing: the graph viewers returning 404 errors, and the Agent Canvas lacking awareness of multi-file tool outputs and their relationships.

## Problem Analysis

### Issue 1: Graph Viewers → `detail: "Not Found"`
The `GraphView` component constructs iframe URLs like `http://localhost:9000/admin/graph/graph.html` and `/graph/{id}/graph.html`. However, **no static file mounts exist in `main.py`** for these paths, and **no graph data has been generated yet** (the `graphify_skill.py` backend hasn't been implemented). The iframe hits the FastAPI catch-all and returns a JSON 404.

**Root Cause**: The frontend was wired before the backend was ready. The GraphView must gracefully handle the "no graph yet" state.

### Issue 2: Agent Canvas Cannot Visualize Multi-Modular Creations
When the agent calls `workspace_writer` multiple times (e.g., creating `graphify_skill.py`, `admin_ops.py`, `GraphView.tsx`, and `AdminOverview.tsx` in one session), the Canvas treats each as an isolated artifact. There is:
- No concept of a **module** or **session batch** grouping related files.
- No visual indicator of **relationships** between files (e.g., `GraphView.tsx` imports from `config.ts`; `AdminOverview.tsx` uses `GraphView`).
- No **"All Files"** overview that shows the full workspace footprint.

**Root Cause**: The `Artifact` type is flat — it has `id`, `type`, `title`, `content`, and `language`, but no `module`, `parentId`, or `dependencies` fields. The Canvas renders individual files with no grouping semantics.

---

## User Review Required

> [!IMPORTANT]
> **Breaking Change to `Artifact` Type**: Adding `module` and `dependencies` fields to the `Artifact` interface will require updates to every artifact producer (the `parseArtifacts` function, the `workspace_writer` extraction in `Chat.tsx`, and history re-parsing in `loadConversation`). This is backward-compatible (new fields are optional), but I want to confirm the approach before touching the core type.

> [!IMPORTANT]
> **Graph Tab Behavior Before Backend**: Until `graphify_skill.py` and the static mounts are implemented, the Graph tab will show a "No Graph Available" placeholder instead of an error JSON. Do you want me to also implement the backend `main.py` static mounts now, or defer that to the next phase?

---

## Proposed Changes

### Phase 1: Fix Graph Viewer Error State

#### [MODIFY] [GraphView.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/canvas/GraphView.tsx)
- Replace the raw iframe with a **connection-aware** wrapper that:
  1. `fetch()`s the graph URL with `HEAD` request first.
  2. If `404` or unreachable → render a styled "Graph Not Generated Yet" placeholder with instructions.
  3. If `200` → render the iframe as before.
- Add a **manual refresh** button and a **"Generate Now"** CTA (which will later call the graphify API endpoint).

#### [MODIFY] [AdminOverview.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/AdminOverview.tsx)
- Replace hardcoded stats with a "Awaiting Data" state when the global graph isn't available.
- Add a **live workspace directory listing** that fetches actual workspace IDs from the backend.

---

### Phase 2: Enhance Artifact Type for Multi-Modular Support

#### [MODIFY] [chat.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/types/chat.ts)
Add optional fields to the `Artifact` interface:
```typescript
export interface Artifact {
  id: string;
  type: 'code' | 'docs' | 'research';
  title: string;
  content: string;
  language?: string;
  timestamp: number;
  messageId?: string;
  // NEW: Multi-modular support
  module?: string;        // e.g., "graphify-integration" — groups related files
  filePath?: string;      // e.g., "backend/skills/builtin/graphify_skill.py"
  dependencies?: string[]; // IDs of other artifacts this one references
}
```

---

### Phase 3: Upgrade Artifact Extraction Pipeline

#### [MODIFY] [Chat.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/Chat.tsx) — Lines 312-334
Update the `workspace_writer` tool call extraction to:
1. **Extract `filePath`** from the `filename` arg (preserving directory structure like `backend/skills/graphify_skill.py`).
2. **Auto-detect `module`** by grouping consecutive `workspace_writer` calls from the same `messageId` under a shared module name (derived from the agent's response context).
3. **Infer `dependencies`** heuristically: scan artifact content for `import` / `from ... import` statements that match titles of other artifacts in the same batch.

#### [MODIFY] [artifactParser.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/utils/artifactParser.ts)
- Extend the `[CANVAS:...]` tag format to optionally accept module and path:
  `[CANVAS:CODE:main.py:python:backend/skills]` → adds `filePath` context.
- The fallback code-block parser already works for individual blocks; no changes needed there.

---

### Phase 4: Redesign Agent Canvas for Multi-Artifact Awareness

#### [MODIFY] [AgentCanvas.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/AgentCanvas.tsx)
Major refactor of the content area:

1. **Module Sidebar** (when multiple files exist):
   - A collapsible tree view grouped by `module` (or by directory path).
   - Each node shows the file icon, name, and type badge.
   - Clicking a file selects it for the detail pane.

2. **Dependency Minimap** (bottom of canvas):
   - A small SVG showing edges between related artifacts (using the `dependencies` field).
   - Hovering an edge highlights both source and target in the tree.

3. **"All Files" Tab** (replaces the flat artifact list):
   - Table/grid view with columns: File, Type, Module, Size, Dependencies.
   - Sortable and filterable.

4. **Preserved Existing Behavior**:
   - Single artifacts still render identically via `ArtifactView`.
   - The Graph tab remains unchanged.

#### [NEW] [ModuleTree.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/canvas/ModuleTree.tsx)
- Tree component that groups artifacts by `module` or inferred directory path.
- Renders file icons based on language/type.
- Supports expand/collapse for each module group.

#### [NEW] [DependencyMinimap.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/canvas/DependencyMinimap.tsx)
- Small SVG/Canvas based visualization showing artifact-to-artifact edges.
- Uses force-directed layout or simple linear arrangement.

---

### Phase 5: Backend Static Mounts (Deferred — Can implement now if requested)

#### [MODIFY] [main.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/main.py)
```python
from fastapi.staticfiles import StaticFiles

# Global admin graph
admin_graph_dir = Path("data/admin/global-graph")
admin_graph_dir.mkdir(parents=True, exist_ok=True)
app.mount("/admin/graph", StaticFiles(directory=str(admin_graph_dir), html=True), name="admin-graph")

# Per-workspace graphs via a catch-all API endpoint
@app.get("/graph/{session_id}/{file_path:path}")
async def serve_workspace_graph(session_id: str, file_path: str):
    ...
```

---

## Verification Plan

### Automated Tests
- Build the frontend with `npm run build` in `client/` to confirm zero TypeScript errors.
- Verify the Graph tab renders the placeholder (not a JSON 404) when no graph data exists.

### Manual Verification
- Ask the agent to create multiple files in one session and verify they appear grouped in the Canvas module tree.
- Confirm dependency arrows render between files that import each other.
- Verify the Admin Overview page shows a graceful empty state.
