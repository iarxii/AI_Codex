from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.db.session import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB on startup
    await init_db()
    # TODO: Initialize OllamaOpt bridge
    yield
    # Cleanup code here if needed

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# Set up CORS
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:5176",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} API", "status": "running"}

# Include routers
from backend.api import auth, chat, metrics, rag, skills, conversations, models
app.include_router(auth.router, prefix=settings.API_V1_STR + "/auth", tags=["auth"])
app.include_router(conversations.router, prefix=settings.API_V1_STR + "/conversations", tags=["conversations"])
app.include_router(chat.router, prefix=settings.API_V1_STR + "/chat", tags=["chat"])
app.include_router(metrics.router, prefix=settings.API_V1_STR + "/metrics", tags=["metrics"])
app.include_router(rag.router, prefix=settings.API_V1_STR + "/rag", tags=["rag"])
app.include_router(skills.router, prefix=settings.API_V1_STR + "/skills", tags=["skills"])
app.include_router(models.router, prefix=settings.API_V1_STR + "/models", tags=["models"])

# Direct WebSocket registration for debugging
from backend.api.chat import websocket_endpoint
from backend.api.metrics import metrics_endpoint
app.add_api_websocket_route("/ws/agent", websocket_endpoint)
app.add_api_websocket_route("/ws/metrics", metrics_endpoint)
