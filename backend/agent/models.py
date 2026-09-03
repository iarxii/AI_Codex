import logging
from typing import Optional
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from backend.config import settings

logger = logging.getLogger(__name__)

def get_llm(provider: str, model: str, temperature: float = 0.7, api_key: Optional[str] = None, base_url: Optional[str] = None, account_id: Optional[str] = None, gateway_id: Optional[str] = None, region: Optional[str] = None, aws_secret_access_key: Optional[str] = None):
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
        elif provider == "alibaba_ecs":
            model_name = settings.DEFAULT_MODEL
        elif provider == "openrouter":
            model_name = "meta-llama/llama-3-8b-instruct"
        elif provider == "openai":
            model_name = "gpt-4o-mini"
        elif provider == "groq":
            model_name = "llama3-8b-8192"
        elif provider == "gemini":
            model_name = "gemini-1.5-flash"
        elif provider in ("cloudflare_ai_gateway", "workers_ai"):
            model_name = "@cf/meta/llama-3-8b-instruct"
        elif provider == "litert":
            model_name = "gemma-2b-it-q4"
        elif provider == "deepseek":
            model_name = "deepseek-chat"
        elif provider == "xai":
            model_name = "grok-2"
        elif provider == "together":
            model_name = "meta-llama/Llama-3.3-70B-Instruct-Turbo"
        elif provider == "fireworks":
            model_name = "accounts/fireworks/models/llama-v3p3-70b-instruct"
        elif provider == "nvidia":
            model_name = "meta/llama-3.1-8b-instruct"
        elif provider == "perplexity":
            model_name = "sonar"
        elif provider == "cohere":
            model_name = "command-r-plus"
        elif provider == "mistral":
            model_name = "mistral-large-latest"
        elif provider == "huggingface":
            model_name = "meta-llama/Llama-3.3-70B-Instruct"
        elif provider == "cerebras":
            model_name = "llama-3.3-70b"
        elif provider == "anthropic":
            model_name = "claude-sonnet-4"
        else:
            model_name = "llama3"

    logger.info(f"Initializing LLM: provider={provider}, model={model_name}, temperature={temperature}, base_url={base_url}")
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
        resolved_base_url = base_url or "https://openrouter.ai/api/v1"
        return ChatOpenAI(
            model=model_name,
            openai_api_key=api_key or "sk-dummy",
            openai_api_base=resolved_base_url,
            temperature=temperature
        )

    elif provider == "openai":
        resolved_base_url = base_url or "https://api.openai.com/v1"
        return ChatOpenAI(
            model=model_name,
            openai_api_key=api_key or "sk-dummy",
            openai_api_base=resolved_base_url,
            temperature=temperature
        )
        
    elif provider == "gemini":
        if api_key and api_key.startswith("vertex_adc"):
            parts = api_key.split(":")
            project = parts[1] if len(parts) > 1 and parts[1] else settings.GCP_PROJECT_ID
            location = parts[2] if len(parts) > 2 and parts[2] else settings.GCP_REGION
            # pyrefly: ignore [missing-import]
            from langchain_google_vertexai import ChatVertexAI
            logger.info(f"Initializing ChatVertexAI (ADC) with model={model_name}, project={project}, location={location}")
            return ChatVertexAI(
                model=model_name,
                project=project,
                location=location,
                temperature=temperature
            )
        else:
            return ChatGoogleGenerativeAI(
                model=model_name,
                google_api_key=api_key or "dummy",
                temperature=temperature
            )
        
    elif provider == "ollama_cloud":
        # Resolve base URL: 1. dynamic base_url argument, 2. settings, 3. localhost fallback
        resolved_base_url = base_url or getattr(settings, "OLLAMA_CLOUD_BASE_URL", None) or "http://localhost:11434"
        if not resolved_base_url.endswith("/v1"):
            resolved_base_url = f"{resolved_base_url.rstrip('/')}/v1"
        logger.info(f"Ollama Cloud resolved base_url: {resolved_base_url}")
        return ChatOpenAI(
            model=model_name,
            openai_api_key=api_key or "sk-ollama",
            openai_api_base=resolved_base_url,
            temperature=temperature
        )

    elif provider == "alibaba_ecs":
        # Tier 2 (Connex, per-user) supplies base_url directly; Tier 1 static fallback only
        # applies when platform-managed inference is enabled (see backend/config.py).
        resolved_base_url = base_url
        if not resolved_base_url and settings.PLATFORM_MANAGED_INFERENCE_ENABLED:
            resolved_base_url = settings.ALIBABA_ECS_OLLAMA_URL
        if not resolved_base_url:
            raise ValueError(
                "Alibaba ECS requires a connected Ollama endpoint. Connect Alibaba ECS in the "
                "CONNEX tab, or enable platform-managed inference."
            )
        logger.info(f"Alibaba ECS resolved base_url: {resolved_base_url}")
        return ChatOllama(
            model=model_name,
            base_url=resolved_base_url,
            temperature=temperature
        )

    elif provider == "aws_bedrock":
        # Connex-managed only (Tier 2) — AWS has no static platform-managed fallback.
        try:
            from langchain_aws import ChatBedrock
        except ImportError as exc:
            raise ValueError(
                "AWS Bedrock support requires the 'langchain-aws' package. Install it with "
                "'pip install langchain-aws'."
            ) from exc

        if not api_key or not aws_secret_access_key or not region:
            raise ValueError(
                "AWS Bedrock requires an access key, secret key, and region. Connect AWS Bedrock "
                "in the CONNEX tab."
            )
        logger.info(f"Initializing AWS Bedrock: model={model_name}, region={region}")
        return ChatBedrock(
            model_id=model_name,
            region_name=region,
            aws_access_key_id=api_key,
            aws_secret_access_key=aws_secret_access_key,
            model_kwargs={"temperature": temperature},
        )

    elif provider == "colab_bridge":
        return ChatOpenAI(
            model=model_name,
            openai_api_key=api_key or "sk-colab",
            openai_api_base=f"{settings.LLAMACPP_BASE_URL}/v1",
            temperature=temperature
        )
        
    elif provider == "cloudflare_ai_gateway":
        # Resolve base URL: 1. dynamic base_url argument, 2. settings, 3. default.
        # When account_id + gateway_id are provided and the base URL is still the
        # bare host, compose the full gateway path: .../v1/{account_id}/{gateway_id}
        resolved_base_url = base_url or getattr(settings, "CLOUDFLARE_AI_GATEWAY_BASE_URL", None) or "https://gateway.ai.cloudflare.com"
        composed = account_id and gateway_id and gateway_id not in resolved_base_url
        if composed:
            resolved_base_url = f"{resolved_base_url.rstrip('/')}/v1/{account_id}/{gateway_id}"
        elif not resolved_base_url.endswith("/v1"):
            resolved_base_url = f"{resolved_base_url.rstrip('/')}/v1"
        logger.info(f"Cloudflare AI Gateway resolved base_url: {resolved_base_url}")
        return ChatOpenAI(
            model=model_name,
            openai_api_key=api_key or "sk-cf-gateway",
            openai_api_base=resolved_base_url,
            temperature=temperature
        )
        
    elif provider == "workers_ai":
        # Workers AI uses Cloudflare's OpenAI-compatible API
        resolved_account_id = account_id or getattr(settings, "CLOUDFLARE_ACCOUNT_ID", None)
        if resolved_account_id:
            resolved_base_url = f"https://api.cloudflare.com/client/v4/accounts/{resolved_account_id}/ai/v1"
        else:
            resolved_base_url = base_url or "https://api.cloudflare.com/client/v4/accounts/your-account-id/ai/v1"
        logger.info(f"Workers AI resolved base_url: {resolved_base_url}")
        return ChatOpenAI(
            model=model_name,
            openai_api_key=api_key or "sk-workers-ai",
            openai_api_base=resolved_base_url,
            temperature=temperature
        )
        
    elif provider == "litert":
        # LiteRT runs client-side (WebGPU/WASM via useLiteRtChat) — the backend
        # never serves this provider. Fail loudly instead of silently routing to
        # a local Ollama/llama.cpp instance.
        logger.warning("LiteRT provider selected on backend — client-side provider, not servable.")
        raise ValueError(
            "LiteRT is a client-side provider and cannot be used on the backend. "
            "Use the Lite Chat portal instead."
        )

    elif provider in (
        "openai",
        "deepseek", "xai", "together", "fireworks", "nvidia",
        "perplexity", "cohere", "mistral", "huggingface", "cerebras",
    ):
        # More-providers: all expose OpenAI-compatible endpoints. If the client
        # supplied a custom base_url (stored from MoreProvidersModal) it wins;
        # otherwise fall back to the provider's public default.
        default_base = {
            "openai": "https://api.openai.com/v1",
            "deepseek": "https://api.deepseek.com/v1",
            "xai": "https://api.x.ai/v1",
            "together": "https://api.together.xyz/v1",
            "fireworks": "https://api.fireworks.ai/inference/v1",
            "nvidia": "https://integrate.api.nvidia.com/v1",
            "perplexity": "https://api.perplexity.ai",
            "cohere": "https://api.cohere.com",
            "mistral": "https://api.mistral.ai/v1",
            "huggingface": "https://router.huggingface.co/v1",
            "cerebras": "https://api.cerebras.ai/v1",
        }
        resolved_base_url = base_url or default_base.get(provider, "")
        if not api_key:
            logger.warning(f"Provider {provider} selected without an API key — requests will fail upstream.")
        logger.info(f"Initializing {provider}: model={model_name}, base_url={resolved_base_url}")
        return ChatOpenAI(
            model=model_name,
            openai_api_key=api_key or "sk-dummy",
            openai_api_base=resolved_base_url,
            temperature=temperature
        )

    elif provider == "anthropic":
        # Anthropic's OpenAI-compatible endpoint. Claude is served over
        # https://api.anthropic.com/v1 (messages/models are OpenAI-shaped).
        resolved_base_url = base_url or "https://api.anthropic.com/v1"
        if not api_key:
            logger.warning("Anthropic provider selected without an API key — requests will fail upstream.")
        logger.info(f"Initializing Anthropic: model={model_name}, base_url={resolved_base_url}")
        return ChatOpenAI(
            model=model_name,
            openai_api_key=api_key or "sk-ant-dummy",
            openai_api_base=resolved_base_url,
            temperature=temperature
        )

    elif provider in ("azure", "azure_foundry"):
        # Azure OpenAI / Azure AI Foundry need the resource endpoint + API version. The base_url
        # passed in must be the full "https://<resource>.openai.azure.com/"
        # deployment endpoint (frontend MoreProvidersModal for azure, Connex config for azure_foundry).
        resolved_base_url = base_url or ""
        if not resolved_base_url:
            logger.error("Azure provider selected without an azure_endpoint base_url.")
            raise ValueError(
                "Azure OpenAI requires an endpoint URL. Add your Azure resource "
                "endpoint (https://<resource>.openai.azure.com/) in the provider settings."
            )
        if not resolved_base_url.endswith("/v1"):
            resolved_base_url = f"{resolved_base_url.rstrip('/')}/v1"
        logger.info(f"Initializing Azure OpenAI: model={model_name}, base_url={resolved_base_url}")
        return ChatOpenAI(
            model=model_name,
            openai_api_key=api_key or "sk-azure-dummy",
            openai_api_base=resolved_base_url,
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
    api_keys: Optional[dict] = None,
    base_url: Optional[str] = None
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
        elif provider == "cloudflare_ai_gateway":
            resolved_model = "@cf/meta/llama-3-8b-instruct"
        elif provider == "workers_ai":
            resolved_model = "@cf/meta/llama-3-8b-instruct"
        elif provider == "litert":
            resolved_model = "gemma-2b-it-q4"  # Example LiteRT model
    elif tier in ("reasoning", "coder"):
        # Flagship reasoning / coding models
        if provider == "gemini":
            resolved_model = "gemini-1.5-pro"
        elif provider == "openrouter":
            resolved_model = "anthropic/claude-sonnet-4"
        elif provider == "groq":
            resolved_model = "llama-3.3-70b-versatile"
        elif provider == "local":
            resolved_model = "codellama"
        elif provider == "cloudflare_ai_gateway":
            resolved_model = "@cf/meta/llama-3.1-70b-instruct"
        elif provider == "workers_ai":
            resolved_model = "@cf/meta/llama-3.1-70b-instruct"
        elif provider == "litert":
            resolved_model = "gemma-7b-it-q4"  # Example LiteRT model
            
    # Resolve API Key for the resolved provider from api_keys dict if available
    if api_keys and resolved_provider in api_keys:
        resolved_api_key = api_keys[resolved_provider]
        
    return get_llm(resolved_provider, resolved_model, temperature, resolved_api_key, base_url=base_url)
