import httpx
from fastapi import APIRouter, HTTPException, Query, Header, Depends
from typing import List, Dict, Any
import json
from pydantic import BaseModel
from urllib.parse import urlparse
from backend.config import settings
from backend.db.session import get_db
from backend.db.models import User
from backend.api.deps import get_current_user_optional

router = APIRouter()

OPENAI_COMPAT_BASE_URLS: Dict[str, str] = {
    "openai": "https://api.openai.com/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "groq": "https://api.groq.com/openai/v1",
    "deepseek": "https://api.deepseek.com/v1",
    "xai": "https://api.x.ai/v1",
    "together": "https://api.together.xyz/v1",
    "fireworks": "https://api.fireworks.ai/inference/v1",
    "nvidia": "https://integrate.api.nvidia.com/v1",
    "perplexity": "https://api.perplexity.ai",
    "cohere": "https://api.cohere.com",
    "mistral": "https://api.mistral.ai/v1",
    "huggingface": "https://router.huggingface.co/v1",
    "cerebras": "https://api.cerebras.ai/v1",
}


def _normalize_base_url(base_url: str, provider: str) -> str:
    """Normalize user-supplied base URLs and reject malformed hosts early."""
    value = (base_url or "").strip().strip('"').strip("'")
    if not value:
        return ""
    if "://" not in value:
        value = f"https://{value.lstrip('/')}"

    parsed = urlparse(value)
    if not parsed.scheme or not parsed.netloc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid base URL for provider '{provider}': {base_url}",
        )
    if any(ch in parsed.netloc for ch in ("{", "}", " ")):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid hostname in base URL for provider '{provider}': {parsed.netloc}. "
                "Remove placeholders and whitespace."
            ),
        )

    path = (parsed.path or "").rstrip("/")
    return f"{parsed.scheme}://{parsed.netloc}{path}"


def _models_url(base_url: str) -> str:
    return f"{base_url.rstrip('/')}/models"


