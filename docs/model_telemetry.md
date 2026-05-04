# AI Agent Harness: Provider & Model Telemetry Blueprint

This document outlines the architectural blueprint for the **Provider/Model Telemetry** features in AI_Codex. The goal is to transition the model interaction from a "Black Box" experience to a transparent "Engine" where users can monitor and control the underlying mechanics in real-time.

---

## 1. Model Configuration Parameters

When fine-tuning the model response behavior, especially with local models (e.g., Gemma, Llama), the following parameters are exposed:

| Parameter | Description | Impact |
| :--- | :--- | :--- |
| **Max Tokens** | Sets a hard cap on the total number of tokens in the response. | Lower = Faster; Higher = More detail. |
| **Top K** | Limits the model's next-word selection to the K most likely options. | Higher = Variety; Lower = Focused/Predictable. |
| **Top P** | A probability-based filter (nucleus sampling) that adds words until a threshold is reached. | Higher = Natural; Lower = Conservative. |
| **Temperature** | Controls the randomness of the output distribution. | Lower = Logical/Focused; Higher = Creative/Exploratory. |
| **Accelerator** | Selection of compute hardware (e.g., NVIDIA GPU, Apple Metal). | GPU selection significantly improves inference speed. |
| **Thinking** | Toggles step-by-step reasoning (Chain of Thought). | Essential for complex logic/math; may increase latency. |

---

## 2. The Ruleset Blueprint

The AI Agent Harness should implement the following UI/UX and architectural patterns:

### A. The "Model HUD" (Persistent Status Bar)
A non-intrusive UI element (thin strip) that provides high-level context:
- **Provider Identity**: Name and high-fidelity icon.
- **Context Window Usage**: Visual progress bar showing consumed vs. available tokens.
- **Current Parameters**: Live display of Temperature, Top K, etc.
- **Rate Limit Status**: Indicator of API health and remaining quota.

### B. The "Capability Matrix"
Visual indicators (chips/icons) showing what the current model supports:
- `Tools`: Function Calling capability.
- `Thinking`: Native reasoning/CoT support.
- `Multimodal`: Image/Audio/Video processing.
- `Structured`: JSON Mode / Constrained Output support.

### C. The "Initialization Sequence"
A transparency phase during workspace startup:
1. **Handshake**: Verifying API connectivity or local model availability.
2. **Capability Sync**: Fetching model limits and supported features.
3. **Latency Check**: Initial benchmark of Time to First Token (TTFT).

---

## 3. Initialization & Capability Probes

To ensure the harness "knows" its engine before the first user prompt, implement this 3-Tier strategy:

- **Tier 1: Metadata Handshake**: Query the provider's API (e.g., `model_info`) to get hardcoded capabilities.
- **Tier 2: "Canary" Probes**: Execute silent, background tests during initialization:
    - *Reasoning Test*: Small logic puzzle to verify CoT output.
    - *JSON Test*: A prompt requiring raw JSON to check for "conversational fluff."
- **Tier 3: Latency Benchmark**: Measure TTFT. 
    - **Real-time**: < 200ms
    - **Standard**: 200ms - 800ms
    - **Batch**: > 1s

---

## 4. Error States & Graceful Throttling

Handle telemetry interruptions and provider limits with high-fidelity feedback:
- **Visual Alerting**: The HUD changes color (Amber for warning, Red for failure).
- **Rate Limit Countdown**: Display an active timer: *"Rate limited. Resuming in 14s."*
- **Request Queuing**: Instead of failing, the harness should queue outgoing turns during temporary throttling events.

---

## 5. Session Export & Audit Schema

All telemetry and configuration data must be exportable for debugging, cost tracking, and audit trails.

```typescript
interface SessionExport {
  sessionId: string;
  timestamp: string;
  provider: {
    name: string;
    class: "standard" | "expert" | "pro"; 
  };
  telemetry: {
    totalTokens: number;
    avgLatencyMs: number;
    peakLatencyMs: number;
  };
  config: {
    temperature: number;
    topK: number;
    topP: number;
    maxOutputTokens: number;
  };
  turns: Array<{
    role: "user" | "model";
    content: string;
    metadata: {
      latencyMs: number;
      tokenCount: number;
      thinkingPath?: string; 
    };
  }>;
}
```

> **Note**: This documentation serves as the source of truth for the `feat/provider/model/telemetry` implementation phase.
