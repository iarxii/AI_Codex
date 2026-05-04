from typing import List

def get_model_capabilities(provider: str, model: str) -> List[str]:
    """
    Determines model capabilities based on provider and model ID.
    Follows the AI Agent Harness Capability Matrix.
    """
    capabilities = []
    
    # Tool Support (Function Calling)
    if provider in ["groq", "gemini", "openrouter"]:
        capabilities.append("Tools")
    elif provider == "local":
        # Some local models might support tools, but our current NativeLocalClient 
        # is optimized for llama-server which doesn't expose standard tool calling yet.
        pass
    
    # Thinking / Reasoning Support
    thinking_models = [
        "gemini-1.5-pro", "gemini-2.0-flash-thinking", 
        "llama-3.1-405b", "deepseek-reasoner", "o1-mini", "o1-preview"
    ]
    if any(m in (model or "").lower() for m in thinking_models):
        capabilities.append("Thinking")
    
    # Multimodal Support
    multimodal_models = ["gemini", "gpt-4o", "claude-3", "pixtral"]
    if any(m in (model or "").lower() for m in multimodal_models) or provider == "gemini":
        capabilities.append("Multimodal")
    
    # Structured / JSON Mode Support
    if provider in ["groq", "gemini"]:
        capabilities.append("Structured")
    
    return capabilities

def estimate_tokens(text: str) -> int:
    """
    Rough estimation of token count for telemetry display.
    """
    if not text:
        return 0
    # Simple heuristic: 1 token approx 4 characters
    return len(text) // 4
