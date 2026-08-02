## Plan: LiteChat UX Parity + Shared Attachments

Implement targeted LiteChat and shared chat-surface upgrades so LiteChat reaches Workspace-level message fidelity (markdown, export, richer metadata) while introducing a reusable attachment foundation for both LiteChat and Workspace. Use a two-phase attachment approach: Phase 1 delivers images + docs via inline prompt context; Phase 2 is documented as multipart/file-reference evolution.

**Steps**
1. Add a shared chat message rendering layer for LiteChat that mirrors Workspace markdown behavior.
   - Reuse the same markdown stack already proven in Workspace message rendering: ReactMarkdown + remark-gfm + remark-math + rehype-katex.
   - Replace LiteChat’s plain text message body rendering with markdown rendering for bot responses (and optionally user messages for consistency), preserving existing bubble styling and typing state.
   - Dependency: independent.
2. Extend LiteChat message metadata model and population path to support footer telemetry.
   - Expand LiteChat message type to include metadata fields needed by UI: provider, model, duration/latency, tokens, timestamp, and optional usage details.
   - In useLiteRtChat cloud path, populate metadata from /chat/quick response when available, with client-side fallback estimation for duration/tokens.
   - In local path, compute/assign local metadata (engine local, elapsed time, estimated token count).
   - Dependency: independent.
3. Enhance backend quick response payload for first-class footer accuracy.
   - Update /api/chat/quick response to include stable telemetry keys (provider, model, duration_ms or seconds, token estimates/usage) in addition to existing reply and optional conversation_id.
   - Keep existing auth and persistence behavior unchanged.
   - Dependency: parallel with step 2 (frontend should handle both old/new payloads for compatibility).
4. Implement LiteChat agent-response footer redesign.
   - Update LiteChat bot bubble footer format to show provider icon + model on left and time taken + tokens used right-justified.
   - Reuse provider icon lookup pattern from provider metadata map and keep engine/accelerator indicators only where still relevant.
   - Ensure footer gracefully degrades when some metadata is unavailable.
   - Dependency: depends on steps 1-2.
5. Update LiteChat user/footer controls and remove obsolete status pill.
   - Remove “Web Engine Online” pill/tag from the LiteChat footer strip.
   - Replace right-side delete icon control with a “Clear Chat” button that opens a confirmation prompt warning that history will be lost.
   - Add “Export Chat” action beside “Clear Chat”, using the Workspace export schema/pattern for JSON session export.
   - Dependency: independent; export mapping depends on message metadata from step 2 for richer output.
6. Add large-screen Model Configuration panel toggle without breaking current responsive behavior.
   - Introduce a desktop-visible toggle control (same panel intent as small/medium drawer toggle) to show/hide the right Model Configuration rail on large screens.
   - Preserve existing small/medium drawer behavior and breakpoints; do not replace with a single unified behavior.
   - Keep existing keyboard/escape interactions for mobile drawer untouched.
   - Dependency: independent.
7. Implement shared attachment feature (Phase 1 delivery) across LiteChat and Workspace.
   - Create reusable attachment state + UI primitives usable by both LiteChat composer and Workspace ChatInput (selected files pills, remove action, clear state).
   - Support selected types for this phase: images (png/jpg/webp/gif) and docs (md/txt/pdf).
   - On send, append normalized attachment context into message payload (inline transport) for both chat flows.
   - For Workspace websocket flow, include attachment context in outgoing payload message body (or explicit attachments field if backend already accepts it); for LiteChat /chat/quick use prompt augmentation in request body.
   - Dependency: independent from markdown/footer; can run in parallel.
8. Create dedicated filesystem TODO plan for attachment Phase 2.
   - Add a new docs plan file under docs/plans describing multipart upload + file-reference architecture, API contract, storage/security constraints, and migration path from inline mode.
   - Include risks, size limits, MIME validation, and backwards compatibility notes.
   - Dependency: after step 7 design decisions are codified.
9. Verify end-to-end behavior and regressions.
   - Validate markdown rendering (tables, lists, code blocks, math) in LiteChat.
   - Validate footer telemetry layout and right-justification on desktop/mobile.
   - Validate clear-confirm flow, export output shape, and removal of obsolete footer pill.
   - Validate desktop panel toggle behavior at lg+ and existing sm/md interactions.
   - Validate attachments for both LiteChat and Workspace with supported file types.

**Relevant files**
- client/src/pages/LiteChat.tsx — replace plain message rendering; update bot footer layout; remove old footer pill; add clear confirmation + export action; add desktop Model Configuration toggle and conditional right-rail rendering.
- client/src/hooks/useLiteRtChat.ts — extend LiteMessage metadata shape; compute/populate provider/model/time/tokens for local/cloud; include attachments context in quick-chat payload generation path.
- backend/api/chat.py — enhance /quick response payload with telemetry metadata while preserving current reply/conversation behavior.
- client/src/components/chat/MessageItem.tsx — source reference for markdown + KaTeX rendering patterns and metadata footer semantics.
- client/src/pages/Workspace.tsx — source reference for export payload structure and download behavior.
- client/src/components/chat/ChatInput.tsx — implement shared attachment UI integration for Workspace path (replace placeholder alert).
- client/src/types/chat.ts — reference existing metadata conventions to align schema and avoid drift between Workspace and LiteChat.
- client/src/components/providerMeta.ts and client/src/components/ProviderIcon.tsx — provider label/icon resolution for LiteChat response footer.
- docs/plans/#67_implementation_plan.md — current plan context to extend with this scope.

**Verification**
1. In LiteChat, send markdown-heavy prompts and confirm rendering parity with Workspace patterns (headings/lists/code/math/tables).
2. In LiteChat cloud mode, confirm bot footer shows provider icon + model and right-aligned time + token metrics.
3. In LiteChat local mode, confirm footer still renders sensible fallback telemetry.
4. Confirm “Web Engine Online” is removed from footer.
5. Click “Clear Chat”, verify confirmation appears, cancel keeps history, confirm clears visible history.
6. Click “Export Chat”, verify downloaded JSON shape aligns with Workspace export fields and includes message metadata when present.
7. On large screens, toggle Model Configuration panel on/off and verify no regression to sm/md drawer interactions.
8. Attach supported image/doc files in LiteChat and Workspace, send message, and verify attachment context is included in outbound payload and reflected in agent response quality.
9. Run frontend type-check/lint and backend checks for changed files.

**Decisions**
- Attachment scope for this pass: images (png/jpg/webp/gif) + documents (md/txt/pdf).
- Attachment transport strategy: two-phase plan; implement inline context now, document multipart/file-reference as next phase.
- Keep existing responsive behavior patterns; only add desktop toggle capability rather than replacing panel logic.

**Further Considerations**
1. For PDF handling in Phase 1, decide whether to send filename/size only or client-side text extraction where feasible.
2. Define max attachment count and aggregate payload size limits to protect quick-chat latency.
3. Consider a shared chat-export utility to avoid duplicate export logic between Workspace and LiteChat.