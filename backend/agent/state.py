from typing import Annotated, List, Optional, TypedDict
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

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
    scratchpad: Optional[dict]

    # --- Extended ReAct Loop State ---
    task_goal: Optional[str]                         # The ultimate objective
    execution_artifacts: Optional[dict]              # Records of changes (e.g. modified files)
    evaluation_report: Optional[dict]                # Results from evaluate_turn node
    recent_actions_fingerprint: Optional[List[str]]  # History of tool calls for stagnation detection
    
    # --- Token Allocation Metrics ---
    token_metrics: Optional[dict]                    # {system, summary, tail, total, max}
    
    # --- Self-Correction & Quality Tracking ---
    quality_history: Optional[List[float]]           # Rolling log of quality scores (0.0 - 1.0)
    consideration_vector: Optional[dict]             # Directives for reasoning constraint
    
    # --- Short-Process (Bypass) Routing ---
    is_short_process: Optional[bool]                 # Tracks if this is a short-circuit conversational run