def _extract_openai_models(payload: Any) -> List[Dict[str, str]]:
    """Best-effort normalize OpenAI-compatible model list payloads."""
    if not isinstance(payload, dict):
        return []
    raw = payload.get("data", [])
    if not isinstance(raw, list):
        return []

    models: List[Dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        model_id = item.get("id") or item.get("name")
        if not isinstance(model_id, str) or not model_id:
            continue
        model_name = item.get("name") or model_id
        if not isinstance(model_name, str):
            model_name = model_id
        models.append({"id": model_id, "name": model_name})
    return models

async def _list_models_raw(
    provider: str, 
    api_key: str = Query(None), 
    x_api_key: str = Header(None),
    x_base_url: str = Header(None),
    x_account_id: str = Header(None),
    x_gateway_id: str = Header(None),
    x_local_backend_mode: str = Header(None),
    x_space_slug: str = Header(None),
    x_is_premium: str = Header(None),
    current_user: User | None = Depends(get_current_user_optional),
    db: Any = Depends(get_db)
):
    """
    Dynamically list available models for a given provider.
    Mutes local models for Standard workspaces and locks models for non-premium spaces.
    """
    # 0. Normalization: Map google to gemini
    if provider == "google":
        provider = "gemini"

    # 1. Enforcement: Mute local models in Standard Workspaces (no slug)
    if provider == "local" and not x_space_slug:
        return []

    # 2. Enforcement: Check if we should lock to a single model for non-premium Colab spaces
    is_premium = x_is_premium == "true"
    
    actual_key = x_api_key or api_key
    if not actual_key:
        api_keys = {}
        if current_user and current_user.settings_json:
            try:
                api_keys = json.loads(current_user.settings_json).get("api_keys", {})
            except Exception:
                pass
        actual_key = api_keys.get(provider)
        
    if not actual_key:
        import os
        if provider == "gemini" or provider == "google":
            actual_key = os.environ.get("GEMINI_API_KEY")
        elif provider == "openai":
            actual_key = os.environ.get("OPENAI_API_KEY")
        elif provider == "groq":
            actual_key = os.environ.get("GROQ_API_KEY")
        elif provider == "openrouter":
            actual_key = os.environ.get("OPENROUTER_API_KEY")
        elif provider == "ollama_cloud":
            actual_key = os.environ.get("OLLAMA_API_KEY")
        elif provider == "cloudflare_ai_gateway":
            actual_key = os.environ.get("CLOUDFLARE_AI_GATEWAY_API_KEY")
        elif provider == "workers_ai":
            actual_key = os.environ.get("WORKERS_AI_API_KEY")
        elif provider == "deepseek":
            actual_key = os.environ.get("DEEPSEEK_API_KEY")
        elif provider == "xai":
            actual_key = os.environ.get("XAI_API_KEY")
        elif provider == "together":
            actual_key = os.environ.get("TOGETHER_API_KEY")
        elif provider == "fireworks":
            actual_key = os.environ.get("FIREWORKS_API_KEY")
        elif provider == "nvidia":
            actual_key = os.environ.get("NVIDIA_API_KEY")
        elif provider == "perplexity":
            actual_key = os.environ.get("PERPLEXITY_API_KEY")
        elif provider == "cohere":
            actual_key = os.environ.get("COHERE_API_KEY")
        elif provider == "mistral":
            actual_key = os.environ.get("MISTRAL_API_KEY")
        elif provider == "huggingface":
            actual_key = os.environ.get("HUGGINGFACE_API_KEY")
        elif provider == "cerebras":
            actual_key = os.environ.get("CEREBRAS_API_KEY")
        elif provider == "anthropic":
            actual_key = os.environ.get("ANTHROPIC_API_KEY")
        elif provider == "azure":
            actual_key = os.environ.get("AZURE_OPENAI_API_KEY")
    async with httpx.AsyncClient(timeout=10.0) as client:
        if provider == "local":
            local_mode = x_local_backend_mode or settings.LOCAL_BACKEND_MODE
            
            if local_mode == "llamacpp":
                # ── LLAMACPP MODE ──
                # llama-server typically serves one model, queryable via /v1/models
                try:
                    base_url = settings.LLAMACPP_BASE_URL.rstrip("/")
                    models = []
                    try:
                        r = await client.get(f"{base_url}/v1/models")
                        if r.status_code == 200:
                            v1_data = r.json()
                            for m in v1_data.get("data", []):
                                model_id = m.get("id", "default")
                                # Normalize SHA256 digests
                                if model_id.startswith("sha256-") or model_id.startswith("sha256:"):
                                    model_id = "default"
                                models.append({"id": model_id, "name": m.get("id", "Local Model (llama-server)")})
                    except Exception:
                        pass
                    if not models:
                        models.append({"id": "default", "name": "Local Model (llama-server)"})
                    return models
                except Exception:
                    return [{"id": "default", "name": "Local Model (unreachable)"}]
            
            else:
                # ── OLLAMA MODE (default) ──
                try:
                    response = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
                    if response.status_code == 200:
                        data = response.json()
                        models = []
                        for m in data.get("models", []):
                            name = m["name"].lower()
                            if any(x in name for x in ["embed", "minilm", "nomic", "bert", "ranker"]):
                                continue
                            model_id = m["name"]
                            display_name = m["name"]
                            # llama-server (turboquant) returns SHA256 blob digests
                            # Normalize to "default" since it only serves one model
                            if model_id.startswith("sha256-") or model_id.startswith("sha256:"):
                                model_id = "default"
                                display_name = f"Local Model (llama-server)"
                            models.append({"id": model_id, "name": display_name})
                        
                        # Enforcement: If non-premium space, only allow 1 predefined model
                        if not is_premium and x_space_slug:
                            # Try to find deepseek-r1:7b or just return the first one
                            premium_default = next((m for m in models if "deepseek-r1:7b" in m["id"]), models[0] if models else None)
                            if premium_default:
                                return [premium_default]

                        # If Ollama returned no chat models, add a default
                        if not models:
                            models.append({"id": "default", "name": "Local Model (auto-detect)"})
                        return models
                    return [{"id": "default", "name": "Local Model (auto-detect)"}]
                except Exception:
                    return [{"id": "default", "name": "Local Model (unreachable)"}]

        elif provider == "ollama_cloud":
            if not x_base_url:
                return []
            try:
                normalized_base = _normalize_base_url(x_base_url, "ollama_cloud")
                url = f"{normalized_base.rstrip('/')}/api/tags"
                headers = {}
                if actual_key:
                    headers["Authorization"] = f"Bearer {actual_key}" if not actual_key.startswith("Bearer") else actual_key
                    
                response = await client.get(url, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    return [{"id": m["name"], "name": m["name"]} for m in data.get("models", [])]
                return []
            except HTTPException:
                raise
            except httpx.RequestError as e:
                target = str(getattr(e, "request", None).url) if getattr(e, "request", None) else normalized_base
                raise HTTPException(status_code=502, detail=f"Ollama Cloud network error ({target}): {str(e)}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Ollama Cloud error: {str(e)}")

        elif provider == "openrouter":
            if not actual_key:
                return []
            try:
                base_url = _normalize_base_url(x_base_url or OPENAI_COMPAT_BASE_URLS["openrouter"], "openrouter")
                headers = {"Authorization": f"Bearer {actual_key}"}
                response = await client.get(_models_url(base_url), headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    return _extract_openai_models(data)
                return []
            except HTTPException:
                raise
            except httpx.RequestError as e:
                target = str(getattr(e, "request", None).url) if getattr(e, "request", None) else "openrouter"
                raise HTTPException(status_code=502, detail=f"OpenRouter network error ({target}): {str(e)}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"OpenRouter error: {str(e)}")

        elif provider == "groq":
            if not actual_key:
                return []
            try:
                base_url = _normalize_base_url(x_base_url or OPENAI_COMPAT_BASE_URLS["groq"], "groq")
                headers = {"Authorization": f"Bearer {actual_key}"}
                response = await client.get(_models_url(base_url), headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    return _extract_openai_models(data)
                return []
            except HTTPException:
                raise
            except httpx.RequestError as e:
                target = str(getattr(e, "request", None).url) if getattr(e, "request", None) else "groq"
                raise HTTPException(status_code=502, detail=f"Groq network error ({target}): {str(e)}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Groq error: {str(e)}")

        elif provider == "gemini":
            if not actual_key:
                return []
            if actual_key.startswith("vertex_adc"):
                return [
                    {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash (Vertex AI)"},
                    {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro (Vertex AI)"},
                    {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash (Vertex AI)"},
                    {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro (Vertex AI)"},
                    {"id": "gemini-2.0-flash-exp", "name": "Gemini 2.0 Flash Exp (Vertex AI)"},
                    {"id": "gemini-2.0-pro-exp", "name": "Gemini 2.0 Pro Exp (Vertex AI)"},
                ]
            try:
                # Gemini list models is currently best via their SDK which handles auth/retry logic
                from google import genai
                sdk_client = genai.Client(api_key=actual_key)
                models = []
                for m in sdk_client.models.list():
                    model_id = m.name.replace("models/", "")
                    if "gemini" in model_id.lower() or "learnlm" in model_id.lower():
                        models.append({"id": model_id, "name": getattr(m, 'display_name', model_id)})
                return models
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Gemini error: {str(e)}")

        elif provider == "colab_bridge":
            if not x_base_url:
                return [{"id": "gemma-4-E4B_q4_0-it", "name": "Gemma 4 QAT (Colab Bridge)"}]
            try:
                base_url = _normalize_base_url(x_base_url, "colab_bridge").rstrip("/")
                headers = {}
                if actual_key:
                    headers["Authorization"] = f"Bearer {actual_key}" if not actual_key.startswith("Bearer") else actual_key
                
                # Try OpenAI-compatible /v1/models first
                try:
                    response = await client.get(f"{base_url}/v1/models", headers=headers)
                    if response.status_code == 200:
                        data = response.json()
                        return [{"id": m["id"], "name": m.get("name", m["id"])} for m in data.get("data", [])]
                except Exception:
                    pass

                # Fallback: Try Ollama /api/tags
                try:
                    response = await client.get(f"{base_url}/api/tags", headers=headers)
                    if response.status_code == 200:
                        data = response.json()
                        return [{"id": m["name"], "name": m["name"]} for m in data.get("models", [])]
                except Exception:
                    pass
                
                # If both fail, return a default placeholder
                return [{"id": "gemma-4-E4B_q4_0-it", "name": "Gemma 4 QAT (Colab Bridge)"}]
            except HTTPException:
                raise
            except httpx.RequestError as e:
                target = str(getattr(e, "request", None).url) if getattr(e, "request", None) else "colab_bridge"
                raise HTTPException(status_code=502, detail=f"Colab Bridge network error ({target}): {str(e)}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Colab Bridge error: {str(e)}")

        elif provider == "cloudflare_ai_gateway":
            if not x_base_url:
                return []
            try:
                base_url = _normalize_base_url(x_base_url, "cloudflare_ai_gateway").rstrip("/")
                headers = {}
                if actual_key:
                    headers["Authorization"] = f"Bearer {actual_key}" if not actual_key.startswith("Bearer") else actual_key
                # Compose the full gateway path when account/gateway IDs are supplied
                if x_account_id and x_gateway_id and x_gateway_id not in base_url:
                    base_url = f"{base_url}/v1/{x_account_id}/{x_gateway_id}"
                if not base_url.endswith("/v1"):
                    base_url = f"{base_url}/v1"

                # Cloudflare AI Gateway exposes an OpenAI-compatible /v1/models endpoint
                response = await client.get(f"{base_url}/models", headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    return _extract_openai_models(data)
                return []
            except HTTPException:
                raise
            except httpx.RequestError as e:
                target = str(getattr(e, "request", None).url) if getattr(e, "request", None) else "cloudflare_ai_gateway"
                raise HTTPException(status_code=502, detail=f"Cloudflare AI Gateway network error ({target}): {str(e)}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Cloudflare AI Gateway error: {str(e)}")

        elif provider == "workers_ai":
            if not x_account_id:
                return []
            try:
                # Workers AI uses the Cloudflare API
                base_url = "https://api.cloudflare.com/client/v4/accounts"
                headers = {"Authorization": f"Bearer {actual_key}"} if actual_key else {}
                
                # List available models from Workers AI
                response = await client.get(f"{base_url}/{x_account_id}/ai/models/search", headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    models = []
                    for m in data.get("result", []):
                        model_id = m.get("name", "")
                        if model_id:
                            models.append({"id": model_id, "name": m.get("display_name", model_id)})
                    return models
                return []
            except httpx.RequestError as e:
                target = str(getattr(e, "request", None).url) if getattr(e, "request", None) else "workers_ai"
                raise HTTPException(status_code=502, detail=f"Workers AI network error ({target}): {str(e)}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Workers AI error: {str(e)}")

        # ── OpenAI-compatible cloud providers (More Providers) ──
        # DeepSeek, xAI, Together, Fireworks, NVIDIA, Perplexity, Cohere,
        # Mistral, Hugging Face and Cerebras all expose an OpenAI-compatible
        # /v1/models endpoint. Anthropic & Azure OpenAI are handled separately
        # below because of their non-OpenAI / endpoint-specific contracts.
        elif provider in (
            "openai",
            "deepseek", "xai", "together", "fireworks", "nvidia",
            "perplexity", "cohere", "mistral", "huggingface", "cerebras",
        ):
            base_url = _normalize_base_url(x_base_url or OPENAI_COMPAT_BASE_URLS.get(provider, ""), provider)
            if not actual_key:
                return []
            if not base_url:
                return []
            try:
                headers = {"Authorization": f"Bearer {actual_key}"}
                response = await client.get(_models_url(base_url), headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    return _extract_openai_models(data)
                return []
            except HTTPException:
                raise
            except httpx.RequestError as e:
                target = str(getattr(e, "request", None).url) if getattr(e, "request", None) else base_url
                raise HTTPException(
                    status_code=502,
                    detail=(
                        f"{provider} network error ({target}): {str(e)}. "
                        f"Check DNS and the configured base URL."
                    ),
                )
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"{provider} error: {str(e)}")

        return []


@router.get("")
async def list_models(
    provider: str, 
    api_key: str = Query(None), 
    x_api_key: str = Header(None),
    x_base_url: str = Header(None),
    x_account_id: str = Header(None),
    x_gateway_id: str = Header(None),
    x_local_backend_mode: str = Header(None),
    x_space_slug: str = Header(None),
    x_is_premium: str = Header(None),
    current_user: User | None = Depends(get_current_user_optional),
    db: Any = Depends(get_db)
):
    if provider == "google":
        provider = "gemini"

    models = await _list_models_raw(
        provider=provider,
        api_key=api_key,
        x_api_key=x_api_key,
        x_base_url=x_base_url,
        x_account_id=x_account_id,
        x_gateway_id=x_gateway_id,
        x_local_backend_mode=x_local_backend_mode,
        x_space_slug=x_space_slug,
        x_is_premium=x_is_premium,
        current_user=current_user,
        db=db
    )
    
    if not x_space_slug:
        return models
        
    if x_space_slug == "code-lab":
        # Only Gemma / Google models
        return [
            m for m in models 
            if "gemma" in m["id"].lower() 
            or "gemma" in m["name"].lower() 
            or "google" in m["id"].lower()
        ]
        
    if x_space_slug == "health-tech":
        # Only MedGemma models
        return [
            m for m in models
            if "medgemma" in m["id"].lower()
            or "medgemma" in m["name"].lower()
            or "medgamma" in m["id"].lower()
            or "medgamma" in m["name"].lower()
        ]
        
    if x_space_slug == "gpt-oss":
        if provider == "gemini":
            return [
                m for m in models 
                if "gemini" in m["id"].lower() 
                or "gemini" in m["name"].lower()
            ]
        # Only OpenAI / GPT models
        return [
            m for m in models 
            if "gpt" in m["id"].lower() 
            or "gpt" in m["name"].lower() 
            or "openai" in m["id"].lower()
        ]
        
    return models


class LoadModelRequest(BaseModel):
    model_name: str


@router.post("/load")
async def load_model(payload: LoadModelRequest):
    """
    Endpoint to dynamically hot-swap/load a specific model flavor in llama-server.
    Used by the Colab bridge client or frontend spaces to switch models.
    """
    from backend.utils.llama_manager import LlamaServerManager
    success = LlamaServerManager.ensure_model_loaded(payload.model_name)
    if success:
        return {"status": "success", "message": f"Successfully loaded model flavor: {payload.model_name}"}
    raise HTTPException(status_code=500, detail=f"Failed to load model flavor: {payload.model_name}")

