# AdaptivIntelligenceCodex (AICodex)

**AdaptivIntelligenceCodex (AICodex)** is a comprehensive knowledge base and code generation pipeline for Senior Agentic AI Engineers, designed for rapid prototyping and architecture mapping. It features an AI-powered Health and Oversight Data Analysis engine supporting both OpenAI (gpt-4o) and Google Gemini (2.5 Flash) models.

## Core Capabilities

- **Neural Analytics**: Real-time hardware telemetry (NPU/GPU/CPU) tracking.
- **Graphify Knowledge Graph**: Interactive structural codebase mapping and cross-project intelligence. [See Docs](docs/GRAPHIFY_INTEGRATION.md)

## Setup

The AI_Codex project consists of a **FastAPI Backend** and a **React Frontend**.

### 1. Backend Setup (Python 3.10+)
```sh
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Frontend Setup (React)
```sh
cd client
npm install
```

## Running the App

### Local Development
To start both services with a single command (requires the provided `.bat` or `.sh` scripts):
```sh
./start_website_dev.bat --aicodex --local
```

Alternatively, start them separately:
1. **Backend**: `cd backend && python main.py`
2. **Frontend**: `cd client && npm run dev`

## Deployment & Hardware

- **Hardware Guidelines**: Running large models locally requires significant RAM/VRAM. See [Hardware Requirements](docs/HARDWARE_REQUIREMENTS.md).
- **Google Colab**: Deploy the GPU-enabled backend to Colab for premium performance. See [Colab Deployment Guide](docs/COLAB_DEPLOYMENT.md).
- **Production (Cloud Run)**: Automated deployment to Google Cloud Run is supported. See [Production Deployment](deploy_production.bat).


### Features

- Modern OpenAI and Gemini integration
- Provider selection per request
- Designed for health data analysis, oversight, and feedback

---

## License

This project is distributed under the MIT License. See `LICENSE` for more information.

## Contributing

Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for details on how to contribute to this project.
