"""Integration Flow Engine — APScheduler-based runner for polling/webhook triggers and step execution.

This module provides:
- Polling trigger scheduler (APScheduler)
- Step executor with output templating ({{step.N.output.field}})
- Run history tracking
- Manual trigger API
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Callable, Awaitable

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_
from sqlalchemy.orm import selectinload

from backend.db.session import AsyncSessionLocal
from backend.db.models import (
    IntegrationFlow,
    IntegrationStep,
    IntegrationFlowRun,
    UserConnection,
    IntegrationProvider,
)
from backend.integrations.oauth import (
    retrieve_decrypted_tokens,
    refresh_access_token,
    get_provider_config,
)

logger = logging.getLogger(__name__)

# Global scheduler instance
_scheduler: Optional[AsyncIOScheduler] = None

# Step executor registry: provider_slug -> {action_name: executor_func}
STEP_EXECUTORS: Dict[str, Dict[str, Callable[[Dict[str, Any], Dict[str, Any]], Awaitable[Dict[str, Any]]]]] = {}


def register_step_executor(provider_slug: str, action_name: str, executor: Callable[[Dict[str, Any], Dict[str, Any]], Awaitable[Dict[str, Any]]]) -> None:
    """Register a step executor for a provider/action."""
    if provider_slug not in STEP_EXECUTORS:
        STEP_EXECUTORS[provider_slug] = {}
    STEP_EXECUTORS[provider_slug][action_name] = executor


def get_step_executor(provider_slug: str, action_name: str) -> Optional[Callable]:
    """Get a registered step executor."""
    return STEP_EXECUTORS.get(provider_slug, {}).get(action_name)


# ---------------------------------------------------------------------------
# Token management helpers
# ---------------------------------------------------------------------------

async def get_valid_connection_token(
    db: AsyncSession,
    connection: UserConnection,
) -> Optional[str]:
    """Get a valid access token for a connection, refreshing if needed."""
    tokens = await retrieve_decrypted_tokens(
        db_connection=db,
        user_id=connection.user_id,
        provider_slug=connection.provider_id,
    )
    if not tokens:
        return None
    
    # Check if token needs refresh (within 5 min of expiry)
    if tokens.expires_at and tokens.expires_at <= datetime.utcnow():
        if not tokens.refresh_token:
            logger.warning(f"Token expired for connection {connection.id}, no refresh token available")
            return None
        
        try:
            config = get_provider_config(connection.provider_id)
            tokens = await refresh_access_token(
                refresh_token=tokens.refresh_token,
                client_id=config.slug,
                client_secret="",
                token_endpoint=config.oauth_token_url,
            )
            # Update stored tokens
            from backend.integrations.oauth import store_user_connection
            await store_user_connection(
                db_session=db,
                user_id=connection.user_id,
                provider_slug=connection.provider_id,
                access_token=tokens.access_token,
                refresh_token=tokens.refresh_token,
                scopes=tokens.scope.split(",") if tokens.scope else [],
            )
            await db.commit()
        except Exception as e:
            logger.error(f"Failed to refresh token for connection {connection.id}: {e}")
            return None
    
    return tokens.access_token


# ---------------------------------------------------------------------------
# Output templating
# ---------------------------------------------------------------------------

_TEMPLATE_PATTERN = re.compile(r'\{\{\s*step\.(\d+)\.output\.([^}]+)\s*\}\}')

def render_template(template: str, step_outputs: Dict[int, Dict[str, Any]]) -> str:
    """Render a template string with step output references.
    
    Template syntax: {{step.N.output.field}}
    Example: "Create file in {{step.1.output.folder_id}}"
    """
    def replace_match(match):
        step_idx = int(match.group(1))
        field_path = match.group(2).strip()
        
        if step_idx not in step_outputs:
            logger.warning(f"Step {step_idx} output not found for template")
            return match.group(0)
        
        output = step_outputs[step_idx]
        # Navigate nested fields (e.g., "data.id" -> output["data"]["id"])
        keys = field_path.split('.')
        for key in keys:
            if isinstance(output, dict) and key in output:
                output = output[key]
            else:
                logger.warning(f"Field {field_path} not found in step {step_idx} output")
                return match.group(0)
        
        return str(output)
    
    return _TEMPLATE_PATTERN.sub(replace_match, template)


def render_config(config_json: Optional[str], step_outputs: Dict[int, Dict[str, Any]]) -> Dict[str, Any]:
    """Render a JSON config with template substitution."""
    if not config_json:
        return {}
    try:
        config = json.loads(config_json)
    except json.JSONDecodeError:
        logger.warning(f"Invalid JSON config: {config_json}")
        return {}
    
    # Recursively render string values
    def render_value(value):
        if isinstance(value, str):
            return render_template(value, step_outputs)
        elif isinstance(value, dict):
            return {k: render_value(v) for k, v in value.items()}
        elif isinstance(value, list):
            return [render_value(v) for v in value]
        return value
    
    return render_value(config)


# ---------------------------------------------------------------------------
# Step execution
# ---------------------------------------------------------------------------

async def execute_step(
    db: AsyncSession,
    step: IntegrationStep,
    step_outputs: Dict[int, Dict[str, Any]],
    flow_run: IntegrationFlowRun,
) -> Dict[str, Any]:
    """Execute a single step and return its output."""
    
    # Get the connection
    conn = await db.get(UserConnection, step.action_connection_id)
    if not conn:
        raise ValueError(f"Connection {step.action_connection_id} not found")
    
    # Get provider config
    provider = await db.get(IntegrationProvider, conn.provider_id)
    if not provider:
        raise ValueError(f"Provider {conn.provider_id} not found")
    
    # Get valid token
    access_token = await get_valid_connection_token(db, conn)
    if not access_token:
        raise ValueError(f"No valid token for connection {conn.id}")
    
    # Render step config with previous step outputs
    rendered_config = render_config(step.action_config_json, step_outputs)
    
    # Prepare input data
    input_data = {
        "access_token": access_token,
        "config": rendered_config,
        "previous_outputs": step_outputs,
    }
    
    # Get executor
    executor = get_step_executor(provider.slug, step.action_name)
    if not executor:
        raise ValueError(f"No executor registered for {provider.slug}.{step.action_name}")
    
    # Execute with retry logic
    max_attempts = 1
    backoff_seconds = 1
    if step.retry_config_json:
        try:
            retry_config = json.loads(step.retry_config_json)
            max_attempts = retry_config.get("max_attempts", 1)
            backoff_seconds = retry_config.get("backoff_seconds", 1)
        except json.JSONDecodeError:
            pass
    
    last_error = None
    for attempt in range(1, max_attempts + 1):
        try:
            logger.info(f"Executing step {step.id} (attempt {attempt}/{max_attempts}): {step.action_name}")
            output = await executor(input_data, step_outputs)
            
            # Update step output
            step.action_output_json = json.dumps(output)
            await db.commit()
            
            return output
        except Exception as e:
            last_error = e
            logger.warning(f"Step {step.id} attempt {attempt} failed: {e}")
            if attempt < max_attempts:
                time.sleep(backoff_seconds * attempt)  # Linear backoff
    
    # All attempts failed
    raise last_error or Exception(f"Step {step.id} failed after {max_attempts} attempts")


# ---------------------------------------------------------------------------
# Flow execution
# ---------------------------------------------------------------------------

async def execute_flow_run(
    flow_id: int,
    trigger_payload: Optional[Dict[str, Any]] = None,
    trigger_connection_id: Optional[int] = None,
) -> IntegrationFlowRun:
    """Execute a full flow run."""
    
    async with AsyncSessionLocal() as db:
        # Load flow with steps
        flow = await db.get(
            IntegrationFlow,
            flow_id,
            options=[selectinload(IntegrationFlow.steps)]
        )
        if not flow:
            raise ValueError(f"Flow {flow_id} not found")
        
        if not flow.enabled:
            raise ValueError(f"Flow {flow_id} is disabled")
        
        # Create flow run record
        flow_run = IntegrationFlowRun(
            flow_id=flow_id,
            trigger_connection_id=trigger_connection_id,
            status="running",
            trigger_payload_json=json.dumps(trigger_payload) if trigger_payload else None,
            started_at=datetime.utcnow(),
        )
        db.add(flow_run)
        await db.commit()
        await db.refresh(flow_run)
        
        step_outputs: Dict[int, Dict[str, Any]] = {}
        
        try:
            # Execute steps in order
            for step in sorted(flow.steps, key=lambda s: s.step_index):
                output = await execute_step(db, step, step_outputs, flow_run)
                step_outputs[step.step_index] = output
            
            # Success
            flow_run.status = "success"
            flow_run.steps_output_json = json.dumps(step_outputs)
            flow_run.completed_at = datetime.utcnow()
            flow_run.duration_ms = int((flow_run.completed_at - flow_run.started_at).total_seconds() * 1000)
            await db.commit()
            
        except Exception as e:
            logger.error(f"Flow {flow_id} run {flow_run.id} failed: {e}")
            flow_run.status = "failed"
            flow_run.error_text = str(e)
            flow_run.steps_output_json = json.dumps(step_outputs)
            flow_run.completed_at = datetime.utcnow()
            flow_run.duration_ms = int((flow_run.completed_at - flow_run.started_at).total_seconds() * 1000)
            await db.commit()
        
        return flow_run


# ---------------------------------------------------------------------------
# Polling trigger functions (to be implemented per provider)
# ---------------------------------------------------------------------------

async def poll_google_gmail(
    connection: UserConnection,
    config: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Poll Gmail for new messages matching criteria."""
    # TODO: Implement Gmail polling using Gmail API
    # Use historyId cursor from config
    return None


