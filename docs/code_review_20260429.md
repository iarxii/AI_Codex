# Code Review — `feat/agent/canvas` (Gemini 3 Flash Changes)

**Reviewer**: Claude Opus 4.6 (AI/ML + Code Review lens)
**Branch**: `feat/agent/canvas`
**Scope**: 4 modified files, 2 new files, 0 backend changes

---

## Executive Summary

The changeset introduces a frontend-only artifact extraction and display system for the Agent Canvas right-panel. The architecture is additive (no destructive refactors), and the existing WebSocket pipeline, backend agent graph, and chat flow are fully preserved. The UI work is solid. However, there is **one critical gap** and several medium-priority issues that should be addressed before this feature can work end-to-end.

---

## 🔴 Critical Issue

### The LLM has no instructions to emit `[CANVAS:...]` tags

The entire feature relies on the AI agent wrapping output in `[CANVAS:CODE:title:lang]...[/CANVAS]` tags. But **nothing was added to the backend** to make this happen:

- [profile.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/profile.py) — The system prompt (`build_system_prompt()`) has no mention of canvas tags
- [SOUL.md / AGENTS.md](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/data/profile/) — Not updated with canvas output instructions

**Impact**: The parser will never find any artifacts because no LLM will spontaneously produce `[CANVAS:CODE:main.py:python]` output without being instructed to.

> [!CAUTION]
> Without a system prompt update, this feature is inert. The frontend scaffolding is correct, but the pipeline has no "producer" for the data the "consumer" expects.

**Fix**: Add a `[CANVAS_PROTOCOL]` section to the agent's system prompt (either in `AGENTS.md` or `profile.py`) instructing the LLM to wrap generated code/docs/research in the `[CANVAS:TYPE:TITLE:LANG]...[/CANVAS]` format.

---

## 🟡 Medium Issues

### 1. Streaming performance — regex on every token event

In [Chat.tsx:146-163](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/Chat.tsx#L146-L163):

```typescript
// 3. Parse Artifacts for Canvas
const newArtifacts = parseArtifacts(data.content);
```

`data.content` is the **full accumulated response** sent on every streaming token. The regex `parseArtifacts()` runs against this growing string on *every single token event* — potentially hundreds of times per response.

**Impact**: For long responses (10k+ chars), this creates O(n²) parsing overhead. The regex itself uses `[\s\S]*?` lazy quantifiers which are relatively safe, but the sheer call frequency is wasteful.

**Recommendation**: Only parse on `data.type === 'done'` events, or debounce the parsing (e.g., parse every 500ms or every 50 tokens). This would reduce calls from ~500+ to ~1.

---

### 2. Stale closure over `isCanvasOpen` in WebSocket handler

In [Chat.tsx:162](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/Chat.tsx#L162):

```typescript
if (!isCanvasOpen) setIsCanvasOpen(true);
```

This is inside `socket.onmessage`, which is defined in a `useEffect` that depends on `[reconnectCount]`. The `isCanvasOpen` value captured here is the state at the time the effect ran — it will be stale. This means:
- If the user manually closes the canvas, the next token event will reopen it (the closure still sees `false` from mount time)
- After a reconnect, the closure gets a fresh value, but the stale-until-reconnect window is the entire session

**Recommendation**: Use a ref (`isCanvasOpenRef`) for the check, or move auto-open logic to a separate `useEffect` that watches `artifacts.length`.

---

### 3. Missing `filteredArtifacts` in useEffect dependency array

In [AgentCanvas.tsx:30](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/AgentCanvas.tsx#L26-L30):

```typescript
useEffect(() => {
    if (filteredArtifacts.length > 0 && (!selectedId || !filteredArtifacts.find(a => a.id === selectedId))) {
      setSelectedId(filteredArtifacts[0].id);
    }
  }, [activeTab, artifacts]);
```

`filteredArtifacts` is a derived value from `artifacts` and `activeTab`, so the deps are technically sufficient for correctness. But `selectedId` is *read* inside the effect without being in the dependency array, which is a React lint violation. If the user manually selects an artifact and then a new artifact arrives in a different tab, the effect may not re-evaluate correctly.

**Recommendation**: Add `selectedId` to the dependency array, or restructure as a `useMemo`-driven selection.

---

### 4. Type mismatch — `'doc'` vs `'docs'`

In [artifactParser.ts:28-29](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/utils/artifactParser.ts#L28-L29):

```typescript
const validTypes = ['code', 'docs', 'research'];
const artifactType = validTypes.includes(type) ? type : 'docs';
```

But the tag format documented is `[CANVAS:DOC:title]`. When a user/LLM writes `DOC`, `.toLowerCase()` produces `"doc"` — which is **not** in `validTypes` (`'docs'`). So it falls through to the default `'docs'`, which happens to be correct *by accident*.

**Recommendation**: Explicitly map `'doc'` → `'docs'` before the check, or add `'doc'` to validTypes with a normalization step. The current behavior works but is fragile and misleading.

---

## 🟢 Positive Observations

### ✅ No destructive changes to the backend pipeline
The entire `backend/` directory is untouched. The WebSocket handler (`chat.py`), agent graph (`graph.py`), nodes (`nodes.py`), and profile system are all preserved. This respects the user's explicit constraint.

### ✅ Clean state management
- Artifacts are properly cleared on `handleNewChat()`
- Artifacts are re-parsed from history in `loadConversation()`
- Deduplication by ID in the streaming handler is correct

### ✅ Solid UI architecture
- Tab filtering with counts is well-implemented
- The empty state with the spinning dashed-border animation is a nice touch
- `ArtifactView` correctly differentiates between code (monospace `<pre>`) and docs/research (`ReactMarkdown`)
- The header badge with artifact count provides good affordance

### ✅ Type system is clean
The `Artifact` interface is well-typed and placed correctly in the shared types file.

---

## Action Items (Priority Order)

| # | Severity | File | Issue | Fix |
|---|----------|------|-------|-----|
| 1 | 🔴 Critical | `backend/data/profile/AGENTS.md` | LLM has no canvas output instructions | Add `[CANVAS_PROTOCOL]` to system prompt |
| 2 | 🟡 Medium | `Chat.tsx` | Regex runs on every streaming token | Move parsing to `done` event or debounce |
| 3 | 🟡 Medium | `Chat.tsx` | Stale closure on `isCanvasOpen` | Use ref or separate effect |
| 4 | 🟡 Low | `AgentCanvas.tsx` | Missing `selectedId` in useEffect deps | Add to dependency array |
| 5 | 🟢 Minor | `artifactParser.ts` | `'doc'` vs `'docs'` mismatch | Add explicit normalization map |

---

## Verdict

**Approve with required changes** — The frontend scaffolding is production-quality and non-destructive. Fix #1 (system prompt) is mandatory for the feature to function. Fixes #2-3 should be addressed to prevent subtle streaming bugs. The rest are polish.
