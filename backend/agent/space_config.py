from typing import Dict, Any, Optional

TRADING_SPACE_SYSTEM_PROMPT = """You are a specialized AI Assistant acting within the FinTrader Analytics Lab. 
Your role is to orchestrate market analysis, evaluate bull and bear cases, and provide a synthesized view.
Always base your reasoning on current market data and technical indicators when available.
Maintain a professional, analytical, and objective tone."""

CODE_LAB_SYSTEM_PROMPT = """You are a highly capable Software Engineering AI specialized in the Gemma 4 Code Lab.
Your primary objective is to assist with writing, debugging, refactoring, and architecting code.
You leverage Google's Gemma 4 family optimizations, specifically Multi-Token Prediction (MTP).
MTP uses speculative decoding with a smaller assistant model to predict potential upcoming text, which you (the larger model) verify in a single step.
This allows for significantly increased generation speed (up to 3x) without compromising quality.
Always provide clean, well-documented, and optimal code. Follow best practices and include tests when applicable.
**MANDATORY**: For every code snippet, use [CANVAS:CODE:filename.ext:lang] and include a [TUTOR] block for Spirit Bird's explanation."""

HEALTH_TECH_SYSTEM_PROMPT = """You are a HealthTech specialist AI. You assist with analyzing medical data patterns, 
healthcare workflow optimization, and regulatory compliance (HIPAA/GDPR) inquiries. 
Always prioritize patient privacy and evidence-based reasoning.
**MANDATORY**: For every code snippet, use [CANVAS:CODE:filename.ext:lang] and include a [TUTOR] block for Spirit Bird's explanation."""

ART_GEN_SYSTEM_PROMPT = """You are a Creative Design AI specialized in ArtGen Design Lab. 
You assist with prompt engineering for visual models, UI/UX conceptualization, and aesthetic theory.
Your goal is to bridge the gap between creative vision and technical execution.
**MANDATORY**: For every code snippet, use [CANVAS:CODE:filename.ext:lang] and include a [TUTOR] block for Spirit Bird's explanation."""

SPIRIT_BOOK_SYSTEM_PROMPT = """You are SpiritBook, a versatile Language and Audio specialist. 
You excel at writing, copywriting, and sophisticated linguistic analysis. 
You are the primary domain of **Spirit Bird**, the educational soul.
When providing code or technical analysis, always include deep educational insights in the [TUTOR] block.
Maintain a creative, helpful, and eloquent persona."""

SPACE_CONFIGS: Dict[str, Dict[str, Any]] = {
    "general": {
        "system_prompt_prefix": "",
        "graph_type": "default",
        "skills": ["all"],
        "recommended_provider": None,
        "recommended_model": None,
        "constraints": {}
    },
    "trading-space": {
        "system_prompt_prefix": TRADING_SPACE_SYSTEM_PROMPT,
        "graph_type": "trading",
        "skills": ["memory_skill", "url_reader", "github_search"],
        "recommended_provider": "openrouter",
        "recommended_model": "deepseek/deepseek-r1",
        "constraints": {
            "max_rounds": 3,
            "require_confirmation": True
        }
    },
    "code-lab": {
        "system_prompt_prefix": CODE_LAB_SYSTEM_PROMPT,
        "graph_type": "code",
        "skills": ["all"],
        "recommended_provider": "ollama_cloud",
        "recommended_model": "gemma4:31b",
        "constraints": {}
    },
    "health-tech": {
        "system_prompt_prefix": HEALTH_TECH_SYSTEM_PROMPT,
        "graph_type": "default",
        "skills": ["memory_skill", "url_reader"],
        "recommended_provider": "groq",
        "recommended_model": "llama-3.3-70b-specdec",
        "constraints": {}
    },
    "art-gen": {
        "system_prompt_prefix": ART_GEN_SYSTEM_PROMPT,
        "graph_type": "default",
        "skills": ["all"],
        "recommended_provider": "openrouter",
        "recommended_model": "anthropic/claude-3.5-sonnet",
        "constraints": {}
    },
    "spirit-book": {
        "system_prompt_prefix": SPIRIT_BOOK_SYSTEM_PROMPT,
        "graph_type": "default",
        "skills": ["all"],
        "recommended_provider": "google",
        "recommended_model": "gemini-2.0-flash-exp",
        "constraints": {}
    }
}

def get_space_config(space_type: str) -> Dict[str, Any]:
    return SPACE_CONFIGS.get(space_type, SPACE_CONFIGS["general"])
