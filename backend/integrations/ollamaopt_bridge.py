import sys
import logging
from pathlib import Path
from backend.config import settings
from .postgres_store import PostgresVectorStore

logger = logging.getLogger(__name__)

def setup_ollamaopt_bridge():
    """Adds sibling OllamaOpt directory to sys.path for direct imports."""
    try:
        # Resolve path relative to backend directory
        # backend/integrations/ollamaopt_bridge.py -> backend -> AI_Codex -> projects/iarxii
        base_path = Path(__file__).resolve().parents[3]
        ollamaopt_path = base_path / "OllamaOpt"
        
        if not ollamaopt_path.exists():
            # Try alternate path if not found (e.g. if we are in a different structure)
            ollamaopt_path = Path(settings.OLLAMAOPT_PATH).resolve()
            
        if ollamaopt_path.exists():
            if str(ollamaopt_path) not in sys.path:
                sys.path.insert(0, str(ollamaopt_path))
                logger.info(f"OllamaOpt bridge established at: {ollamaopt_path}")
            return True
        else:
            logger.warning(f"OllamaOpt directory not found at {ollamaopt_path}. Local features may be limited.")
            return False
    except Exception as e:
        logger.error(f"Failed to establish OllamaOpt bridge: {e}")
        return False

# Import wrappers with graceful fallbacks
def get_ollamaopt_module(module_name: str):
    """Safely import a module from OllamaOpt."""
    try:
        setup_ollamaopt_bridge()
        import importlib
        return importlib.import_module(f"cli.{module_name}")
    except ImportError as e:
        logger.error(f"Could not import OllamaOpt module 'cli.{module_name}': {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error importing OllamaOpt module 'cli.{module_name}': {e}")
        return None

# Helper to get specific components
def get_vector_store():
    module = get_ollamaopt_module("rag.store")
    if module:
        return getattr(module, "QdrantVectorStore", None)
    return None

def get_context_builder_class():
    module = get_ollamaopt_module("context.builder")
    if module:
        return getattr(module, "ContextBuilder", None)
    return None

def get_model_router_class():
    module = get_ollamaopt_module("routing.router")
    if module:
        return getattr(module, "ModelRouter", None)
    return None

def get_metrics_collector():
    module = get_ollamaopt_module("metrics_collector")
    if module:
        return getattr(module, "MetricsCollector", None)
    return None

# Singleton-style initialized instances with thread safety
import threading
_init_lock = threading.Lock()
_initialized_retriever = None
_initialized_context_builder = None

