# AdaptivIntelligenceCodex (AICodex)

**AdaptivIntelligenceCodex (AICodex)** is a comprehensive knowledge base and code generation pipeline for Senior Agentic AI Engineers, designed for rapid prototyping and architecture mapping. It features a local-first agentic oversight engine that prioritizes local offline inference via our optimized **OllamaOpt** pipeline, complemented by Bring-Your-Own-Key (BYOK) cloud provider routing.

## Core Capabilities

- **OllamaOpt Inference**: High-performance local LLM execution via Ollama or Llama.cpp with optimized context window management and token stream caching.
- **BYOK Cloud Integration**: Multi-provider cloud routing supporting OpenAI (GPT-4o), Google Gemini, Anthropic, and OpenRouter using your own developer keys.
- **Neural Analytics**: Real-time hardware telemetry (NPU/GPU/CPU) tracking.
- **Graphify Knowledge Graph**: Interactive structural codebase mapping and cross-project intelligence. [See Docs](docs/GRAPHIFY_INTEGRATION.md)

## Setup

The AI_Codex project consists of a **FastAPI Backend** and a **React Frontend**. You can set up the entire project using our setup script:

```sh
./setup.sh
```

### Manual Setup

#### 1. Backend Setup (Python 3.10+)
```sh
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

#### 2. Frontend Setup (React)
```sh
cd client
npm install
```

## Running the App

### Local Development (OllamaOpt / Local Focus)
To launch all services (including local databases and the FastAPI and React application servers) using the repository-level script:
```sh
./start-services.sh
```

Alternatively, start them separately:
1. **Backend**: `cd backend && python main.py`
2. **Frontend**: `cd client && npm run dev`

## Deployment & Hardware

- **Hardware Guidelines**: Running large models locally requires significant RAM/VRAM. See [Hardware Requirements](docs/HARDWARE_REQUIREMENTS.md).
- **Google Colab**: Deploy the GPU-enabled backend to Colab for premium performance. See [Colab Deployment Guide](docs/COLAB_DEPLOYMENT.md).
- **Production (Cloud Run)**: Automated deployment to Google Cloud Run is supported. See [Production Deployment](deploy_production.bat).

---

## License

This project is distributed under the MIT License. See `LICENSE` for more information.

## Contributing

Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for details on how to contribute to this project.
