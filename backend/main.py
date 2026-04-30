import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.db.session import init_db
from backend.utils.logger import mask_uvicorn_logs

# Ensure logging is masked on startup
mask_uvicorn_logs()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Sync SQLite from GCS if in Cloud Run
    is_cloud_run = os.getenv("K_SERVICE") is not None
    if is_cloud_run and settings.DB_TYPE == "sqlite":
        from backend.utils.storage import download_db_from_gcs
        download_db_from_gcs()

    # Initialize DB on startup
    print(f"[DB_DEBUG] Using database: {settings.async_database_url}")
    await init_db()
    
    # Initialize OllamaOpt bridge
    from backend.integrations.ollamaopt_bridge import setup_ollamaopt_bridge
    setup_ollamaopt_bridge()
    yield
    
    # Sync SQLite back to GCS on shutdown
    if is_cloud_run and settings.DB_TYPE == "sqlite":
        from backend.utils.storage import upload_db_to_gcs
        upload_db_to_gcs()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# Set up CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} API", "status": "running"}

@app.get("/healthz")
async def health_check():
    from datetime import datetime
    return {"status": "healthy", "timestamp": str(datetime.now())}

# Include routers
from backend.api import auth, chat, metrics, rag, skills, conversations, models, workspace
app.include_router(auth.router, prefix=settings.API_V1_STR + "/auth", tags=["auth"])
app.include_router(conversations.router, prefix=settings.API_V1_STR + "/conversations", tags=["conversations"])
app.include_router(chat.router, prefix=settings.API_V1_STR + "/chat", tags=["chat"])
app.include_router(workspace.router, prefix=settings.API_V1_STR + "/workspace", tags=["workspace"])
app.include_router(metrics.router, prefix=settings.API_V1_STR + "/metrics", tags=["metrics"])
app.include_router(rag.router, prefix=settings.API_V1_STR + "/rag", tags=["rag"])
app.include_router(skills.router, prefix=settings.API_V1_STR + "/skills", tags=["skills"])
app.include_router(models.router, prefix=settings.API_V1_STR + "/models", tags=["models"])

@app.websocket("/ws/debug")
async def debug_websocket(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        await websocket.send_text(f"Echo: {data}")
