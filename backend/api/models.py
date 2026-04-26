import requests
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any
import google.generativeai as genai
from backend.config import settings

router = APIRouter()

@router.get("")
async def list_models(provider: str, api_key: str = None):
    """
    Dynamically list available models for a given provider.
    """
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

    elif provider == "openrouter":
        if not api_key:
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
        if not api_key:
            return []
        try:
            headers = {"Authorization": f"Bearer {api_key}"}
            response = requests.get("https://api.groq.com/openai/v1/models", headers=headers)
            if response.status_code == 200:
                data = response.json()
                return [{"id": m["id"], "name": m["id"]} for m in data.get("data", [])]
            return []
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Groq error: {str(e)}")

    elif provider == "gemini":
        if not api_key:
            return []
        try:
            genai.configure(api_key=api_key)
            models = []
            for m in genai.list_models():
                if 'generateContent' in m.supported_generation_methods:
                    # Strip 'models/' prefix if present for consistency with ChatGoogleGenerativeAI
                    model_id = m.name.replace("models/", "")
                    models.append({"id": model_id, "name": m.display_name})
            return models
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gemini error: {str(e)}")

    return []
