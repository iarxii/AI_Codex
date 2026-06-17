# Goal: Token Usage and Provider Fallback CLI Test Tool

Implement a command-line interface (CLI) tool and telemetry enhancements to measure, trigger, and log LLM token usage and dynamic provider switching behaviors.

---

## User Review Required

> [!IMPORTANT]
> The CLI tool will log detailed token usage and provider switching history to the local filesystem at `logs/token_switching_test.log`.
> We will enhance the LangGraph agent state (`telemetry` dictionary) to track provider attempts and estimated token consumption, making these metrics fully observable.

---

## Compute Resource Efficiency Guidelines

To minimize CPU, RAM, and database overhead:
1. **Lightweight Token Estimation**: Utilize simple character-based heuristics (`estimate_tokens` from `telemetry.py`) to count tokens, avoiding the overhead of loading heavy tokenizers (e.g. tiktoken/transformers).
2. **Direct Graph Invocations**: Execute a single turn of the reasoning graph directly in isolation, bypassing FastAPI web server initialization and heavy database pooling.
3. **Flat File Logs**: Use standard file-append operations for writing metrics, eliminating database transaction and connection overhead.

---

## Proposed Changes

### Component: Backend Agent & Telemetry

#### [MODIFY] [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)
- Calculate and record estimated input token counts (prompt, system prompt, and context history) and output token counts (response content) in `telemetry["tokens"]`.
- Record provider attempts (e.g., `telemetry["provider_attempts"] = ["groq (failed)", "gemini (success)"]`) inside the return state of `reason_node` so callers can track fallback sequences.

#### [NEW] [token_test_cli.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/utils/token_test_cli.py)
- Create a Python CLI tool using `argparse`.
- Accept arguments:
  * `--primary` (e.g. `groq` or `gemini`)
  * `--model` (e.g. `llama3-8b-8192` or default)
  * `--simulate-error` (simulate a rate limit/429 error on the primary provider to trigger fallback)
  * `--prompt` (custom testing prompt)
- Execute a reasoning agent loop, capture the return state (including token usage and provider attempts), and display a formatted report in the terminal.
- Append a JSON or CSV structured entry to `logs/token_switching_test.log` for future analysis.

---

## Verification Plan

### Automated Tests
- Run the CLI tool under normal operation:
  `python backend/utils/token_test_cli.py --primary gemini --prompt "What is 2+2?"`
- Run the CLI tool with simulated rate limits:
  `python backend/utils/token_test_cli.py --primary groq --simulate-error --prompt "Write a short poem."`
- Verify that `logs/token_switching_test.log` contains detailed records of the token counts, latencies, and switches.
