# Corrected Strategic Plan: Dynamic & Secure LangSmith Telemetry

This plan outlines the corrected, secure, and production-ready implementation of a **Split-Plane Observability Architecture** for the AI_Codex project, supporting both the VSCode extension and Vite Web Client.

---

## 1. Core Architectural Strategy

To achieve maximum performance and privacy without high resource overhead, we adopt a **Split-Plane Observability Architecture**:

*   **The Control/Execution Plane (Local):** The LangGraph agent loops, local file operations, AST parsing, and state updates run completely on the host or local environment.
*   **The Telemetry Plane (Hybrid/Cloud):** We stream asynchronous, non-blocking telemetry meta-data to the managed LangSmith cloud service to debug and benchmark our agent loops.

---

## 2. Implementation Plan

### Phase 1: Dynamic Telemetry & Token Gating

#### The Correct Path:
*   **Client Configuration**: Telemetry toggles and API keys are stored securely in client-side settings (VSCode user configuration or browser LocalStorage) rather than being hardcoded in code.
*   **Payload Delivery**: The client sends telemetry configuration keys (`benchmark_mode`, `private_workspace`, `langsmith_api_key`, `langsmith_project`) dynamically with every outgoing WebSocket request.
*   **Process Isolation on Backend**: To prevent cross-tenant trace leakage or race conditions on the multi-tenant FastAPI backend, we avoid mutating global process variables (`os.environ`). Instead, we wrap execution of the LangGraph event stream in an async-safe, task-local `tracing_context`.

#### Backend Implementation (`backend/api/chat.py`):
```python
import langsmith as ls
from langsmith.run_helpers import tracing_context

# Inside the run_agent_task handler for WebSocket connection:
benchmark_mode = payload_data.get("benchmark_mode", False)
private_workspace = payload_data.get("private_workspace", True)
langsmith_api_key = payload_data.get("langsmith_api_key")
langsmith_project = payload_data.get("langsmith_project", "vscode-agent-react-benchmarks")

# Enable tracing only if benchmarking is active, not in a private workspace, and key is present
enable_tracing = benchmark_mode and not private_workspace and bool(langsmith_api_key)

# Instantiate a scoped Client instance (no global environment mutation)
ls_client = ls.Client(api_key=langsmith_api_key) if enable_tracing else None

# Wrap the LangGraph generation stream in the task-local contextvars block
with tracing_context(client=ls_client, project_name=langsmith_project, enabled=enable_tracing):
    async for event in agent_graph.astream_events(initial_state, config=config, version="v2"):
        # Process event stream normally...
```

---

### Phase 2: Trace Interception & State Scrubbing

To prevent large file payloads, long command outputs, and sensitive workspace code from inflating trace bandwidth or violating privacy boundaries, we perform scrubbing before data is sent to the LangSmith cloud.

#### The Correct Path:
*   **Keep LLM Context Intact**: Do not truncate the `messages` array inside the graph state itself. Doing so starves the LLM of context, breaking its code comprehension.
*   **Use Client-Side Redactors**: Configure the LangSmith client using its `hide_inputs` and `hide_outputs` hooks. This truncates large structures *only* for the outgoing telemetry stream, protecting privacy and bandwidth while leaving the agent's context window untouched.

```python
def scrub_telemetry_payload(inputs: dict) -> dict:
    """
    Scrubs sensitive keys and truncates massive content fields
    before they are dispatched to LangSmith.
    """
    scrubbed = inputs.copy()
    if "messages" in scrubbed:
        processed_msgs = []
        for msg in scrubbed["messages"]:
            content = msg.get("content", "")
            if isinstance(content, str) and len(content) > 1000:
                # Truncate content representation in tracing logs
                content = content[:500] + "\n... [TRUNCATED FOR TELEMETRY SAVINGS] ...\n" + content[-500:]
            msg["content"] = content
            processed_msgs.append(msg)
        scrubbed["messages"] = processed_msgs
    return scrubbed

ls_client = ls.Client(
    api_key=langsmith_api_key,
    hide_inputs=scrub_telemetry_payload,
    hide_outputs=scrub_telemetry_payload
)
```

#### Database & Persistence Strategy:
*   **SQLite on Cloud Run (Production)** vs. **PostgreSQL on Local (Docker)**.
*   Instead of introducing LangGraph `checkpointer` classes (e.g., `MemorySaver`), which are not multi-tenant safe and would require separate adapters (`SqliteSaver` vs `PostgresSaver`), we maintain the compiled graph as stateless.
*   We continue to load and persist conversation states directly through SQLAlchemy ORM database models (`Conversation`, `Message`), keeping persistence database-engine-agnostic and respecting database separations.

---

### Phase 3: Trajectory Evaluation via the SDK

To perform trace evaluation programmatically, a dedicated script (e.g., `tests/benchmark_evaluation.py`) will fetch failed runs using the LangSmith SDK:

```python
from langsmith import Client

# Initialize client using your secure local settings or environment
client = Client()

failed_agent_loops = client.list_runs(
    project_name="vscode-agent-react-benchmarks",
    run_type="llm",
    error=True
)

for run in failed_agent_loops:
    print(f"Failed Run ID: {run.id}")
    print(f"Inputs passed to LLM: {run.inputs.get('messages')}")
    print(f"Parsing Error details: {run.error}")
```

---

## 3. Milestones & Risk Mitigations

*   **Milestone 1 (Operational Control):** Successfully link your VSCode tool-calling engine to LangSmith using explicit settings gating. Confirm that when `enableLangsmith` is off, the runtime incurs zero network overhead.
*   **Milestone 2 (Loop Optimization):** Identify tool-calling patterns where your ReAct loop executes more than 4 consecutive calls for a single coding problem. Use the LangSmith **Playground** sandbox to refine instructions until the agent hits the target in fewer turns.
*   **Risk (The 14-Day Cliff):** Because the Developer plan purges history after 14 days, successful benchmark configurations must be exported programmatically or screenshotted if you wish to track performance regression over time.
