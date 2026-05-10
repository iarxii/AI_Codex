# Implementation Plan - Dual Backend CI/CD & Secure Handshake

This plan outlines the implementation of a "Dual Backend" architecture where standard requests hit Cloud Run, but "Premium CodexSpace" tasks are routed to a Google Colab GPU instance via a secured ngrok tunnel.

## User Review Required

> [!IMPORTANT]
> **Security Handshake**: We will use a shared `VITE_COLAB_SECRET` baked into the frontend build. The Colab backend will reject any requests that do not include this secret in the `X-Codex-Premium-Key` header.

> [!WARNING]
> **WebSocket Migration**: Since chat is WebSocket-based, the frontend will perform a hard reconnection when switching to/from a Premium Space to target the new host.

## Proposed Changes

### Frontend (Client)

#### [MODIFY] [config.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/config.ts)
- Add `COLAB_URL` and `COLAB_SECRET` to the config object.
- Export a helper `getBackendConfig(space)` to resolve the active URL.

#### [MODIFY] [AIContext.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/contexts/AIContext.tsx)
- Add logic to track the "Target Host" based on `activeSpace.slug`.
- Ensure any `fetch` calls use the dynamically resolved URL.

#### [MODIFY] [Chat.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/Chat.tsx)
- Update WebSocket initialization to use the dynamic `WS_BASE_URL`.
- Inject the security handshake header into all outgoing requests.

### Backend

#### [MODIFY] [main.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/main.py)
- Add a custom middleware to verify the `X-Codex-Premium-Key` if a `COLAB_SECRET` environment variable is present.

### CI/CD Infrastructure

#### [MODIFY] [deploy_production.bat](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/deploy_production.bat)
- Add support for `--colab-url` and `--colab-secret` flags.
- Inject these as build-time environment variables into the Vite build.

---

## Execution Plan

1.  **Backend Security Layer**: Implement the handshake middleware in `main.py`.
2.  **Frontend Dynamic Routing**: Refactor `config.ts` and `AIContext.tsx`.
3.  **Handshake Integration**: Update `Chat.tsx` to send the security header.
4.  **CI/CD Refactor**: Update `deploy_production.bat` to support the dual-backend build.
5.  **Deployment**: Execute the frontend deployment to `aicodex-lab` with the Colab configuration.

## Verification Plan

### Automated Verification
- **Status Check**: Script will ping both Cloud Run and Colab endpoints before starting the build.
- **Handshake Test**: A test `curl` will be sent to the Colab backend without the key to verify it is rejected (403 Forbidden).

### Manual Verification
- Enter a "Premium" space in the UI and verify that the "Network" tab in DevTools shows requests hitting the ngrok URL.
- Verify that standard spaces still hit Cloud Run.