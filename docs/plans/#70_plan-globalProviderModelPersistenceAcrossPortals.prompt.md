## Plan: Global Provider/Model Persistence Across Portals

Unify provider/model persistence behavior between Workspace and LiteChat by using shared localStorage semantics, cross-tab/route synchronization, and deterministic fallback logic for LiteChat’s cloud-only provider scope. Keep scope focused to selection persistence only (no broader SettingsModal redesign).

**Steps**
1. Establish a single persistence contract for portal state (*foundation*).
   - Define shared keys already in use: `ai_provider`, `ai_model_<provider>`, `ai_model`.
   - Define LiteChat-specific key: `litert_engine_mode`.
   - Document fallback rule approved by user: if Workspace provider is `local`, LiteChat falls back to last valid cloud provider.

2. Add cross-portal rehydration in Workspace context (*depends on 1*).
   - In `AIContext`, add a `storage` listener that updates in-memory `provider` and selected model when keys change, so Workspace reflects changes made in LiteChat without reload.
   - Ensure listener ignores invalid providers and keeps existing safety behavior.

3. Harden LiteChat provider/model initialization and fallback chain (*depends on 1*).
   - Ensure LiteChat resolves provider from shared storage with this priority:
     1) stored cloud provider if valid,
     2) last known cloud provider,
     3) `ollama_cloud` fallback.
   - Ensure selected model for resolved provider is read from `ai_model_<provider>` consistently.

4. Persist LiteChat engine mode explicitly (*parallel with 2-3*).
   - Read `litert_engine_mode` during LiteChat init.
   - Write `litert_engine_mode` whenever mode toggles.
   - Keep behavior isolated: engine mode persistence should not overwrite provider/model state.

5. Normalize write paths for both portals (*depends on 2-4*).
   - Workspace writes through `AIContext.setProvider`/`setModel` remain source of truth.
   - LiteChat writes (`setProvider`, `selectModel`) must always update the shared keys in same format.
   - Ensure no duplicate or conflicting key names are introduced.

6. Apply deterministic local-to-cloud fallback behavior in LiteChat runtime (*depends on 3,5*).
   - When entering LiteChat and stored provider is non-cloud (e.g., `local`), switch to remembered cloud provider without mutating Workspace state.
   - Keep user-facing behavior stable: no unexpected provider resets while inside Workspace.

7. Validation and regression checks (*depends on 2-6*).
   - Manual workflow checks:
     1) set provider/model in Workspace -> open LiteChat -> confirm selection is mirrored (or fallback for local).
     2) set provider/model in LiteChat -> return Workspace -> confirm updates appear without hard reload.
     3) toggle LiteChat local/cloud engine mode -> reload route -> confirm mode persistence.
     4) verify local Workspace provider does not break LiteChat; it uses last cloud provider.
   - Run targeted diagnostics on changed files and resolve any type/lint issues.

**Relevant files**
- `c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/contexts/AIContext.tsx` — add storage-based rehydration of provider/model state.
- `c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/hooks/useLiteRtChat.ts` — unify provider/model reads+writes and add `litert_engine_mode` persistence.
- `c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/config/providerConfig.ts` — reuse/confirm cloud provider allowlist behavior.
- `c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/LiteChat.tsx` — no structural redesign; verify route behavior after hook persistence updates.

**Verification**
1. In Workspace, choose `openai` + model A; switch to LiteChat and confirm `openai` + model A loads.
2. In LiteChat, choose `anthropic` + model B; switch back to Workspace and confirm `anthropic` + model B updates live.
3. In Workspace, choose `local`; switch to LiteChat and confirm fallback to last cloud provider (not forced reset each time).
4. In LiteChat, toggle engine mode and refresh route; confirm mode persists via `litert_engine_mode`.
5. Run diagnostics for `AIContext.tsx` and `useLiteRtChat.ts`.

**Decisions**
- Approved fallback policy: LiteChat uses last cloud provider when Workspace is `local`.
- Scope includes provider/model/engine-mode persistence only.
- Scope excludes SettingsModal redesign and server-side profile schema changes for this pass.

**Further Considerations**
1. Optional next step: add server-backed sync for these keys across devices/sessions.
2. Optional next step: surface a subtle tooltip in LiteChat when fallback from `local` to cloud occurs.