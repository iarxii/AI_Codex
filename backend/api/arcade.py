from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List
import json
from datetime import datetime

from backend.db.session import get_db
from backend.api.auth import get_current_user
from backend.db.models import User, ArcadeScore
from backend.agent.models import get_llm
from langchain_core.messages import HumanMessage

router = APIRouter()

# --- Pydantic Models ---
class ScoreSubmit(BaseModel):
    game_id: str
    score: int
    stars_earned: int
    accuracy: Optional[float] = 100.0
    time_spent_sec: int

class LeaderboardEntry(BaseModel):
    username: str
    score: int
    stars_earned: int
    accuracy: float
    time_spent_sec: int
    timestamp: datetime

class HintRequest(BaseModel):
    game_id: str
    level_id: int
    level_title: str
    instruction: str
    current_styles: dict
    target_styles: dict
    attempts: int
    provider: str
    model: str
    api_key: str

# --- Endpoints ---

@router.post("/score")
async def submit_score(
    data: ScoreSubmit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Submits a new game completion score.
    """
    try:
        new_score = ArcadeScore(
            user_id=current_user.id,
            game_id=data.game_id,
            score=data.score,
            stars_earned=data.stars_earned,
            accuracy=data.accuracy,
            time_spent_sec=data.time_spent_sec,
            timestamp=datetime.utcnow()
        )
        db.add(new_score)
        await db.commit()
        return {"status": "success", "message": "Score recorded successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/leaderboard/{game_id}", response_model=List[LeaderboardEntry])
async def get_leaderboard(
    game_id: str,
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """
    Fetches the leaderboard for a specific game, showing the highest score per user.
    """
    try:
        # Subquery to get max score per user for this game
        subquery = (
            select(
                ArcadeScore.user_id,
                func.max(ArcadeScore.score).label("max_score")
            )
            .filter(ArcadeScore.game_id == game_id)
            .group_by(ArcadeScore.user_id)
            .subquery()
        )

        # Query join to retrieve details of that max score
        stmt = (
            select(ArcadeScore, User.username)
            .join(User, ArcadeScore.user_id == User.id)
            .join(
                subquery,
                (ArcadeScore.user_id == subquery.c.user_id) & 
                (ArcadeScore.score == subquery.c.max_score)
            )
            .filter(ArcadeScore.game_id == game_id)
            .order_by(ArcadeScore.score.desc(), ArcadeScore.time_spent_sec.asc())
            .limit(limit)
        )

        result = await db.execute(stmt)
        entries = []
        seen_users = set()

        for row in result.all():
            score_record, username = row
            # Deduplicate just in case a user has multiple identical max scores
            if score_record.user_id in seen_users:
                continue
            seen_users.add(score_record.user_id)
            
            entries.append(LeaderboardEntry(
                username=username,
                score=score_record.score,
                stars_earned=score_record.stars_earned,
                accuracy=score_record.accuracy or 100.0,
                time_spent_sec=score_record.time_spent_sec,
                timestamp=score_record.timestamp
            ))
            
        return entries
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/hint")
async def get_arcade_hint(
    data: HintRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Generates a personalized CSS debug hint using the user's BYOK LLM provider.
    """
    if not data.api_key or not data.api_key.strip():
        raise HTTPException(status_code=400, detail="API key is required for BYOK model execution.")

    try:
        if data.game_id == "logicgrid":
            prompt_text = f"""
You are the AI Codex Deduction Engine, an expert system compiler and logic analyst.
The player is playing a "Logic Grid" puzzle (logicgrid).

Level: {data.level_title} (Level ID: {data.level_id})
Goal: Match all items of the categories correctly based on the logical clues.

Clues and Level Info:
{data.instruction}

The correct relations (Solution mapping):
{json.dumps(data.target_styles, indent=2)}

Player's Current Grid pairings:
{json.dumps(data.current_styles, indent=2)}

Attempts so far: {data.attempts}

Analyze the player's pairings.
If they have marked any INCORRECT pairings (a checked relation that contradicts the correct relations), identify it immediately and explain the logic of why it conflicts in a cryptic, supportive developer-oriented style (e.g. "If Bob drinks Espresso and writes Go, then Bob cannot be writing Rust. Check Clue #2").
If they have no errors but are stuck, examine the clues and suggest the next logical deduction they can make. Keep it concise in 2-3 sentences. Do NOT give away all solutions.
"""
        elif data.game_id == "chromasync":
            prompt_text = f"""
You are the AI Codex Colorist, an expert designer and aesthetic art critic.
The player is playing "ChromaSync" (chromasync) - a color space matching game.

Level: {data.level_title} (Level ID: {data.level_id})
Goal: {data.instruction}

Target Color(s) in HSL:
{json.dumps(data.target_styles, indent=2)}

Player's Current Color settings in HSL:
{json.dumps(data.current_styles, indent=2)}

Attempts so far: {data.attempts}

Analyze the difference in HSL space between the target and player's selections.
Identify which channels (Hue, Saturation, or Lightness) are the furthest off.
Give a brief feedback advice (2-3 sentences max) in the voice of a sophisticated, somewhat theatrical art critic.
Advise them on which way to shift their channels (e.g. "The hue is too warm; shift the slider towards cooler blue tones. Lighten up the saturation to let it breathe, or dim the luminance to give it gravity"). Do NOT list the exact target numbers.
"""
        elif data.game_id == "patternforge":
            prompt_text = f"""
You are the AI Codex Decrypter, an elite hacker and mathematical cryptographer.
The player is playing "PatternForge" (patternforge) - a sequence decoding puzzle.
 
Level: {data.level_title} (Level ID: {data.level_id})
Goal: {data.instruction}
 
Current Sequence elements:
{json.dumps(data.current_styles, indent=2)}
 
Correct next element / target solution:
{json.dumps(data.target_styles, indent=2)}
 
Attempts so far: {data.attempts}
 
Analyze the sequence and the player's incorrect attempts.
Give a brief, cryptic hint (2-3 sentences max) in the voice of a hacker/decrypter pointing out the mathematical rule or geometric rotation rule of the sequence.
Do NOT give away the exact final answer or next element. Focus on hinting at the growth rate, recurrence formula, rotation angle increments, or matrix relations (e.g. "Each step doubles the delta of the previous step. Hack the increment rate to reveal the answer.").
"""
        elif data.game_id == "nodeflow":
            prompt_text = f"""
You are the AI Codex Routing Core, a network routing optimizer and graph theory algorithm specialist.
The player is playing "NodeFlow" (nodeflow) - a graph pathfinding game.
 
Level: {data.level_title} (Level ID: {data.level_id})
Goal: {data.instruction}
 
Graph edges and weights/capacities:
{json.dumps(data.target_styles, indent=2)}
 
Player's Current selected path / state:
{json.dumps(data.current_styles, indent=2)}
 
Attempts so far: {data.attempts}
 
Analyze the graph connectivity and the player's path/attempt.
Give a brief, analytical hint (2-3 sentences max) in the voice of a network optimizer pointing out graph-theory traversal logic (e.g., shortest path calculations, BFS queue visitation order, or max flow bottleneck analysis).
Do NOT reveal the exact final path list (e.g. do not write "Select S -> A -> C -> T").
Instead, suggest which node they should consider next or describe how the current path exceeds the cost budget or misses the search algorithm definition.
"""
        else:
            prompt_text = f"""
You are the AI Codex Insight Engine, a helpful compiler and debugger guiding developer minds.
The user is playing a gamified frontend puzzle called "Digital Architect" (digiarch).

Level: {data.level_title} (Level ID: {data.level_id})
Level Goal: {data.instruction}

Target Constraints (Goal CSS properties):
{json.dumps(data.target_styles, indent=2)}

Player's Current CSS selections:
{json.dumps(data.current_styles, indent=2)}

Attempts so far: {data.attempts}

Provide a concise, educational, and developer-friendly debug hint in 2-3 sentences.
Do NOT reveal the exact correct property/value combinations (e.g. do not say "select column-reverse"). 
Instead, describe the behavior of their current settings compared to the goal, and point them to the specific properties they need to adjust to solve the constraints.
"""
        
        # Instantiate LLM using the unified factory
        llm = get_llm(
            provider=data.provider,
            model=data.model,
            temperature=0.7,
            api_key=data.api_key
        )
        
        response = await llm.ainvoke([HumanMessage(content=prompt_text)])
        hint_content = response.content
        
        # Clean response if returning content list from some providers
        if isinstance(hint_content, list):
            hint_content = "".join([part.get("text", "") if isinstance(part, dict) else str(part) for part in hint_content])
            
        return {"hint": str(hint_content).strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Provider execution error: {str(e)}")
