import json
import logging
import httpx
from typing import List, Dict, Any, Optional, AsyncIterator
from langchain_core.messages import BaseMessage, AIMessage, HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Chat Template Registry
# Each model family requires its own prompt format for raw /completion calls.
# When using Ollama mode, templates are handled by Ollama automatically via
# the model's embedded Modelfile — this registry is only used in llamacpp mode.
# ─────────────────────────────────────────────────────────────────────────────
CHAT_TEMPLATES = {
    "llama3": {
        "bos": "<|begin_of_text|>",
        "header_fmt": "<|start_header_id|>{role}<|end_header_id|>\n\n",
        "eot": "<|eot_id|>",
        "stop": ["<|eot_id|>", "<|end_of_text|>", "<|start_header_id|>"],
    },
    "chatml": {
        # Used by: Qwen, Qwen2, Qwen2.5, Qwen3, Yi, Mistral-Instruct v0.3+
        "bos": "",
        "header_fmt": "<|im_start|>{role}\n",
        "eot": "<|im_end|>\n",
        "stop": ["<|im_end|>"],
    },
    "glm4": {
        # Used by: GLM-4, GLM-4.6, ChatGLM4
        "bos": "[gMASK]<sop>",
        "header_fmt": "<|{role}|>\n",
        "eot": "",
        "stop": ["<|user|>", "<|observation|>"],
    },
    "deepseek": {
        # Used by: DeepSeek-R1, DeepSeek-V2/V3
        "bos": "<|begin▁of▁sentence|>",
        "header_fmt": "<|{role_tag}|>\n",
        "eot": "<|end▁of▁sentence|>",
        "stop": ["<|end▁of▁sentence|>", "<|User|>"],
        # DeepSeek uses custom role tags
        "role_map": {"system": "System", "user": "User", "assistant": "Assistant"},
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# Template auto-detection from model name
# ─────────────────────────────────────────────────────────────────────────────
MODEL_TEMPLATE_MAP = {
    # Qwen family → ChatML
    "qwen": "chatml",
    "qwen2": "chatml",
    "qwen3": "chatml",
    # GLM family
    "glm": "glm4",
    "chatglm": "glm4",
    # DeepSeek family
    "deepseek": "deepseek",
    # Llama family (default)
    "llama": "llama3",
    "llama3": "llama3",
    # Mistral with ChatML
    "mistral": "chatml",
    "ministral": "chatml",
    # Yi family → ChatML
    "yi": "chatml",
}


def detect_template(model_name: str) -> str:
    """
    Auto-detect the chat template from a model name string.
    Falls back to 'llama3' if no match is found.
    """
    if not model_name:
        return "llama3"

    name_lower = model_name.lower()

    # Check longest-prefix matches first (e.g., "qwen2.5-coder" matches "qwen")
    # Sort by key length descending to prioritize more specific matches
    for prefix in sorted(MODEL_TEMPLATE_MAP.keys(), key=len, reverse=True):
        if prefix in name_lower:
            return MODEL_TEMPLATE_MAP[prefix]

    return "llama3"


class NativeLocalClient:
    """
    Optimized client for llama-server (raw llama.cpp) with native streaming
    and model-aware prompt templating.
    
    This client is used in 'llamacpp' backend mode where we talk directly
    to llama-server's /completion endpoint with a raw prompt string.
    In 'ollama' backend mode, we use LangChain's ChatOpenAI instead,
    which handles templating automatically.
    """

    def __init__(
        self,
        base_url: str,
        model: str = "default",
        temperature: float = 0.0,
        template: str = None,
    ):
        # Strip /v1 to access native llama.cpp endpoints (/completion, /tokenize)
        self.base_url = base_url.replace("/v1", "") if "/v1" in base_url else base_url
        self.model = model
        self.temperature = temperature

        # Determine template: explicit override > auto-detect > fallback
        if template:
            self.template_name = template
        else:
            self.template_name = detect_template(model)

        if self.template_name not in CHAT_TEMPLATES:
            logger.warning(
                f"Unknown template '{self.template_name}', falling back to 'llama3'"
            )
            self.template_name = "llama3"

        self.template = CHAT_TEMPLATES[self.template_name]
        logger.info(
            f"NativeLocalClient initialized: model={model}, template={self.template_name}"
        )

    def _apply_template(self, messages: List[BaseMessage]) -> str:
        """Applies the configured chat template to a list of LangChain messages."""
        tpl = self.template
        prompt = tpl["bos"]

        role_map = tpl.get("role_map", None)

        for msg in messages:
            # Determine role
            if isinstance(msg, SystemMessage):
                role = "system"
            elif isinstance(msg, AIMessage):
                role = "assistant"
            else:
                role = "user"

            # Apply role mapping if the template defines one (e.g., DeepSeek)
            if role_map:
                mapped_role = role_map.get(role, role)
                header = tpl["header_fmt"].format(role_tag=mapped_role, role=mapped_role)
            else:
                header = tpl["header_fmt"].format(role=role)

            prompt += f"{header}{msg.content}{tpl['eot']}"

        # Append the assistant header to prompt generation
        if role_map:
            assistant_tag = role_map.get("assistant", "assistant")
            prompt += tpl["header_fmt"].format(
                role_tag=assistant_tag, role=assistant_tag
            )
        else:
            prompt += tpl["header_fmt"].format(role="assistant")

        return prompt

    async def ainvoke(self, messages: List[BaseMessage]) -> AIMessage:
        """Non-streaming invocation (fallback)."""
        prompt = self._apply_template(messages)
        payload = {
            "prompt": prompt,
            "temperature": self.temperature,
            "stream": False,
            "n_predict": 1024,
            "stop": self.template["stop"],
            "cache_prompt": True,
            "slot_id": -1,  # Allow server to pick/reuse slot
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/completion", json=payload
            )
            if response.status_code != 200:
                raise Exception(f"Local server error: {response.text}")
            data = response.json()
            return AIMessage(content=data.get("content", ""))

    async def astream(
        self, messages: List[BaseMessage]
    ) -> AsyncIterator[Dict[str, Any]]:
        """Streaming invocation for 'blazing fast' UI feedback."""
        prompt = self._apply_template(messages)
        payload = {
            "prompt": prompt,
            "temperature": self.temperature,
            "stream": True,
            "n_predict": 1024,
            "stop": self.template["stop"],
            "cache_prompt": True,
            "slot_id": -1,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", f"{self.base_url}/completion", json=payload
            ) as response:
                if response.status_code != 200:
                    raise Exception(
                        f"Local server streaming error: {await response.aread()}"
                    )

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
