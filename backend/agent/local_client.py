import json
import logging
import httpx
from typing import List, Dict, Any, Optional
from langchain_core.messages import BaseMessage, AIMessage

logger = logging.getLogger(__name__)

class NativeLocalClient:
    """
    A lightweight client for llama-server (turboquant) that bypasses LangChain's 
    OpenAI wrapper to provide better stability and support for native parameters.
    """
    def __init__(self, base_url: str, model: str = "default", temperature: float = 0.0):
        self.base_url = base_url.replace("/v1", "") if "/v1" in base_url else base_url
        self.model = model
        self.temperature = temperature

    async def ainvoke(self, messages: List[BaseMessage]) -> AIMessage:
        """
        Invokes the model using the native /completion endpoint for better prompt caching.
        """
        # Convert messages to a single prompt string (simple template)
        prompt = ""
        for msg in messages:
            role = "USER" if msg.type == "human" else "ASSISTANT"
            if msg.type == "system":
                prompt += f"SYSTEM: {msg.content}\n"
            else:
                prompt += f"{role}: {msg.content}\n"
        prompt += "ASSISTANT:"

        payload = {
            "prompt": prompt,
            "temperature": self.temperature,
            "stream": False, # Maximum stability for local GPU
            "n_predict": 1024,
            "stop": ["USER:", "SYSTEM:", "</s>"],
            "cache_prompt": True # Native llama-server param
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.post(f"{self.base_url}/completion", json=payload)
                if response.status_code != 200:
                    raise Exception(f"Native server error: {response.text}")
                
                data = response.json()
                return AIMessage(content=data.get("content", ""))
            except Exception as e:
                logger.error(f"NativeLocalClient failed: {e}")
                raise e
