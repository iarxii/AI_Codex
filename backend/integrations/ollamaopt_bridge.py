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
                # Try modern /api/embed directly to avoid legacy 404 noise
                embedding_models = [self.model, "all-minilm:latest", "all-minilm", "nomic-embed-text"]
                for model in embedding_models:
                    if not model: continue
                    try:
                        resp = requests.post(
                            f"{self.api_base}/api/embed", 
                            json={"model": model, "input": text}, 
                            timeout=5
                        )
                        if resp.status_code == 200:
                            embeddings = resp.json().get("embeddings")
                            if embeddings: return [float(v) for v in embeddings[0]]
                    except Exception: continue
                
                # If all failed, return None (RAG will skip)
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
            
            store = QdrantVectorStore(
                collection_name="aicodex_vectors",
                persist_dir="data/qdrant",
                embedding_dim=384, 
            )
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
