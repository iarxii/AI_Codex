import os
from pathlib import Path
import logging
import re
from typing import List

logger = logging.getLogger(__name__)

# Directory where persona files are stored
# Resolve relative to this file's location (backend/agent/profile.py)
PROFILE_DIR = Path(__file__).resolve().parent.parent / "data" / "profile"
SUBMODULE_ROOT = Path(__file__).resolve().parent.parent.parent
SKILLS_DIR = SUBMODULE_ROOT / "skills"

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

def load_mandatory_skills() -> str:
    mandatory_dir = SKILLS_DIR / "mendatory"
    if not mandatory_dir.exists():
        return ""
    
    skills_content = []
    try:
        for path in sorted(mandatory_dir.glob("*.md")):
            try:
                content = path.read_text(encoding="utf-8")
                skills_content.append(f"\n--- SKILL: {path.stem.upper()} ---\n{content}")
                logger.info(f"Loaded mandatory skill from {path.name}")
            except Exception as e:
                logger.error(f"Failed to read mandatory skill {path.name}: {e}")
    except Exception as e:
        logger.error(f"Error reading mandatory skills directory: {e}")
        
    return "\n".join(skills_content)

def load_situational_skills(allowed_skills: List[str] = None) -> str:
    if not allowed_skills:
        return ""
    
    situational_dir = SKILLS_DIR / "situational"
    if not situational_dir.exists():
        return ""
        
    skills_content = []
    try:
        for path in sorted(situational_dir.glob("*.md")):
            skill_name = path.stem
            if skill_name in allowed_skills or "all" in allowed_skills:
                try:
                    content = path.read_text(encoding="utf-8")
                    skills_content.append(f"\n--- SITUATIONAL SKILL: {skill_name.upper()} ---\n{content}")
                    logger.info(f"Loaded situational skill from {path.name}")
                except Exception as e:
                    logger.error(f"Failed to read situational skill {path.name}: {e}")
    except Exception as e:
        logger.error(f"Error reading situational skills directory: {e}")
        
    return "\n".join(skills_content)

def compress_markdown(text: str) -> str:
    """Removes excess whitespace, newlines, and compresses markdown to reduce token count."""
    if not text: return ""
    # Remove excessive blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Remove multiple spaces
    text = re.sub(r' {2,}', ' ', text)
    return text.strip()

def build_system_prompt(conversation_id: str = "default", allowed_skills: List[str] = None, tool_binding_status: str = "") -> str:
    """
    Assembles the System Prompt from modular markdown files (SOUL, USER, MEMORY, AGENTS).
    Applies programmatic compression to strike a balance between load and performance.
    Injects the Workspace Sentinel status for persistent session awareness.
    Injects mandatory and situational skills from the skills/ directory.
    Optionally injects tool-binding telemetry so the model knows which tools are available.
    """
    soul = compress_markdown(load_profile_file("SOUL.md", "You are AICodex, an elite agentic assistant."))
    user = compress_markdown(load_profile_file("USER.md", "The user is a software developer."))
    memory = compress_markdown(load_profile_file("MEMORY.md", "No previous project memory found."))
    agents = compress_markdown(load_profile_file("AGENTS.md", "Follow standard agentic coding procedures."))
    spirit_bird = compress_markdown(load_profile_file("SPIRIT_BIRD.md", "Spirit Bird is the educational soul."))
    
    # Workspace Sentinel: inject live session context
    from backend.agent.workspace_sentinel import read_workspace_status
    workspace_status = read_workspace_status(conversation_id)
    status_block = f"\n[STATUS]\n{workspace_status}" if workspace_status else ""
    
    # Load prompt-based skills
    mandatory_skills = compress_markdown(load_mandatory_skills())
    mandatory_skills_block = f"\n[MANDATORY SKILLS]\n{mandatory_skills}" if mandatory_skills else ""
    
    situational_skills = compress_markdown(load_situational_skills(allowed_skills))
    situational_skills_block = f"\n[SITUATIONAL SKILLS]\n{situational_skills}" if situational_skills else ""
    
    # Tool-binding telemetry injection (Layer 3)
    tool_status_line = f"\n11. TOOL STATUS: {tool_binding_status}" if tool_binding_status else ""
    
    prompt = f"""[SOUL]
{soul}

[USER]
{user}

[MEMORY]
{memory}
{status_block}

[SPIRIT_BIRD]
{spirit_bird}

[PROCEDURES]
{agents}
{mandatory_skills_block}
{situational_skills_block}

INSTRUCTIONS:
1. Use [SOUL] for identity.
2. Use [USER] context.
3. Use [MEMORY] for grounding.
4. Use [SPIRIT_BIRD] for educational context and tutoring.
5. Use [STATUS] for current session awareness (if present).
6. Use [PROCEDURES] for execution. Follow the Workspace Interaction precedence rule strictly.
7. You are an autonomous agent. If a query requires technical context, use the 'codebase_search' tool.
8. For simple greetings or general chat, respond directly without using tools.
9. Always ask for confirmation before making permanent file changes.
10. CRITICAL: Writing code inside a [CANVAS:...] block does NOT save it to disk. To physically create or modify files, you MUST call the appropriate tool. Use 'workspace_patcher' to modify existing files by replacing a specific block of text. Use 'workspace_writer' ONLY for creating brand new files. NEVER output raw markdown code blocks to write to a file without calling a tool. Call the tool FIRST, then optionally show a Canvas block afterward.
{tool_status_line}
"""
    return prompt

