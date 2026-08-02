## Plan: Fix /chat/quick 401 + Add LiteChat Sessions with AI Titles

Resolve 401 `Not authenticated` on POST `/api/chat/quick` by standardizing frontend token handling before chat requests while keeping backend chat endpoints strict-auth. In the same implementation stream, add LiteChat session persistence and AI-generated chat titles so chat history behaves like Workspace conversation history.

**Steps**
1. Confirm strict-auth contract on quick chat route: validate `/api/chat/quick` uses `Depends(get_current_user)` and that unauthenticated requests return 401 by design.
2. Audit all frontend quick-chat callers for token usage parity: identify places using raw `localStorage.getItem('token')` instead of `getValidToken()` (*parallel with step 1*).
3. Normalize quick-chat callers to `getValidToken()` and shared auth cleanup behavior so expired tokens are removed before request and UI can react consistently (*depends on 2*).
4. Add consistent 401 handling on quick-chat responses: when response status is 401, call `clearAuthSession()` and surface a clear re-auth prompt in UI state instead of generic network failure text (*depends on 3*).
5. Preserve request forwarding contract while fixing auth path: provider id, model id, API key, and connection params must continue to be passed exactly as today (*parallel with step 4*).

6. Add LiteChat conversation session lifecycle aligned with Workspace:
	- Create/select conversation records via `/conversations` APIs.
	- Track active `conversation_id` in LiteChat state.
	- Load existing messages when a past conversation is selected.
	- Persist user and assistant messages for each send cycle.
7. Extend `/api/chat/quick` payload/flow to accept `conversation_id` and persist messages into `Message`/`Conversation` tables (mirroring Workspace persistence semantics while keeping endpoint lightweight).
8. Reuse AI title generation flow for new LiteChat conversations:
	- Trigger async title generation on first user message when title is default.
	- Reuse/align with existing helper (`generate_cloud_chat_title`) so 3-5 word AI titles appear in history.
9. Add LiteChat chat history UI integration:
	- Add a history list/panel (or reuse existing sidebar history surface) for LiteChat sessions.
	- Show generated titles, updated timestamps, and support selecting prior sessions.
10. Add rename/delete controls for LiteChat sessions using existing conversations endpoints so behavior matches Workspace-level history management.

11. Validate no regression in authenticated chat flows (LiteChat, MiniContextChat, SpiritBird harness) and verify unauthenticated behavior remains explicit/user-readable.
12. Validate session persistence and title generation end-to-end across refresh/reload, including history list correctness and conversation continuity.

**Relevant files**
- `backend/api/chat.py` — `/quick` route auth dependency, quick-chat request processing, and title generation helper (`generate_cloud_chat_title`).
- `backend/api/auth.py` — JWT validation (`get_current_user`), token expiry behavior, and 401 generation path.
- `backend/api/conversations.py` — list/create/update/delete/load conversation APIs used by Workspace history and reusable for LiteChat history.
- `backend/db/models.py` — `Conversation`/`Message` schema contracts used for persistent chat sessions.
- `client/src/hooks/useLiteRtChat.ts` — quick chat request path, token handling, and new active `conversation_id` plus session-aware message lifecycle.
- `client/src/pages/LiteChat.tsx` — UI wiring for session creation, session switching, and history browsing controls.
- `client/src/components/Sidebar.tsx` — reference history implementation pattern (title rendering, fetching, rename/delete interactions).
- `client/src/pages/Workspace.tsx` — reference behavior for creating/selecting conversations and loading prior chat state.
- `client/src/components/chat/MiniContextChat.tsx` — quick chat caller currently using raw token read.
- `client/src/components/chat/SpiritBirdChatHarness.tsx` — quick chat caller currently using raw token read.
- `client/src/utils/authToken.ts` — canonical token validation and auth session cleanup helpers.

**Verification**
1. Authenticated path: login, send chat via LiteChat, MiniContextChat, and SpiritBird harness; verify 200 responses and normal replies.
2. Expired token path: simulate/force expired token in storage, send chat; verify token is cleared and UI shows re-auth needed instead of silent 401 loop.
3. Missing token path: clear auth storage, send chat; verify explicit unauthenticated UX and no repeated failing retries.
4. Session persistence: create new LiteChat session, send messages, refresh page, confirm conversation and messages reload.
5. History browsing: open chat history, verify generated AI titles appear, select old session, and messages hydrate correctly.
6. Title generation: for a newly created session with default title, first user prompt should asynchronously produce a concise AI title in history.
7. Session management parity: rename/delete session operations should reflect immediately in history and backend records.
8. Regression: confirm `/api/models`, provider selection, and Workspace history flows remain stable.

**Decisions**
- Keep backend `/api/chat/quick` strict-auth; do not switch to optional auth in this pass.
- Fix auth via frontend token hygiene + explicit 401 UX handling, not API contract relaxation.
- Add LiteChat persistence using existing conversation infrastructure rather than introducing a separate storage model.
- Use AI-generated titles for LiteChat session history through the existing async title generation pattern.

**Further Considerations**
1. If anonymous quick-chat is needed later, add a separate explicitly public endpoint with rate limiting instead of loosening `/api/chat/quick`.
2. Consider a shared authenticated fetch wrapper to prevent token-handling drift across components.
3. Consider extracting shared conversation/session hooks used by both Workspace and LiteChat to reduce duplicated history logic.
