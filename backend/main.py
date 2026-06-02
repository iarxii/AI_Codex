import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from sqlalchemy import select, update
from backend.config import settings
from backend.db.session import init_db
from backend.utils.logger import mask_uvicorn_logs

# Ensure logging is masked on startup
mask_uvicorn_logs()

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[LIFESPAN] Starting initialization...")
    # Sync SQLite from GCS if in Cloud Run
    is_cloud_run = os.getenv("K_SERVICE") is not None
    force_restart = os.getenv("FORCE_RESTART") == "1" or os.getenv("FORCE_RESTART") == "true"
    
    if is_cloud_run and settings.DB_TYPE == "sqlite":
        if not force_restart:
            print("[LIFESPAN] Cloud Run detected, syncing DB from GCS...")
            from backend.utils.storage import download_db_from_gcs
            download_db_from_gcs()
        else:
            print("[LIFESPAN] FORCE_RESTART enabled, skipping GCS sync to trigger fresh schema.")

    # Initialize DB on startup
    print(f"[LIFESPAN] Initializing database: {settings.async_database_url}")
    await init_db()
    
    # Verify User table schema in logs
    try:
        from backend.db.session import engine
        from sqlalchemy import text
        async with engine.connect() as conn:
            result = await conn.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result.fetchall()]
            print(f"[LIFESPAN] Verified User columns: {columns}")
    except Exception as e:
        print(f"[LIFESPAN] Warning: Schema verification failed: {e}")

    print("[LIFESPAN] Database initialized.")
    
    # Seed Codex Spaces to ensure catalog is populated
    from codex_spaces.backend.seed_spaces import seed
    await seed()
    print("[LIFESPAN] Codex Spaces seeded.")
    
    if is_cloud_run and settings.DB_TYPE == "sqlite" and force_restart:
        print("[LIFESPAN] Schema updated via FORCE_RESTART. Performing immediate GCS sync...")
        from backend.utils.storage import upload_db_to_gcs
        upload_db_to_gcs()
    
    # Admin Account Migration
    print("[LIFESPAN] Running Identity Migration (Scrubbing legacy admin, elevating nexus-architect)...")
    from backend.db.session import AsyncSessionLocal
    from backend.db.models import User
    import uuid
    
    # 1. Deactivate legacy admin
    try:
        async with AsyncSessionLocal() as session:
            scrambled_hash = f"disabled_{uuid.uuid4().hex}"
            await session.execute(
                update(User).where(User.username == "admin").values(
                    is_active=False, 
                    hashed_password=scrambled_hash
                )
            )
            await session.commit()
        print("[LIFESPAN] Admin account deactivated.")
    except Exception as e:
        print(f"[LIFESPAN] Warning: Admin deactivation failed: {e}")

    # 2. Seed/Elevate nexus-architect
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(User).filter_by(username="nexus-architect"))
            architect = result.scalar_one_or_none()
            if not architect:
                print("[LIFESPAN] Seeding nexus-architect super-user...")
                from backend.db.session import pwd_context
                new_architect = User(
                    username="nexus-architect",
                    hashed_password=pwd_context.hash("GOD_MODE_ON"), # Standard fallback, but GOD_MODE_ON bypasses anyway
                    role="super_admin",
                    first_name="Nexus",
                    surname="Architect",
                    profession="System Sovereign",
                    is_active=True
                )
                session.add(new_architect)
            else:
                print("[LIFESPAN] nexus-architect exists, ensuring super_admin elevation...")
                await session.execute(update(User).where(User.username == "nexus-architect").values(role="super_admin"))
            await session.commit()
        print("[LIFESPAN] nexus-architect identity verified.")
    except Exception as e:
        print(f"[LIFESPAN] Warning: nexus-architect seeding/elevation failed: {e}")
    
    
    # Initialize OllamaOpt bridge
    print("[LIFESPAN] Setting up OllamaOpt bridge...")
    from backend.integrations.ollamaopt_bridge import setup_ollamaopt_bridge
    setup_ollamaopt_bridge()
    print("[LIFESPAN] Initialization complete. Server ready.")
    yield
    
    # Shutdown logic
    print("[LIFESPAN] Shutting down...")
    if is_cloud_run and settings.DB_TYPE == "sqlite":
        print("[LIFESPAN] Cloud Run detected, uploading DB to GCS before shutdown...")
        from backend.utils.storage import upload_db_to_gcs
        upload_db_to_gcs()
    print("[LIFESPAN] Shutdown complete.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# Premium Handshake Middleware
@app.middleware("http")
async def verify_premium_handshake(request, call_next):
    # Exclude login and healthz from handshake
    path = request.url.path.rstrip("/")
    if path.endswith("/login") or path.endswith("/healthz") or path == "" or path == "/api":
        return await call_next(request)

    if settings.COLAB_SECRET:
        # Check for the secret key in headers
        handshake_key = request.headers.get("X-Codex-Premium-Key")
        if handshake_key != settings.COLAB_SECRET:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=403,
                content={"detail": "Premium Handshake Failed: Invalid or missing security key."}
            )
    return await call_next(request)

