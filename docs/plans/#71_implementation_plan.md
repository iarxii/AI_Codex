# Web Client + Backend Performance Improvement Plan

## Current Status (2026-08-05)
- Implementation has started.
- Phase 1 (stream transport and client update cadence) is complete.
- Phase 2 (render-path and trace-scaling optimizations) is complete.
- Stream metrics and integrity enforcement are implemented in the active Workspace flow.
- Structured backend performance logging is now queued and non-blocking.
- Remaining work is now concentrated in re-profiling/benchmarking and optional integrity auto-recovery hardening.

## Scope
- Reduce UI thread pressure during streamed responses.
- Reduce backend stream overhead and noisy hot-path logging.
- Improve observability for stream throughput and render cost.

## What Was Done
1. WebSocket token transport switched to delta frames for active backend streaming paths.
2. Server-side token coalescing added with ~75ms flush cadence (within the 50-100ms target).
3. Sequence numbers and final message metadata added (`final_seq`, `final_length`).
4. Workspace client now supports `token_delta` and legacy `token` for backward compatibility.
5. Workspace stream updates now use buffered refs plus throttled UI flush (~75ms).
6. Context telemetry emission is now gated behind a debug flag (`debug_context_telemetry`) instead of always-on.
7. Stream buffers are reset/cleaned on completion, teardown, and new request/retry paths.
8. Streaming assistant messages now use a plain-text preview path while typing; markdown/math rendering resumes after completion.
9. Thought trace retention caps were added (entry count and detail size clamping) to bound memory and render work.
10. Stream-loop print logging in backend chat transport was removed/replaced with logger calls and debug-gated pipeline logging.
11. Backend final telemetry now reports stream metrics (chunk counts, byte/char counts, flush counts, final sequence/length).
12. Client now validates `final_seq` and `final_length` on `done`, records integrity metadata, and annotates mismatch warnings.
13. Lightweight windowing was added for long message histories and long thought-trace histories (progressive "load older" rendering).
14. Backend `log_performance` now queues structured JSONL telemetry to a background writer thread instead of performing synchronous file writes in request/tool paths.

## Outstanding Work
1. Re-profiling pass with real workloads after the queue-based logging and UI improvements.
2. Optional hardening: add automatic recovery flow on integrity mismatch (retry or request transcript refresh) instead of warning-only behavior.

## Original Plan Tracking
- [x] 1. Switch WebSocket token contract from full accumulated content to delta chunks.
- [x] 2. Add server-side stream coalescing (flush every 50-100ms or one frame equivalent).
- [x] 3. Add sequence numbers and final checksum/length to ensure deterministic client reconstruction.
- [x] 4. In client stream handlers, buffer token deltas in refs and publish state on a throttled cadence.
- [x] 5. During streaming, render plain text preview; defer full Markdown/KaTeX parsing until completion (or low-frequency checkpoints).
- [x] 6. Cap and batch updates to thought trace entries/details.
- [x] 7. Virtualize historical trace/log surfaces and avoid mapping full arrays on every token event.
- [x] 8. Remove per-token terminal/debug logging in production paths; keep opt-in debug sampling only.
- [x] 9. Replace synchronous performance file writes with structured, queued logging/telemetry emission.
- [x] 10. Stop emitting non-consumed context telemetry events per node, or gate them behind debug mode.
- [x] 11. Add request-level metrics: inbound/outbound event count, streamed bytes, flush count, TTFT, total latency, and long-task indicators.
- [ ] 12. Re-profile before any desktop/runtime migration decisions (React Native/Tauri/Electron), since transport/render costs are current primary bottlenecks.

## Priority Order
1. Structured queued performance telemetry.
Reasoning: keeps observability while removing sync file-write stalls and improving metric quality.
2. Re-profile and compare against baseline.
Reasoning: verifies impact before any architectural migration decisions.
3. Optional mismatch auto-recovery workflow.
Reasoning: current warning path is safe but manual; automatic recovery improves robustness for end users.

## Next-Step Tasks (Ready To Implement)
1. Run before/after profiling capture and write baseline vs. current metrics to docs.
Why now: confirms the real impact of transport/render/logging changes and informs any further optimization.
2. Add automatic recovery behavior for stream integrity mismatch (instead of warning-only).
Why now: closes the loop on reliability where network jitter or missed frames may occur.

## Notes
- Local LiteRT generation is currently unavailable, so it is not the active UI-thread bottleneck right now.
- Focus first on the Workspace WebSocket stream path and chat rendering surfaces.