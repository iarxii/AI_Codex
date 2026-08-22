"""MCP Client Adapter — connects to MCP servers (stdio or HTTP/SSE) and exposes tools as LangChain StructuredTool."""

from __future__ import annotations

import asyncio
import json
import logging
import shlex
import subprocess
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional, Union

import httpx
from langchain_core.tools import StructuredTool
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# JSON-RPC Models
# ---------------------------------------------------------------------------

class JSONRPCRequest(BaseModel):
    jsonrpc: str = "2.0"
    id: Union[int, str] = field(default_factory=lambda: str(uuid.uuid4()))
    method: str
    params: Optional[Dict[str, Any]] = None


class JSONRPCResponse(BaseModel):
    jsonrpc: str = "2.0"
    id: Union[int, str]
    result: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None


class JSONRPCNotification(BaseModel):
    jsonrpc: str = "2.0"
    method: str
    params: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Transport Base
# ---------------------------------------------------------------------------

class MCPTransport:
    """Base class for MCP transports."""
    
    async def connect(self) -> None:
        raise NotImplementedError
    
    async def disconnect(self) -> None:
        raise NotImplementedError
    
    async def send_request(self, method: str, params: Optional[Dict[str, Any]] = None) -> JSONRPCResponse:
        raise NotImplementedError
    
    async def send_notification(self, method: str, params: Optional[Dict[str, Any]] = None) -> None:
        raise NotImplementedError
    
    @property
    def is_connected(self) -> bool:
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Stdio Transport (for local subprocess servers)
# ---------------------------------------------------------------------------

class StdioTransport(MCPTransport):
    """MCP over stdio — launches a subprocess and communicates via stdin/stdout."""
    
    def __init__(
        self,
        command: str,
        args: List[str],
        cwd: Optional[str] = None,
        env: Optional[Dict[str, str]] = None,
    ):
        self.command = command
        self.args = args
        self.cwd = cwd
        self.env = env or {}
        self._process: Optional[subprocess.Popen] = None
        self._stdout_buffer = ""
        self._pending: Dict[Union[int, str], asyncio.Future] = {}
        self._read_task: Optional[asyncio.Task] = None
        self._connected = False
    
    async def connect(self) -> None:
        if self._connected:
            return
        
        # Merge with current env
        full_env = {**__import__("os").environ, **self.env}
        
        self._process = subprocess.Popen(
            [self.command] + self.args,
            cwd=self.cwd,
            env=full_env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        
        self._connected = True
        self._read_task = asyncio.create_task(self._read_loop())
        
        # Initialize
        init_resp = await self.send_request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "aicodex-backend", "version": "1.0.0"},
        })
        
        if init_resp.error:
            raise RuntimeError(f"MCP initialize failed: {init_resp.error}")
        
        # Send initialized notification
        await self.send_notification("notifications/initialized", {})
        
        logger.info(f"MCP stdio transport connected: {self.command} {' '.join(self.args)}")
    
    async def _read_loop(self):
        """Read stdout line by line and resolve pending requests."""
        if not self._process or not self._process.stdout:
            return
        
        loop = asyncio.get_event_loop()
        
        while self._connected and self._process.poll() is None:
            try:
                line = await loop.run_in_executor(None, self._process.stdout.readline)
                if not line:
                    break
                
                line = line.strip()
                if not line:
                    continue
                
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    logger.warning(f"MCP: Failed to parse: {line}")
                    continue
                
                if "id" in data:
                    # Response to a request
                    resp = JSONRPCResponse(**data)
                    future = self._pending.pop(resp.id, None)
                    if future and not future.done():
                        future.set_result(resp)
                elif "method" in data and "id" not in data:
                    # Notification
                    notif = JSONRPCNotification(**data)
                    await self._handle_notification(notif)
            except Exception as e:
                logger.error(f"MCP stdio read error: {e}")
                break
    
    async def _handle_notification(self, notification: JSONRPCNotification):
        """Handle incoming notifications."""
        logger.debug(f"MCP notification: {notification.method}")
    
    async def disconnect(self) -> None:
        self._connected = False
        if self._read_task:
            self._read_task.cancel()
            try:
                await self._read_task
            except asyncio.CancelledError:
                pass
        if self._process:
            self._process.terminate()
            try:
                await asyncio.get_event_loop().run_in_executor(
                    None, self._process.wait, 5
                )
            except subprocess.TimeoutExpired:
                self._process.kill()
                await asyncio.get_event_loop().run_in_executor(None, self._process.wait)
    
    async def send_request(
        self,
        method: str,
        params: Optional[Dict[str, Any]] = None,
        timeout: float = 30.0,
    ) -> JSONRPCResponse:
        if not self._connected or not self._process or not self._process.stdin:
            raise RuntimeError("Transport not connected")
        
        request_id = str(uuid.uuid4())
        request = JSONRPCRequest(id=request_id, method=method, params=params)
        
        future: asyncio.Future = asyncio.get_event_loop().create_future()
        self._pending[request_id] = future
        
        try:
            json_line = request.model_dump_json(exclude_none=True) + "\n"
            await asyncio.get_event_loop().run_in_executor(
                None, self._process.stdin.write, json_line
            )
            await asyncio.get_event_loop().run_in_executor(
                None, self._process.stdin.flush
            )
            
            resp = await asyncio.wait_for(future, timeout=timeout)
            return resp
        except asyncio.TimeoutError:
            self._pending.pop(request_id, None)
            return JSONRPCResponse(
                id=request_id,
                error={"code": -32000, "message": f"Request timeout after {timeout}s"},
            )
        except Exception as e:
            self._pending.pop(request_id, None)
            return JSONRPCResponse(
                id=request_id,
                error={"code": -32603, "message": f"Transport error: {e}"},
            )
    
    async def send_notification(self, method: str, params: Optional[Dict[str, Any]] = None) -> None:
        if not self._connected or not self._process or not self._process.stdin:
            return
        
        notification = JSONRPCNotification(method=method, params=params)
        json_line = notification.model_dump_json(exclude_none=True) + "\n"
        await asyncio.get_event_loop().run_in_executor(
            None, self._process.stdin.write, json_line
        )
        await asyncio.get_event_loop().run_in_executor(
            None, self._process.stdin.flush
        )
    
    @property
    def is_connected(self) -> bool:
        return self._connected and self._process and self._process.poll() is None


