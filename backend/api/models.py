import requests
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
    Dynamically list available models for a given provider.
    """
    actual_key = x_api_key or api_key
    if provider == "local":
        try:
            # Call Ollama API
            response = requests.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if response.status_code == 200:
                data = response.json()
                models = []
                for m in data.get("models", []):
                    name = m["name"].lower()
                    # Filter out models that are obviously embeddings or non-chat
                    if any(x in name for x in ["embed", "minilm", "nomic", "bert", "ranker"]):
                        continue
                    models.append({"id": m["name"], "name": m["name"]})
                return models
            return []
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ollama error: {str(e)}")

    elif provider == "ollama_cloud":
        if not x_base_url:
            return []
        try:
            # Call remote Ollama API
            url = f"{x_base_url.rstrip('/')}/api/tags"
            headers = {}
            if actual_key:
                headers["Authorization"] = f"Bearer {actual_key}" if not actual_key.startswith("Bearer") else actual_key
                
            response = requests.get(url, headers=headers)
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
            response = requests.get("https://openrouter.ai/api/v1/models")
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
            response = requests.get("https://api.groq.com/openai/v1/models", headers=headers)
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
            from google import genai
            client = genai.Client(api_key=actual_key)
            models = []
            for m in client.models.list():
                model_id = m.name.replace("models/", "")
                if "gemini" in model_id.lower() or "learnlm" in model_id.lower():
                    models.append({"id": model_id, "name": getattr(m, 'display_name', model_id)})
            return models
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gemini error: {str(e)}")

    return []
