# RAG Environment Setup on Windows Server 2022

This guide provides step-by-step instructions for configuring a Windows Server 2022 environment to run the complete RAG (Retrieval Augmented Generation) workflow for this project.

## 1. Install Windows Subsystem for Linux (WSL)

Ollama, which is used for generating text embeddings, does not have a native installer for Windows Server. The recommended approach is to run it within the Windows Subsystem for Linux (WSL).

1.  Open **PowerShell as an Administrator**.
2.  Run the following command to install WSL and the default Ubuntu distribution:
    ```powershell
    wsl --install
    ```
3.  After the installation is complete, **reboot your server** as prompted. WSL will complete its setup upon restart.

## 2. Install and Configure Ollama (via WSL)

Once WSL is installed, you can install Ollama inside the Linux environment.

1.  Open the **Ubuntu** application from the Start Menu.
2.  Inside the new Ubuntu terminal, run the official Ollama installation script:
    ```bash
    curl -fsSL https://ollama.com/install.sh | sh
    ```
3.  After the installation, Ollama will be running as a background service within WSL. You now need to pull the specific embedding model used by this project:
    ```bash
    ollama pull nomic-embed-text
    ```

Ollama is now running and accessible from both the WSL environment and the host Windows Server at `http://localhost:11434`.

## 3. Install Docker and Run ChromaDB

ChromaDB is used as the vector store to hold the document embeddings. The easiest way to run it is via Docker.

1.  **Install Docker Desktop:** Download and install Docker Desktop for Windows from the official [Docker website](https://www.docker.com/products/docker-desktop/).
2.  **Start ChromaDB Container:** Once Docker is running, open a **PowerShell** or **Command Prompt** window and run the following command to start the ChromaDB server:
    ```bash
    docker run -p 8000:8000 chromadb/chroma
    ```
    This will download the ChromaDB image and run it as a container, making it accessible on `http://localhost:8000`.

## 4. Project Configuration

Finally, configure the project itself.

1.  **Install Dependencies:** Open a terminal in the project's root directory and run `npm install` in both the `server` and `mcp` directories to install all required Node.js packages.
    ```bash
    cd server
    npm install
    cd ../mcp
    npm install
    cd ..
    ```
2.  **Set API Key:** The RAG service requires a Google Gemini API key.
    *   Create a file named `.env` in the `server` directory.
    *   Add your API key to this file:
        ```env
        GEMINI_API_KEY="YOUR_API_KEY_HERE"
        ```

## 5. Next Steps: Ingestion and Usage

Your server environment is now fully configured. To proceed with populating the vector store and using the RAG service, please follow the instructions in the workflow guide:

*   **[RAG Workflow Setup Guide](./RAG_Workflow_Setup.md)**
