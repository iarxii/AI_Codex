from typing import Annotated, List, Optional, TypedDict, Literal
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field


class AgentScratchpad(BaseModel):
    """Structured scratchpad for ReSum context compression."""
    active_goal: str = Field(default="", description="Primary objective")
    completed_steps: list[str] = Field(default_factory=list, description="Completed tasks")
    current_blocker: str = Field(default="None", description="Current error or blocker")
    next_action: str = Field(default="", description="Next planned step")


class AgentState(TypedDict):
    """
    Represents the state of the AICodex agentic loop.
    """
    # The conversation history
    messages: Annotated[List[BaseMessage], add_messages]
    
    # Active tool calls (for UI rendering)
    current_tool_calls: List[dict]
    
    # Assembled context from RAG/Memory (from OllamaOpt)
    context_data: dict
    
    # Hardware routing info (NPU/GPU/CPU)
    routing_decision: dict
    
    # Final answer flag
    is_complete: bool
    
    # Error state if any
    error: Optional[str]
    
    # Model Telemetry & Capability Data
    telemetry: dict
    
    # Codex Space configuration parameters
    space_config: dict
    
    # Optional domain-specific states
    trading_context: Optional[dict]
    
    # Client-injected workspace data and semantic context
    
    # Flag to control Tutor block inclusion in final report
    include_tutor: bool
    
    # --- Context Engineering Fields (from research) ---
    sandboxed_vars: dict[str, str]          # [Technique 1] Environmental Sandboxing
    scratchpad: dict                        # [Technique 3] Structured Scratchpad (ReSum)
    phase: str                              # [Technique 4] Phase for Dynamic Tool Binding: DISCOVERY | EXECUTION

    # --- Extended ReAct Loop State ---
    task_goal: Optional[str]                         # The ultimate objective
    execution_artifacts: Optional[dict]              # Records of changes (e.g. modified files)
    evaluation_report: Optional[dict]                # Results from evaluate_turn node
    recent_actions_fingerprint: Optional[List[str]]  # History of tool calls for stagnation detection
    no_tool_stall_count: Optional[int]                # Consecutive long-process turns without tool calls
    guard_blocked: Optional[bool]                     # Guard detected a hard stop condition
    
    # --- Token Allocation Metrics ---
    token_metrics: Optional[dict]                    # {system, summary, tail, total, max}
    
    # --- Self-Correction & Quality Tracking ---
    quality_history: Optional[List[float]]           # Rolling log of quality scores (0.0 - 1.0)
    consideration_vector: Optional[dict]             # Directives for reasoning constraint
    
    # --- Short-Process (Bypass) Routing ---
    is_short_process: Optional[bool]                 # Tracks if this is a short-circuit conversational run
    raw_prompt: Optional[str]                         # User intent before workspace/context enrichment
    routing_metadata: Optional[dict]                  # Structured classification and promotion metadata

    # --- Client Context ---
    client_type: Optional[str]                       # Identifier for the client (web, vscode, aidock, android)
    context: Optional[dict]                           # Model context kept separate from raw user intent

    # --- Tutor Block Control ---
    include_tutor: Optional[bool]                     # Flag to conditionally include the [TUTOR] block in final report
