With a **Lean Context** budget of **1800 characters**, here is a realistic breakdown for a standard conversational interaction (no code blocks or long tool logs):

### The Math:
*   **System Instructions**: ~400 characters (Your identity as AICodex, primary rules).
*   **Current User Query**: ~150 characters (Average length of a developer's question).
*   **Remaining for History**: ~1,250 characters.

### Estimated Capacity:
Based on an average conversational turn (User message + AI response) totaling ~450–600 characters:

1.  **Short/Direct Chat**: You can fit about **5–7 messages** (roughly 3 full conversational turns).
2.  **Dense Chat**: If the AI provides detailed explanations, you might drop down to **3–4 messages** (1.5–2 turns).

### Why this is a "Sweet Spot" for Local Models:
*   **Prefill Speed**: 1800 characters is roughly **400-500 tokens**. Most local GPUs (8GB–12GB VRAM) can "prefill" this amount of context in under **0.5–1.0 seconds**.
*   **KV Cache Stability**: By keeping the window small, we prevent the "Context Drift" and performance degradation that happens when a 3B or 7B model tries to look back 10,000 characters. 
*   **Sliding Window**: Our `ContextBuilder` uses a sliding window, so the AI will always remember the **most recent** 2-3 turns perfectly. 

### The Strategy:
We currently have `max_history_messages: 6` set in the [ContextPolicy](file:///c:/AppDev/My_Linkdin/projects/iarxii/OllamaOpt/cli/context/model.py#L71). This means even if you write very short messages, we cap it at the last 6 messages to ensure the "attention" of the local model stays sharp on the current problem rather than wandering into old history.

**Pro-tip**: If you notice the AI "forgetting" a critical instruction from 10 minutes ago, it's better to occasionally use the **"Clear Chat"** (or start a new session) to reset the KV cache, or just re-state the key constraint in your latest prompt.