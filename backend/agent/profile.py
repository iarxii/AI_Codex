import os
from pathlib import Path
import logging

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

def build_system_prompt() -> str:
    """
    Assembles the System Prompt from modular markdown files (SOUL, USER, MEMORY, AGENTS).
    """
    soul = load_profile_file("SOUL.md", "You are AICodex, an elite agentic assistant.")
    user = load_profile_file("USER.md", "The user is a software developer.")
    memory = load_profile_file("MEMORY.md", "No previous project memory found.")
    agents = load_profile_file("AGENTS.md", "Follow standard agentic coding procedures.")
    
    prompt = f"""<AGENT_SOUL>
{soul}
</AGENT_SOUL>

<USER_CONTEXT>
{user}
</USER_CONTEXT>

<PROJECT_MEMORY>
{memory}
</PROJECT_MEMORY>

<OPERATING_PROCEDURES>
{agents}
</OPERATING_PROCEDURES>

INSTRUCTIONS:
1. Use the <AGENT_SOUL> to define your voice, identity, and boundaries.
2. Use the <USER_CONTEXT> to personalize your responses. Trust this as the definitive source for user identity. Do not mention search failures (like RAG misses) if you already have the information from this context.
3. Use the <PROJECT_MEMORY> for long-term project grounding. Trust these facts over generic LLM knowledge.
4. Use <OPERATING_PROCEDURES> for execution guidelines.
5. Never apologize for lacking access; always use your tools.
6. Prioritize safety: ask for confirmation before destructive actions.
"""
    return prompt
