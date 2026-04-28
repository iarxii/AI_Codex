import logging
from typing import Any, Dict, List, Optional
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.db.session import engine, AsyncSessionLocal
from backend.db.models import DocumentChunk
from pgvector.sqlalchemy import Vector

logger = logging.getLogger(__name__)

class PostgresVectorStore:
    """
    Vector store implementation using PostgreSQL and pgvector.
    """
    def __init__(self, collection_name: str = "aicodex_vectors", embedding_dim: int = 1536):
        self.collection_name = collection_name
        self.embedding_dim = embedding_dim

    async def add_chunks(self, chunks: List[Any], embeddings: List[List[float]]):
        async with AsyncSessionLocal() as session:
            for chunk, embedding in zip(chunks, embeddings):
                doc_chunk = DocumentChunk(
                    source_path=chunk.source_path,
                    content=chunk.content,
                    embedding=embedding,
                    metadata_json=str(chunk.metadata)
                )
                session.add(doc_chunk)
            await session.commit()
            logger.info(f"Added {len(chunks)} chunks to PostgresVectorStore")

    def sync_search(self, query_embedding: List[float], top_k: int = 5, score_threshold: float = 0.3) -> List[Dict[str, Any]]:
        import asyncio
        try:
            # We need to run the async search in a way that works from a thread
            return asyncio.run(self.search(query_embedding, top_k, score_threshold))
        except Exception as e:
            logger.error(f"Sync search failed: {e}")
            return []

    async def search(self, query_embedding: List[float], top_k: int = 5, score_threshold: float = 0.3) -> List[Dict[str, Any]]:
        async with AsyncSessionLocal() as session:
            # Using cosine similarity: 1 - (embedding <=> query_embedding)
            # pgvector uses <=> for cosine distance, <-> for Euclidean distance, <#> for inner product
            stmt = select(DocumentChunk).order_by(DocumentChunk.embedding.cosine_distance(query_embedding)).limit(top_k)
            result = await session.execute(stmt)
            chunks = result.scalars().all()
            
            # Note: We might want to filter by score_threshold manually if needed, 
            # or use a more complex query. For now, we'll just return the top_k.
            
            return [
                {
                    "chunk_id": str(c.id),
                    "source_path": c.source_path,
                    "content": c.content,
                    "score": 1.0, # Placeholder for now, pgvector doesn't return score directly in simple order_by
                    "metadata": {} 
                } for c in chunks
            ]
