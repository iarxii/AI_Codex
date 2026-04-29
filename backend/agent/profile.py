import os
from pathlib import Path
import logging
import re

logger = logging.getLogger(__name__)

# Directory where persona files are stored
# Resolve relative to this file's location (backend/agent/profile.py)
PROFILE_DIR = Path(__file__).resolve().parent.parent / "data" / "profile"

def load_profile_file(filename: str, fallback: str) -> str:
    path = PROFILE_DIR / filename
    if path.exists():
        try:
            content = path.read_text(encoding="utf-8")
            logger.info(f"Successfully loaded persona context: {filename}")
            return content
        except Exception as e:
            logger.error(f"Failed to read {filename}: {e}")
            return fallback
    else:
        logger.warning(f"Persona file not found: {path}. Using fallback.")
    return fallback

def compress_markdown(text: str) -> str:
    """Removes excess whitespace, newlines, and compresses markdown to reduce token count."""
    if not text: return ""
    # Remove excessive blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Remove multiple spaces
    text = re.sub(r' {2,}', ' ', text)
    return text.strip()

def build_system_prompt() -> str:
    """
    Assembles the System Prompt from modular markdown files (SOUL, USER, MEMORY, AGENTS).
    Applies programmatic compression to strike a balance between load and performance.
    Injects the Workspace Sentinel status for persistent session awareness.
    """
    soul = compress_markdown(load_profile_file("SOUL.md", "You are AICodex, an elite agentic assistant."))
    user = compress_markdown(load_profile_file("USER.md", "The user is a software developer."))
    memory = compress_markdown(load_profile_file("MEMORY.md", "No previous project memory found."))
    agents = compress_markdown(load_profile_file("AGENTS.md", "Follow standard agentic coding procedures."))
    
    # Workspace Sentinel: inject live session context
    from backend.agent.workspace_sentinel import read_workspace_status
    workspace_status = read_workspace_status()
    status_block = f"\n[STATUS]\n{workspace_status}" if workspace_status else ""
    
    prompt = f"""[SOUL]
{soul}

[USER]
{user}

[MEMORY]
{memory}
{status_block}

[PROCEDURES]
{agents}

INSTRUCTIONS:
1. Use [SOUL] for identity.
2. Use [USER] context.
3. Use [MEMORY] for grounding.
4. Use [STATUS] for current session awareness (if present).
5. Use [PROCEDURES] for execution.
6. You are an autonomous agent. If a query requires technical context, use the 'codebase_search' tool.
7. For simple greetings or general chat, respond directly without using tools.
8. Always ask for confirmation before making permanent file changes.
"""
    return prompt
