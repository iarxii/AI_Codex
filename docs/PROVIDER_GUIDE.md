# LLM Provider & Troubleshooting Guide

AICodex supports 5 major LLM providers. Each has specific requirements and common failure modes.

## 1. Local Neural Core (llama-server.exe / Ollama)

This is your primary development provider. It uses the `ChatOpenAI` adapter for maximum tool-calling compatibility.

### Standard Setup
- **Endpoint**: `http://localhost:11434`
- **Model**: `llama3.2:3b` or `qwen2.5-coder:7b`
- **AICodex Routing**: AICodex automatically appends `/v1` to your `OLLAMA_BASE_URL`.

### 🚨 Troubleshooting: "llama-server works but AICodex doesn't"
If you can chat via the llama.cpp Web UI but AICodex is silent:
1. **Tool Binding**: AICodex tries to bind "skills" (tools) to the model. Many local models (like `lfm2.5-thinking`) do NOT support function calling. AICodex now automatically detects this and falls back to a plain message, but if your model is specifically failing, try disabling tool use in settings.
2. **V1 Suffix**: `llama-server.exe` (turboquant) is an OpenAI-compatible server. Ensure it is listening on the port configured in your `.env`.
3. **KV Cache Explosion**: Local hardware may freeze if the context window is too large. Check `docs/ROTORQUANT_REFERENCE.md` for optimization tips.

---

## 2. Google Gemini

Highly recommended for high-speed, large-context reasoning.

- **Setup**: Get an API key from [Google AI Studio](https://aistudio.google.com/).
- **Model Format**: `gemini-1.5-flash` or `gemini-1.5-pro`.
- **Note**: AICodex handles the `models/` prefix automatically. You can just enter the model name.

---

## 3. Ollama Cloud

Used for remote execution or team-hosted Ollama instances.

- **Setup**: Requires a publicly accessible URL (or Tailscale/VPN).
- **Authentication**: Uses the API key provided in the UI as a Bearer token.

---

## 4. Groq (LPU)

The fastest provider for rapid reasoning.

- **Setup**: Get a key from the [Groq Cloud Console](https://console.groq.com/).
- **Models**: `llama3-70b-8192`, `mixtral-8x7b-32768`.
- **Failure Mode**: Often fails if the request contains too many system tokens. Use the "Compressed Prompt" setting.

---

## 5. OpenRouter

A unified gateway to hundreds of models.

- **Status**: **De-prioritized**.
- **Issue**: API can be janky, and free models frequently return `quota_usage` errors even when credits are available.
- **Recommended Models**: `meta-llama/llama-3-8b-instruct:free`.

---

## Provider Compatibility Matrix

| Provider | Tool Calling | Streaming | Best Use Case |
|:---------|:-------------|:----------|:--------------|
| **Local** | ⚠️ Partial | ✅ Yes | Privacy & Local File Ops |
| **Gemini** | ✅ Full | ✅ Yes | Large Context / Research |
| **Groq** | ✅ Full | ✅ Yes | Speed / Code Debugging |
| **Ollama Cloud**| ✅ Partial | ✅ Yes | Remote Collaboration |
| **OpenRouter** | ✅ Full | ✅ Yes | Experimental Models |

---

## Debugging Workflow

If a model is not responding:
1. Check the **Backend Terminal**. AICodex now logs `DEBUG: Initializing LLM Provider` for every request.
2. Look for `PIPELINE ERROR`. If it says `401 Unauthorized`, check your API key in the UI.
3. Look for `PIPELINE EXCEPTION`. This now includes a full stack trace to identify exactly where the connection broke.
