# TODO (Future Plan): Enabling Tier 1 "Platform-Managed Inference" for Paid Subscriptions

**Status:** Not started. This is a forward-looking plan, not an active implementation task.

## Context

As of 2026-09-03, cloud inference routing (Azure AI Foundry, AWS Bedrock, Alibaba ECS) uses a
two-tier credential model:

- **Tier 2 "Client-Managed Cloud Connections" (active now):** each user connects their own cloud
  provider credentials via the CONNEX tab (OAuth for Azure Foundry, API-key/config form for AWS
  Bedrock and Alibaba ECS). Credentials are stored per-user, encrypted, in `UserConnection`
  ([backend/db/models.py](../../backend/db/models.py)). Resolved per-request in
  [backend/integrations/cloud_inference.py](../../backend/integrations/cloud_inference.py) and
  consumed only by the premium chat flow ([backend/api/chat.py](../../backend/api/chat.py)).
- **Tier 1 "Platform-Managed Inference" (disabled by default):** a single instance-wide static
  credential/endpoint configured via environment variables (e.g. `ALIBABA_ECS_OLLAMA_URL`),
  gated behind `settings.PLATFORM_MANAGED_INFERENCE_ENABLED` in
  [backend/config.py](../../backend/config.py). Currently `False` everywhere.

Tier 1 exists so that, in the future, AICodex itself can host/pay for the inference backend and
offer it to paying subscribers without requiring them to bring their own cloud credentials —
similar to how "Premium" already works for the Colab bridge today.

## What needs to happen before flipping `PLATFORM_MANAGED_INFERENCE_ENABLED = True` in production

1. **Billing integration**: a subscription/payment system must exist and be able to gate access
   (e.g. a `subscription_tier` or `is_platform_inference_subscriber` flag on `User`, checked before
   falling back to Tier 1 in `get_llm()`/`resolve_cloud_inference_credentials`).
2. **Per-subscriber quota & rate limiting**: Tier 1 credentials are shared across all subscribers
   hitting the same instance-wide Alibaba ECS/Azure/AWS account — without quotas, one subscriber
   could exhaust the platform's inference budget or GPU capacity. Needs a token-bucket or
   request-count limiter keyed by user ID.
3. **Cost attribution / usage metering**: track per-user token usage against the shared platform
   credential so subscription tiers can be priced sensibly and abuse can be detected.
4. **Security review of the shared credential**: Tier 1 secrets (e.g. `ALIBABA_ECS_OLLAMA_URL`,
   any future `AZURE_FOUNDRY_*`/`AWS_BEDROCK_*` platform-wide env vars) are far more sensitive once
   they're actively serving paying customers rather than sitting inert — rotate them, scope IAM
   permissions tightly, and add audit logging for who invoked the platform-managed path and when.
5. **Fallback ordering decision**: confirm whether Tier 2 (user's own Connex connection) should
   always take priority over Tier 1 when both exist for the same user, or whether subscribers
   should be forced onto Tier 1 exclusively for billing predictability. Current code in
   `get_llm()`'s `alibaba_ecs` branch prefers an explicit `base_url` (Tier 2) over the static
   settings fallback (Tier 1) — revisit this ordering once Tier 1 is live.
6. **Terraform/infra for the platform-hosted inference host**: the Alibaba ECS+ACR Terraform in
   [infra/environments/dev](../../infra/environments/dev) was originally built for this exact
   purpose (a platform-hosted GPU Ollama instance) — it's currently unused/optional since Tier 2
   means each user hosts their own. Revisit whether to actually `terraform apply` this once Tier 1
   goes live, sized for expected subscriber load (not the dev-sized single GPU instance).
7. **Update `deploy_production.bat`**: the existing `--alibaba-endpoint` flag already sets
   `ALIBABA_ECS_OLLAMA_URL` on the premium Cloud Run service — no script changes needed, just flip
   `PLATFORM_MANAGED_INFERENCE_ENABLED=True` as an additional env var once ready.

## Non-goals for this future plan

- This does NOT require ripping out the Tier 2 Connex-based client-managed flow — both tiers are
  meant to coexist indefinitely. Tier 2 remains valuable for users who want to bring their own
  cloud account (e.g. enterprise customers with existing Azure/AWS agreements).
