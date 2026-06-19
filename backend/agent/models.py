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
        elif provider == "ollama_cloud":
            model_name = "llama3"
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
        base_url = "https://ollama.com"
        if not base_url.endswith("/v1"):
            base_url = f"{base_url.rstrip('/')}/v1"
        return ChatOpenAI(
            model=model_name,
            openai_api_key=api_key or "sk-ollama",
            openai_api_base=base_url,
            temperature=temperature
        )
        
    else:
        # Default fallback
        logger.warning(f"Unknown provider {provider}, falling back to local llama3")
        return ChatOllama(
            model="llama3",
            base_url=settings.OLLAMA_BASE_URL,
            temperature=temperature
        )
