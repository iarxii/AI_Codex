"""Resolves per-user Connex cloud-inference connections into get_llm()-ready credentials.

Tier 2 "Client-Managed Cloud Connections" — each user connects their own Azure Foundry / AWS
Bedrock / Alibaba ECS credentials via the CONNEX tab; the premium chat flow resolves them here
before calling get_llm(). This is distinct from Tier 1 "Platform-Managed Inference" (static
settings, gated behind settings.PLATFORM_MANAGED_INFERENCE_ENABLED — see backend/config.py).
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from backend.integrations.oauth import decrypt_token, get_user_connection

logger = logging.getLogger(__name__)

CLOUD_INFERENCE_PROVIDERS = frozenset({"azure_foundry", "aws_bedrock", "alibaba_ecs"})


async def resolve_cloud_inference_credentials(
    db_session,
    user_id: int,
    provider_slug: str,
) -> Optional[dict[str, Any]]:
    """Return a normalized credential dict for a connected cloud-inference provider, or None.

    Normalized keys (only the relevant subset is populated per provider):
    - base_url: str
    - api_key: str
    - region: str
    - model_id: str
    - deployment_name: str
    - api_version: str
    """
    conn = await get_user_connection(db_session=db_session, user_id=user_id, provider_slug=provider_slug)
    if not conn or conn.status != "active":
        return None

    try:
        blob = decrypt_token(conn.access_token_enc)
    except Exception:
        logger.error(f"Failed to decrypt cloud inference connection for provider={provider_slug}, user={user_id}")
        return None

    extra_config: dict[str, Any] = {}
    if conn.config_json:
        try:
            extra_config = json.loads(conn.config_json)
        except Exception:
            extra_config = {}

    if provider_slug == "azure_foundry":
        # blob is the raw AAD access token (OAuth connection); endpoint/deployment come from config_json
        return {
            "api_key": blob,
            "base_url": extra_config.get("endpoint", ""),
            "deployment_name": extra_config.get("deployment_name", ""),
            "api_version": extra_config.get("api_version", "2024-10-21"),
        }

    # api_key type providers (aws_bedrock, alibaba_ecs): blob is a JSON-encoded config dict
    try:
        config = json.loads(blob)
    except Exception:
        logger.error(f"Cloud inference connection blob is not valid JSON for provider={provider_slug}, user={user_id}")
        return None

    return {**config, **extra_config}
