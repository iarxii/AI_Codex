from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
from backend.integrations.ollamaopt_bridge import get_ollamaopt_module
from pathlib import Path
import os

router = APIRouter()

class RAGQueryRequest(BaseModel):
    query: str
    collection: str = "ollamaopt_docs"
    limit: int = 5

@router.post("/query")
async def query_rag(request: RAGQueryRequest):
    """
    Query the RAG system directly.
    """
    try:
        rag_module = get_ollamaopt_module("rag")
        if not rag_module:
            raise HTTPException(status_code=503, detail="RAG system not available.")

        # components
        QdrantVectorStore = getattr(rag_module, "QdrantVectorStore", None)
        OllamaEmbedder = getattr(rag_module, "OllamaEmbedder", None)
        Retriever = getattr(rag_module, "Retriever", None)

        store = QdrantVectorStore(
            collection_name=request.collection,
            persist_dir="data/qdrant",
            embedding_dim=768,
        )
        embedder = OllamaEmbedder()
        retriever = Retriever(store=store, embedder=embedder, top_k=request.limit)

        results = retriever.retrieve(request.query)
        return {
            "results": [
                {
                    "content": r.content,
                    "title": r.title,
                    "source_path": r.source_path,
                    "score": r.score,
                    "metadata": r.metadata
                } for r in results
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ingest")
async def ingest_document(file: UploadFile = File(...), collection: str = "ollamaopt_docs"):
    """
    Ingest a document into the RAG system.
    """
    try:
        # Save file temporarily
        temp_dir = Path("data/uploads")
        temp_dir.mkdir(parents=True, exist_ok=True)
        file_path = temp_dir / file.filename
        
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())

        rag_module = get_ollamaopt_module("rag")
        if not rag_module:
            raise HTTPException(status_code=503, detail="RAG system not available.")

        DocumentIngester = getattr(rag_module, "DocumentIngester", None)
        Document = getattr(rag_module, "Document", None)
        
        # This is a bit simplified - real ingestion might need more setup
        # depending on OllamaOpt's DocumentIngester implementation
        ingester = DocumentIngester(collection_name=collection)
        doc = Document(source_path=str(file_path), title=file.filename)
        
        # Synchronous ingestion (might want to move to background task)
        ingester.ingest_document(doc)
        
        return {"message": f"Successfully ingested {file.filename}", "collection": collection}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
