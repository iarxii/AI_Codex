import sys
import os
from pathlib import Path

# Add backend to path so we can import from .config etc.
sys.path.append(str(Path(__file__).resolve().parent))

import integrations.ollamaopt_bridge as bridge
from agent.graph import create_agent_graph

def test_imports():
    print("--- AICodex Integration Check ---")
    
    vs = bridge.get_vector_store()
    print(f"QdrantVectorStore: {'FOUND' if vs else 'MISSING'}")
    
    cb = bridge.get_context_builder_class()
    print(f"ContextBuilder Class: {'FOUND' if cb else 'MISSING'}")
    
    mr = bridge.get_model_router_class()
    print(f"ModelRouter Class: {'FOUND' if mr else 'MISSING'}")
    
    try:
        graph = create_agent_graph()
        print(f"Agent Graph: COMPILED")
    except Exception as e:
        print(f"Agent Graph: FAILED ({e})")

if __name__ == "__main__":
    test_imports()
