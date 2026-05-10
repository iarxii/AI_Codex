# Implementation Plan - Robust Space-Aware Provider Switching

This plan addresses the "API Key Failure" when switching between specialized spaces (like Trading Space) and general chat. It refactors the hardcoded backend overrides into a recommendation system and ensures the backend always has access to the correct API keys for all providers.

## User Review Required

> [!IMPORTANT]
> The "Financial Trading Space" will still default to **OpenRouter / DeepSeek R1** as recommended, but you will now be able to override this selection in the UI (e.g., switching to Ollama Cloud) without the backend forcing you back to OpenRouter.

> [!NOTE]
> All your API keys will now be sent to the backend in an encrypted-at-rest (if configured) or secure WebSocket stream to allow the agent to switch providers dynamically if needed by a specific "Space" skill.

## Proposed Changes

### 1. Backend Core & Config
Refactor how spaces define their "preferred" models.

#### [MODIFY] [space_config.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/space_config.py)
- Rename `provider_override` to `recommended_provider`.
- Rename `model_override` to `recommended_model`.
- Remove the "enforced" nature of these settings to allow user overrides.

#### [MODIFY] [chat.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/chat.py)
- Update `run_agent_task` to accept `api_keys` (a dictionary of all keys).
- Change the provider resolution logic:
    1. Use the provider/model from the payload if provided.
    2. Fallback to `recommended_provider`/`model` only if the payload is empty or set to "default".
    3. Retrieve the final `api_key` from the `api_keys` map based on the resolved provider.

---

### 2. Frontend Context & UI
Enable the frontend to share all keys and respond to recommendations.

#### [MODIFY] [AIContext.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/contexts/AIContext.tsx)
- Add `getAllApiKeys()` function to the context.
- Update `CodexSpace` interface to include `recommended_provider` and `recommended_model`.

#### [MODIFY] [Chat.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/Chat.tsx)
- Update `handleSend` to package all API keys into the `api_keys` payload field.
- Logic to automatically apply space recommendations when a new space conversation is created (while allowing manual override).

#### [MODIFY] [SettingsModal.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/SettingsModal.tsx)
- (Self-Correction from previous error): Ensure `setModel` is correctly scoped and used.

---

### 3. UI Persistence & Layout Fixes
Address the "Alpha Terminal" strip bleeding into other spaces.

#### [MODIFY] [Chat.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/Chat.tsx)
- Tighten the `activeSpace` synchronization logic to ensure it resets immediately when switching to a "General" conversation.
- Add an explicit check in the render block to only show the `TradingSpaceHeader` if `activeSpace?.slug === 'trading-space'`.

#### [MODIFY] [ChatHeader.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/chat/ChatHeader.tsx)
- Add a transition effect when the header sub-component changes to prevent visual ghosting of previous space headers.

### 4. Space Management
Ensure space metadata is correctly propagated.

#### [MODIFY] [spaces.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/spaces.py)
- Update `SpaceRead` Pydantic model to include recommendation fields if necessary (or just pass through `config_json`).

## Verification Plan

### Automated Tests
- No automated tests for WebSocket flows, will rely on manual verification.

### Manual Verification
1. **Scenario: Manual Override**
   - Enter **Trading Space**.
   - Select **Ollama Cloud** / **cogito-2.1:671b**.
   - Send message: "What is the DXY?"
   - Verify in terminal logs that the backend uses `ollama_cloud` and does NOT attempt to use OpenRouter.
2. **Scenario: Space Recommendation**
   - Create a NEW workspace in **Trading Space**.
   - Verify the UI defaults to **OpenRouter / DeepSeek R1** (if keys are available).
   - Send message and verify successful authentication using the OpenRouter key.
3. **Scenario: Multi-Key Security**
   - Ensure that if a key for a specific provider is missing, a friendly "API Key Missing" error is returned for that specific provider.
