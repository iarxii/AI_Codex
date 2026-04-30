import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from dotenv import load_dotenv

# Explicitly load .env relative to this file
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

class Settings(BaseSettings):
    PROJECT_NAME: str = "AICodex"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api"
    
    # Auth
    SECRET_KEY: str  # Required - no default for security
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week
    
    # Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    DEFAULT_MODEL: str = "llama3.2:3b"
    
    # Database
    DB_TYPE: str = "sqlite" # "sqlite" or "postgres"
    EMBEDDING_DIM: int = 384 # Default for all-minilm
    SEED_ADMIN: bool = False
    # CORS
    CORS_ORIGINS: str = "*" # CSV of allowed origins
    
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: str = "5432"
    POSTGRES_DB: str = "aicodex"
    DATABASE_URL: str = "" # Set via env or constructed
    
    # GCS Persistence (for SQLite on Cloud Run)
    GCS_BUCKET_NAME: str = "aicodex-data-1096425756328"
    DATABASE_FILE: str = "data/aicodex.db"
    
    # Skills & Sandbox
    ALLOWED_COMMANDS: str = "git,python,pip,node,npm,dir,type,cat,ls"
    MAX_EXECUTION_TIME: int = 30
    
    # GitHub
    GITHUB_PAT: str = ""
    
    # OllamaOpt Integration
    OLLAMAOPT_PATH: str = "../../OllamaOpt"
    
    model_config = SettingsConfigDict(
        env_file=env_path,
        env_file_encoding='utf-8',
        extra="ignore"
    )

    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        if self.DB_TYPE == "sqlite":
            return f"sqlite+aiosqlite:///./{self.DATABASE_FILE}"
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()

# Ensure data directory exists
DATA_DIR = Path("./data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR = DATA_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
