"""
Workspace Sentinel: Persistent state manager for long-term agent memory.

Maintains a compact `workspace_status.md` file that captures the current
project objective, key decisions, and active context. This file is injected
into every system prompt to give the LLM "God Mode" awareness of the session
without consuming the full Lean Context budget.

Budget: ~200 characters for the status injection.
Trigger: Updated every SENTINEL_INTERVAL turns.
Persistence: Lives in `data/` — synced to GCS on Cloud Run, local disk otherwise.
"""

import logging
from pathlib import Path
from datetime import datetime
from typing import List, Optional
from langchain_core.messages import BaseMessage

logger = logging.getLogger(__name__)

# Where the status file lives (alongside aicodex.db in data/)
STATUS_FILE = Path("./data/workspace_status.md")

# How often (in conversation turns) to trigger a status update
SENTINEL_INTERVAL = 5

# Maximum chars for the status content (fits in the 200-char Workspace Meta budget)
MAX_STATUS_CHARS = 200


def read_workspace_status() -> str:
    """
    Reads the current workspace status. Returns empty string if no status exists.
    This is called on every prompt to inject into the system message.
    """
    if STATUS_FILE.exists():
        try:
            content = STATUS_FILE.read_text(encoding="utf-8").strip()
            # Enforce budget ceiling
            if len(content) > MAX_STATUS_CHARS:
                content = content[:MAX_STATUS_CHARS - 3] + "..."
            return content
        except Exception as e:
            logger.error(f"Sentinel: Failed to read status file: {e}")
    return ""


def write_workspace_status(status: str) -> None:
    """
    Writes a new workspace status. Enforces the character budget.
    """
    STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    # Enforce budget
    if len(status) > MAX_STATUS_CHARS:
        status = status[:MAX_STATUS_CHARS - 3] + "..."
    
    try:
        STATUS_FILE.write_text(status, encoding="utf-8")
        logger.info(f"Sentinel: Status updated ({len(status)} chars)")
    except Exception as e:
        logger.error(f"Sentinel: Failed to write status file: {e}")


def should_update_status(turn_count: int) -> bool:
    """
    Determines if the Sentinel should trigger a status update based on turn count.
    """
    return turn_count > 0 and turn_count % SENTINEL_INTERVAL == 0


def extract_status_from_history(messages: List[BaseMessage]) -> str:
    """
    Extracts a compact status summary from recent conversation history.
    
    This is a LOCAL extraction (no LLM call) — it scans the last few messages
    for key signals and compresses them into a ≤200 char status line.
    
    For the "Cloud Crutch" pattern (using Gemini Flash for deeper summarization),
    see `cloud_summarize_status()`.
    """
    if not messages:
        return ""
    
    # Take the last 5 messages (most recent context)
    recent = messages[-5:]
    
    # Extract the user's most recent question/goal
    last_user_msg = ""
    for msg in reversed(recent):
        if msg.type == "human":
            last_user_msg = msg.content[:80]  # Cap at 80 chars
            break
    
    # Extract any key decisions from assistant messages
    key_facts = []
    for msg in recent:
        if msg.type == "ai":
            content = msg.content if isinstance(msg.content, str) else str(msg.content)
            # Look for decision markers
            for marker in ["decided", "using", "set to", "configured", "switched to", "implemented"]:
                if marker in content.lower():
                    # Extract the sentence containing the marker
                    sentences = content.split(".")
                    for s in sentences:
                        if marker in s.lower() and len(s.strip()) < 60:
                            key_facts.append(s.strip())
                            break
                    break
    
    # Compose status within budget
    timestamp = datetime.now().strftime("%m/%d %H:%M")
    
    parts = [f"[{timestamp}]"]
    if last_user_msg:
        parts.append(f"Goal: {last_user_msg}")
    if key_facts:
        parts.append(f"Decision: {key_facts[-1][:60]}")
    
    status = " | ".join(parts)
    
    # Enforce budget
    if len(status) > MAX_STATUS_CHARS:
        status = status[:MAX_STATUS_CHARS - 3] + "..."
    
    return status