# ---------------------------------------------------------------------------
# HTTP/SSE Transport (for remote MCP servers)
# ---------------------------------------------------------------------------

class SSETransport(MCPTransport):
    """MCP over HTTP + SSE — connects to a remote MCP HTTP/SSE server."""
    
    def __init__(
        self,
        base_url: str,
        session_id: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.session_id = session_id
        self.headers = headers or {}
        self._client: Optional[httpx.AsyncClient] = None
        self._connected = False
        self._pending: Dict[Union[int, str], asyncio.Future] = {}
        self._event_source_task: Optional[asyncio.Task] = None
    
    async def connect(self) -> None:
        if self._connected:
            return
        
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers=self.headers,
            timeout=30.0,
        )
        
        # Create session if not provided
        if not self.session_id:
            resp = await self._client.post("/mcp/sessions")
            resp.raise_for_status()
            self.session_id = resp.json()["session_id"]
        
        self.headers["X-MCP-Session"] = self.session_id
        self._client.headers.update(self.headers)
        
        # Initialize
        init_resp = await self.send_request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "aicodex-backend", "version": "1.0.0"},
        })
        
        if init_resp.error:
            raise RuntimeError(f"MCP initialize failed: {init_resp.error}")
        
        # Send initialized notification
        await self.send_notification("notifications/initialized", {})
        
        # Start SSE listener for notifications
        self._event_source_task = asyncio.create_task(self._sse_listener())
        
        self._connected = True
        logger.info(f"MCP SSE transport connected: {self.base_url} (session: {self.session_id})")
    
    async def _sse_listener(self):
        """Listen for SSE events from the server."""
        try:
            async with self._client.stream(
                "GET",
                "/mcp/events",
                headers={"Accept": "text/event-stream"},
            ) as response:
                async for line in response.aiter_lines():
                    if not line or line.startswith(":"):
                        continue
                    if line.startswith("event:"):
                        event_type = line[6:].strip()
                    elif line.startswith("data:"):
                        data = line[5:].strip()
                        try:
                            payload = json.loads(data)
                            # Handle notification events
                            if event_type == "notification" and isinstance(payload, dict):
                                notif = JSONRPCNotification(**payload)
                                await self._handle_notification(notif)
                        except json.JSONDecodeError:
                            pass
        except Exception as e:
            logger.error(f"MCP SSE listener error: {e}")
    
    async def _handle_notification(self, notification: JSONRPCNotification):
        logger.debug(f"MCP notification: {notification.method}")
    
    async def disconnect(self) -> None:
        self._connected = False
        if self._event_source_task:
            self._event_source_task.cancel()
            try:
                await self._event_source_task
            except asyncio.CancelledError:
                pass
        if self._client:
            await self._client.aclose()
    
    async def send_request(
        self,
        method: str,
        params: Optional[Dict[str, Any]] = None,
        timeout: float = 30.0,
    ) -> JSONRPCResponse:
        if not self._connected or not self._client:
            raise RuntimeError("Transport not connected")
        
        request = JSONRPCRequest(method=method, params=params)
        
        resp = await self._client.post(
            "/mcp",
            json=request.model_dump(exclude_none=True),
            timeout=timeout,
        )
        resp.raise_for_status()
        
        data = resp.json()
        if isinstance(data, list):
            # Batch response - return first
            return JSONRPCResponse(**data[0])
        return JSONRPCResponse(**data)
    
    async def send_notification(self, method: str, params: Optional[Dict[str, Any]] = None) -> None:
        if not self._connected or not self._client:
            return
        
        notification = JSONRPCNotification(method=method, params=params)
        await self._client.post(
            "/mcp",
            json=notification.model_dump(exclude_none=True),
        )
    
    @property
    def is_connected(self) -> bool:
        return self._connected and self._client is not None


