# RAG Pipeline & Vector Store Documentation

AICodex uses Retrieval Augmented Generation (RAG) to ground agent responses in your local workspace and project memory.

## 🏗️ Architecture

The pipeline consists of three main components:
1. **Embedding Core**: Generates vector representations of text.
2. **Vector Store**: Persists and searches these vectors.
3. **Context Builder**: Injects retrieved results into the agent's prompt.

### 1. Embedding Model
- **Default**: `all-minilm` (384 dimensions).
- **Rationale**: 384d offers the best balance of speed and accuracy for coding tasks on local hardware. It is significantly faster than Nomics 768d or OpenAI's 1536d.
- **Configuration**: Defined in `backend/config.py` via `EMBEDDING_DIM`.

### 2. Vector Store (Dual-Mode)
AICodex supports two storage backends:
- **SQLite + pgvector (Local/Dev)**: Uses the `pgvector` extension if running in Postgres, or simulated local storage for SQLite.
- **Qdrant (Prod/Advanced)**: A dedicated high-performance vector database.
- **Dynamic Initialization**: The `OllamaOptBridge` dynamically detects the available store and initializes the appropriate retriever.

### 3. The OllamaOpt Bridge
The `backend/integrations/ollamaopt_bridge.py` acts as a monkey-patched adapter for the `OllamaOpt` library.
- **Modern Endpoint Support**: Automatically handles the transition from legacy `/api/embeddings` to modern `/api/embed` in Ollama.
- **Sync/Async Fallback**: Implements `sync_search` and `async_search` to ensure compatibility with both the FastAPI endpoints and the LangGraph engine.

---

## 📂 Data Model: `DocumentChunk`

Each document is broken into chunks and stored in the database:
- `content`: The raw text snippet.
- `embedding`: The `Vector(384)` representation.
- `source_path`: The file path relative to the project root.
- `metadata_json`: Store line numbers, file types, and other tags.

---

## 🛠️ Operations

### Ingestion (`/api/rag/ingest`)
Currently, files are ingested as whole chunks. 
- **Recommendation**: For large files, use the `workspace_reader` skill which the agent uses to selectively pull context.
- **Future Roadmap**: Implement semantic chunking and sliding window overlaps.

### Querying (`/api/rag/query`)
The agent uses the `rag_query` skill to perform similarity searches.
- **Top-K**: Default is set to 4 results.
- **Score Threshold**: Returns results with a cosine similarity score > 0.7.

---

## 🚨 Troubleshooting

### "Dimension Mismatch"
If you see an error about `Vector size 1536 does not match 384`:
- This occurs when the database schema was created for OpenAI dimensions but you are using `all-minilm`.
- **Resolution**: Phase 1 fix updated `models.py` to use `settings.EMBEDDING_DIM`. Run a migration or reset your local DB.

### "Retriever not initialized"
- Ensure Ollama is running and the embedding model is pulled:
  `ollama pull all-minilm`
