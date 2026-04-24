# AICodex Chat Portal Upgrade: Analysis & Feature Map

The current `Chat.tsx` implementation is a functional but minimal "slop" template. To meet the product requirements for a professional AI Coding Agent, we need to transition from a single-page chat to a multi-pane IDE-style interface.

## 1. Gap Analysis

| Current State | Target State | Priority |
| :--- | :--- | :--- |
| Single chat session | **Multi-Conversation Shelf**: Persisted history in SQLite. | CRITICAL |
| No grounding visibility | **Context Discovery Pane**: Show retrieved OllamaOpt chunks. | HIGH |
| Direct WS streaming | **Rich Event Streaming**: Distinguish between thoughts, tools, and tokens. | HIGH |
| Hardcoded branding | **Dynamic Design System**: Unified tokens for Carbon/Indigo theme. | MEDIUM |
| No skill management | **Skill Inventory**: Toggle and configure skills from the UI. | MEDIUM |

## 2. Feature Map

### A. The "Nexus" Sidebar (Left Shelf)
- **Conversation List**: Grouped by time (Today, Yesterday, Last Week).
- **New Chat Button**: Instant state reset.
- **Skill Status**: Live indicators for `workspace_reader`, `shell_exec`, etc.
- **User Profile**: Quick access to settings and logout.

### B. The "Reasoning" Workspace (Center)
- **Fluid Chat**: Improved markdown rendering with code highlighting (Prism/Shiki).
- **Tool Invocations**: Expanding cards for tool inputs/outputs.
- **Streaming State**: Distinction between agent "thinking" and "speaking".

### C. The "Context" Inspector (Right Drawer)
- **RAG Grounding**: List of documents/code snippets currently in the LLM's context.
- **Token Budget**: Visual bar showing context window usage (from OllamaOpt metrics).
- **System Prompt**: View the active grounding policy.

## 3. Technical Requirements

### Backend Updates
1.  **Conversation API**: Endpoints for `GET /conversations`, `POST /conversations`, and `GET /conversations/{id}/messages`.
2.  **Stateful Agent**: The LangGraph loop must load history from the DB for the given `conversation_id`.
3.  **Extended WS Events**: Send `context_metadata` and `thought_process` events through the WebSocket.

### Frontend Updates
1.  **State Management**: Use a clean context or custom hook for the WebSocket and Message state.
2.  **Tailwind Layout**: Use a 3-column grid (`Sidebar` | `MainChat` | `ContextPane`).
3.  **Component Refactor**: Break `Chat.tsx` into atomic components for better maintainability.

## 4. Proposed Design Tokens (AICodex Carbon)

- **Primary**: Indigo-500 (`#6366F1`)
- **Secondary**: Cyan-400 (`#22D3EE`)
- **Surface**: Slate-900 (`#0F172A`)
- **Glass**: `backdrop-blur-xl` + `bg-white/5`
- **Border**: `border-white/10`

---

> [!IMPORTANT]
> The most critical next step is wiring the **Conversation History** and ensuring the **WebSocket** identifies the user/conversation correctly to pull grounded context.
