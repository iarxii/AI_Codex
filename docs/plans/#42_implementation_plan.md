# Implementation Plan — Colab Notebook Overhaul for Custom Llama.cpp & Hot-Reloading

This plan outlines the complete overhaul of `docs/notebooks/AICodex_Spirit_Bird.ipynb` to transition from legacy Ollama App dependencies to our custom compiled `llama-cpp-turboquant` (RotorQuant) pipeline, support hot-reloading of backend source code, print clear connection details, and clean up all remaining `localhost:11434` references.

## User Review Required

> [!IMPORTANT]
> **Complete Notebook Overhaul Details**:
> 1. **Custom Engine Compilation**: Instead of downloading default precompiled binaries, the notebook will compile `llama-cpp-turboquant` natively inside the Linux container with full CUDA support. This ensures compatibility with the RotorQuant 3-bit symmetric KV cache quantizations (`planar3`).
> 2. **Uvicorn Hot Reloading**: The Uvicorn process will be launched with `--reload` from `/content/AI_Codex` so that code edits in the notebook environment or during synchronization trigger automatic hot-reloads of the FastAPI backend.
> 3. **Highlighted API Secrets and URL**: We will print out the Ngrok Tunnel Public URL and the Handshake Keys in a formatted, copy-pasteable banner on startup, making it easy to configure the VSCode extension or Web Client.
> 4. **Purging Legacy Ollama (11434)**: All verification, health checks, and report blocks will target the custom `llama-server` port `8080` (OpenAI compatible `/v1/models`) instead of the legacy `localhost:11434` Ollama daemon.

Please confirm if this set of changes matches your required overhaul.

## Proposed Changes

### Jupyter Notebook

#### [MODIFY] [AICodex_Spirit_Bird.ipynb](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/docs/notebooks/AICodex_Spirit_Bird.ipynb)

We will rewrite and update the following cells inside the notebook:

- **Cell #4 (Setup Quantized Llama.cpp Model Provider)**:
  - Add logic to check for `/content/llama-cpp-turboquant` directory.
  - Clone `https://github.com/johndpope/llama-cpp-turboquant.git` and checkout `feature/planarquant-kv-cache`.
  - Compile the engine using CMake with CUDA: `cmake -B build -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release && cmake --build build --config Release -j $(nproc)`.
  - Start the custom binary `./build/bin/llama-server` on port `8080` with `--cache-type-k planar3 --cache-type-v planar3` targeting the persistent Google Drive Gemma 4 QAT GGUF model path.

- **Cell #7 (Ngrok Tunnel Setup & Start Backend)**:
  - Configure the Ngrok tunnel on port `9173`.
  - Print a clear, formatted console banner displaying:
    - **Colab Backend Public URL** (e.g. `https://xxxx.ngrok-free.app`)
    - **Handshake Secret / API Key** (`SECRET_KEY` or `TOKEN`)
  - Run uvicorn with hot-reloading: `["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "9173", "--reload"]`.

- **Cell #8 (Health Check)**:
  - Modify the connection test block to query the FastAPI backend (`http://localhost:9173`) and the custom model server (`http://localhost:8080/v1/models`).
  - Remove all requests to the deprecated `11434` port.

- **Cell #10 (Verification Test)**:
  - Replace the legacy `http://localhost:11434/api/tags` connection check with a verify request against `http://localhost:8080/v1/models`.

- **Cell #11 (Deployment Report)**:
  - Rewrite the markdown summary to document the custom `llama-server` / `llama-cpp-turboquant` build, custom port configuration, and the unified `llamacpp` backend orchestration.

---

## Verification Plan

### Manual Verification
1. We will run our update script to apply these changes to the notebook file.
2. We will inspect the notebook JSON cells to confirm all changes are correctly placed and formatted.
