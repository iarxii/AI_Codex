## Plan: Restore LiteChat Authless + Session UX

Apply targeted backend and frontend changes so LiteChat works in authenticated and guest modes: make /chat/quick optionally authenticated, prevent session APIs from throwing in guest mode, add active-session visibility and an always-available history toggle panel, and ensure New Chat clears immediately. Keep strict auth on /cloud-config and preserve existing provider/model forwarding.

**Steps**
1. Backend auth dependency update in [backend/api/chat.py](backend/api/chat.py): import and use get_current_user_optional only for quick route.
2. Refactor quick chat persistence gating in [backend/api/chat.py](backend/api/chat.py):
   - In quick_chat, treat current_user as optional.
   - If current_user exists: keep ownership validation for conversation_id and auto-create Conversation(title="New Conversation", space_type="general") when missing.
   - If current_user is missing: skip Conversation/Message DB read/write/title generation entirely.
   - Build model messages from system_context + user message only for guest path.
   - Return conversation_id only for persisted (authenticated) conversations; return reply-only for guest path.
   - Keep /cloud-config on strict get_current_user unchanged.
3. Client auth helper softening in [client/src/hooks/useLiteRtChat.ts](client/src/hooks/useLiteRtChat.ts): replace throwing getAuthHeaders with getAuthHeadersOptional() and add hasValidAuth() wrapper around getValidToken().
4. Session API graceful guest behavior in [client/src/hooks/useLiteRtChat.ts](client/src/hooks/useLiteRtChat.ts): refreshSessions, loadConversation, createConversation, deleteConversation should early-return/no-op when unauthenticated; no Session expired throws in guest path; maintain current behavior for authenticated users.
5. Active session derivation in [client/src/hooks/useLiteRtChat.ts](client/src/hooks/useLiteRtChat.ts): compute activeSession from sessions + activeConversationId and expose it in hook return.
6. Cloud sendMessage path fixes in [client/src/hooks/useLiteRtChat.ts](client/src/hooks/useLiteRtChat.ts):
   - Use optional auth headers for /chat/quick request.
   - Attach/create conversation_id only when authenticated.
   - For guest mode, send without conversation_id and still render reply.
   - Remove pre-request hard fail on missing token.
   - Preserve forwarding fields: provider, model, api_key, base_url, account_id, gateway_id.
7. LiteChat header and session panel UX in [client/src/pages/LiteChat.tsx](client/src/pages/LiteChat.tsx):
   - Add isSessionsPanelOpen state.
   - Add always-visible History toggle in header (desktop + mobile) independent of empty-state prompts block.
   - Add visible active session indicator in header: activeSession.title or Guest Session.
   - Add slide-over sessions panel listing title + updated time with load, delete, New, and Refresh actions.
8. New Chat click responsiveness in [client/src/pages/LiteChat.tsx](client/src/pages/LiteChat.tsx): update startNewSession to clear visible feed immediately, then attempt createConversation; if unauthenticated, remain in guest mode without error/dead click.
9. Keep existing prompts/history section intact in [client/src/pages/LiteChat.tsx](client/src/pages/LiteChat.tsx), while introducing the separate history toggle panel.
10. Diagnostics validation on changed files: run error checks for [backend/api/chat.py](backend/api/chat.py), [client/src/hooks/useLiteRtChat.ts](client/src/hooks/useLiteRtChat.ts), and [client/src/pages/LiteChat.tsx](client/src/pages/LiteChat.tsx); resolve TypeScript/Python diagnostics before completion.

**Relevant files**
- [backend/api/chat.py](backend/api/chat.py) — quick_chat auth dependency, persistence branching, ownership checks, response shape.
- [backend/api/auth.py](backend/api/auth.py) — source of get_current_user_optional import target (reuse existing optional auth helper).
- [client/src/hooks/useLiteRtChat.ts](client/src/hooks/useLiteRtChat.ts) — auth header behavior, session API guards, active session derivation, cloud quick-chat request payload.
- [client/src/pages/LiteChat.tsx](client/src/pages/LiteChat.tsx) — header controls, active indicator, new sessions slide-over panel, New Chat behavior.

**Verification**
1. Guest mode: clear auth token, open LiteChat, click New Chat, send a cloud message; verify reply appears and no Session expired preflight error.
2. Guest mode session UX: History toggle opens panel; active indicator shows Guest Session; refresh/new/delete/load actions fail safely (no crash/throw) when unauthenticated.
3. Auth mode: login, create/load/delete sessions from slide-over panel; active indicator tracks selected session title; New Chat clears feed instantly and persists newly created conversation.
4. Auth quick chat persistence: send message with no active conversation_id and verify backend returns conversation_id; send follow-up and verify conversation continuity.
5. Backend route checks: /cloud-config still requires auth; /chat/quick works with and without auth.
6. Diagnostics: confirm no Python diagnostics in [backend/api/chat.py](backend/api/chat.py) and no TypeScript diagnostics in [client/src/hooks/useLiteRtChat.ts](client/src/hooks/useLiteRtChat.ts) and [client/src/pages/LiteChat.tsx](client/src/pages/LiteChat.tsx).

**Decisions**
- Include anonymous quick chat support only for /chat/quick; keep /cloud-config strict-auth.
- Preserve existing cloud provider/model selection and forwarding contract.
- Scope excludes redesign of current prompts/history block; only additive sidepanel toggle + panel UX required.

**Further Considerations**
1. Optional: for guest mode, decide whether to persist ephemeral messages to localStorage for reload continuity. Recommendation: defer to keep this fix focused.
2. Optional: align all other quick-chat clients to same optional-auth semantics in a follow-up pass if they share this regression pattern.