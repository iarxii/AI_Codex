from typing import Any, Dict, List, Optional
from ..base import BaseSkill, SkillResult
from backend.integrations.ollamaopt_bridge import get_ollamaopt_module

class RagQuerySkill(BaseSkill):
    """
    Skill to query the local RAG (VectorDB) system.
    """
    name = "rag_query"
    description = (
        "Queries the local vector store for relevant documentation, code snippets, "
        "or knowledge based on the user's query."
    )
    parameters = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The natural language query to search for."
            },
            "collection": {
                "type": "string",
                "description": "The collection to query (default: 'ollamaopt_docs').",
                "default": "ollamaopt_docs"
            },
            "limit": {
                "type": "integer",
                "description": "The maximum number of results to return.",
                "default": 5
            }
        },
        "required": ["query"]
    }

    async def execute(self, query: str, collection: str = "ollamaopt_docs", limit: int = 5) -> SkillResult:
        try:
            # Import required modules from OllamaOpt via bridge
            rag_module = get_ollamaopt_module("rag")
            if not rag_module:
                return SkillResult(success=False, error="RAG module not found in OllamaOpt.")

            # Get components
            QdrantVectorStore = getattr(rag_module, "QdrantVectorStore", None)
            OllamaEmbedder = getattr(rag_module, "OllamaEmbedder", None)
            Retriever = getattr(rag_module, "Retriever", None)

            if not all([QdrantVectorStore, OllamaEmbedder, Retriever]):
                return SkillResult(success=False, error="Failed to load RAG components from OllamaOpt.")

            # Initialize components (similar to ChatInterface)
            # In a production app, these should probably be cached/singleton
            store = QdrantVectorStore(
                collection_name=collection,
                persist_dir="data/qdrant",
                embedding_dim=768,
            )
            embedder = OllamaEmbedder(
                api_base="http://localhost:11434", # Should come from settings
                model="nomic-embed-text",         # Should come from settings
            )
            retriever = Retriever(
                store=store,
                embedder=embedder,
                top_k=limit
            )

            # Perform retrieval
            results = retriever.retrieve(query, top_k=limit)
            
            if not results:
                return SkillResult(success=True, output="No relevant information found in RAG.", data={"results": []})

            # Format output
            formatted_output = retriever.format_for_context(results)
            citations = retriever.get_citations(results)

            return SkillResult(
                success=True,
                output=formatted_output,
                data={
                    "results": [
                        {
                            "content": r.content,
                            "title": r.title,
                            "source_path": r.source_path,
                            "score": r.score
                        } for r in results
                    ],
                    "citations": citations
                }
            )

        except Exception as e:
            return SkillResult(success=False, error=f"RAG query failed: {str(e)}")
