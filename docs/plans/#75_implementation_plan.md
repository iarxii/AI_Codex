## Plan: Alibaba ECS as Model Runtime, Cloud Run Premium as Router

Adopts Option A from the feedback: Cloud Run `aicodex-premium` stays as the router/auth entrypoint; Alibaba ECS becomes a GPU Ollama host; premium backend forwards inference via a new `alibaba_ecs` provider. Default Cloud Run production path in `deploy_production.bat` is untouched — Alibaba is purely additive.

**Steps**

**Phase 1 — Terraform (wire ECS-GPU + ACR into dev env)**
1. Add `module "acr"` and `module "ecs_gpu"` to `main.tf`, sourcing the already-existing but unused infra/modules/ecs-gpu and infra/modules/acr modules, wired to the existing `module.network`/`module.security_group` outputs.
2. Add `ecs_instance_type`/`ecs_image_id` variables + tfvars example.
3. Add outputs: `ecs_public_ip`, `ecs_instance_id`, `acr_instance_id`, `acr_namespace`.
4. Update `alibaba_cloud_deployment_blueprint.md` to mark this wiring done and document the router split.

**Phase 2 — Backend routing (parallel with Phase 1)**
5. Add `ALIBABA_ECS_OLLAMA_URL` setting in `config.py`.
6. Add `alibaba_ecs` branch to `get_llm()` in `models.py`, modeled on the existing `ollama_cloud` branch — `ChatOllama` pointed at the ECS endpoint.
7. Mirror the branch in `models.py` (model listing/base-url normalization), alongside existing `ollama_cloud`/`colab_bridge` handling.
8. Optionally expose `alibaba_ecs` in the frontend provider selector (location TBD via quick search during implementation) — only if user-selectable; otherwise route implicitly when in premium mode.

**Phase 3 — Deploy script (additive only)**
9. Add `--alibaba-endpoint <url>` flag to `deploy_production.bat` that appends `ALIBABA_ECS_OLLAMA_URL` to the existing premium `--set-env-vars`, without altering default flags/paths.
10. Extend `route_map.json` generation with an `alibaba_ecs_url` field.

**Phase 4 — Manual provisioning (user-confirmed, cost-incurring)**
11. User runs `terraform apply` against their Alibaba credentials — explicit go-ahead required, not automated.
12. Flesh out `user_data` in `main.tf` to actually launch Ollama (currently just installs Docker + placeholder).
13. Re-run deploy script with `--alibaba-endpoint` pointing at the new ECS IP.

**Verification**
1. `terraform validate`/`plan` (no apply without confirmation).
2. Manual/unit check that `get_llm("alibaba_ecs", ...)` resolves to `ChatOllama` at the configured URL.
3. `deploy_production.bat --preflight` still runs cleanly with the new flag.
4. Post-provisioning: `curl .../api/tags` for Ollama liveness, then end-to-end premium websocket smoke test via existing `COLAB_SECRET` handshake.

**Scope boundaries**
- No changes to default `--be`/`--fe`/full-stack paths.
- Option B (fully retiring Cloud Run premium in favor of Alibaba) is explicitly excluded.
- No automatic `terraform apply`.
- vLLM excluded — Ollama only per your choice.

Full detail saved in plan.md. Let me know if you want changes, or approve to hand off for implementation.