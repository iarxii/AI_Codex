# 🛡️ Core Directive: Agentic Self-Testing & Orchestration

> **Target:** All Autonomous Agents & Neural Cores
> **Context:** You are tasked with developing and orchestrating Cloud Backend and Node.js functions. 
> **Critical Failure to Avoid:** The "Confirmation Loop" / "Happy Path" Trap. Do not write code and immediately report success without executing physical validation.

As an autonomous agent, your primary value is not just writing code, but **validating that the code actually works in the user's physical environment**. You must use your available tool calls to execute, test, and verify your changes before returning a success state.

Follow these strict orchestration rules for all future Node.js and Cloud Backend tasks:

## 1. Mandatory Tool-Based Verification
You are explicitly forbidden from outputting `[GOAL_REACHED]` or providing a summary until you have physically executed the code using your terminal/command tools and observed a successful exit code and expected standard output. 
- **Terminology Note:** Do NOT refer to your final summary as a "Post-Mortem" (it makes the project sound dead). Use terms like "Execution Summary", "Validation Report", or "Deployment Status".
- **Do not assume:** Just because the code syntax is theoretically correct does not mean the ports are open, dependencies are installed, or the environment variables are set.
- **Prove it:** Run the script, ping the endpoint, or execute the test suite using your tools.

## 2. Test-Driven Execution
When writing a new Node.js function or cloud handler:
1. **Write the Function:** Implement the core logic with robust error handling (try/catch).
2. **Write the Verification Script:** Write a quick local execution script (e.g., `test_handler.js`) or a unit test (e.g., using Jest).
3. **Execute the Tool Call:** Run `node test_handler.js` using your terminal tool.
4. **Analyze the Output:** Read the `stdout` and `stderr` from your tool call.
5. **Iterate if Necessary:** If the command fails, analyze the stack trace, patch the file, and *run the tool call again*. 

## 3. Defensive Orchestration in Node.js
Your Node functions must be built for observability and resilience:
- **Environment Validation:** Fail fast. At the top of your backend scripts, explicitly check for required `.env` variables and throw an error immediately if they are missing.
- **Port Conflict Handling:** If starting an Express server, handle `EADDRINUSE` gracefully or implement dynamic port fallback during development.
- **Verbose Logging during Dev:** Ensure your functions log critical state transitions so your terminal tool calls can capture meaningful output for your own analysis.

## 4. The "Trust, but Verify" Workflow
Whenever you are asked to configure a backend service:
1. **Deploy/Start the Service** (e.g., `npm run dev` or `docker-compose up`).
2. **Poll for Readiness:** Do not use arbitrary `sleep` commands. Instead, poll the service until it answers successfully.
   - **Windows & Cross-Platform Safe Polling:** On Windows host environments, standard shell `curl` commands can be unreliable or behave differently due to PowerShell aliases. Prefer cross-platform inline Node.js or Python scripts:
     - *Node.js inline poll:* `node -e "const http = require('http'); const check = () => http.get('http://localhost:PORT/health', res => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1)); check();"`
     - *Python inline poll:* `python -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://localhost:PORT/health').getcode() == 200 else 1)"`
3. **Report:** Only summarize your work to the user *after* the polling tool call succeeds.

## 5. Model & Local Environment Optimizations
To ensure execution is optimal across both resource-constrained local models and remote neural cores:
- **Error Log Truncation:** Compilers and test runners (e.g., Jest or Pytest) can emit massive stdout/stderr logs on failure. Do not ingest the entire log; capture and analyze only the relevant tail (e.g., the last 30-50 lines) to avoid context window bloat and memory compaction limits.
- **Strict Exit Codes:** Ensure mock scripts, test harnesses, and validation scripts return explicit exit codes (`0` for success, non-zero for failure). This provides the agent with an unambiguous indicator of success rather than relying on textual analysis.
- **Windows Command Safety:** Since the developer host environment is **Windows**, avoid shell constructs like `&&` or `|` when calling tools unless using PowerShell syntax, or execute sequential commands as separate tool calls. Prefer Python/Node inline scripts for operations requiring redirection or complex piping.

## 6. Stagnation Guard and Blocker Signals
If you hit an unrecoverable compilation blocker, environmental constraint, or enter a repetitive execution loop:
- **Break Autonomy:** Cease repeating the same failing tool calls.
- **Emit Blocker Markers:** You must explicitly append **`[REQUEST_WALL]`** or **`AWAITING_USER:`** to your final output message when pausing execution. This acts as a handshake token to notify the client extension's SAR loop to stop iterating immediately, saving API token usage and yielding cleanly to the user.

**Acknowledge this directive.** Your next actions must demonstrate explicit tool-call testing of your generated backend code.
