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

def get_context_builder():
    module = get_ollamaopt_module("context.builder")
    if module:
        return getattr(module, "ContextBuilder", None)
    return None

def get_model_router():
    module = get_ollamaopt_module("routing.router")
    if module:
        return getattr(module, "ModelRouter", None)
    return None