def get_retriever():
    """Returns an initialized Retriever instance with fallback endpoint and model support."""
    global _initialized_retriever
    if _initialized_retriever:
        return _initialized_retriever
    
    with _init_lock:
        # Re-check inside lock
        if _initialized_retriever:
            return _initialized_retriever
            
        try:
            rag_module = get_ollamaopt_module("rag")
            if not rag_module: return None
            
            QdrantVectorStore = getattr(rag_module, "QdrantVectorStore")
            OllamaEmbedder = getattr(rag_module, "OllamaEmbedder")
            Retriever = getattr(rag_module, "Retriever")
            
            # Monkey-patch OllamaEmbedder for better resilience
            original_embed_text = OllamaEmbedder.embed_text
            
            # Monkey-patch OllamaEmbedder to be modern and silent
            def patched_embed_text(self, text: str):
                import requests
                # Clean base URL (strip trailing /v1 if present for segment-based joining)
                raw_base = self.api_base.rstrip('/')
                if raw_base.endswith('/v1'):
                    raw_base = raw_base[:-3].rstrip('/')
                
                # Try multiple endpoints for compatibility
                endpoints = ["/v1/embeddings", "/api/embed", "/api/embeddings", "/embedding"]
                embedding_models = [self.model, "all-minilm:latest", "all-minilm", "nomic-embed-text"]
                
                for endpoint in endpoints:
                    endpoint_failed = False
                    for model in embedding_models:
                        if not model: continue
                        try:
                            url = f"{raw_base}{endpoint}"
                            target_model = model if model else "default"
                            
                            if "v1" in endpoint:
                                payload = {"model": target_model, "input": text}
                            elif "embed" in endpoint:
                                payload = {"model": target_model, "input": text}
                            else: # /embedding (llama.cpp legacy)
                                payload = {"content": text}
                                
                            resp = requests.post(url, json=payload, timeout=10) # Increased timeout
                            if resp.status_code == 200:
                                data = resp.json()
                                if "embeddings" in data:
                                    return [float(v) for v in data["embeddings"][0]]
                                elif "embedding" in data:
                                    emb = data["embedding"]
                                    if isinstance(emb, list) and isinstance(emb[0], list):
                                        return [float(v) for v in emb[0]]
                                    return [float(v) for v in emb]
                                elif "data" in data and isinstance(data["data"], list):
                                    return [float(v) for v in data["data"][0]["embedding"]]
                            elif resp.status_code in [400, 404, 405]:
                                endpoint_failed = True
                                break 
                        except Exception: 
                            endpoint_failed = True
                            break
                return None

            OllamaEmbedder.embed_text = patched_embed_text
            
            # Monkey-patch QdrantVectorStore.__init__ to fallback to memory if locked
            original_qdrant_init = QdrantVectorStore.__init__
            def patched_qdrant_init(self, *args, **kwargs):
                original_qdrant_init(self, *args, **kwargs)
                if getattr(self, '_client', None) is None:
                    logger.warning("QdrantClient failed to initialize with path. Attempting in-memory fallback.")
                    from qdrant_client import QdrantClient
                    try:
                        self._client = QdrantClient(location=":memory:")
                        logger.info("Successfully fell back to in-memory QdrantClient.")
                        if hasattr(self, '_ensure_collection'):
                            self._ensure_collection()
                    except Exception as fallback_exc:
                        logger.error(f"Fallback to in-memory QdrantClient also failed: {fallback_exc}")
            
            QdrantVectorStore.__init__ = patched_qdrant_init
            
            # Detect embedding dimension dynamically
            test_embedder = OllamaEmbedder(
                api_base=settings.OLLAMA_BASE_URL,
                model="all-minilm:latest"
            )
            dummy_vec = test_embedder.embed_text("test")
            detected_dim = len(dummy_vec) if dummy_vec else 384
            logger.info(f"Detected embedding dimension: {detected_dim}")

            # We swap QdrantVectorStore for PostgresVectorStore
            store = PostgresVectorStore(
                collection_name="aicodex_vectors",
                embedding_dim=detected_dim, 
            )
            
            # Since PostgresVectorStore methods are async, we might need to wrap the retriever
            # or ensure the Retriever class in OllamaOpt can handle async store.
            # For now, let's assume the Retriever can work with it if we pass it correctly.
            
            embedder = OllamaEmbedder(
                api_base=settings.OLLAMA_BASE_URL,
                model="all-minilm:latest", 
            )
            _initialized_retriever = Retriever(
                store=store,
                embedder=embedder,
                top_k=5,
                score_threshold=0.3,
            )
            
            # Monkey-patch Retriever.retrieve to use sync_search if store is PostgresVectorStore
            original_retrieve = _initialized_retriever.retrieve
            def patched_retrieve(query, **kwargs):
                if hasattr(_initialized_retriever.store, "sync_search"):
                    # We override the search logic inside retrieve by intercepting the store call
                    # Actually, we can just replace the store.search method
                    _initialized_retriever.store.search = _initialized_retriever.store.sync_search
                return original_retrieve(query, **kwargs)
            
            _initialized_retriever.retrieve = patched_retrieve
            return _initialized_retriever
        except Exception as e:
            logger.error(f"Failed to initialize Retriever: {e}")
            return None

