# Deployment & Configuration Guide

AICodex is designed to run in three main environments: Local Dev, Docker, and Google Cloud Run.

## ⚙️ Environment Variables (`.env`)

Create a `.env` file in the `backend/` directory.

| Variable | Description | Default |
|:---------|:------------|:--------|
| `SECRET_KEY` | JWT signing key (REQUIRED) | - |
| `DATABASE_URL` | SQLite or Postgres URL | (auto-generated) |
| `OLLAMA_BASE_URL`| Local/Remote Ollama API | `http://localhost:11434` |
| `ALLOWED_COMMANDS`| CSV list for sandbox | `git,python,pip,node...`|
| `EMBEDDING_DIM` | Vector dimension | `384` |
| `SEED_ADMIN` | Auto-create admin user | `False` |
| `GCS_BUCKET_NAME`| For Cloud Run persistence | - |

---

## 💻 Local Development

Use the provided batch script to start both backend and frontend:
```bash
.\start_website_dev.bat --aicodex --local
```

### Manual Start
1. **Backend**:
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```
2. **Frontend**:
   ```bash
   cd client
   npm install
   npm run dev
   ```

---

## 🐳 Docker Deployment

### Backend
```bash
docker build -t aicodex-backend -f backend/Dockerfile .
docker run -p 8080:8080 --env-file backend/.env aicodex-backend
```

### Frontend (Nginx)
```bash
docker build -t aicodex-frontend -f client/Dockerfile .
docker run -p 80:80 aicodex-frontend
```

---

## ☁️ Google Cloud Run

AICodex uses a **GCS Persistence Pattern** to handle SQLite on ephemeral Cloud Run instances.

### 1. Database Sync
The `backend/utils/storage.py` handles syncing the `.db` file to a Google Cloud Storage bucket on startup and shutdown.

### 2. Deployment Script
Use the `deploy_production.bat` script (if available) or follow these steps:
1. Enable Cloud Run and GCS APIs.
2. Build and push the backend image to Google Artifact Registry.
3. Deploy to Cloud Run with `K_SERVICE` env var set (triggers GCS sync).
4. Configure `CORS_ORIGINS` to allow your production domain.

---

## 🚨 Production Hardening

Before deploying to a public URL:
1. Change `SEED_ADMIN` to `False` after the first run.
2. Set a strong, unique `SECRET_KEY`.
3. Enable WebSocket authentication (Phase 2 task).
4. Configure an SSL certificate (Cloud Run handles this automatically).
