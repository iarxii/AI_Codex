# Integration of `graphify` into AI_Codex

This plan outlines the steps to integrate the newly added `graphify` submodule into `AI_Codex`. `graphify` will provide a structural knowledge graph of the codebase, which will be used for both agent memory and user visualization.

## Proposed Changes

### [Component] Backend - Graphify Skill
Add a new skill that allows the agent to interact with the knowledge graph.

#### [NEW] [graphify_skill.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/builtin/graphify_skill.py)
- Implement `GraphifySkill` inheriting from `BaseSkill`.
- Actions:
    - `rebuild`: Runs `graphify .` to refresh the graph.
    - `query`: Runs `graphify query` for structural context.
    - `path`: Runs `graphify path` to find relationships between components.

### [Component] Backend - API
Expose the generated interactive graph to the frontend.

#### [MODIFY] [main.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/main.py)
- Mount `graphify-out` as a static directory so the frontend can access `graph.html`.

### [Component] Frontend - Visualization
Add a way for users to view the graph.

#### [NEW] [GraphCanvas.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/GraphCanvas.tsx)
- A component that renders the `graph.html` in an iframe.

#### [MODIFY] [App.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/App.tsx) (or relevant navigation component)
- Add a "Graph" tab or button to show the `GraphCanvas`.

## Open Questions
- Should the graph rebuild automatically on certain events (e.g., after the agent makes changes)?
- Do we want to use the `graphify` MCP server instead of/in addition to the CLI tool for the agent?

## Verification Plan

### Automated Tests
- Run the agent and ask it a structural question (e.g., "What are the god nodes in this project?") and verify it uses the `graphify` tool.

### Manual Verification
- Access `http://localhost:8000/graph/graph.html` to ensure the static mount works.
- Verify the "Graph" tab in the UI displays the interactive visualization.
