# Ollama App vs. llama.cpp (llama-server)

## The Fundamental Relationship

**Ollama wraps llama.cpp.** They are not competing tools — they are different layers of the same stack.

```
┌───────────────────────────────────────────┐
│  Ollama App                               │
│  ┌─────────────────────────────────────┐  │
│  │  Model Management (pull, push)      │  │
│  │  OpenAI-Compatible REST API         │  │
│  │  Chat Template Auto-Application     │  │
│  │  Multi-Model Hot-Swap               │  │
│  │  ┌──────────────────────────────┐   │  │
│  │  │   llama.cpp (core engine)    │   │  │
│  │  │   • GGUF tensor loading      │   │  │
│  │  │   • GPU kernel dispatch      │   │  │
│  │  │   • KV cache management      │   │  │
│  │  │   • Token sampling           │   │  │
│  │  └──────────────────────────────┘   │  │
│  └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

---

## Quick Comparison

| Feature | Ollama App | Raw llama-server |
|---------|-----------|-----------------|
| **Model management** | `ollama pull qwen3:8b` | Manual GGUF download |
| **API style** | OpenAI-compat `/v1/chat/completions` | Native `/completion` + `/v1/chat/completions` |
| **Chat templates** | Auto-applied per model (via Modelfile) | Manual: `--jinja` flag or raw prompt |
| **Multi-model** | Hot-swaps on the fly | One model per server instance |
| **GPU layer control** | Limited (via `OLLAMA_GPU_LAYERS` env or Modelfile) | Full: `--n-gpu-layers`, `--tensor-split` |
| **KV cache tuning** | None exposed | `--cache-type-k q8_0`, `--cache-type-v q8_0` |
| **Quantization format** | GGUF (from Ollama registry, pre-quantized) | GGUF (manual `llama-quantize`, custom calibration) |
| **Slot/session management** | Internal only | Full: `--slot-save-path`, `--slot-id` |
| **Ease of use** | ★★★★★ (pull and go) | ★★☆☆☆ (flags, config, manual everything) |
| **Performance ceiling** | Good (sensible defaults) | Highest (full control over every parameter) |

---

## When to Use Each

### Use Ollama When:
- You want to **quickly try different models** without managing files
- You need **automatic chat template handling** (Ollama reads the Modelfile)
- You're running **multiple models** and want to switch via API
- You want OpenAI-compatible API out of the box
- You prefer simplicity over maximum performance tuning

### Use llama-server When:
- You need to **squeeze maximum performance** from a single model
- You want **custom quantization** (imatrix-calibrated Q4_K_M, IQ2_M, etc.)
- You need **KV cache optimization** for long-context workloads
- You're running a **dedicated single-model server** (e.g., production deployment)
- You need **slot management** for multi-session inference

---

## Model Format

**Both use GGUF.** This is the only format that matters for local inference:
- GGUF = GG Universal Format, created by the llama.cpp project
- Ollama's registry stores pre-quantized GGUFs; you can also import custom GGUFs via `ollama create`
- Common quantization levels: Q4_K_M (balanced), Q5_K_M (higher quality), Q8_0 (near-full), IQ2_M (extreme compression)

---

## AICodex Pipeline Integration

The AICodex pipeline supports **both backends** via a toggle:

| Mode | Backend | Template Handling | Best For |
|------|---------|-------------------|----------|
| **Ollama** (default) | Ollama App on `:11434` | Automatic (Modelfile) | Multi-model switching, quick setup |
| **llama.cpp** | llama-server.exe on `:8080` | Manual (NativeLocalClient) | Max performance, custom quants |

Configuration: Set `LOCAL_BACKEND_MODE` in `.env` to `"ollama"` or `"llamacpp"`.

---

## Available Local Models (Current System)

| Model | Size | Template | Ollama | Notes |
|-------|------|----------|--------|-------|
| qwen2.5-coder:3b | 1.84 GB | ChatML | ✅ Installed | Best for coding tasks |
| llama3.2:3b | 1.93 GB | Llama-3 | ✅ Installed | General purpose |
| deepseek-r1:7b | 4.47 GB | DeepSeek | ✅ Installed | Reasoning/thinking |
| lfm2.5-thinking | 731 MB | — | ✅ Installed | Lightweight reasoning |
| all-minilm | 45 MB | — | ✅ Installed | Embeddings only |

### Planned Additions
- **GLM-4 9B** — Strong reasoning, different training distribution from Qwen
- **Qwen3 8B** — Upgraded general-purpose model with native tool calling
