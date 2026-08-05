# Web Client + Backend Performance Improvement Plan

## Current Status (2026-08-05)
- Implementation has started.
- Phase 1 (stream transport and client update cadence) is partially complete.
- Remaining work is now concentrated in rendering strategy, logging cleanup, and observability.

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

## Outstanding Work
1. Streaming render strategy: switch bot streaming view to plain-text preview and defer full Markdown/KaTeX render.
2. Thought trace scaling: cap retained trace details and batch heavy detail updates.
3. Large-history rendering: virtualize historical message/trace surfaces to avoid full tree work.
4. Hot-path log noise: remove remaining per-token/verbose terminal prints from production stream loops.
5. Performance logging backend: replace synchronous file writes in `log_performance` with queued/structured telemetry.
6. Observability: add request-level stream metrics (event count, byte count, flush count, TTFT, total latency, long-task indicators).
7. Integrity handling on client: enforce `final_seq` and `final_length` verification and recovery behavior.
8. Re-profiling pass with real workloads after items above are complete.

## Original Plan Tracking
- [x] 1. Switch WebSocket token contract from full accumulated content to delta chunks.
- [x] 2. Add server-side stream coalescing (flush every 50-100ms or one frame equivalent).
- [x] 3. Add sequence numbers and final checksum/length to ensure deterministic client reconstruction.
- [x] 4. In client stream handlers, buffer token deltas in refs and publish state on a throttled cadence.
- [ ] 5. During streaming, render plain text preview; defer full Markdown/KaTeX parsing until completion (or low-frequency checkpoints).
- [~] 6. Cap and batch updates to thought trace entries/details. (partially improved via stream buffering; explicit retention limits still pending)
- [ ] 7. Virtualize historical trace/log surfaces and avoid mapping full arrays on every token event.
- [~] 8. Remove per-token terminal/debug logging in production paths; keep opt-in debug sampling only. (partially reduced, not complete)
- [ ] 9. Replace synchronous performance file writes with structured, queued logging/telemetry emission.
- [x] 10. Stop emitting non-consumed context telemetry events per node, or gate them behind debug mode.
- [ ] 11. Add request-level metrics: inbound/outbound event count, streamed bytes, flush count, TTFT, total latency, and long-task indicators.
- [ ] 12. Re-profile before any desktop/runtime migration decisions (React Native/Tauri/Electron), since transport/render costs are current primary bottlenecks.

## Priority Order
1. Streaming render strategy (plain-text live view, deferred Markdown/KaTeX parse).
Reasoning: this is the largest remaining UI-thread hotspot after stream transport optimization.
2. Trace retention + virtualization for history-heavy sessions.
Reasoning: prevents render cost from scaling linearly with conversation length and trace verbosity.
3. Logging cleanup in stream hot paths.
Reasoning: avoids backend CPU and stdout I/O overhead during token-heavy responses.
4. Structured queued performance telemetry.
Reasoning: keeps observability while removing sync file-write stalls and improving metric quality.
5. End-to-end stream metrics and integrity checks (`final_seq`, `final_length`).
Reasoning: enables measurable regression detection and robust client recovery.
6. Re-profile and compare against baseline.
Reasoning: verifies impact before any architectural migration decisions.

## Next-Step Tasks (Ready To Implement)
1. Add `isStreaming` render mode in chat message rendering to bypass markdown parsing while `status === "typing"`.
Why now: directly reduces repeated parse cost during token flow.
2. Add trace retention caps (entry count and detail length) and low-frequency detail updates.
Why now: bounds memory/render work in long or tool-heavy sessions.
3. Introduce list virtualization for long message/trace lists.
Why now: controls DOM and reconciliation cost for large histories.
4. Remove remaining stream-loop `print(...)` debug logs or guard behind explicit debug env flag.
Why now: reduces backend overhead and log noise under load.
5. Implement structured telemetry emitter for `LLM_REASONING` and `TOOL_CALL` metrics.
Why now: replaces sync writes with safer production-grade observability.
6. Add stream counters and payload-size metrics to final telemetry payload.
Why now: gives concrete data to tune flush interval and confirm throughput gains.

## Notes
- Local LiteRT generation is currently unavailable, so it is not the active UI-thread bottleneck right now.
- Focus first on the Workspace WebSocket stream path and chat rendering surfaces.