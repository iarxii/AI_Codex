import httpx
from fastapi import APIRouter, HTTPException, Query, Header, Depends
from typing import List, Dict, Any
import json
from pydantic import BaseModel
from backend.config import settings
from backend.db.session import get_db
from backend.db.models import User
from backend.api.auth import get_current_user

router = APIRouter()

async def _list_models_raw(
    provider: str, 
    api_key: str = Query(None), 
    x_api_key: str = Header(None),
    x_base_url: str = Header(None),
    x_local_backend_mode: str = Header(None),
    x_space_slug: str = Header(None),
    x_is_premium: str = Header(None),
    current_user: User = Depends(get_current_user),
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
        elif provider == "groq":
            actual_key = os.environ.get("GROQ_API_KEY")
        elif provider == "openrouter":
            actual_key = os.environ.get("OPENROUTER_API_KEY")
        elif provider == "ollama_cloud":
            actual_key = os.environ.get("OLLAMA_API_KEY")
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
                url = f"{x_base_url.rstrip('/')}/api/tags"
                headers = {}
                if actual_key:
                    headers["Authorization"] = f"Bearer {actual_key}" if not actual_key.startswith("Bearer") else actual_key
                    
                response = await client.get(url, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    return [{"id": m["name"], "name": m["name"]} for m in data.get("models", [])]
                return []
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Ollama Cloud error: {str(e)}")

        elif provider == "openrouter":
            if not actual_key:
                return []
            try:
                response = await client.get("https://openrouter.ai/api/v1/models")
                if response.status_code == 200:
                    data = response.json()
                    return [{"id": m["id"], "name": m["name"]} for m in data.get("data", [])]
                return []
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"OpenRouter error: {str(e)}")

        elif provider == "groq":
            if not actual_key:
                return []
            try:
                headers = {"Authorization": f"Bearer {actual_key}"}
                response = await client.get("https://api.groq.com/openai/v1/models", headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    return [{"id": m["id"], "name": m["id"]} for m in data.get("data", [])]
                return []
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Groq error: {str(e)}")

        elif provider == "gemini":
            if not actual_key:
                return []
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
                base_url = x_base_url.rstrip("/")
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
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Colab Bridge error: {str(e)}")

        return []


@router.get("")
async def list_models(
    provider: str, 
    api_key: str = Query(None), 
    x_api_key: str = Header(None),
    x_base_url: str = Header(None),
    x_local_backend_mode: str = Header(None),
    x_space_slug: str = Header(None),
    x_is_premium: str = Header(None),
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_db)
):
    if provider == "google":
        provider = "gemini"

    models = await _list_models_raw(
        provider=provider,
        api_key=api_key,
        x_api_key=x_api_key,
        x_base_url=x_base_url,
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

