# Implementation Plan: ADK Observatory Panel + LaTeX Math Rendering

---

## Part 1 — ADK Stack Observatory Panel (GemmaSandboxHarness Redesign)

### Problem
The current right-panel contains a fake MTP simulation that has no connection to the live agent and provides zero real value. The two tabs ("Sandbox" and "MTP Simulator") demonstrate nothing meaningful about the Google ADK Stack architecture running behind this space.

### Proposed Design: "ADK Observatory"

Rename the panel to the **ADK Stack Observatory** and replace both tabs with three purpose-driven views that each hook into real backend data.

---

### Tab 1 — `CHAIN OF THOUGHT`
**Concept**: Live, per-turn trace of the agent's reasoning graph execution.

When the user submits a message to the Code Lab, the sidebar streams a visualization of the ADK graph nodes as they fire:

```
init_node → reason → execute_tool → evaluate_turn → END
```

**How it works**:
- The backend `/api/spaces/code-lab/analyze` endpoint (already built) returns a `graph_trace` field listing which nodes were visited, in what order, and with what latency.
- The frontend polls or receives this after each submission.
- Each visited node is rendered as an animated step card: a node name, its latency (`Xs`), and a status badge (SKIPPED / FAST-PATH / EXECUTED / TOOL).

> [!IMPORTANT]
> **Short-Process Bypass Visibility**: This is where the short-circuit routing we built becomes *observable*. Simple greetings will show `init_node → END` (FAST-PATH), making the architecture tangible and impressive. Technical queries show the full chain.

**Visual Treatment**: Vertical animated node-chain with connecting lines. Each node pulses briefly as it fires, then settles to a completion glow.

---

### Tab 2 — `AGENT TELEMETRY`
**Concept**: Live token economics and model performance — a real-time "cockpit" view of what the model is doing.

**Metrics shown from the actual API response**:
| Metric | Source |
|--------|--------|
| Input Tokens | `telemetry.usage.input` |
| Output Tokens | `telemetry.usage.output` |
| TTFT (Time-to-First-Token) | `telemetry.ttft` |
| Init Node Latency | `telemetry.latencies.init_node` |
| Is Short Process | `is_short_process` flag |
| Provider / Model | `telemetry.provider / model` |

Displayed as a clean metrics grid with live-updating mini bar charts (using recharts, already in package.json) for token distribution.

**MTP Speedup Badge**: Show the real MTP gain factor from the analyze endpoint as a highlighted callout badge — turning it from a fake "3.1x" into a real value computed from AST complexity.

---

### Tab 3 — `CODE ANALYSIS`
**Concept**: The existing Sandbox + Diagnostics functionality, consolidated and connected to the real `/analyze` endpoint.

Merges the existing Sandbox textarea and the analysis result panel, now cleanly showing real backend-derived data:
- **Health Score** (real AST metric)
- **Complexity Class** (real computation)
- **Optimized Code** (real GenAI suggestion)
- **Speculative Steps** (real MTP token groups from backend)

The "Simulate" button on this tab feeds the real `mtp_steps` returned by the backend into the token stream visualization — no fake data.

---

### Backend Change Required (`spaces.py`)

