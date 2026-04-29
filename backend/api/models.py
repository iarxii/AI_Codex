import httpx
from fastapi import APIRouter, HTTPException, Query, Header
from typing import List, Dict, Any
from backend.config import settings

router = APIRouter()

@router.get("")
async def list_models(
    provider: str, 
    api_key: str = Query(None), 
    x_api_key: str = Header(None),
    x_base_url: str = Header(None)
):
    """
    Dynamically list available models for a given provider using non-blocking async calls.
    """
    actual_key = x_api_key or api_key
    async with httpx.AsyncClient(timeout=10.0) as client:
        if provider == "local":
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
                    # If llama-server returned no models via /api/tags, add a default entry
                    if not models:
                        # Try /v1/models endpoint for pure OpenAI-compat servers
                        try:
                            base_v1 = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/v1"
                            r2 = await client.get(f"{base_v1}/models")
                            if r2.status_code == 200:
                                v1_data = r2.json()
                                for m in v1_data.get("data", []):
                                    models.append({"id": m.get("id", "default"), "name": m.get("id", "Local Model")})
                        except Exception:
                            pass
                        if not models:
                            models.append({"id": "default", "name": "Local Model (auto-detect)"})
                    return models
                # Server is running but /api/tags returned non-200
                # Still provide a default entry so the user can attempt chat
                return [{"id": "default", "name": "Local Model (auto-detect)"}]
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Ollama error: {str(e)}")

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

        return []
