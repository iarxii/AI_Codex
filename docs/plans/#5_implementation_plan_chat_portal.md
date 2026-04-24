# Implementation Plan: AICodex Chat Portal Evolution

This plan outlines the steps to transform the current minimal chat interface into a professional agentic workspace with conversation history, grounding visualization, and robust backend integration.

## 1. Backend: Stateful Conversations & History

### [MODIFY] [models.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/db/models.py)
- Ensure `Conversation` and `Message` models are sufficient for storing agent state (tool calls, metadata).

### [NEW] [conversations.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/conversations.py)
- `GET /api/conversations`: List user conversations.
- `POST /api/conversations`: Create new conversation.
- `GET /api/conversations/{id}`: Get message history.

### [MODIFY] [chat.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/chat.py)
- Update WebSocket endpoint to:
    - Accept `conversation_id` and load existing `HumanMessage`/`AIMessage` history into the LangGraph state.
    - Persist incoming `HumanMessage` and outgoing `AIMessage` to the database.

## 2. Frontend: Multi-Pane Architecture

### [NEW] [Sidebar.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/Sidebar.tsx)
- Premium "Shelf" for conversation history.
- New Chat button.
- Account/Settings footer.

### [NEW] [ContextInspector.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/ContextInspector.tsx)
- Right-side drawer for RAG grounding visualization.
- Tool output inspector.

### [MODIFY] [Chat.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/Chat.tsx)
- Integrate `Sidebar` and `ContextInspector`.
- Implement conversation switching logic.
- Robust WebSocket reconnection and error handling.

## 3. UI/UX: Design System Refinement

- Implement `Shiki` or `Prism` for high-fidelity code blocks.
- Add "Thought" transitions (micro-animations) for agent reasoning steps.
- Ensure all components follow the **AICodex Carbon** theme (Dark Mode, Glassmorphism).

## 4. Verification Plan

### Automated Tests
- `pytest backend/tests/test_conversations.py`: Test history persistence.
- WebSocket message sequence validation.

### Manual Verification
1. Create a new chat, send a message, refresh page, verify history reloads.
2. Ask a question requiring RAG, verify context chunks appear in the `ContextInspector`.
3. Verify tool calls are visually distinct from chat messages.
