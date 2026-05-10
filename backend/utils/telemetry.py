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
    elif provider == "local" or provider == "ollama_cloud":
        # Gemma 4 supports native tool calling in local environments
        if "gemma4" in (model or "").lower():
            capabilities.append("Tools")
    
    
    # Thinking / Reasoning Support
    thinking_models = [
        "gemini-1.5-pro", "gemini-2.0-flash-thinking", 
        "llama-3.1-405b", "deepseek-reasoner", "o1-mini", "o1-preview",
        "gemma4"
    ]
    if any(m in (model or "").lower() for m in thinking_models):
        capabilities.append("Thinking")
    
    # Multimodal Support
    multimodal_models = ["gemini", "gpt-4o", "claude-3", "pixtral"]
    if any(m in (model or "").lower() for m in multimodal_models) or provider == "gemini":
        capabilities.append("Multimodal")
    
    # Structured / JSON Mode Support
    if provider in ["groq", "gemini"] or "gemma4" in (model or "").lower():
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
