# Phase 1: Foundation (Backend + Agent Core)

- [x] Restructure directories (archive/delete old code)
    - [x] Create `archive/` directory
    - [x] Move `server/` to `archive/`
    - [x] Move `Agents/google_adk` to `archive/`
    - [x] Delete `client-deprecate/`
    - [x] Delete `Agents/langgraph/`
    - [x] Delete root `package.json`
- [x] Initialize Python environment in `backend/`
    - [x] Create `backend/requirements.txt`
    - [x] Create `backend/.env`
- [x] Create FastAPI skeleton
    - [x] `backend/main.py`
    - [x] `backend/config.py`
    - [x] `backend/db/session.py` (with admin seed)
    - [x] `backend/db/models.py`
- [x] Set up OllamaOpt sibling bridge
    - [x] `backend/integrations/ollamaopt_bridge.py`
- [x] Build LangGraph Agent Core
    - [x] `backend/agent/state.py`
    - [x] `backend/agent/graph.py`
    - [x] `backend/agent/nodes.py`
- [x] Implement API endpoints
    - [x] Auth endpoints (`/api/auth/login`)
    - [x] Chat WebSocket (`/ws/agent`)
- [x] Validation
    - [x] Verify OllamaOpt imports
    - [x] Verify agent tool-calling loop

# Phase 1 Complete
AICodex backend foundation is ready.
- FastAPI skeleton implemented
- SQLite DB with admin seed ready
- OllamaOpt bridge established
- LangGraph core wiring verified
