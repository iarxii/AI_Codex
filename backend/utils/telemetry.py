from typing import List

def get_model_capabilities(provider: str, model: str) -> List[str]:
    """
    Determines model capabilities based on provider and model ID.
    Follows the AI Agent Harness Capability Matrix.
    """
    capabilities = []
    
    # Tool Support (Function Calling)
    if provider in ["groq", "gemini", "openrouter"]:
        model_lower = (model or "").lower()
        if provider == "groq" and "compound" in model_lower:
            pass
        else:
            capabilities.append("Tools")
    elif provider == "local" or provider == "ollama_cloud":
        # Broaden tool support for modern Ollama models
        # These families are known to support native tool calling in Ollama
        tool_capable_families = [
            "llama3.1", "llama3.2", "llama3.3", 
            "mistral", "mistral-nemo", 
            "qwen2.5", "command-r", "gemma4"
        ]
        model_lower = (model or "").lower()
        
        # Heuristic: check if model belongs to a tool-capable family
        # BUT explicitly exclude DeepSeek-R1 for now as it lacks standard tool-calling support in Ollama
        if any(f in model_lower for f in tool_capable_families):
            if "deepseek-r1" not in model_lower:
                capabilities.append("Tools")
        
        # Fallback for generic "llama3" names that might be 3.1/3.2
        elif "llama3" in model_lower and "deepseek" not in model_lower:
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

def get_model_context_limit(provider: str, model: str) -> int:
    """
    Returns the approximate context window size (in tokens) for the given
    provider/model combination. Used for budget-aware context management
    to prevent unbounded context accumulation.
    """
    model_lower = (model or "").lower()
    
    # Provider-level defaults
    provider_defaults = {
        "groq": 8192,
        "gemini": 32768,
        "openrouter": 8192,
        "ollama_cloud": 8192,
        "local": 4096,
    }
    
    # Model-specific overrides (known context windows)
    if "gemini-1.5-pro" in model_lower or "gemini-2.0" in model_lower:
        return 128_000
    if "gemini-1.5-flash" in model_lower:
        return 128_000
    if "gemma4" in model_lower or "gemma-4" in model_lower:
        return 32_768
    if "llama-3.1-405b" in model_lower or "llama3.3" in model_lower:
        return 128_000
    if "llama3.1" in model_lower or "llama3.2" in model_lower:
        return 128_000
    if "llama3" in model_lower:
        return 8192
    if "mistral" in model_lower:
        return 32_768
    if "qwen2.5" in model_lower:
        return 32_768
    if "deepseek" in model_lower:
        return 64_000
    if "compound" in model_lower:
        return 8192
    
    return provider_defaults.get(provider, 8192)
