from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .db.session import init_db

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} API", "status": "running"}

# Include routers
from .api import auth, chat, metrics
app.include_router(auth.router, prefix=settings.API_V1_STR + "/auth", tags=["auth"])
app.include_router(chat.router, prefix=settings.API_V1_STR + "/chat", tags=["chat"])
app.include_router(metrics.router, prefix=settings.API_V1_STR + "/metrics", tags=["metrics"])

# Direct WebSocket registration for debugging
from .api.chat import websocket_endpoint
from .api.metrics import metrics_endpoint
app.add_api_websocket_route("/ws/agent", websocket_endpoint)
app.add_api_websocket_route("/ws/metrics", metrics_endpoint)
