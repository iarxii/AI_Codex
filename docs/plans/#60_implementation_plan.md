# Integration Roadmap: Google Agent Platform (Vertex AI) for CodexSpaces

This roadmap details the integration of the Gemini Enterprise Agent Platform (Vertex AI) into the AI_Codex CodexSpaces (specifically Gemma Code Lab and Health Tech spaces) using Google Cloud Application Default Credentials (ADC) with strict authentication rules.

## User Review Required

> [!IMPORTANT]
> - **GCP Auth Strategy**: We will enforce **strict ADC** (`vertexai=True`) without fallback to API keys for the `"vertex"` cloud provider.
> - **GCP Configuration**: 
>   - Project: `aicodex-lab`
>   - Region: `us-central1` (corresponds to US Central region)
> - **Migration**: Gemma Code Lab and Health Tech (MedGemma Soft Lab) spaces will migrate fully from `ollama_cloud` to Google's Enterprise Agent Platform (`vertex` provider).

## Proposed Changes

### Configuration & Auth (Environment)

To integrate Vertex AI using GCP Auth, we will rely on Application Default Credentials (ADC).

#### [MODIFY] `.env`
- **Action**: Add Vertex AI specific environment variables.
- **Variables**:
  - `GCP_PROJECT_ID=aicodex-lab`
  - `GCP_REGION=us-central1`

---

### Backend (Python)

We will revise the native `google-genai` SDK wrapper in `genai_llm.py` and space configurations in `space_config.py` to support Vertex AI initialization using ADC.

#### [MODIFY] [genai_llm.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/codex_spaces/backend/agent/genai_llm.py)
- **Action**: Update `GemmaCodeLabLLM.__init__` to accept `vertexai`, `project`, and `location` parameters.
- **Action**: Initialize `genai.Client(vertexai=True, project=project, location=location)` when `vertexai=True` is enabled. Do not require or allow `api_key` passing under this configuration.
- **Action**: Update `get_code_lab_llm` factory to route `provider == "vertex"` requests with `vertexai=True` and omit `api_key` validation.

#### [MODIFY] [space_config.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/codex_spaces/backend/agent/space_config.py)
- **Action**: Revise `code-lab` and `health-tech` space definitions.
- **Changes**:
  - Change `recommended_provider` to `"vertex"`.
  - Update `recommended_model` for `code-lab` to `"gemini-3.1-pro"` (or `"gemma-4-26b-a4b-it"` if available in `aicodex-lab`).
  - Update `recommended_model` for `health-tech` to `"gemini-3.1-pro"`.

---

## Verification Plan

### Automated Tests
- Verify Pydantic structured output streaming compatibility with the Vertex AI backend.
- Run unit tests for `get_code_lab_llm` factory to ensure it creates a Vertex-enabled client when `provider="vertex"`.

### Manual Verification
1. Run local environment verification: ensure ADC credentials are valid.
2. Spin up CodexSpaces backend with the revised config.
3. Initiate chats inside both `Gemma Code Lab` and `Health Tech` spaces to verify Vertex-routed inference succeeds.
