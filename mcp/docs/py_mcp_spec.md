# Python Productivity MCP Server (py-mcp)

## Overview
The `py-mcp` server provides advanced local development tools for Python projects. It focuses on accelerating the "Write-Test-Document" cycle by automating boilerplate and providing context-aware suggestions leveraging the Gemma 4 MTP capabilities.

## Core Features
1. **Docstring Generation**: Automatically generates PEP 257 compliant docstrings by analyzing function signatures and logic.
2. **Type Hint Injection**: Analyzes variable usage to suggest appropriate Python type hints (`typing` module).
3. **Unit Test Skeleton Generation**: Creates `pytest` or `unittest` skeletons based on the target function's logic.
4. **Refactor Suggestions**: Identifies "code smells" (e.g., overly long functions, deep nesting) and suggests Pythonic improvements.

## Technical Implementation
- **Parsing**: Uses `tree-sitter-python` for high-fidelity AST (Abstract Syntax Tree) traversal.
- **Inference**: Integrates with the Gemma 4 API to generate completions based on the extracted AST context.
- **Protocol**: Implements the Model Context Protocol (MCP) to expose these as tools to the LLM agent.

## Integration with Gemma 4 MTP
The server is designed to feed "prefix-context" (the code up to the docstring/test point) to the MTP model, allowing for ultra-fast speculative decoding of common Python patterns.
