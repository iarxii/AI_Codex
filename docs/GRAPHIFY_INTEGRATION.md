# Graphify Knowledge Graph Integration

This document outlines the architecture, implementation, and usage of the Graphify submodule within the AI_Codex ecosystem. Graphify provides structural codebase insights and persistent memory via interactive visual maps.

## 🏗️ Architecture Overview

The integration is split into two primary scopes:

### 1. Workspace-Level Graph (Per-Project)
Each agentic workspace (Conversation ID) maintains its own isolated knowledge graph.
- **Storage**: `data/workspaces/{conversation_id}/graphify-out/`
- **Trigger**: Automated, non-blocking updates triggered by the `workspace_writer` skill after code changes.
- **UI**: Accessible via the **"Project Graph"** tab in the **Agent Canvas**.

### 2. Super-Admin Overview (Global)
A cross-workspace aggregator that merges individual graphs into a global knowledge cluster.
- **Storage**: `data/admin/global-graph/`
- **Trigger**: Periodic background tasks or manual admin trigger.
- **UI**: Accessible via the **"Global Map"** button in the Chat Navbar or the **"Super Admin Overview"** in Settings.

---

## 🛠️ Backend Implementation

### GraphifySkill
A dedicated `BaseSkill` that wraps the Graphify CLI.
- **`rebuild_graph(workspace_id)`**: Re-analyzes the workspace source code to generate fresh AST and Semantic relationship maps.
- **`query_graph(query)`**: Allows the agent to perform structural queries (e.g., "Find all dependencies of component X").

### Build-Time Integration
The `workspace_writer.py` skill includes a hook that invokes `GraphifySkill.rebuild_graph` asynchronously. This ensures the visual map is always reflective of the latest code without blocking the agent's primary loop.

---

## 💻 Frontend Implementation

### Core Components
- **`GraphView.tsx`**: A reusable iframe wrapper that handles dynamic URL construction for both workspace and global graph paths.
- **`AgentCanvas.tsx`**: Host for the workspace graph tab. Uses the `conversationId` prop to anchor the graph path.
- **`AdminOverview.tsx`**: A dedicated page (`/admin/overview`) providing a high-level dashboard for cross-project intelligence.

### API Routing
The FastAPI backend mounts static directories to serve the generated HTML/JS artifacts from Graphify:
- `/graph/{id}/*` -> `data/workspaces/{id}/graphify-out/`
- `/admin/graph/*` -> `data/admin/global-graph/`

---

## 🚀 Usage Guide

### For Agents
Agents are instructed via system prompts to use the graph for:
1. **Architectural Verification**: Checking if a new component adheres to existing patterns.
2. **Impact Analysis**: Seeing which modules might be affected by a refactor.

### For Users
- Open the **Agent Canvas** and switch to the **Graph** tab to see your code's structure evolve in real-time.
- Navigate to **Super Admin Overview** to see how different workspaces share knowledge or dependencies.

---

## 📁 File Structure
```text
AI_Codex/
├── graphify/               # Git Submodule
├── backend/
│   ├── skills/
│   │   └── graphify_skill.py
│   └── main.py             # Static mounts
├── data/
│   └── workspaces/
│       └── {id}/
│           └── graphify-out/
└── client/
    ├── src/
    │   ├── components/canvas/GraphView.tsx
    │   └── pages/AdminOverview.tsx
```
