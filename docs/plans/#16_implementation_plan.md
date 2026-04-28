# Implementation Plan - Autonomous Agentic Workflow & Advanced Context Management

This plan outlines a scalable, provider-agnostic architecture for AICodex that allows the agent to autonomously decide when to use tools/RAG, while managing large conversation contexts using modern architectural patterns.

## User Review Required

> [!IMPORTANT]
> **Autonomous Decision Making**: Instead of hardcoded rules (heuristics), I will leverage the LLM's own internal logic to decide if a query is "conversational" or "technical." This ensures the agent remains smart and adaptable across all providers (Groq, Gemini, local Ollama, etc.).

> [!IMPORTANT]
> **RAG as a Tool**: Currently, RAG is "forced" on every turn. I will move the Codebase Retrieval logic into an explicit **tool** that the agent can choose to call only when it identifies a technical need.

## Proposed Changes

### [Backend] Agentic Architecture (Provider-Agnostic)

#### [MODIFY] [nodes.py](file:///c:/AppDev\My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)
- **`planner_node` [NEW]**: The initial entry point. The model receives the user query and a system prompt explaining it can either respond directly or call a tool (including `code_search`).
- **`get_dynamic_llm`**: Remove forced `bind_tools`. Bind tools only to the model instances that require them, and ensure standard OpenAI/Anthropic/Groq tool-calling schemas are used.
- **Context Management**:
    - **Database Integration**: Use the existing `sqlite`/`postgresql` to store and fetch the last $N$ messages (Short-term memory).
    - **Summarization**: Implement a background task that summarizes the oldest $M$ messages when the context window exceeds a threshold (e.g., 80% of model limit).
    - **Memory RAG**: If the model needs context from "long ago," it can call a `memory_search` tool to retrieve past conversation snippets from the vector database.

#### [MODIFY] [graph.py](file:///c:/AppDev\My_Linkdin/projects/iarxii/AI_Codex/backend/agent/graph.py)
- **Cycle-Aware Logic**: Ensure the graph can cycle from `execute_tool` back to `reason` (Planner) to allow for multi-step reasoning.

### [Infrastructure] Context & Memory Strategy

| Component | Role in Context Management | Modern Pattern |
|---|---|---|
| **SQLite / Postgres** | **Persistence**: Stores every raw message and tool output. | **Source of Truth**: Provides the exact history for manual review and re-indexing. |
| **Vector DB (Qdrant/Postgres)** | **Semantic Search**: Stores embeddings of code AND past conversations. | **Long-term Memory (RAG)**: Allows the agent to "remember" technical decisions made days ago. |
| **MCP Tools** | **Planning & Knowledge**: Tools like `sequential-thinking` help break down complex tasks. | **Externalized Reasoning**: Offloads the cognitive load of complex planning to a structured scratchpad. |

## Verification Plan

### Automated Tests
- **Latency Check**: Verify that "Hi" responds in <1s by skipping the RAG retrieval step.
- **Tool-Call Accuracy**: Verify the agent only calls `code_search` for queries like "How does the auth work?".

### Manual Verification
- **Groq/Gemini Toggle**: Verify the logic works identically on different providers.
- **Long Chat Stability**: Conduct a 50+ message conversation and verify the "Context Budgeting" (summarization) triggers correctly.