# ---------------------------------------------------------------------------
# MCP Client Manager
# ---------------------------------------------------------------------------

@dataclass
class MCPServerConfig:
    """Configuration for an MCP server."""
    name: str
    transport_type: str  # "stdio" or "http"
    command: Optional[str] = None
    args: List[str] = field(default_factory=list)
    cwd: Optional[str] = None
    env: Dict[str, str] = field(default_factory=dict)
    url: Optional[str] = None
    headers: Dict[str, str] = field(default_factory=dict)
    enabled: bool = True


class MCPClientManager:
    """Manages connections to multiple MCP servers and exposes their tools."""
    
    def __init__(self):
        self.servers: Dict[str, MCPServerConfig] = {}
        self.transports: Dict[str, MCPTransport] = {}
        self.tools: Dict[str, Dict[str, Any]] = {}  # server_name -> {tool_name: tool_info}
    
    def add_server(self, config: MCPServerConfig) -> None:
        """Register an MCP server configuration."""
        self.servers[config.name] = config
    
    def remove_server(self, name: str) -> None:
        """Remove a server configuration."""
        self.servers.pop(name, None)
        if name in self.transports:
            asyncio.create_task(self.transports[name].disconnect())
            self.transports.pop(name, None)
        self.tools.pop(name, None)
    
    async def connect_all(self) -> None:
        """Connect to all enabled servers."""
        for name, config in self.servers.items():
            if not config.enabled:
                continue
            try:
                await self._connect_server(name, config)
            except Exception as e:
                logger.error(f"Failed to connect to MCP server '{name}': {e}")
    
    async def _connect_server(self, name: str, config: MCPServerConfig) -> None:
        if config.transport_type == "stdio":
            if not config.command:
                raise ValueError(f"Stdio transport requires command for server '{name}'")
            transport = StdioTransport(
                command=config.command,
                args=config.args,
                cwd=config.cwd,
                env=config.env,
            )
        elif config.transport_type == "http":
            if not config.url:
                raise ValueError(f"HTTP transport requires URL for server '{name}'")
            transport = SSETransport(
                base_url=config.url,
                headers=config.headers,
            )
        else:
            raise ValueError(f"Unknown transport type: {config.transport_type}")
        
        await transport.connect()
        self.transports[name] = transport
        
        # Fetch tools
        await self._fetch_tools(name)
        
        logger.info(f"Connected to MCP server '{name}' with {len(self.tools.get(name, {}))} tools")
    
    async def _fetch_tools(self, server_name: str) -> None:
        """Fetch tools from a connected server."""
        transport = self.transports.get(server_name)
        if not transport:
            return
        
        try:
            resp = await transport.send_request("tools/list")
            if resp.error:
                logger.warning(f"Failed to fetch tools from {server_name}: {resp.error}")
                return
            
            tools_list = resp.result.get("tools", []) if resp.result else []
            self.tools[server_name] = {
                tool["name"]: {
                    "name": tool["name"],
                    "description": tool.get("description", ""),
                    "inputSchema": tool.get("inputSchema", {}),
                    "server_name": server_name,
                }
                for tool in tools_list
            }
        except Exception as e:
            logger.error(f"Error fetching tools from {server_name}: {e}")
    
    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """Call a tool by name (finds the server that has it)."""
        for server_name, tools in self.tools.items():
            if tool_name in tools:
                transport = self.transports.get(server_name)
                if not transport:
                    raise RuntimeError(f"Server '{server_name}' not connected")
                
                resp = await transport.send_request("tools/call", {
                    "name": tool_name,
                    "arguments": arguments,
                })
                
                if resp.error:
                    raise RuntimeError(f"MCP tool error: {resp.error}")
                
                # Parse result
                result = resp.result
                if isinstance(result, dict) and "content" in result:
                    # Standard MCP format
                    content = result["content"]
                    if isinstance(content, list):
                        text_parts = [c.get("text", "") for c in content if c.get("type") == "text"]
                        return "\n".join(text_parts)
                return result
        
        raise ValueError(f"Tool '{tool_name}' not found in any connected server")
    
    def get_all_tools(self) -> Dict[str, Dict[str, Any]]:
        """Get all tools from all connected servers."""
        return self.tools
    
    def get_tool_info(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """Get tool info by name."""
        for tools in self.tools.values():
            if tool_name in tools:
                return tools[tool_name]
        return None
    
    async def disconnect_all(self) -> None:
        """Disconnect all transports."""
        for name, transport in self.transports.items():
            try:
                await transport.disconnect()
            except Exception as e:
                logger.error(f"Error disconnecting {name}: {e}")
        self.transports.clear()
    
    async def __aenter__(self):
        await self.connect_all()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.disconnect_all()


# ---------------------------------------------------------------------------
# LangChain StructuredTool Adapter
# ---------------------------------------------------------------------------

def mcp_tool_to_structured_tool(
    tool_info: Dict[str, Any],
    client_manager: MCPClientManager,
) -> StructuredTool:
    """Convert an MCP tool to a LangChain StructuredTool."""
    
    name = tool_info["name"]
    description = tool_info.get("description", "")
    input_schema = tool_info.get("inputSchema", {})
    server_name = tool_info.get("server_name", "")
    
    async def _execute(**kwargs) -> str:
        return await client_manager.call_tool(name, kwargs)
    
    # Create StructuredTool from function
    tool = StructuredTool.from_function(
        coroutine=_execute,
        name=name,
        description=description,
    )
    
    return tool


def get_mcp_structured_tools(client_manager: MCPClientManager) -> List[StructuredTool]:
    """Get all MCP tools as LangChain StructuredTools."""
    tools = []
    for server_name, server_tools in client_manager.tools.items():
        for tool_name, tool_info in server_tools.items():
            try:
                tool = mcp_tool_to_structured_tool(tool_info, client_manager)
                tools.append(tool)
            except Exception as e:
                logger.error(f"Failed to create StructuredTool for {tool_name}: {e}")
    return tools


# ---------------------------------------------------------------------------
# Registry Integration
# ---------------------------------------------------------------------------

class MCPRegistry:
    """Registry for MCP server configurations with persistence."""
    
    def __init__(self, db_session_factory):
        self.db_session_factory = db_session_factory
        self.client_manager = MCPClientManager()
    
    async def load_from_db(self) -> None:
        """Load MCP server configs from database."""
        # TODO: Implement DB loading
        pass
    
    async def save_to_db(self, config: MCPServerConfig) -> None:
        """Save MCP server config to database."""
        # TODO: Implement DB saving
        pass
    
    async def delete_from_db(self, name: str) -> None:
        """Delete MCP server config from database."""
        # TODO: Implement DB deletion
        pass
    
    async def start(self) -> None:
        """Start all registered servers."""
        await self.client_manager.connect_all()
    
    async def stop(self) -> None:
        """Stop all servers."""
        await self.client_manager.disconnect_all()
    
    def get_structured_tools(self) -> List[StructuredTool]:
        """Get all tools as StructuredTools for the agent."""
        return get_mcp_structured_tools(self.client_manager)


# ---------------------------------------------------------------------------
# Default configuration loader
# ---------------------------------------------------------------------------

def load_default_mcp_servers() -> List[MCPServerConfig]:
    """Load default MCP server configurations.
    
    These match the VSCode extension's default mcpServers config.
    """
    import os
    
    workspace_root = os.getenv("WORKSPACE_ROOT", ".")
    
    return [
        MCPServerConfig(
            name="git",
            transport_type="stdio",
            command="npx",
            args=["-y", "@modelcontextprotocol/server-git"],
            cwd=workspace_root,
            enabled=True,
        ),
        MCPServerConfig(
            name="filesystem",
            transport_type="stdio",
            command="npx",
            args=["-y", "@modelcontextprotocol/server-filesystem", workspace_root],
            cwd=workspace_root,
            enabled=True,
        ),
        MCPServerConfig(
            name="github",
            transport_type="stdio",
            command="npx",
            args=["-y", "@modelcontextprotocol/server-github"],
            cwd=workspace_root,
            env={"GITHUB_PERSONAL_ACCESS_TOKEN": os.getenv("GITHUB_PAT", "")},
            enabled=bool(os.getenv("GITHUB_PAT")),
        ),
    ]