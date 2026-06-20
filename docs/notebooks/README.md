# AI Codex Colab Orchestration Pipeline & Model Downloader

This directory contains the orchestration notebook and batch utilities used to set up, compile, and run the **AI Codex Backend** inside a hardware-accelerated Google Colab environment.

---

## 1. Colab Orchestration Sequence

The Jupyter Notebook (`AICodex_Spirit_Bird.ipynb`) automates the setup of the remote backend in the following sequence:

1. **Storage & Environment Persistence**: Mounts Google Drive to cache large model weights persistently, avoiding re-downloading between session restarts.
2. **System Dependencies & Repository Setup**: Clones the core codebases, builds and configures PostgreSQL database with `pgvector` extensions for Vector search, and installs dependencies.
3. **Engine Compiling**: Clones and compiles the custom `llama-cpp-turboquant` engine with CUDA acceleration and sets up planar symmetric KV cache compression (`planar3`).
4. **Backend Bootstrapping**: Spins up the FastAPI application server with live hot-reloading configurations.
5. **Reverse Proxy Tunneling**: Sets up `ngrok` TCP and HTTP forwarding to map the remote Colab server ports to accessible public URLs.
6. **Handshake & Verification**: Verifies end-to-end model connectivity and generates a secure runtime report masking passwords and sensitive keys.

---

## 2. Model Downloader (`dl_models.bat`)

To feed different flavors of models (e.g., DeepSeek R1, Qwen Coder, Gemma QAT) into your CodexSpaces, they must be cached in your Google Drive. 

The `dl_models.bat` script automates high-speed model retrieval using Hugging Face's Rust-accelerated `hf_transfer` engine.

### Setup and Usage:
1. **Locate your local Google Drive Folder**: Install Google Drive for Desktop on your Windows machine so your Drive appears as a local disk (typically drive letter `G:\` or `H:\`).
2. **Create the Model Directory**: Create a folder named `open_models` in your Google Drive (e.g., `G:\My Drive\open_models\`).
3. **Place the Script**: Copy `dl_models.bat` and paste it directly inside the `open_models` directory:
   ```
   G:\My Drive\open_models\dl_models.bat
   ```
4. **Run the Script**: Double-click `dl_models.bat`. It will:
   - Install `huggingface_hub` and the high-speed transfer library `hf_transfer`.
   - Download the model weights to a temporary directory on your local SSD first (to bypass Google Drive virtual write limitations).
   - Move the finalized `.gguf` files into the respective subfolders (`Qwen/`, `Google/`, `DeepSeek/`) in your Drive.
   - Automatically clean up temporary download files.

Once the batch file completes, Google Drive for Desktop will sync the model files to the cloud. The Colab notebook will then be able to read and hot-swap them instantly.

---

## 3. Assist & Technical Support

Setting up a remote CUDA-enabled orchestration pipeline can be tricky. If you would like access to the fully configured `.ipynb` notebook file along with personalized technical support to assist you with the setup, a donation of **$5** is highly appreciated.

For support inquiries and donation details, please contact the repository maintainer.