# Set up CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
effective_origins = [o for o in origins if o != "*"]
local_origins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://localhost:9000", "http://localhost:9173", "http://127.0.0.1:9173"]
for lo in local_origins:
    if lo not in effective_origins:
        effective_origins.append(lo)

lab_origin = "https://aicodex-lab-1096425756328.us-central1.run.app"
if lab_origin not in effective_origins:
    effective_origins.append(lab_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=effective_origins if effective_origins else [lab_origin],
    allow_origin_regex="https://.*\.a\.run\.app|http://localhost:\d+|http://127.0.0.1:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler to ensure CORS headers on 500s
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    from starlette.exceptions import HTTPException as StarletteHTTPException
    if isinstance(exc, StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers={
                "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
                "Access-Control-Allow-Credentials": "true",
                **(getattr(exc, "headers", None) or {})
            }
        )
        
    import traceback
    print(f"[ERROR] Unhandled exception: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Credentials": "true"
        }
    )


@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} API", "status": "running"}

# Static Mounts for Knowledge Graphs
admin_graph_dir = Path("data/admin/global-graph")
admin_graph_dir.mkdir(parents=True, exist_ok=True)
app.mount("/admin/graph", StaticFiles(directory=str(admin_graph_dir), html=True), name="admin-graph")

# Workspace graphs: we mount the parent workspaces dir
# Requests will be /graph/{id}/graphify-out/graph.html
# To match frontend /graph/{id}/graph.html, we'll need a custom serving route or change frontend.
# I'll add a helper route to serve the graph.html from graphify-out.
@app.get("/graph/{session_id}/graph.html")
async def get_workspace_graph(session_id: str):
    from fastapi.responses import FileResponse
    from fastapi import HTTPException
    path = Path(f"data/workspaces/{session_id}/graphify-out/graph.html")
    if path.exists():
        return FileResponse(path)
    raise HTTPException(status_code=404, detail="Graph not found")

# Ensure static directories exist before mounting
Path("data/workspaces").mkdir(parents=True, exist_ok=True)
app.mount("/graph", StaticFiles(directory="data/workspaces", html=True), name="workspace-graphs")

@app.get("/healthz")
async def health_check():
    from datetime import datetime
    return {"status": "healthy", "timestamp": str(datetime.now())}

# Include routers
from backend.api import auth, chat, metrics, rag, skills, conversations, models, workspace, profile, admin, market, arcade
from codex_spaces.backend.api import spaces, bridge
app.include_router(auth.router, prefix=settings.API_V1_STR + "/auth", tags=["auth"])
app.include_router(profile.router, prefix=settings.API_V1_STR + "/profile", tags=["profile"])
app.include_router(admin.router, prefix=settings.API_V1_STR + "/admin", tags=["admin"])
app.include_router(conversations.router, prefix=settings.API_V1_STR + "/conversations", tags=["conversations"])
app.include_router(spaces.router, prefix=settings.API_V1_STR + "/spaces", tags=["spaces"])
app.include_router(bridge.router, prefix=settings.API_V1_STR + "/spaces/bridge", tags=["bridge"])
app.include_router(chat.router, prefix=settings.API_V1_STR + "/chat", tags=["chat"])
app.include_router(workspace.router, prefix=settings.API_V1_STR + "/workspace", tags=["workspace"])
app.include_router(metrics.router, prefix=settings.API_V1_STR + "/metrics", tags=["metrics"])
app.include_router(market.router, prefix=settings.API_V1_STR + "/market", tags=["market"])
app.include_router(rag.router, prefix=settings.API_V1_STR + "/rag", tags=["rag"])
app.include_router(skills.router, prefix=settings.API_V1_STR + "/skills", tags=["skills"])
app.include_router(models.router, prefix=settings.API_V1_STR + "/models", tags=["models"])
app.include_router(arcade.router, prefix=settings.API_V1_STR + "/arcade", tags=["arcade"])

@app.websocket("/ws/debug")
async def debug_websocket(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        await websocket.send_text(f"Echo: {data}")
