# Spirit Bird MCP Local Dev Tooling Strategy

## Overview
This document outlines the architecture and implementation roadmap for the Model Context Protocol (MCP) servers designed to enhance the local development experience within the Spirit Bird Platform. The primary goal is to leverage Gemma 4's Multi-Token Prediction (MTP) capabilities to provide high-speed, context-aware coding assistance.

## Proposed MCP Servers (Phase 1: Local Dev)

### 1. Git Intelligence Server (`git-mcp`)
**Purpose:** Automate commit message generation and branch management.
- **Feature:** `generate_commit_message` - Analyzes `git diff` and predicts a Conventional Commit message.
- **Feature:** `summarize_branch_changes` - Provides a high-level summary of changes between the current branch and main.

### 2. Python Productivity Server (`py-mcp`)
**Purpose:** Deep Python code completion and structural analysis.
- **Feature:** `predict_next_block` - Uses MTP to suggest the next logical block of code (e.g., a `try-except` block after a risky operation).
- **Feature:** `generate_pytest_stubs` - Creates boilerplate test files based on analyzed source functions.

### 3. SQL Schema Server (`sql-mcp`)
**Purpose:** Bridge the gap between database schemas and application code.
- **Feature:** `get_schema_context` - Injects current table definitions into the LLM context window for accurate query generation.
- **Feature:** `predict_join_path` - Suggests the most likely JOIN sequence based on foreign key relationships.

## Implementation Standards
- **Language:** TypeScript / Node.js
- **Protocol:** Model Context Protocol (MCP)
- **Testing:** Mandatory unit tests using `jest` or `vitest`.
- **Deployment:** Local execution via `npm start` or Docker containers.

## Roadmap
1. [ ] Implement `git-mcp` (High Value, Low Complexity)
2. [ ] Implement `py-mcp` (Medium Complexity)
3. [ ] Implement `sql-mcp` (Medium Complexity)
