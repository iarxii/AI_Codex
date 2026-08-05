import json
from typing import Any, Dict, Optional


def _normalize_key(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
    else:
        value = str(value).strip()
    return value or None


def _is_placeholder_key(provider: str, value: Any) -> bool:
    normalized = _normalize_key(value)
    if not normalized:
        return True

    placeholder_values = {"sk-ollama", "sk-dummy", "dummy", "placeholder"}
    return normalized.lower() in placeholder_values


def resolve_provider_api_key(provider: Optional[str], direct_api_key: Any = None, api_keys: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """Resolve the effective API key for a provider without treating Ollama Cloud as auth-missing."""
    provider_name = (provider or "").lower()
    if not provider_name:
        return _normalize_key(direct_api_key)

    direct_value = _normalize_key(direct_api_key)
    if direct_value and not _is_placeholder_key(provider_name, direct_value):
        return direct_value

    if isinstance(api_keys, dict):
        mapped_value = api_keys.get(provider_name)
        if mapped_value is not None and not _is_placeholder_key(provider_name, mapped_value):
            return _normalize_key(mapped_value)

    return None


def build_provider_api_key_map(payload_api_keys: Optional[Dict[str, Any]] = None, settings_json: Optional[str] = None) -> Dict[str, str]:
    """Merge provider API keys from request payload and the user's saved settings."""
    merged: Dict[str, str] = {}

    if isinstance(payload_api_keys, dict):
        for provider, value in payload_api_keys.items():
            resolved = _normalize_key(value)
            if provider and resolved:
                merged[str(provider)] = resolved

    if settings_json:
        try:
            parsed = json.loads(settings_json)
        except Exception:
            return merged

        saved_keys = parsed.get("api_keys", {}) if isinstance(parsed, dict) else {}
        if isinstance(saved_keys, dict):
            for provider, value in saved_keys.items():
                resolved = _normalize_key(value)
                if provider and resolved and str(provider) not in merged:
                    merged[str(provider)] = resolved

    return merged
