import sys
import logging
from pathlib import Path
from backend.config import settings

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

# Singleton-style initialized instances
_initialized_retriever = None
_initialized_context_builder = None

def get_retriever():
    """Returns an initialized Retriever instance with fallback endpoint support."""
    global _initialized_retriever
    if _initialized_retriever:
        return _initialized_retriever
    
    try:
        rag_module = get_ollamaopt_module("rag")
        if not rag_module: return None
        
        QdrantVectorStore = getattr(rag_module, "QdrantVectorStore")
        OllamaEmbedder = getattr(rag_module, "OllamaEmbedder")
        Retriever = getattr(rag_module, "Retriever")
        
        # Monkey-patch OllamaEmbedder to support /api/embed if /api/embeddings fails
        original_embed_text = OllamaEmbedder.embed_text
        
        def patched_embed_text(self, text: str):
            # Try legacy endpoint first (original logic)
            res = original_embed_text(self, text)
            if res is not None:
                return res
            
            # If 404/failure, try modern /api/embed
            import requests
            try:
                modern_endpoint = f"{self.api_base}/api/embed"
                payload = {"model": self.model, "input": text}
                resp = requests.post(modern_endpoint, json=payload, timeout=self.timeout)
                if resp.status_code == 200:
                    data = resp.json()
                    # /api/embed returns 'embeddings' (plural) for multiple or a list of lists
                    embeddings = data.get("embeddings")
                    if embeddings and len(embeddings) > 0:
                        return [float(v) for v in embeddings[0]]
            except Exception:
                pass
            return None

        OllamaEmbedder.embed_text = patched_embed_text
        
        store = QdrantVectorStore(
            collection_name="aicodex_vectors",
            persist_dir="data/qdrant",
            embedding_dim=384, # all-minilm is 384
        )
        embedder = OllamaEmbedder(
            api_base=settings.OLLAMA_BASE_URL,
            model="all-minilm", # Use a smaller, more common model for compatibility
        )
        _initialized_retriever = Retriever(
            store=store,
            embedder=embedder,
            top_k=5,
            score_threshold=0.3,
        )
        return _initialized_retriever
    except Exception as e:
        logger.error(f"Failed to initialize Retriever: {e}")
        return None

def get_context_builder():
    """Returns an initialized ContextBuilder instance."""
    global _initialized_context_builder
    if _initialized_context_builder:
        return _initialized_context_builder
    
    try:
        context_module = get_ollamaopt_module("context.builder")
        policy_module = get_ollamaopt_module("context.model") # Fixed: was context.policy
        if not context_module or not policy_module: return None
        
        ContextBuilder = getattr(context_module, "ContextBuilder")
        ContextPolicy = getattr(policy_module, "ContextPolicy")
        
        policy = ContextPolicy()
        _initialized_context_builder = ContextBuilder(policy=policy)
        _initialized_context_builder.set_system_prompt(
            "You are AICodex, an intelligent coding agent. "
            "Use the provided context to ground your answers. "
            "If the context is insufficient, use your tools."
        )
        return _initialized_context_builder
    except Exception as e:
        logger.error(f"Failed to initialize ContextBuilder: {e}")
        return None
