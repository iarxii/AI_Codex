# Walkthrough - Dual Backend & Secure Handshake

We have successfully implemented the hybrid backend architecture for AI Codex, enabling high-performance GPU reasoning via Google Colab while maintaining a stable core on Google Cloud Run.

## Key Changes

### 1. Backend Security & Stability
- **Secure Handshake**: Added a middleware in `main.py` that verifies the `X-Codex-Premium-Key` header.
- **GPU Cooldown**: Implemented a 1.5s per-user rate limiter in `chat.py` to prevent concurrent request spikes from locking the Colab GPU.
- **WebSocket Hardening**: Verified the handshake during the WS upgrade phase to ensure the reasoning pipeline is protected.

### 2. Frontend Dynamic Routing
- **Config Resolver**: `config.ts` now identifies spaces with `premium` in their slug and reroutes traffic to the Colab URL.
- **Automatic Auth**: The frontend now detects when it's talking to a Colab backend and automatically injects the security handshake key.

### 3. CI/CD Pipeline
- **Deployment Script**: `deploy_production.bat` is now a powerful dual-backend tool. It can bake the Colab ngrok URL and shared secret into the production build during the frontend compilation.
- **Build Args**: The `Dockerfile` and `cloudbuild.yaml` were updated to support these build-time injections.

## Validation Results

### Handshake Verification
- [x] Requests without `X-Codex-Premium-Key` to a `COLAB_SECRET` enabled backend are rejected with **403 Forbidden**.
- [x] WebSocket connections without the `handshake` query param are terminated with **4003 Forbidden**.

### Rate Limiting
- [x] Rapidly clicking "Send" in the UI triggers a "Neural Link Throttled" error, protecting the GPU.

### Dynamic Routing
- [x] Standard Space: Hits `aicodex-be.a.run.app`.
- [x] Premium Space: Hits `ngrok-free.app`.

## Future Recommendations
- **Redis Limiter**: If you scale beyond a single Colab instance, consider moving the in-memory rate limiter to Redis.
- **Dynamic Key Rotation**: For enterprise-grade security, implement a revolving handshake key via a shared KMS.
