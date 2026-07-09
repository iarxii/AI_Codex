# Blocker and Wall Markers Integration Guide

This document defines the interface and token contract between the client-side execution loops and the backend agent graph in the Spirit Bird / AI_Codex platform.

---

## 1. The Dual-Loop Architecture

The platform operates using a dual-loop orchestration paradigm:
1. **Client-Side Step-by-Step Auto-Reasoning (SAR) Loop:** Governed by the VS Code extension's `SpiritBirdClient` (`client.ts` & `v2_client.ts`). It makes iterative HTTP requests (up to `maxIterations = 12`) to the backend codegen endpoint.
2. **Backend LangGraph Execution Loop:** Governed by the Python backend (`graph.py` & `nodes.py`). It processes state transitions, tools execution, syntax checks, and self-evaluation.

```
+-------------------------------------------------------------+
|               VS Code Extension Client                      |
|                                                             |
|   +-----------------------------------------------------+   |
|   | SpiritBirdClient (SAR Loop - max 12 iterations)     |   |
|   +----------+---------------------------------+--------+   |
|              | HTTP Prompt                     ^            |
|              v                                 | Response   |
+--------------+---------------------------------+------------+
               |                                 |
+--------------+---------------------------------+------------+
|              v                                 |            |
|   +----------+---------------------------------+--------+   |
|   | LangGraph (init -> reason -> evaluate -> report)   |   |
|   +-----------------------------------------------------+   |
|                                                             |
|                  Backend Python API Server                  |
+-------------------------------------------------------------+
```

---

## 2. Synchronization Markers

Because the client-side SAR loop runs iteratively, it needs to scan the incoming backend text streams for special termination tokens. These are divided into **Goal** and **Wall** markers:

### A. Goal Markers (Termination on Success)
When the agent successfully reaches the user's objective, it must output one of the following goal markers. Upon detection, the client immediately terminates the loop and sets the status to `'goal-reached'`.

* **`[GOAL_REACHED]`** (Primary)
* **`<goal_reached/>`**
* **`FINAL_ANSWER:`**

### B. Wall Markers (Termination on Blocker)
If the agent hits a blocker, detects state stagnation, or requires manual human intervention (e.g., in the backend `handle_blocker_node`), it must output one of the following wall markers. Upon detection, the client immediately terminates the loop and sets the status to `'request-wall'`.

* **`[REQUEST_WALL]`** (Primary)
* **`<request_wall/>`**
* **`AWAITING_USER:`**

> [!WARNING]
> If the backend halts execution (e.g., due to quality degradation checks) but fails to output a Wall Marker, the client-side SAR loop will continue to invoke the backend endpoint until `maxIterations` is exhausted. This leads to substantial token waste and slow user feedback.

---

## 3. Backend Integration Details

### Successful Execution (`final_report_node`)
When the quality gate passes (`goal_achieved: True`), the graph transitions to the `final_report_node`.
* **Prompt Rule:** The prompt forces a structured markdown output under `### 📋 Execution Summary` and `### 🚀 Recommended Next Steps`.
* **Goal Output:** The system prompt instructs the model to wrap its thoughts and output `[GOAL_REACHED]` to end the client loop.

### Stagnation & Degradation (`handle_blocker_node`)
When the loop's quality metric drops over consecutive turns, or when the agent repeats tool calls (circular behavior), the conditional router redirects execution to `handle_blocker_node`.
* **Output Construction:** The node returns a structured warning:
  ```markdown
  🛑 **Execution Paused (Degradation Guard)**
  
  My self-evaluation engine detected code quality degradation or a repetitive loop.
  **Critique:** [Critique details]
  
  Please review the changes and guide me on how to proceed.
  
  [REQUEST_WALL]
  ```
* **Client Handshake:** The suffix `[REQUEST_WALL]` forces the VS Code extension to immediately halt its loop, display the Pause warning, and open the chat HUD for user interaction.
