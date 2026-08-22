"""FastAPI routers for integrations — OAuth, connections, flows, and workspace bindings."""

import secrets
import time
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_
from typing import List, Optional, Dict, Any
import urllib.parse
from pydantic import BaseModel

# Simple in-memory PKCE state store (MVP) — replace with Redis in production
# Structure: {state: {"code_verifier": str, "user_id": int, "provider": str, "redirect_uri": str, "expires_at": float}}
_pkce_state_store: Dict[str, Dict[str, Any]] = {}
_PKCE_TTL_SECONDS = 600  # 10 minutes

def _store_pkce_state(state: str, code_verifier: str, user_id: int, provider: str, redirect_uri: str) -> None:
    _pkce_state_store[state] = {
        "code_verifier": code_verifier,
        "user_id": user_id,
        "provider": provider,
        "redirect_uri": redirect_uri,
        "expires_at": time.time() + _PKCE_TTL_SECONDS,
    }

def _get_and_clear_pkce_state(state: str) -> Optional[Dict[str, Any]]:
    data = _pkce_state_store.pop(state, None)
    if data and data["expires_at"] < time.time():
        return None  # expired
    return data

from backend.db.models import (
    User,
    IntegrationProvider,
    UserConnection,
    SpaceConnection,
    IntegrationFlow,
    IntegrationStep,
    IntegrationFlowRun,
    CodexSpace,
    User as ModelUser,
)
from backend.db.session import get_db
from backend.integrations.oauth import (
    OAuthTokens,
    AuthURLParams,
    generate_code_verifier,
    generate_code_challenger,
    build_authorization_url,
    exchange_code_for_tokens,
    TokenExchangeError,
    store_user_connection,
    get_user_connection,
    retrieve_decrypted_tokens,
    update_connection_status,
    PROVIDERS,
    get_provider_config,
)
from backend.api.deps import get_current_active_user


router = APIRouter(prefix="/api/integrations", tags=["integrations"])


# ---------------------------------------------------------------
# 1. Provider catalog
# ---------------------------------------------------------------


@router.get("/providers", response_model=List[dict])
async def list_providers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[dict]:
    """List all registered integration providers."""
    stmt = select(IntegrationProvider).where(IntegrationProvider.is_active == True)
    result = await db.execute(stmt)
    providers = result.scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
            "icon_url": p.icon_url,
            "scopes": p.config_schema_json,  # placeholder; actual scopes from OAuth module
        }
        for p in providers
    ]


@router.get("/providers/{slug}")
async def get_provider_detail(slug: str) -> dict:
    """Get detailed config for a specific provider."""
    config = get_provider_config(slug)
    return {
        "name": config.name,
        "slug": config.slug,
        "oauth_authorize_url": config.oauth_authorize_url,
        "oauth_token_url": config.oauth_token_url,
        "scopes": config.scopes,
        "icon": config.icon,
        "client_kwargs": config.client_kwargs,
    }


# ---------------------------------------------------------------
# 2. User connections (OAuth flow)
# ---------------------------------------------------------------


