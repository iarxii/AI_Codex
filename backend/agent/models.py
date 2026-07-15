import logging
from typing import Optional
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from backend.config import settings

logger = logging.getLogger(__name__)

def get_llm(provider: str, model: str, temperature: float = 0.7, api_key: Optional[str] = None):
    """
    Unified LLM factory for AICodex Agent.
    """
    # Normalize model name and resolve defaults/placeholders
    model_name = model or "default"
    if model_name in ("default", "local", ""):
        if provider == "local":
            model_name = settings.DEFAULT_MODEL
        elif provider == "colab_bridge":
            model_name = "gemma-4-E4B_q4_0-it"
        elif provider == "ollama_cloud":
            model_name = settings.DEFAULT_MODEL  # e.g. llama3.2:3b from config
        elif provider == "openrouter":
            model_name = "meta-llama/llama-3-8b-instruct"
        elif provider == "groq":
            model_name = "llama3-8b-8192"
        elif provider == "gemini":
            model_name = "gemini-1.5-flash"
        else:
            model_name = "llama3"

    logger.info(f"Initializing LLM: provider={provider}, model={model_name}, temperature={temperature}")
    
    if provider == "local":
        if settings.LOCAL_BACKEND_MODE == "ollama":
            return ChatOllama(
                model=model_name,
                base_url=settings.OLLAMA_BASE_URL,
                temperature=temperature
            )
        else:
            # Fallback to OpenAI-compatible llamacpp
            return ChatOpenAI(
                model=model_name,
                openai_api_key="sk-not-needed",
                openai_api_base=f"{settings.LLAMACPP_BASE_URL}/v1",
                temperature=temperature
            )
            
    elif provider == "groq":
        return ChatOpenAI(
            model=model_name,
            openai_api_key=api_key or "sk-dummy",
            openai_api_base="https://api.groq.com/openai/v1",
            temperature=temperature
        )
        
    elif provider == "openrouter":
        return ChatOpenAI(
            model=model_name,
            openai_api_key=api_key or "sk-dummy",
            openai_api_base="https://openrouter.ai/api/v1",
            temperature=temperature
        )
        
    elif provider == "gemini":
        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=api_key or "dummy",
            temperature=temperature
        )
        
    elif provider == "ollama_cloud":
        # Use the user-configured cloud Ollama URL (set via OLLAMA_CLOUD_URL env var in frontend settings)
        base_url = getattr(settings, "OLLAMA_CLOUD_BASE_URL", None) or "http://localhost:11434"
        if not base_url.endswith("/v1"):
            base_url = f"{base_url.rstrip('/')}/v1"
        return ChatOpenAI(
            model=model_name,
            openai_api_key=api_key or "sk-ollama",
            openai_api_base=base_url,
            temperature=temperature
        )
        
    elif provider == "colab_bridge":
        return ChatOpenAI(
            model=model_name,
            openai_api_key=api_key or "sk-colab",
            openai_api_base=f"{settings.LLAMACPP_BASE_URL}/v1",
            temperature=temperature
        )
        
    else:
        # Default fallback — use the configured DEFAULT_MODEL
        logger.warning(f"Unknown provider {provider}, falling back to local ollama with {settings.DEFAULT_MODEL}")
        return ChatOllama(
            model=settings.DEFAULT_MODEL,
            base_url=settings.OLLAMA_BASE_URL,
            temperature=temperature
        )


def get_llm_for_tier(
    tier: str, 
    provider: str, 
    model: str, 
    temperature: float = 0.7, 
    api_key: Optional[str] = None, 
    api_keys: Optional[dict] = None
):
    """
    Tiered LLM factory for routing, guardrails, and coding reasoning.
    """
    resolved_provider = provider
    resolved_model = model
    resolved_api_key = api_key
    
    # 1. Determine target provider/model based on tier
    if tier in ("routing", "guard"):
        # Fast, cheap models
        if provider == "gemini":
            resolved_model = "gemini-1.5-flash"
        elif provider == "openrouter":
            resolved_model = "meta-llama/llama-3-8b-instruct"
        elif provider == "groq":
            resolved_model = "llama-3.1-8b-instant"
        elif provider == "local":
            resolved_model = "llama3"
    elif tier in ("reasoning", "coder"):
        # Flagship reasoning / coding models
        if provider == "gemini":
            resolved_model = "gemini-1.5-pro"
        elif provider == "openrouter":
            resolved_model = "anthropic/claude-sonnet-4"  # claude-3.5-sonnet deprecated Jul 2025
        elif provider == "groq":
            resolved_model = "llama-3.3-70b-versatile"
        elif provider == "local":
            resolved_model = "codellama"
            
    # Resolve API Key for the resolved provider from api_keys dict if available
    if api_keys and resolved_provider in api_keys:
        resolved_api_key = api_keys[resolved_provider]
        
    return get_llm(resolved_provider, resolved_model, temperature, resolved_api_key)
