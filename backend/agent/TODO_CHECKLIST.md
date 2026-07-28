# Implementation Plan: Enhance Final Report and Tutor Block Handling

## Overview
This document outlines the steps to improve the `final_report_node` in the backend to generate more detailed summaries and make the Tutor block conditional based on task complexity.

## Steps

### 1. Modify AgentState
   - [x] Add `include_tutor: bool = True` field to `AgentState` in `backend/agent/state.py` (or wherever the state is defined)
   - [x] Ensure the field is initialized in the agent's initial state

### 2. Update `final_report_node` in `backend/agent/nodes.py`
   - [x] Increase the context window for execution trail:
         - Change AIMessage truncation from 200 to 500 characters
         - Change ToolMessage truncation from 100 to 250 characters
         - OR implement a lightweight summarization step for long trails (if needed) <- hold off on this one for now
   - [x] Revise the `summary_prompt` to explicitly request:
         - Key decisions made during execution
         - Specific tools used and their outcomes
         - Quantitative metrics (files modified, lines changed, etc.)
         - Clear, actionable next steps with examples
   - [x] Make the Tutor block conditional:
         - If `state.get("include_tutor", True)` is True, include the Tutor section in the prompt
         - If False, omit the Tutor section instructions
   - [x] Adjust the response handling to not expect Tutor tags when `include_tutor` is False

### 3. Set `include_tutor` Flag Appropriately
   - [x] In `reason_node` or `evaluate_turn_node`, set `include_tutor` based on:
         - Task complexity (e.g., check if the task involves code explanation, architecture discussion, etc.)
         - User preferences (if available via configuration)
         - Presence of educational concepts in the execution trail
   - [x] For simple conversational queries (no tool use), set `include_tutor = False`
   - [x] For tasks involving code generation, modification, or architectural decisions, set `include_tutor = True`

### 4. Unit Tests
   - [x] Write unit tests for `final_report_node`:
         - Verify detailed summary is generated when `include_tutor=True`
         - Verify summary without Tutor block when `include_tutor=False`
         - Test edge cases (empty trail, very long histories)
   - [x] Test the logic for setting `include_tutor` in the relevant nodes

### 5. Documentation
   - [x] Update any relevant documentation (e.g., agent harness documentation) to reflect the new `include_tutor` flag and conditional Tutor block
   - [x] Update comments in `nodes.py` to explain the conditional logic

### 6. Integration Testing
   - [ ] Test end-to-end to ensure:
         - The vscode-extension correctly renders detailed summaries
         - Tutor block appears only when expected
         - No regression in existing Tutor block functionality for cases where it is still included

## Notes
- Backward Compatibility: Default `include_tutor=True` maintains current behavior unless explicitly overridden.
- Token Management: Be mindful of increased context window size; consider summarization if trails become too long.
- State Propagation: Ensure `include_tutor` is initialized in the agent's initial state and propagated correctly through all nodes.
