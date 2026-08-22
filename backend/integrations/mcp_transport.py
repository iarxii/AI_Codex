"""MCP HTTP/SSE Transport Server — exposes MCP protocol over HTTP + SSE.

This allows the backend to run MCP servers as managed services and connect to them
via HTTP instead of stdio. Complements the VSCode extension's stdio-based McpManager.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# JSON-RPC 2.0 Models
# ---------------------------------------------------------------------------

class JSONRPCRequest(BaseModel):
    jsonrpc: str = "2.0"
    id: Optional[int | str] = None
    method: str
    params: Optional[Dict[str, Any]] = None


class JSONRPCResponse(BaseModel):
    jsonrpc: str = "2.0"
    id: Optional[int | str] = None
    result: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None


class JSONRPCNotification(BaseModel):
    jsonrpc: str = "2.0"
    method: str
    params: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# MCP Protocol Types
# ---------------------------------------------------------------------------

class MCPServerCapabilities(BaseModel):
    tools: Optional[Dict[str, Any]] = None
    resources: Optional[Dict[str, Any]] = None
    prompts: Optional[Dict[str, Any]] = None


class MCPClientCapabilities(BaseModel):
    tools: Optional[Dict[str, Any]] = None
    resources: Optional[Dict[str, Any]] = None
    prompts: Optional[Dict[str, Any]] = None


class MCPTool(BaseModel):
    name: str
    description: Optional[str] = None
    inputSchema: Dict[str, Any]


class MCPInitializeRequest(BaseModel):
    protocolVersion: str
    capabilities: MCPClientCapabilities
    clientInfo: Dict[str, str]


class MCPInitializeResponse(BaseModel):
    protocolVersion: str = "2024-11-05"
    capabilities: MCPServerCapabilities
    serverInfo: Dict[str, str]


# ---------------------------------------------------------------------------
# MCP Server Session
# ---------------------------------------------------------------------------

@dataclass
class MCPSession:
    """Represents a single MCP client connection."""
    session_id: str
    initialized: bool = False
    client_info: Optional[Dict[str, str]] = None
    pending_requests: Dict[int | str, asyncio.Future] = field(default_factory=dict)
    next_id: int = 1
    created_at: datetime = field(default_factory=datetime.utcnow)


class MCPTransportServer:
    """MCP server with HTTP + SSE transport.
    
    Supports both:
    - POST /mcp — JSON-RPC requests (with response)
    - GET /mcp/events — SSE stream for notifications
    """
    
    def __init__(self, name: str, version: str = "1.0.0"):
        self.name = name
        self.version = version
        self.sessions: Dict[str, MCPSession] = {}
        self.tools: Dict[str, MCPTool] = {}
        self.resources: Dict[str, Any] = {}
        self.prompts: Dict[str, Any] = {}
        
        # Handler maps
        self._request_handlers: Dict[str, Callable] = {}
        self._notification_handlers: Dict[str, Callable] = {}
        
        # Register built-in handlers
        self._register_builtin_handlers()
    
    def _register_builtin_handlers(self):
        self._request_handlers["initialize"] = self._handle_initialize
        self._request_handlers["tools/list"] = self._handle_tools_list
        self._request_handlers["tools/call"] = self._handle_tools_call
        self._request_handlers["resources/list"] = self._handle_resources_list
        self._request_handlers["resources/read"] = self._handle_resources_read
        self._request_handlers["prompts/list"] = self._handle_prompts_list
        self._request_handlers["prompts/get"] = self._handle_prompts_get
        
        self._notification_handlers["notifications/initialized"] = self._handle_initialized_notification
    
    # -------------------------------------------------------------------------
    # Built-in handlers
    # -------------------------------------------------------------------------
    
    async def _handle_initialize(self, params: Dict[str, Any], session: MCPSession) -> Dict[str, Any]:
        req = MCPInitializeRequest(**params)
        session.client_info = req.clientInfo
        session.initialized = True
        
        return MCPInitializeResponse(
            capabilities=MCPServerCapabilities(
                tools={"listChanged": True},
                resources={"subscribe": False, "listChanged": True},
                prompts={"listChanged": True},
            ),
            serverInfo={"name": self.name, "version": self.version},
        ).model_dump(exclude_none=True)
    
    async def _handle_initialized_notification(self, params: Dict[str, Any], session: MCPSession):
        """Client confirms initialization complete."""
        logger.info(f"Session {session.session_id} confirmed initialization")
    
    async def _handle_tools_list(self, params: Dict[str, Any], session: MCPSession) -> Dict[str, Any]:
        return {"tools": [t.model_dump() for t in self.tools.values()]}
    
    async def _handle_tools_call(self, params: Dict[str, Any], session: MCPSession) -> Dict[str, Any]:
        name = params.get("name")
        arguments = params.get("arguments", {})
        
        if name not in self.tools:
            raise ValueError(f"Tool '{name}' not found")
        
        # Execute the tool (to be implemented by subclass or via handler registration)
        handler = getattr(self, f"_tool_{name}", None)
        if not handler:
            raise NotImplementedError(f"Tool '{name}' has no handler")
        
        result = await handler(arguments)
        
        return {
            "content": [
                {"type": "text", "text": str(result)}
            ] if not isinstance(result, dict) else result
        }
    
    async def _handle_resources_list(self, params: Dict[str, Any], session: MCPSession) -> Dict[str, Any]:
        return {"resources": []}
    
    async def _handle_resources_read(self, params: Dict[str, Any], session: MCPSession) -> Dict[str, Any]:
        raise NotImplementedError("Resource reading not implemented")
    
    async def _handle_prompts_list(self, params: Dict[str, Any], session: MCPSession) -> Dict[str, Any]:
        return {"prompts": []}
    
    async def _handle_prompts_get(self, params: Dict[str, Any], session: MCPSession) -> Dict[str, Any]:
        raise NotImplementedError("Prompts not implemented")
    
    # -------------------------------------------------------------------------
    # Public API for registering tools/resources/prompts
    # -------------------------------------------------------------------------
    
    def register_tool(self, tool: MCPTool, handler: Callable[[Dict[str, Any]], Any]) -> None:
        """Register a tool with its handler."""
        self.tools[tool.name] = tool
        setattr(self, f"_tool_{tool.name}", handler)
        logger.info(f"Registered MCP tool: {tool.name}")
    
    def register_resource(self, uri: str, handler: Callable[[], Any]) -> None:
        self.resources[uri] = handler
    
    def register_prompt(self, name: str, handler: Callable[[Dict[str, Any]], Any]) -> None:
        self.prompts[name] = handler
    
    # -------------------------------------------------------------------------
    # Session management
    # -------------------------------------------------------------------------
    
    def create_session(self) -> MCPSession:
        session = MCPSession(session_id=str(uuid.uuid4()))
        self.sessions[session.session_id] = session
        return session
    
    def get_session(self, session_id: str) -> Optional[MCPSession]:
        return self.sessions.get(session_id)
    
    def remove_session(self, session_id: str) -> None:
        self.sessions.pop(session_id, None)
    
    # -------------------------------------------------------------------------
    # Request/Notification processing
    # -------------------------------------------------------------------------
    
    async def process_request(self, session_id: str, request: JSONRPCRequest) -> JSONRPCResponse:
        session = self.get_session(session_id)
        if not session:
            return JSONRPCResponse(id=request.id, error={"code": -32000, "message": "Invalid session"})
        
        handler = self._request_handlers.get(request.method)
        if not handler:
            return JSONRPCResponse(id=request.id, error={"code": -32601, "message": f"Method not found: {request.method}"})
        
        try:
            result = await handler(request.params or {}, session)
            return JSONRPCResponse(id=request.id, result=result)
        except Exception as e:
            logger.error(f"Error handling {request.method}: {e}")
            return JSONRPCResponse(id=request.id, error={"code": -32603, "message": str(e)})
    
    async def process_notification(self, session_id: str, notification: JSONRPCNotification) -> None:
        session = self.get_session(session_id)
        if not session:
            return
        
        handler = self._notification_handlers.get(notification.method)
        if handler:
            try:
                await handler(notification.params or {}, session)
            except Exception as e:
                logger.error(f"Error handling notification {notification.method}: {e}")
    
    async def send_notification(self, session_id: str, method: str, params: Optional[Dict[str, Any]] = None) -> None:
        """Send a notification to a specific session via SSE."""
        session = self.get_session(session_id)
        if not session:
            return
        
        notification = JSONRPCNotification(method=method, params=params)
        # The SSE stream will pick this up
        # In a full implementation, we'd use a queue per session
        logger.debug(f"Notification to {session_id}: {method}")


# ---------------------------------------------------------------------------
# FastAPI App Factory
# ---------------------------------------------------------------------------

def create_mcp_app(transport_server: MCPTransportServer) -> FastAPI:
    """Create a FastAPI app with MCP HTTP/SSE endpoints."""
    
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        logger.info(f"MCP Transport Server '{transport_server.name}' starting...")
        yield
        logger.info(f"MCP Transport Server '{transport_server.name}' shutting down...")
    
    app = FastAPI(
        title=f"MCP Transport - {transport_server.name}",
        version=transport_server.version,
        lifespan=lifespan,
    )
    
    @app.post("/mcp")
    async def mcp_endpoint(request: Request) -> Response:
        """Handle JSON-RPC requests (POST)."""
        body = await request.body()
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            return Response(
                content=json.dumps(JSONRPCResponse(error={"code": -32700, "message": "Parse error"}).model_dump()),
                media_type="application/json",
                status_code=400,
            )
        
        # Handle batch requests
        if isinstance(data, list):
            responses = []
            for item in data:
                req = JSONRPCRequest(**item)
                # Get or create session from header
                session_id = request.headers.get("X-MCP-Session")
                if not session_id:
                    session = transport_server.create_session()
                    session_id = session.session_id
                resp = await transport_server.process_request(session_id, req)
                resp_dict = resp.model_dump(exclude_none=True)
                if "X-MCP-Session" not in resp_dict:
                    resp_dict["_session_id"] = session_id
                responses.append(resp_dict)
            
            return Response(
                content=json.dumps(responses),
                media_type="application/json",
                headers={"X-MCP-Session": session_id},
            )
        
        # Single request
        req = JSONRPCRequest(**data)
        session_id = request.headers.get("X-MCP-Session")
        if not session_id:
            session = transport_server.create_session()
            session_id = session.session_id
        
        resp = await transport_server.process_request(session_id, req)
        return Response(
            content=json.dumps(resp.model_dump(exclude_none=True)),
            media_type="application/json",
            headers={"X-MCP-Session": session_id},
        )
    
    @app.get("/mcp/events")
    async def mcp_events(request: Request):
        """SSE endpoint for server-to-client notifications."""
        session_id = request.headers.get("X-MCP-Session")
        if not session_id:
            session = transport_server.create_session()
            session_id = session.session_id
        
        async def event_generator() -> AsyncGenerator[Dict[str, Any], None]:
            # Send initial connection event
            yield {"event": "connected", "data": json.dumps({"session_id": session_id})}
            
            # In a full implementation, we'd listen on a per-session queue
            # For now, keep connection alive with heartbeat
            while True:
                if await request.is_disconnected():
                    break
                await asyncio.sleep(30)
                yield {"event": "heartbeat", "data": json.dumps({"ts": datetime.utcnow().isoformat()})}
        
        return EventSourceResponse(event_generator(), headers={"X-MCP-Session": session_id})
    
    @app.get("/mcp/sessions/{session_id}")
    async def get_session(session_id: str):
        session = transport_server.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return {
            "session_id": session.session_id,
            "initialized": session.initialized,
            "client_info": session.client_info,
            "created_at": session.created_at.isoformat(),
        }
    
    @app.delete("/mcp/sessions/{session_id}")
    async def delete_session(session_id: str):
        transport_server.remove_session(session_id)
        return {"status": "ok"}
    
    @app.get("/mcp/tools")
    async def list_tools():
        return {"tools": [t.model_dump() for t in transport_server.tools.values()]}
    
    return app


# ---------------------------------------------------------------------------
# Example: Git MCP Server
# ---------------------------------------------------------------------------

class GitMCPServer(MCPTransportServer):
    """Git operations via MCP over HTTP."""
    
    def __init__(self):
        super().__init__("git-mcp", "1.0.0")
        self._register_git_tools()
    
    def _register_git_tools(self):
        import subprocess
        
        async def git_diff(args: Dict[str, Any]) -> str:
            repo_path = args.get("repo_path", ".")
            try:
                result = subprocess.run(
                    ["git", "diff"],
                    cwd=repo_path,
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                return result.stdout or result.stderr or "No changes"
            except Exception as e:
                return f"Error: {e}"
        
        async def git_status(args: Dict[str, Any]) -> str:
            repo_path = args.get("repo_path", ".")
            try:
                result = subprocess.run(
                    ["git", "status"],
                    cwd=repo_path,
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                return result.stdout or result.stderr
            except Exception as e:
                return f"Error: {e}"
        
        async def git_log(args: Dict[str, Any]) -> str:
            repo_path = args.get("repo_path", ".")
            max_count = args.get("max_count", 10)
            try:
                result = subprocess.run(
                    ["git", "log", f"--oneline", f"-n", str(max_count)],
                    cwd=repo_path,
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                return result.stdout or result.stderr
            except Exception as e:
                return f"Error: {e}"
        
        self.register_tool(
            MCPTool(
                name="git_diff",
                description="Get git diff of current changes",
                inputSchema={
                    "type": "object",
                    "properties": {"repo_path": {"type": "string", "default": "."}},
                    "required": [],
                },
            ),
            git_diff,
        )
        
        self.register_tool(
            MCPTool(
                name="git_status",
                description="Get git status",
                inputSchema={
                    "type": "object",
                    "properties": {"repo_path": {"type": "string", "default": "."}},
                    "required": [],
                },
            ),
            git_status,
        )
        
        self.register_tool(
            MCPTool(
                name="git_log",
                description="Get recent git log",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "repo_path": {"type": "string", "default": "."},
                        "max_count": {"type": "integer", "default": 10},
                    },
                    "required": [],
                },
            ),
            git_log,
        )


# ---------------------------------------------------------------------------
# Entrypoint for running standalone
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    
    logging.basicConfig(level=logging.INFO)
    
    # Create Git MCP server
    git_server = GitMCPServer()
    app = create_mcp_app(git_server)
    
    uvicorn.run(app, host="0.0.0.0", port=8090)