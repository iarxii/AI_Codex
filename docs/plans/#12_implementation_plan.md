# Optimize Local LLM System Prompt and KV Cache Bottlenecks

This plan addresses the performance bottlenecks encountered when running the local 1.5b LLM (`lfm2.5-thinking:latest`) on Ollama with an Intel iGPU. Even with a small model, the agentic UI and extensive system prompts result in a massive context window, leading to KV cache explosion and slow inference times.

## User Review Required

> [!WARNING]
> To fully address the KV cache bottleneck as indicated by the Google search feedback, we need to leverage **RotorQuant**. RotorQuant compresses the KV cache using Clifford algebra rotors, offering up to 10-19x faster quantization on GPUs. However, RotorQuant is currently not available in mainline `llama.cpp` or standard Ollama distributions; it requires a custom community fork (e.g., `llama-cpp-turboquant`).
> **Action Required**: Please confirm if you are open to replacing the standard Ollama backend with a custom `llama-cpp-turboquant` build, or if we should implement a wrapper that routes local requests to a custom server running this engine.

## Open Questions

> [!IMPORTANT]
> 1. Should I provide an installation script to pull and compile the `llama-cpp-turboquant` fork for your Intel iGPU?
> 2. For the System Prompt optimization, do you want to keep the current `SOUL`, `MEMORY`, and `AGENTS` structure, but compress them programmatically, or should I rewrite the static markdown files to be much shorter?

## Proposed Changes

### System Prompt & Context Optimization

The `ContextBuilder` dynamically pulls from multiple large sources. For local models on iGPUs, we must enforce stricter budgets.

#### [MODIFY] `c:\AppDev\My_Linkdin\projects\iarxii\AI_Codex\backend\agent\profile.py`
- Refactor `build_system_prompt` to introduce a "minimal mode" for local LLMs, stripping out verbose operating procedures and focusing strictly on tool syntax.
- Compress the XML-like tags to reduce overhead.

#### [MODIFY] `c:\AppDev\My_Linkdin\projects\iarxii\OllamaOpt\cli\context\builder.py`
- Update the `ContextPolicy` budget parameters to enforce a lower `total_hard_cap_chars` specifically when a local provider is detected.
- Implement an aggressive context shedding algorithm for older history segments to preserve KV cache size.

### Code Quality & Benchmarks

#### [NEW] Local Benchmark & QA Execution
- Run `code_quality_checker.py` and `pr_analyzer.py` from the `code-reviewer` agent skill on the `backend/agent` and `OllamaOpt` directories.
- Execute the optimized `latency_probe.ps1` against `lfm2.5-thinking:latest` to measure baseline TTFT (Time To First Token) and token generation speed.

## Verification Plan

### Automated Tests
- Run `latency_probe.ps1 lfm2.5-thinking:latest` before and after the System Prompt trimming to measure the change in TTFT.
- Run the code reviewer static analysis on modified files.

### Manual Verification
- Deploy the updated `AI_Codex` backend.
- Test the Web UI with `lfm2.5-thinking:latest` and monitor the console to verify context payload reduction.
- Check RAM/VRAM usage using the `gpu_diagnostics.bat` script during inference.
