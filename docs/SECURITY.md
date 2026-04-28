# Security Hardening & Compliance

This document tracks the security posture of AICodex and the status of identified vulnerabilities.

## 🛡️ Core Security Principles

1. **Defense in Depth**: Multiple layers of validation for user input and agent commands.
2. **Least Privilege**: The agent sandbox is restricted to an allowlist of commands and specific directories.
3. **Transparency**: All agent actions are logged and visible to the user in the "Thinking Log".

---

## 🔍 Security Audit Findings (2026-04-28)

| ID | Finding | Status | Resolution |
|:---|:--------|:-------|:-----------|
| **S-1** | Unauthenticated WebSockets | 🟡 In Progress | Phase 2 Task: Implementing JWT check in WS handshake. |
| **S-2** | Plaintext API Keys in WS | 🟡 In Progress | Phase 4 Task: Moving to token-based key vault. |
| **S-3** | Hardcoded `SECRET_KEY` | ✅ Fixed | Removed default; now required in `.env`. |
| **S-4** | Hardcoded Admin Password | ✅ Fixed | Gated behind `SEED_ADMIN` flag. |
| **S-5** | Sandbox Shell Injection | ✅ Fixed | Blocked operators `; && \|\| \| > <`. |
| **S-6** | Committed `.env` secrets | 🟡 In Progress | Cleaned history and updated `.gitignore`. |
| **S-7** | No HTTPS enforcement | ⚪ Planned | To be handled via Nginx/Cloud Run ingress. |
| **S-8** | No Rate Limiting | ⚪ Planned | Backlog: Implementing `slowapi`. |
| **S-9** | No Prompt Injection Detection| ⚪ Planned | Backlog: Implementing verification layer. |
| **S-10**| Subprocess Shell usage | ⚪ Planned | Migration to `exec` style instead of `shell`. |

---

## 🛠️ Hardening Procedures

### 1. Sandbox Operator Blocking
The `execute_sandboxed` function in `backend/skills/sandbox.py` now enforces a strict block on command chaining. 
- **Effect**: Prevents an agent (or an attacker via prompt injection) from executing multiple commands in a single string (e.g., `ls; rm -rf /`).

### 2. Admin User Protection
The automatic creation of the `admin` user is now disabled by default. 
- **Procedure**: To bootstrap a new system, set `SEED_ADMIN=True` in `.env`, start the server, verify the user is created, and immediately set it back to `False`.

### 3. JWT Token Validation
WebSocket endpoints are currently being moved to a mandatory token-based handshake.
- **Handshake**: The client must provide a `?token=...` query parameter.
- **Verification**: The server validates the token against the `SECRET_KEY` before allowing the connection to upgrade.

---

## 🚨 Incident Response

If you suspect a security breach:
1. **Rotate the `SECRET_KEY`**: This invalidates all current sessions.
2. **Rotate API Keys**: Update Gemini, Groq, and GitHub tokens immediately.
3. **Check Logs**: Review `backend/logs/agent.log` for any unusual shell activity.
