# UI Enhancements Implementation Plan

This plan addresses the UI feedback provided in the recent screenshot, focusing on improving the usability and aesthetics of the chat interface and sidebar.

## Proposed Changes

### Backend API
We need to add a small backend route to support updating conversation titles from the sidebar.

#### [MODIFY] `conversations.py` (file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/conversations.py)
- **Action:** Add a `PUT /{conversation_id}` route.
- **Details:** This route will accept a `ConversationCreate` payload (or a similar `ConversationUpdate` schema) to update the `title` of an existing conversation.

---

### Client Frontend
We will implement the requested visual and functional changes in the React UI.

#### [MODIFY] `Sidebar.tsx` (file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/Sidebar.tsx)
- **Action:** Implement "Add Title" functionality.
- **Details:** 
  - Add state (`editingId`, `editValue`) to track when a user is renaming a session.
  - Add an "edit" (pencil) icon next to the active session title.
  - When editing, display a small input field. On blur or enter, send a `PUT` request to update the title, then refresh the conversation list.

#### [MODIFY] `Chat.tsx` (file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/Chat.tsx)
- **Action:** Implement "Agent Card" click logic.
  - **Details:** Make the `Workspace #ID` header text clickable. For now, it will trigger an alert or a simple placeholder modal saying "Onboarding Form / Data (Coming Soon)".
- **Action:** Add orange border to the Thinking Process box.
  - **Details:** Change the container's `border-black/[0.05]` utility class to `border-[#FF6600]/40` to make it visually distinct as requested.
- **Action:** Fix "Too long" duration formatting.
  - **Details:** Create a small helper function to format the total seconds (e.g. `241.43s`) into a more readable format (e.g., `4m 01s` or simply dropping the decimals if > 60s) to save horizontal space and improve readability.

## User Review Required

> [!WARNING]
> **Onboarding Form Placeholder**
> We currently do not have an "Onboarding Form" component built. My plan is to add an `onClick` event that triggers a temporary alert `alert("Show Onboarding Form/Data")` on the Agent Card. Once the onboarding form is designed, we can wire it up fully. Let me know if you prefer a placeholder modal instead of an alert.

## Verification Plan

### Manual Verification
- Rename a session in the Sidebar and ensure the new title persists after a page reload.
- Click the "Workspace #ID" header and confirm the placeholder alert appears.
- Trigger a local LLM reasoning cycle and verify the Thinking Process box has an orange border and its total duration is formatted elegantly (e.g., `1m 20s` instead of `80.43s`).
