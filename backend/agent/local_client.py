import json
import logging
import httpx
from typing import List, Dict, Any, Optional, AsyncIterator
from langchain_core.messages import BaseMessage, AIMessage, HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

class NativeLocalClient:
    """
    Optimized client for llama-server (turboquant) with native streaming 
    and Llama-3 prompt templating for maximum parity with the native portal.
    """
    def __init__(self, base_url: str, model: str = "default", temperature: float = 0.0):
        # Strip /v1 to access native llama.cpp endpoints (/completion, /tokenize)
        self.base_url = base_url.replace("/v1", "") if "/v1" in base_url else base_url
        self.model = model
        self.temperature = temperature

    def _apply_llama3_template(self, messages: List[BaseMessage]) -> str:
        """Applies the Llama-3 instruction format for better logic and termination."""
        prompt = "<|begin_of_text|>"
        for msg in messages:
            role = "user"
            if isinstance(msg, SystemMessage): role = "system"
            elif isinstance(msg, AIMessage): role = "assistant"
            
            prompt += f"<|start_header_id|>{role}<|end_header_id|>\n\n{msg.content}<|eot_id|>"
        
        prompt += "<|start_header_id|>assistant<|end_header_id|>\n\n"
        return prompt

    async def ainvoke(self, messages: List[BaseMessage]) -> AIMessage:
        """Non-streaming invocation (fallback)."""
        prompt = self._apply_llama3_template(messages)
        payload = {
            "prompt": prompt,
            "temperature": self.temperature,
            "stream": False,
            "n_predict": 1024,
            "stop": ["<|eot_id|>", "<|end_of_text|>", "<|start_header_id|>"],
            "cache_prompt": True,
            "slot_id": -1 # Allow server to pick/reuse slot
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(f"{self.base_url}/completion", json=payload)
            if response.status_code != 200:
                raise Exception(f"Local server error: {response.text}")
            data = response.json()
            return AIMessage(content=data.get("content", ""))

    async def astream(self, messages: List[BaseMessage]) -> AsyncIterator[Dict[str, Any]]:
        """Streaming invocation for 'blazing fast' UI feedback."""
        prompt = self._apply_llama3_template(messages)
        payload = {
            "prompt": prompt,
            "temperature": self.temperature,
            "stream": True,
            "n_predict": 1024,
            "stop": ["<|eot_id|>", "<|end_of_text|>", "<|start_header_id|>"],
            "cache_prompt": True,
            "slot_id": -1
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", f"{self.base_url}/completion", json=payload) as response:
                if response.status_code != 200:
                    raise Exception(f"Local server streaming error: {await response.aread()}")
                
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        try:
                            data = json.loads(line[6:])
                            content = data.get("content", "")
                            if content:
                                yield {"content": content}
                            if data.get("stop"):
                                break
                        except json.JSONDecodeError:
                            continue
