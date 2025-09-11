# RAG Workflow Setup Guide

This document provides a step-by-step guide to setting up and using the Retrieval Augmented Generation (RAG) workflow in this project.

## 1. Prerequisites

Before you begin, ensure you have the following services running locally:

*   **Ollama:** For generating embeddings. You can download it from [ollama.com](https://ollama.com/).
    *   Once installed, you must pull the required model by running:
        ```bash
        ollama pull nomic-embed-text
        ```
*   **ChromaDB:** For the vector store. The easiest way to run this is using Docker:
    ```bash
    docker run -p 8000:8000 chromadb/chroma
    ```

## 2. Configuration

1.  **Gemini API Key:** The RAG service uses Google's Gemini model for content generation. You need to provide an API key.
    *   Create a file named `.env` in the `server` directory if it doesn't already exist.
    *   Add your Gemini API key to the `.env` file:
        ```env
        GEMINI_API_KEY="YOUR_API_KEY_HERE"
        ```

## 3. Data Ingestion

This step loads your documents, generates embeddings, and stores them in the ChromaDB vector store.

1.  **Add Documents:** Place all the PDF documents you want to process into the `server/rag/data` directory.
2.  **Run the Ingestion Script:** Navigate to the `server` directory in your terminal and run the following command:
    ```bash
    node rag/ingest.js
    ```
    You will see logs indicating the progress of loading, splitting, and embedding the documents. This may take some time depending on the number and size of your documents.

## 4. Running the RAG Service

The RAG service is part of the main application server.

1.  **Start the Server:** If it's not already running, you can start the main server using the project's root launch script:
    ```bash
    ./start-services.sh
    ```
    Alternatively, to start only the main server, navigate to the `server` directory and run:
    ```bash
    npm run server
    ```

## 5. Querying the RAG Service

The RAG service is exposed via an API endpoint. You can use any API client (like Postman, curl, or the project's web front-end) to send a query.

*   **Endpoint:** `POST /api/chat`
*   **Body (JSON):**
    ```json
    {
      "message": "Your question about the documents here"
    }
    ```

*   **Example with `curl`:**
    ```bash
    curl -X POST http://localhost:3001/api/chat \
         -H "Content-Type: application/json" \
         -d '{"message": "What is the main topic of the documents?"}'
    ```