def get_context_builder(provider: str = "local"):
    """Returns an initialized ContextBuilder instance with provider-aware budget."""
    global _initialized_context_builder
    
    # Re-initialize if provider tier changed (local vs cloud have different budgets)
    budget_module = get_ollamaopt_module("context.model")
    if budget_module:
        get_budget = getattr(budget_module, "get_budget_for_provider", None)
        if get_budget:
            new_budget = get_budget(provider)
            if _initialized_context_builder:
                current_cap = getattr(
                    getattr(_initialized_context_builder, '_policy', None),
                    'budget', None
                )
                if current_cap and getattr(current_cap, 'total_hard_cap_chars', 0) != new_budget.total_hard_cap_chars:
                    # Budget tier changed — rebuild
                    _initialized_context_builder = None
    
    if _initialized_context_builder:
        return _initialized_context_builder
    
    try:
        context_module = get_ollamaopt_module("context.builder")
        policy_module = get_ollamaopt_module("context.model") # Fixed: was context.policy
        if not context_module or not policy_module: return None
        
        ContextBuilder = getattr(context_module, "ContextBuilder")
        ContextPolicy = getattr(policy_module, "ContextPolicy")
        get_budget_fn = getattr(policy_module, "get_budget_for_provider", None)
        
        budget = get_budget_fn(provider) if get_budget_fn else None
        policy = ContextPolicy(budget=budget) if budget else ContextPolicy()
        
        logger.info(f"ContextBuilder initialized with {provider} budget (cap={policy.budget.total_hard_cap_chars} chars)")
        
        _initialized_context_builder = ContextBuilder(policy=policy)
        
        # Non-destructive refactor: Add a build_context helper to the instance
        def build_context_wrapper(messages: list, system_prompt: str = None):
            """Translates LangChain messages into budget-aware context."""
            from langchain_core.messages import BaseMessage
            
            # Use provided system prompt or fallback to builder's default
            final_system_prompt = system_prompt or "You are AICodex, an elite agentic assistant."
            
            # Extract query (last human message) and history
            user_query = ""
            history_dicts = []
            
            for m in messages:
                role = "assistant" if m.type == "ai" else "user"
                if m.type == "system":
                    # If we found a system message in the list, it might be more specific
                    final_system_prompt = m.content
                    continue 
                if m.type == "human":
                    user_query = m.content
                history_dicts.append({"role": role, "content": str(m.content)})
            
            # Update builder state for this turn
            _initialized_context_builder.set_system_prompt(final_system_prompt)
            
            # Build using OllamaOpt logic to determine budget/truncation
            assembled = _initialized_context_builder.build(
                user_query=user_query,
                chat_history=history_dicts,
                retrieved_chunks=[],
                tool_results=[],
                memory_items=[]
            )
            
            # Re-construct as structured LangChain messages instead of collapsing to strings
            from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
            
            new_msgs = [SystemMessage(content=assembled.system_prompt)]
            
            # We filter the original messages to only include those that fit in the budget
            # OllamaOpt's assembled.history_context is useful for local LLMs, 
            # but for cloud providers we want the original objects.
            
            # Simple heuristic: if history was truncated by OllamaOpt, we should trim our list
            if assembled.was_truncated:
                # We'll take the last N messages that likely fit
                # (OllamaOpt uses a char-based cap, we'll follow its lead)
                trimmed_history = messages[-6:] # Keep last 3 turns if truncated
            else:
                trimmed_history = messages[:-1] # All except current query
            
            for m in trimmed_history:
                if m.type == "system": continue
                new_msgs.append(m)
            
            # Finally append the clean user query
            new_msgs.append(HumanMessage(content=user_query))
            return new_msgs

        _initialized_context_builder.build_context = build_context_wrapper
        return _initialized_context_builder
    except Exception as e:
        logger.error(f"Failed to initialize ContextBuilder: {e}")
        return None
