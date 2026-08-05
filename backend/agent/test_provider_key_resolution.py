from backend.agent.nodes import resolve_provider_api_key


def test_resolve_provider_api_key_uses_api_keys_map_when_direct_field_missing():
    assert resolve_provider_api_key("ollama_cloud", None, {"ollama_cloud": "my-cloud-key"}) == "my-cloud-key"


def test_resolve_provider_api_key_prefers_direct_value_over_map():
    assert resolve_provider_api_key("ollama_cloud", "direct-key", {"ollama_cloud": "map-key"}) == "direct-key"


def test_resolve_provider_api_key_treats_placeholder_as_missing_for_local_fallback():
    assert resolve_provider_api_key("ollama_cloud", "sk-ollama", {"ollama_cloud": "my-cloud-key"}) == "my-cloud-key"
