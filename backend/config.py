import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):
    PROJECT_NAME: str = "AICodex"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api"
    
    # Auth
    SECRET_KEY: str = "CHANGEME_SUPER_SECRET"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week
    
    # Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    DEFAULT_MODEL: str = "llama3.2:3b"
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/aicodex.db"
    
    # Skills & Sandbox
    ALLOWED_COMMANDS: str = "git,python,pip,node,npm,dir,type,cat,ls"
    MAX_EXECUTION_TIME: int = 30
    
    # GitHub
    GITHUB_PAT: str = ""
    
    # OllamaOpt Integration
    OLLAMAOPT_PATH: str = "../../OllamaOpt"
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

# Ensure data directory exists
DATA_DIR = Path("./data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR = DATA_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