async def poll_google_drive(
    connection: UserConnection,
    config: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Poll Drive for new/changed files."""
    # TODO: Implement Drive polling using Drive API
    # Use startPageToken cursor from config
    return None


async def poll_github(
    connection: UserConnection,
    config: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Poll GitHub for new events (issues, PRs, pushes)."""
    # TODO: Implement GitHub polling using GitHub API
    return None


async def poll_slack(
    connection: UserConnection,
    config: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Poll Slack for new messages/events."""
    # TODO: Implement Slack polling using Slack API
    return None


POLLING_FUNCTIONS = {
    "google": {
        "gmail": poll_google_gmail,
        "drive": poll_google_drive,
    },
    "github": {
        "default": poll_github,
    },
    "slack": {
        "default": poll_slack,
    },
}


async def run_polling_trigger(flow_id: int) -> None:
    """Run the polling trigger for a flow."""
    
    async with AsyncSessionLocal() as db:
        flow = await db.get(IntegrationFlow, flow_id)
        if not flow or not flow.enabled:
            return
        
        # Get trigger connection
        trigger_conn = await db.get(UserConnection, flow.trigger_connection_id)
        if not trigger_conn:
            logger.warning(f"Trigger connection {flow.trigger_connection_id} not found for flow {flow_id}")
            return
        
        provider = await db.get(IntegrationProvider, trigger_conn.provider_id)
        if not provider:
            return
        
        # Get polling function
        trigger_config = json.loads(flow.config_json) if flow.config_json else {}
        trigger_type = trigger_config.get("trigger_type", "default")
        
        poll_func = POLLING_FUNCTIONS.get(provider.slug, {}).get(trigger_type)
        if not poll_func:
            poll_func = POLLING_FUNCTIONS.get(provider.slug, {}).get("default")
        
        if not poll_func:
            logger.warning(f"No polling function for provider {provider.slug}, type {trigger_type}")
            return
        
        # Execute polling
        trigger_payload = await poll_func(trigger_conn, trigger_config)
        if trigger_payload:
            # Execute flow with trigger payload
            await execute_flow_run(flow_id, trigger_payload, trigger_conn.id)


# ---------------------------------------------------------------------------
# Scheduler management
# ---------------------------------------------------------------------------

def get_scheduler() -> AsyncIOScheduler:
    """Get or create the global APScheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler()
        _scheduler.start()
    return _scheduler


def schedule_flow(flow: IntegrationFlow) -> None:
    """Schedule a flow for periodic execution."""
    if not flow.schedule_cron:
        return
    
    scheduler = get_scheduler()
    job_id = f"flow_{flow.id}"
    
    # Remove existing job if any
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
    
    # Add new job
    scheduler.add_job(
        run_polling_trigger,
        CronTrigger.from_crontab(flow.schedule_cron),
        args=[flow.id],
        id=job_id,
        replace_existing=True,
        max_instances=1,  # Prevent overlapping runs
    )
    logger.info(f"Scheduled flow {flow.id} with cron: {flow.schedule_cron}")


def unschedule_flow(flow_id: int) -> None:
    """Remove a flow from the scheduler."""
    scheduler = get_scheduler()
    job_id = f"flow_{flow_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        logger.info(f"Unscheduled flow {flow_id}")


def load_scheduled_flows() -> None:
    """Load all enabled flows with cron schedules into the scheduler."""
    # This should be called on startup
    # We can't easily query async here, so the caller should pass flows
    pass


async def load_and_schedule_flows() -> None:
    """Load all enabled flows with cron schedules and schedule them."""
    try:
        async with AsyncSessionLocal() as db:
            stmt = select(IntegrationFlow).where(
                and_(IntegrationFlow.enabled == True, IntegrationFlow.schedule_cron.is_not(None))
            )
            result = await db.execute(stmt)
            flows = result.scalars().all()
            
            for flow in flows:
                schedule_flow(flow)
            
            logger.info(f"Loaded {len(flows)} scheduled flows")
    except Exception as e:
        # Gracefully handle case where the integration_flows table doesn't exist yet
        # (e.g. restoring an older DB from GCS that predates this feature).
        # The table will be created by init_db; flows will be scheduled on next startup.
        logger.warning(f"[SCHEDULER] Could not load scheduled flows (table may not exist yet): {e}")


# ---------------------------------------------------------------------------
# Webhook handling
# ---------------------------------------------------------------------------

async def handle_webhook_trigger(
    provider_slug: str,
    flow_id: int,
    payload: Dict[str, Any],
    headers: Dict[str, str],
) -> Dict[str, Any]:
    """Handle incoming webhook trigger for a flow.
    
    Validates HMAC signature if configured, then executes the flow.
    """
    async with AsyncSessionLocal() as db:
        flow = await db.get(IntegrationFlow, flow_id)
        if not flow or not flow.enabled:
            return {"error": "Flow not found or disabled"}
        
        # Verify HMAC if webhook secret configured
        webhook_secret = flow.config_json and json.loads(flow.config_json).get("webhook_secret")
        if webhook_secret:
            import hmac
            import hashlib
            signature = headers.get("X-Webhook-Signature", "")
            if not signature:
                return {"error": "Missing webhook signature"}
            
            expected = hmac.new(
                webhook_secret.encode(),
                json.dumps(payload, separators=(',', ':')).encode(),
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(signature, expected):
                return {"error": "Invalid webhook signature"}
        
        # Check idempotency key
        idempotency_key = headers.get("X-Webhook-Idempotency-Key")
        if idempotency_key:
            # Check if we've already processed this key
            existing_run = await db.execute(
                select(IntegrationFlowRun).where(
                    and_(
                        IntegrationFlowRun.flow_id == flow_id,
                        IntegrationFlowRun.trigger_payload_json.contains(idempotency_key)
                    )
                )
            )
            if existing_run.scalar_one_or_none():
                return {"status": "duplicate", "message": "Idempotency key already processed"}
        
        # Execute flow
        await execute_flow_run(flow_id, payload, flow.trigger_connection_id)
        return {"status": "accepted"}


# ---------------------------------------------------------------------------
# Built-in step executors (examples)
# ---------------------------------------------------------------------------

async def _google_send_email_executor(input_data: Dict[str, Any], step_outputs: Dict[int, Dict[str, Any]]) -> Dict[str, Any]:
    """Executor for sending email via Gmail API."""
    # TODO: Implement Gmail API call
    return {"status": "sent", "message_id": "mock"}


async def _google_create_drive_file_executor(input_data: Dict[str, Any], step_outputs: Dict[int, Dict[str, Any]]) -> Dict[str, Any]:
    """Executor for creating file in Google Drive."""
    # TODO: Implement Drive API call
    return {"status": "created", "file_id": "mock", "web_view_link": "https://drive.google.com/file/d/mock"}


async def _github_create_issue_executor(input_data: Dict[str, Any], step_outputs: Dict[int, Dict[str, Any]]) -> Dict[str, Any]:
    """Executor for creating GitHub issue."""
    # TODO: Implement GitHub API call
    return {"status": "created", "issue_number": 123, "html_url": "https://github.com/owner/repo/issues/123"}


async def _slack_post_message_executor(input_data: Dict[str, Any], step_outputs: Dict[int, Dict[str, Any]]) -> Dict[str, Any]:
    """Executor for posting message to Slack."""
    # TODO: Implement Slack API call
    return {"status": "posted", "ts": "1234567890.123456"}


# Register built-in executors
register_step_executor("google", "send_email", _google_send_email_executor)
register_step_executor("google", "create_drive_file", _google_create_drive_file_executor)
register_step_executor("github", "create_issue", _github_create_issue_executor)
register_step_executor("slack", "post_message", _slack_post_message_executor)