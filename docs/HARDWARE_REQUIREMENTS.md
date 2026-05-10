# Hardware Requirements & Model Guidelines

AI_Codex supports a wide range of Large Language Models (LLMs), from lightweight local models to heavy-weight reasoning models. This guide outlines the hardware requirements and system behaviors for local inference.

## Local Model RAM Requirements

Running models locally via Ollama or `llama.cpp` consumes significant system memory (RAM) and Video RAM (VRAM).

| Model Class | Example Models | Min RAM | Recommended RAM/VRAM |
| :--- | :--- | :--- | :--- |
| **Lightweight** | `llama3.2:3b`, `phi3:mini`, `qwen2.5:1.5b`, `glm-edge:1.5b` | 8GB | 8GB RAM + 4GB VRAM |
| **Standard** | `llama3.1:8b`, `mistral:7b`, `gemma:7b`, `glm-4:9b` | 16GB | 16GB RAM + 8GB VRAM |
| **High-Weight** | `deepseek-r1:7b`, `gemma:27b`, `qwen2.5:14b`, `mistral-nemo` | 16GB | 24GB+ RAM / 12GB+ VRAM |
| **Heavy-Weight** | `deepseek-r1:32b`, `qwen2.5:72b`, `llama3.3:70b` | 32GB | 64GB+ RAM / 24GB+ VRAM |

> [!WARNING]
> **DeepSeek-R1**, **Gemma 3**, and **Qwen 72B** models are particularly resource-intensive. If your local machine has less than 16GB of available RAM, high-weight models may fail to load or result in "Out of Memory" (OOM) errors. For models larger than 30B parameters, 32GB+ RAM is mandatory for stable inference.

## Tool-Calling Fallback Mechanism

Not all local models support native function calling (Tool-Calling). AI_Codex implements a **Robust Fallback Strategy** to ensure a smooth user experience:

1.  **Proactive Detection**: The system uses model name heuristics (`backend/utils/telemetry.py`) to determine if a model is "Tool Capable".
2.  **Telemetry Handshake**: If a model is flagged as incompatible, the UI automatically skips tool binding to prevent crashes.
3.  **Reactive Retry**: If a model returns a `400 Bad Request` (e.g., "model does not support tools"), the backend catches the exception and immediately retries the request in **Text-Only Mode**.

This allows you to use reasoning models like DeepSeek-R1 for complex analysis even if they cannot directly execute code or fetch external data in your current local environment.

## Optimization Tips

1.  **Quantization**: Use 4-bit or 8-bit quantized models (GGUF) to reduce memory footprint.
2.  **Offload Layers**: If you have a dedicated GPU, ensure Ollama is configured to offload as many layers as possible to VRAM.
3.  **Colab Backend**: If your local machine lacks the necessary RAM, consider using the [Google Colab Deployment Guide](COLAB_DEPLOYMENT.md) to run the backend on a high-memory T4/A100 GPU instance.
