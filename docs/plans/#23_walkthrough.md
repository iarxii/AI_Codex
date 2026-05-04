# Walkthrough: Model Telemetry Engine

We have successfully transitioned the AICodex agentic loop into a transparent, performance-aware system. The **Model Telemetry Engine** provides real-time insights into model performance, latencies, and capabilities.

## Key Accomplishments

### 1. Instrumentation & Tracking
- **TTFT (Time to First Token)**: Captured accurately for both streaming (Groq, Gemini, local) and non-streaming responses.
- **Node-Level Latency**: Added `init_node` for pre-flight probes and instrumented `reason_node` and `execute_tool_node`.
- **Token Estimation**: Implemented a robust utility to estimate token usage for providers that don't provide native usage metadata.

### 2. Provider Intelligence (Capability Matrix)
- **Automatic Detection**: Added `telemetry.py` utility to detect "Tools", "Thinking", "Multimodal", and "Structured" capabilities based on model profiles.
- **3-Tier Probes**: Implemented an `init_node` in the graph to perform metadata handshakes and initial latency checks.

### 3. High-Fidelity UI (Model HUD)
- **Premium Design**: Created a glassmorphic `ModelTelemetryHUD` that floats at the top of the chat, showing live metrics.
- **Real-time Updates**: The HUD updates instantly as the model starts streaming (TTFT) and finalizes when the response is complete.

### 4. Engine Parameter Tuning
- **Engine Panel**: Created a `ModelConfigPanel` for tuning `Temperature`, `Max Tokens`, `Top K`, and `Top P`.
- **Per-Model Persistence**: Configuration is saved to localStorage and applied per provider/model combination.

## Visual Demonstrations

### Model Telemetry HUD
The HUD displays the active model, TTFT, total latency, token count, and active capabilities.

### Engine Parameters
A new "Engine" button in the chat input opens a premium control panel for real-time parameter adjustment.

## Technical Details

### Backend State
```python
# AgentState extension
telemetry: TypedDict('telemetry', {
    'ttft': float,
    'total_tokens': int,
    'usage': Dict[str, int],
    'latencies': Dict[str, float],
    'capabilities': List[str],
    'provider': str,
    'model': str
})
```

### WebSocket Events
New `type: 'telemetry'` payload emitted on first token and request completion.

## Verification
- [x] Verified state persistence in LangGraph.
- [x] Confirmed WebSocket streaming of telemetry data.
- [x] Validated HUD rendering and parameter application.