The existing `/analyze` endpoint must be extended to return a `graph_trace` field. This can be a lightweight synthetic trace (since we don't yet stream intermediate node events from the agent) that is reconstructed from the stored `is_short_process` telemetry.

```python
# Add to analyze response:
"graph_trace": [
    {"node": "init_node", "status": "executed", "latency_ms": 12},
    {"node": "reason", "status": "fast_path" if is_short else "executed", "latency_ms": 340},
    {"node": "END", "status": "terminal", "latency_ms": 0}
]
```

---

### Files Changed (Part 1)

#### [MODIFY] [GemmaSandboxHarness.tsx](file:///C:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/chat/GemmaSandboxHarness.tsx)
- Replace 2-tab layout (Sandbox / MTP Simulator) with 3-tab layout (Chain of Thought / Agent Telemetry / Code Analysis).
- Wire `Chain of Thought` tab to receive `graph_trace` from the analyze API response.
- Wire `Agent Telemetry` tab to display token, latency, and process-path metrics.
- Consolidate existing Sandbox + analysis into `Code Analysis` tab.

#### [MODIFY] [spaces.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/CodexSpaces/backend/api/spaces.py)
- Add `graph_trace` field to the `/analyze` POST endpoint response.
- Add `is_short_process` flag to response.

---

---

## Part 2 — LaTeX Math Rendering (`$\rightarrow$` fix)

### Problem
The agent outputs mathematical/logical notation using LaTeX syntax like `$\rightarrow$`, `$\Sigma$`, etc. These are passed as raw strings to `react-markdown`, which does not natively handle math. The result is raw dollar-sign wrappers appearing in the rendered output instead of the intended symbols (e.g. `→`).

### Solution: `remark-math` + `rehype-katex`

This is the standard solution for react-markdown. Install two packages:
- `remark-math` — parses `$...$` (inline) and `$$...$$` (block) as math nodes
- `rehype-katex` — renders those nodes via KaTeX (a lightweight TeX renderer, no server needed)
- `katex` — the core KaTeX library (peer dependency)

### Fix Strategy

#### AICodex Web Client
**Package**: `react-markdown` + `remark-gfm` are already present. Add:
```bash
npm install remark-math rehype-katex katex
```
**Files to update**:
- [MessageItem.tsx](file:///C:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/chat/MessageItem.tsx) — Add `remarkMath` to `remarkPlugins`, `rehypeKatex` to `rehypePlugins`, import `katex/dist/katex.min.css`
- [MiniContextChat.tsx](file:///C:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/chat/MiniContextChat.tsx) — Same additions
- [SpiritBirdChatHarness.tsx](file:///C:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/chat/SpiritBirdChatHarness.tsx) — Same additions

#### VSCodex Extension
The extension uses its own HTML webview (`chatView.html`) bundled with `marked` or plain text rendering (no react-markdown). The fix is a lightweight **pre-processing step** in `ChatViewProvider.ts` before the content hits `innerHTML`:

```typescript
// Map common LaTeX sequences to Unicode before render
function preprocessLatex(text: string): string {
  return text
    .replace(/\$\\rightarrow\$/g, '→')
    .replace(/\$\\leftarrow\$/g, '←')
    .replace(/\$\\Rightarrow\$/g, '⇒')
    .replace(/\$\\to\$/g, '→')
    .replace(/\$\\cdot\$/g, '·')
    .replace(/\$\\times\$/g, '×')
    .replace(/\$\\neq\$/g, '≠')
    .replace(/\$\\leq\$/g, '≤')
    .replace(/\$\\geq\$/g, '≥')
    .replace(/\$\\sum\$/g, 'Σ')
    .replace(/\$\\alpha\$/g, 'α')
    .replace(/\$\\beta\$/g, 'β')
    .replace(/\$\\lambda\$/g, 'λ')
    .replace(/\$([^$\n]+)\$/g, '$1'); // strip remaining single $ wrappers
}
```

> [!NOTE]
> KaTeX could be bundled into the webview HTML, but given the extension's CSP constraints and the fact that the symbol usage is primarily arrows and Greek letters (not complex math), a simple Unicode substitution map is safer, lighter, and avoids CSP violations.

#### AIDock Client
AIDock renders `msg.content` as raw `whitespace-pre-wrap` text (confirmed at line 952-955 of `App.tsx`). It has `react-markdown` in `package.json` but doesn't use it for message rendering.

Two sub-tasks:
1. **Add markdown rendering to AIDock messages**: Replace the plain `{msg.content}` with `<ReactMarkdown>` (with `remarkGfm` + `remarkMath` + `rehypeKatex`).
2. **Install missing packages**: `npm install remark-math rehype-katex katex`

---

### Files Changed (Part 2)

#### AICodex Web Client
- [MessageItem.tsx](file:///C:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/chat/MessageItem.tsx) — Add `remarkMath`, `rehypeKatex`, KaTeX CSS import
- [MiniContextChat.tsx](file:///C:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/chat/MiniContextChat.tsx) — Same
- [SpiritBirdChatHarness.tsx](file:///C:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/chat/SpiritBirdChatHarness.tsx) — Same

#### VSCodex Extension
- [ChatViewProvider.ts](file:///C:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/vscode-extension/src/panels/ChatViewProvider.ts) — Add `preprocessLatex()` function, apply before rendering message HTML

#### AIDock Client
- [App.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Dock/client/src/App.tsx) — Replace raw `{msg.content}` render (line 955) with `<ReactMarkdown>` with math plugins for bot messages

---

## Open Questions

> [!IMPORTANT]
> **Chain-of-Thought real-time streaming**: Currently the graph trace would be returned _after_ the full response. Should we implement **streaming** (SSE or WebSocket) so the node steps animate as they happen during the agent's execution? This would require a backend streaming endpoint change but would make the panel feel truly live.

> [!NOTE]
> **VSCodex approach preference**: Should we go with simple Unicode substitution (faster, simpler, no CSP issues) or take the time to properly bundle KaTeX into the webview HTML? KaTeX would handle more complex math expressions but requires webview CSP config updates.
