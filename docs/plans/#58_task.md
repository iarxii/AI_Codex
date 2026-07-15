# Task: Standardizing Ollama Cloud Integration

## VS Code Extension Updates

- `[x]` Modify `CodexRequest` interface in `vscode-extension/src/api/types.ts` to include optional `base_url`
- `[x]` Modify `SpiritBirdClient` constructor in `vscode-extension/src/api/client.ts` to accept `ollamaCloudUrl?: string`
- `[x]` Modify `postCodegen` in `vscode-extension/src/api/client.ts` to inject `base_url` into the POST body payload
- `[x]` Update `extension.ts` construction of `SpiritBirdClient` at both call sites to pass `ollamaCloudUrl` from workspace config

## Backend API & Agent Updates

- `[x]` Modify `CodegenRequest` in `codex_spaces/backend/api/spaces.py` to accept optional `base_url`
- `[x]` Fix API key hijacking in `spaces.py` for `ollama_cloud` provider by defaulting the API key to `sk-ollama`
- `[x]` Pass `base_url` to `get_code_lab_llm` and `run_code_lab` in `spaces.py`
- `[x]` Modify `run_code_lab` in `code_lab_agent.py` to accept and pass `base_url`
- `[x]` Modify `get_code_lab_llm` and `LangChainCodeLabLLM` in `genai_llm.py` to accept and pass `base_url`
- `[x]` Modify `get_llm` and `get_llm_for_tier` in `backend/agent/models.py` to accept and handle `base_url`
- `[x]` Add logger.info logging for `ollama_cloud` initialization in `models.py` and `nodes.py`

## Verification

- `[x]` Run typescript compile on vscode-extension to check for compile errors
- `[x]` Run python compile/check on backend files
- `[x]` Verify end-to-end routing of SCM git commit message generator
