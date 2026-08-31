import os
import sys
from pathlib import Path

# Add the project root and backend to path so we can import modules
project_root = Path(__file__).resolve().parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

# Load dotenv to get current env variables (including our new GCP ones)
from dotenv import load_dotenv
load_dotenv(dotenv_path=project_root / "backend" / ".env")

from codex_spaces.backend.agent.genai_llm import get_code_lab_llm
from codex_spaces.backend.agent.space_config import get_space_config

def main():
    print("--- Testing Space Configs ---")
    for space in ["code-lab", "health-tech"]:
        cfg = get_space_config(space)
        print(f"Space '{space}': provider={cfg.get('recommended_provider')}, model={cfg.get('recommended_model')}")

    print("\n--- Testing Factory Instantiation ---")
    print(f"GCP_PROJECT_ID: {os.getenv('GCP_PROJECT_ID')}")
    print(f"GCP_REGION: {os.getenv('GCP_REGION')}")

    try:
        # Note: If no ADC is locally set up, this might raise a DefaultCredentialsError or similar from google-auth.
        # But we want to test if the get_code_lab_llm routing matches provider='vertex' properly.
        llm = get_code_lab_llm(
            provider="vertex",
            model="gemini-3.1-pro",
            api_key=None
        )
        print("Success! Created vertex LLM wrapper.")
        print(f"Client project: {llm._client.vertex_project if hasattr(llm._client, 'vertex_project') else 'N/A'}")
        print(f"Client location: {llm._client.vertex_location if hasattr(llm._client, 'vertex_location') else 'N/A'}")
    except Exception as e:
        print(f"Vertex initialization raised (expected if credentials missing/etc): {e}")

    try:
        llm_google = get_code_lab_llm(
            provider="google",
            model="gemini-3.1-pro",
            api_key="fake-api-key"
        )
        print("Success! Created google LLM wrapper with api_key.")
    except Exception as e:
        print(f"Google initialization raised: {e}")

if __name__ == "__main__":
    main()
