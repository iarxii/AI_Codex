# Deployment Plan: AI Codex to Google Cloud Run

This plan outlines the steps to deploy the AI Codex application (FastAPI backend and React frontend) to Google Cloud Run using the `cloudrun` MCP server.

## User Review Required

> [!IMPORTANT]
> **Authentication**: You must ensure your local environment is authenticated with Google Cloud. Run `gcloud auth login` and `gcloud auth application-default login` in your terminal.
> **Project ID**: You will need to provide a valid Google Cloud Project ID.
> **Database**: The current setup uses SQLite, which is ephemeral on Cloud Run. For production-grade persistence, we should consider Cloud SQL (PostgreSQL/MySQL). For this initial deployment, we will proceed with the current setup, but data will be lost on container restart.

## Open Questions

- Do you already have a GCP Project created? If not, I can attempt to create one using `create_project`.
- Do you want to deploy the frontend and backend as separate services (recommended) or bundled together?
- For Ollama, are you planning to run it on a separate Cloud Run service with GPU, or use an external API (like Groq/OpenRouter) as mentioned in your `Hosting_AI_Lab.md`?

## Proposed Changes

### [Backend Component]

We will containerize the FastAPI backend and deploy it to Cloud Run.

#### [NEW] [Dockerfile](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/Dockerfile)
Create a Dockerfile to package the FastAPI app.

#### [MODIFY] [main.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/main.py)
Update CORS settings to allow the production frontend URL (once deployed).

### [Frontend Component]

We will build the React app and serve it using a lightweight web server (like Nginx) in a container.

#### [NEW] [Dockerfile](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/Dockerfile)
Create a Dockerfile for the frontend using a multi-stage build (build with Node, serve with Nginx).

#### [MODIFY] [vite.config.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/vite.config.ts)
Ensure the API URL is configurable for production.

---

## Verification Plan

### Automated Tests
- Once deployed, we will use the `get_service` and `get_service_log` tools to verify the status.
- We will perform a health check on the deployed endpoints.

### Manual Verification
- Access the Cloud Run URL in the browser and verify the UI loads and can communicate with the backend.