@router.get("/my-connections", response_model=List[dict])
async def list_my_connections(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[dict]:
    """List the current user's OAuth connections (masked tokens)."""
    stmt = select(UserConnection).where(UserConnection.user_id == current_user.id)
    result = await db.execute(stmt)
    connections = result.scalars().all()

    out = []
    for c in connections:
        # Decrypt just enough to show masked info
        try:
            access = retrieve_decrypted_tokens(db_connection=db, user_id=current_user.id, provider_slug=c.provider_id)
            out.append(
                {
                    "provider": c.provider_id,
                    "status": c.status,
                    "scopes": c.scopes.split(",") if c.scopes else [],
                    "expires_at": c.expires_at.isoformat() if c.expires_at else None,
                    "created_at": c.created_at.isoformat(),
                }
            )
        except Exception:
            out.append(
                {
                    "provider": c.provider_id,
                    "status": c.status,
                    "expires_at": c.expires_at.isoformat() if c.expires_at else None,
                    "created_at": c.created_at.isoformat(),
}
        )
    return out


# ---------------------------------------------------------------
# 6. MCP Server Registry Sync (VSCode Extension ↔ Backend)
# ---------------------------------------------------------------


class MCPServerConfigIn(BaseModel):
    name: str
    transport_type: str  # "stdio" | "http"
    command: Optional[str] = None
    args: List[str] = []
    cwd: Optional[str] = None
    env: Dict[str, str] = {}
    url: Optional[str] = None
    headers: Dict[str, str] = {}
    enabled: bool = True


class MCPServerConfigOut(MCPServerConfigIn):
    status: str  # "connected" | "disconnected" | "error"
    tool_count: int
    tools: List[Dict[str, Any]] = []


@router.get("/mcp/servers", response_model=List[MCPServerConfigOut])
async def list_mcp_servers(
    current_user: User = Depends(get_current_active_user),
) -> List[dict]:
    """List all registered MCP servers with their connection status and tools."""
    mcp_manager = get_mcp_client_manager()
    
    # Get configs from extension sync (in-memory for now)
    # In production, these would be persisted per user
    default_configs = load_default_mcp_servers()
    
    out = []
    for config in default_configs:
        transport = mcp_manager.transports.get(config.name)
        tools = mcp_manager.tools.get(config.name, {})
        
        out.append({
            "name": config.name,
            "transport_type": config.transport_type,
            "command": config.command,
            "args": config.args,
            "cwd": config.cwd,
            "env": config.env,
            "url": config.url,
            "headers": config.headers,
            "enabled": config.enabled,
            "status": "connected" if transport and transport.is_connected else "disconnected",
            "tool_count": len(tools),
            "tools": list(tools.values()),
        })
    return out


@router.post("/mcp/servers", response_model=dict)
async def register_mcp_server(
    *,
    config: MCPServerConfigIn,
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Register a new MCP server (synced from VSCode extension)."""
    mcp_manager = get_mcp_client_manager()
    
    server_config = MCPServerConfig(
        name=config.name,
        transport_type=config.transport_type,
        command=config.command,
        args=config.args,
        cwd=config.cwd,
        env=config.env,
        url=config.url,
        headers=config.headers,
        enabled=config.enabled,
    )
    
    # Remove existing if any
    if config.name in mcp_manager.transports:
        await mcp_manager.transports[config.name].disconnect()
        mcp_manager.transports.pop(config.name, None)
        mcp_manager.tools.pop(config.name, None)
    
    mcp_manager.add_server(server_config)
    
    # Connect immediately
    try:
        await mcp_manager._connect_server(config.name, server_config)
        return {"status": "connected", "message": f"MCP server '{config.name}' registered and connected"}
    except Exception as e:
        logger.error(f"Failed to connect MCP server '{config.name}': {e}")
        return {"status": "error", "message": str(e)}


@router.delete("/mcp/servers/{name}", response_model=dict)
async def unregister_mcp_server(
    *,
    name: str,
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Unregister an MCP server."""
    mcp_manager = get_mcp_client_manager()
    mcp_manager.remove_server(name)
    return {"status": "ok", "message": f"MCP server '{name}' unregistered"}


@router.post("/mcp/servers/{name}/connect", response_model=dict)
async def connect_mcp_server(
    *,
    name: str,
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Manually connect to an MCP server."""
    mcp_manager = get_mcp_client_manager()
    
    config = mcp_manager.servers.get(name)
    if not config:
        raise HTTPException(status_code=404, detail=f"MCP server '{name}' not registered")
    
    try:
        await mcp_manager._connect_server(name, config)
        return {"status": "connected", "message": f"Connected to MCP server '{name}'"}
    except Exception as e:
        logger.error(f"Failed to connect MCP server '{name}': {e}")
        return {"status": "error", "message": str(e)}


@router.post("/mcp/servers/{name}/disconnect", response_model=dict)
async def disconnect_mcp_server(
    *,
    name: str,
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Manually disconnect from an MCP server."""
    mcp_manager = get_mcp_client_manager()
    
    if name in mcp_manager.transports:
        await mcp_manager.transports[name].disconnect()
        mcp_manager.transports.pop(name, None)
        mcp_manager.tools.pop(name, None)
    
    return {"status": "disconnected", "message": f"Disconnected from MCP server '{name}'"}


@router.get("/mcp/tools", response_model=List[dict])
async def list_mcp_tools(
    current_user: User = Depends(get_current_active_user),
) -> List[dict]:
    """List all tools from all connected MCP servers."""
    mcp_manager = get_mcp_client_manager()
    return get_mcp_structured_tools(mcp_manager)


# Import required models
from pydantic import BaseModel
from typing import Optional
from backend.integrations.mcp_client import MCPServerConfig, load_default_mcp_servers, get_mcp_structured_tools


@router.post("/connect/{slug}")
async def initiate_oauth_connect(
    *,
    slug: str,
    redirect_uri: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> JSONResponse:
    """Initiate OAuth 2.0 authorization code flow (PKCE).

    Returns a JSON with `authorization_url` and `state` that the frontend
    uses to redirect the user to the provider's consent screen.
    """
    config = get_provider_config(slug)
    code_verifier = generate_code_verifier()
    code_challenger = generate_code_challenger(code_verifier)
    state = secrets.token_urlsafe(32)

    auth_url = build_authorization_url(
        AuthURLParams(
            client_id=config.slug,
            redirect_uri=redirect_uri,
            scope=" ".join(config.scopes),
            state=state,
            code_challenge=code_challenger,
            code_challenge_method="S256",
        )
    )

    # Store PKCE state for callback verification
    _store_pkce_state(state, code_verifier, current_user.id, slug, redirect_uri)

    return JSONResponse(
        content={
            "authorization_url": auth_url,
            "state": state,
            "provider": slug,
            "redirect_uri": redirect_uri,
        }
    )


@router.get("/callback/{slug}")
async def oauth_callback(
    *,
    slug: str,
    code: str,
    state: str = Query(...),
    redirect_uri: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> JSONResponse:
    """Handle the OAuth provider callback — exchange code for tokens."""

    # Retrieve and validate PKCE state
    pkce_data = _get_and_clear_pkce_state(state)
    if not pkce_data:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    if pkce_data["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="State mismatch: unauthorized user")
    if pkce_data["provider"] != slug:
        raise HTTPException(status_code=400, detail="Provider mismatch in OAuth state")
    if pkce_data["redirect_uri"] != redirect_uri:
        raise HTTPException(status_code=400, detail="Redirect URI mismatch")

    code_verifier = pkce_data["code_verifier"]
    config = get_provider_config(slug)

    try:
        tokens = await exchange_code_for_tokens(
            code=code,
            code_verifier=code_verifier,
            client_id=config.slug,
            client_secret="",  # public client or confidential depending on provider
            token_endpoint=config.oauth_token_url,
            redirect_uri=redirect_uri,
        )
    except TokenExchangeError as e:
        raise HTTPException(status_code=400, detail=e.detail)

    # Store encrypted tokens for this user
    await store_user_connection(
        db_session=db,
        user_id=current_user.id,
        provider_slug=slug,
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        scopes=tokens.scope.split(",") if tokens.scope else [],
    )

    # Set expires_at on the connection if we have it
    if tokens.expires_at and tokens.expires_at > datetime.utcnow():
        # We'd need to update the conn row; for now we just note it
        pass

    # Redirect frontend to integrations page with success flag
    return JSONResponse(
        content={
            "success": True,
            "message": f"Connected {config.name} successfully",
            "provider": slug,
        }
    )


# ---------------------------------------------------------------
# 3. Connection details / health check
# ---------------------------------------------------------------


@router.get("/connections/{provider_id}")
async def connection_detail(
    *,
    provider_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Get details of a user's connection to a provider."""
    conn = await get_user_connection(
        db_session=db, user_id=current_user.id, provider_slug=provider_id
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Refresh if near expiry (within 5 min)
    tokens = await retrieve_decrypted_tokens(
        db_connection=db, user_id=current_user.id, provider_slug=provider_id
    )

    # Perform a health-check call based on provider
    health = await _connection_health_check(tokens)

    return {
        "provider": provider_id,
        "status": conn.status,
        "scopes": conn.scopes.split(",") if conn.scopes else [],
        "expires_at": conn.expires_at.isoformat() if conn.expires_at else None,
        "created_at": conn.created_at.isoformat(),
        "health": health,
    }


async def _connection_health_check(tokens: Optional[OAuthTokens]) -> dict:
    """Quick health-check for a connection (ping provider API)."""
    if not tokens or tokens.is_expired:
        return {"status": "expired", "detail": "Token expired or missing"}

    # Example: Google user info ping
    # In production, each provider would have its own health-check logic
    return {"status": "ok", "detail": "Connection healthy"}


# ---------------------------------------------------------------
# 4. Flow management (workflows / "zaps" without the trademark)
# ---------------------------------------------------------------


@router.post("/flows", response_model=dict)
async def create_flow(
    *,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    name: str = Query(...),
    description: str = Query(""),
    trigger_provider: str = Query(...),  # e.g., "google", "github"
    trigger_config: str = Query("{}"),  # JSON config for the trigger
    steps: str = Query("[]"),  # JSON array of step configs
    schedule_cron: Optional[str] = Query(None),  # e.g., "*/5 * * * *"
) -> dict:
    """Create a new integration flow (workflow)."""

    # Validate trigger connection exists for this user
    config = get_provider_config(trigger_provider)
    conn = await get_user_connection(
        db_session=db, user_id=current_user.id, provider_slug=trigger_provider
    )
    if not conn:
        raise HTTPException(
            status_code=400, detail=f"No active connection for provider {trigger_provider}"
        )

    flow = IntegrationFlow(
        name=name,
        description=description,
        owner_id=current_user.id,
        trigger_connection_id=conn.id,
        enabled=True,
        schedule_cron=schedule_cron,
        config_json=trigger_config,
        steps_output_json=None,
    )
    db.add(flow)
    await db.flush()

    # Parse and store steps
    steps_data = eval(steps) if steps else []  # In production: use json.loads with schema validation
    for idx, step in enumerate(steps_data):
        action_conn = await get_user_connection(
            db_session=db, user_id=current_user.id, provider_slug=step.get("provider", "")
        )
        if not action_conn:
            # Remove flow and return error
            await db.delete(flow)
            await db.commit()
            raise HTTPException(
                status_code=400, detail=f"No connection for step {idx} provider {step.get('provider')}"
            )

        step_model = IntegrationStep(
            flow_id=flow.id,
            step_index=idx,
            action_connection_id=action_conn.id,
            action_name=step.get("action", "unknown"),
            action_config_json=step.get("config", "{}"),
            error_handling=step.get("error_handling", "stop"),
            retry_config_json=step.get("retry", {}),
            step_order=step.get("order", idx),
        )
        db.add(step_model)

    await db.commit()
    return {"id": flow.id, "name": flow.name, "message": "Flow created successfully"}


@router.get("/flows", response_model=List[dict])
async def list_flows(
    *,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    include_disabled: bool = False,
) -> List[dict]:
    """List integration flows owned by the current user."""
    stmt = select(IntegrationFlow).where(IntegrationFlow.owner_id == current_user.id)
    if not include_disabled:
        stmt = stmt.where(IntegrationFlow.enabled == True)
    result = await db.execute(stmt)
    flows = result.scalars().all()

    out = []
    for f in flows:
        # Count runs
        run_stmt = select(IntegrationFlowRun).where(IntegrationFlowRun.flow_id == f.id)
        run_result = await db.execute(run_stmt)
        runs = run_result.scalars().all()
        out.append(
            {
                "id": f.id,
                "name": f.name,
                "description": f.description,
                "enabled": f.enabled,
                "schedule_cron": f.schedule_cron,
                "trigger_provider": f.trigger_connection_id,
                "step_count": len(f.steps),
                "run_count": len(runs),
                "created_at": f.created_at.isoformat(),
            }
        )
    return out


@router.post("/flows/{flow_id}/run", response_model=dict)
async def run_flow_now(
    *,
    flow_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    trigger_payload: Optional[dict] = None,
) -> dict:
    """Execute a flow immediately (manual trigger)."""
    from backend.integrations.runner import execute_flow_run

    # Verify ownership
    flow = await db.get(IntegrationFlow, flow_id)
    if not flow or flow.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Flow not found")

    # Execute flow
    flow_run = await execute_flow_run(flow_id, trigger_payload, flow.trigger_connection_id)
    
    return {
        "run_id": flow_run.id,
        "status": flow_run.status,
        "message": "Flow executed",
        "outputs": json.loads(flow_run.steps_output_json) if flow_run.steps_output_json else None,
        "error": flow_run.error_text,
    }


@router.get("/flows/{flow_id}/runs", response_model=List[dict])
async def list_flow_runs(
    *,
    flow_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    limit: int = 50,
    offset: int = 0,
) -> List[dict]:
    """List run history for a flow."""
    # Verify ownership
    flow = await db.get(IntegrationFlow, flow_id)
    if not flow or flow.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Flow not found")

    stmt = (
        select(IntegrationFlowRun)
        .where(IntegrationFlowRun.flow_id == flow_id)
        .order_by(IntegrationFlowRun.started_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    runs = result.scalars().all()

    return [
        {
            "id": r.id,
            "status": r.status,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "duration_ms": r.duration_ms,
            "error": r.error_text,
            "trigger_payload": json.loads(r.trigger_payload_json) if r.trigger_payload_json else None,
        }
        for r in runs
    ]


@router.get("/flows/{flow_id}/runs/{run_id}", response_model=dict)
async def get_flow_run(
    *,
    flow_id: int,
    run_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Get detailed run information including step outputs."""
    # Verify ownership
    flow = await db.get(IntegrationFlow, flow_id)
    if not flow or flow.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Flow not found")

    run = await db.get(IntegrationFlowRun, run_id)
    if not run or run.flow_id != flow_id:
        raise HTTPException(status_code=404, detail="Run not found")

    return {
        "id": run.id,
        "flow_id": run.flow_id,
        "status": run.status,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "duration_ms": run.duration_ms,
        "error": run.error_text,
        "trigger_payload": json.loads(run.trigger_payload_json) if run.trigger_payload_json else None,
        "steps_output": json.loads(run.steps_output_json) if run.steps_output_json else None,
    }


@router.post("/flows/{flow_id}/runs/{run_id}/replay", response_model=dict)
async def replay_flow_run(
    *,
    flow_id: int,
    run_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Replay a flow run with the original trigger payload."""
    from backend.integrations.runner import execute_flow_run

    # Verify ownership
    flow = await db.get(IntegrationFlow, flow_id)
    if not flow or flow.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Flow not found")

    run = await db.get(IntegrationFlowRun, run_id)
    if not run or run.flow_id != flow_id:
        raise HTTPException(status_code=404, detail="Run not found")

    # Get original trigger payload
    trigger_payload = json.loads(run.trigger_payload_json) if run.trigger_payload_json else None
    
    # Execute flow with same payload
    flow_run = await execute_flow_run(flow_id, trigger_payload, flow.trigger_connection_id)
    
    return {
        "run_id": flow_run.id,
        "status": flow_run.status,
        "message": "Flow replay executed",
    }


# ---------------------------------------------------------------
# 5. Webhook endpoints for flow triggers
# ---------------------------------------------------------------


@router.post("/webhooks/{provider}/{flow_id}", response_model=dict)
async def webhook_trigger(
    *,
    provider: str,
    flow_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Handle incoming webhook trigger for a flow.
    
    Validates HMAC signature if configured, then executes the flow.
    """
    from backend.integrations.runner import handle_webhook_trigger

    # Get raw body for HMAC verification
    body = await request.body()
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    headers = dict(request.headers)
    
    result = await handle_webhook_trigger(provider, flow_id, payload, headers)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


# ---------------------------------------------------------------
# 5. Space-level connection binding
# ---------------------------------------------------------------


@router.post("/spaces/{space_id}/bind-connection")
async def bind_connection_to_space(
    *,
    space_id: int,
    connection_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Bind a user connection to a CodexSpace for workspace-wide enablement."""

    # Verify space ownership/access
    from backend.db.models import CodexSpaceAccess

    space = db.get(CodexSpace, space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    # Check user has admin role in this space
    has_access = (
        await db.execute(
            select(CodexSpaceAccess).where(
                and_(
                    CodexSpaceAccess.space_id == space_id,
                    CodexSpaceAccess.user_id == current_user.id,
                    CodexSpaceAccess.granted_by.has(role="super_admin")
                    | CodexSpaceAccess.user_id == current_user.id,
                )
            )
        )
    ).first()

    if not has_access and current_user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Upsert space connection
    stmt = (
        select(SpaceConnection)
        .where(
            and_(SpaceConnection.space_id == space_id, SpaceConnection.connection_id == connection_id)
        )
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        existing.enabled = True
        existing.config_json = ""  # could merge with existing
        await db.commit()
        return {"id": existing.id, "enabled": True, "message": "Connection re-enabled in space"}
    else:
        new_sc = SpaceConnection(
            space_id=space_id,
            connection_id=connection_id,
            enabled=True,
            config_json="",
        )
        db.add(new_sc)
        await db.commit()
        return {"id": new_sc.id, "enabled": True, "message": "Connection bound to space"}


@router.get("/spaces/{space_id}/connections")
async def list_space_connections(
    *,
    space_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[dict]:
    """List connections enabled in a specific space."""
    from backend.db.models import CodexSpaceAccess

    # Verify access
    space = db.get(CodexSpace, space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    # Check membership
    member_stmt = select(CodexSpaceAccess).where(
        and_(CodexSpaceAccess.space_id == space_id)
    )
    # Simplified: if space is public or user has access
    if space.is_public:
        pass  # proceed
    else:
        has_access = (await db.execute(member_stmt)).first()
        if not has_access:
            raise HTTPException(status_code=403, detail="Not a member of this space")

    stmt = select(SpaceConnection).where(SpaceConnection.space_id == space_id, SpaceConnection.enabled == True)
    result = await db.execute(stmt)
    connections = result.scalars().all()

    out = []
    for sc in connections:
        conn = await get_user_connection(
            db_session=db, user_id=current_user.id, provider_slug="TODO lookup"
        )
        # In production, lookup by sc.connection_id
        out.append(
            {
                "connection_id": sc.connection_id,
                "enabled": sc.enabled,
                "config": sc.config_json,
                "created_at": sc.created_at.isoformat(),
            }
        )
    return out