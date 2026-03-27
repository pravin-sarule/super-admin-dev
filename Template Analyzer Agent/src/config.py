from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os

# Load .env from agent root first, then fall back to Backend/.env for shared local config.
_agent_root = Path(__file__).resolve().parent.parent
_backend_root = _agent_root.parent / "Backend"

load_dotenv(_agent_root / ".env")
load_dotenv(_backend_root / ".env", override=False)

class Settings(BaseSettings):
    DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL") or os.getenv("DRAFT_DB_URL")  # Draft_DB
    AUTH_DATABASE_URL: str = os.getenv("AUTH_DATABASE_URL", "")  # Auth_DB for role check (super_admins, admin_roles, users)
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")
    # Gemini model: use gemini-2.5-pro (default) or gemini-3-pro-preview for latest Pro
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
    ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
    ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")
    DEFAULT_LLM_PROVIDER: str = os.getenv("DEFAULT_LLM_PROVIDER", "claude")
    SECTION_EXTRACTION_PROVIDER: str = os.getenv("SECTION_EXTRACTION_PROVIDER", os.getenv("DEFAULT_LLM_PROVIDER", "claude"))
    PROMPT_REFINEMENT_PROVIDER: str = os.getenv("PROMPT_REFINEMENT_PROVIDER", os.getenv("DEFAULT_LLM_PROVIDER", "claude"))
    TEXT_GENERATION_PROVIDER: str = os.getenv("TEXT_GENERATION_PROVIDER", os.getenv("DEFAULT_LLM_PROVIDER", "claude"))
    VALIDATION_PROVIDER: str = os.getenv("VALIDATION_PROVIDER", os.getenv("DEFAULT_LLM_PROVIDER", "claude"))
    GCS_KEY_BASE64: Optional[str] = os.getenv("GCS_KEY_BASE64")
    DOCUMENT_AI_LOCATION: str = os.getenv("DOCUMENT_AI_LOCATION", "us")
    DOCUMENT_AI_PROCESSOR_ID: Optional[str] = os.getenv("DOCUMENT_AI_PROCESSOR_ID")
    DOCUMENT_AI_OCR_PROCESSOR_VERSION_ID: Optional[str] = os.getenv("DOCUMENT_AI_OCR_PROCESSOR_VERSION_ID")
    GCLOUD_PROJECT_ID: Optional[str] = os.getenv("GCLOUD_PROJECT_ID") or os.getenv("GCS_PROJECT_ID")
    GCS_INPUT_BUCKET_NAME: Optional[str] = os.getenv("GCS_INPUT_BUCKET_NAME") or os.getenv("GCS_BUCKET_NAME")
    GCS_OUTPUT_BUCKET_NAME: Optional[str] = os.getenv("GCS_OUTPUT_BUCKET_NAME") or os.getenv("GCS_BUCKET_NAME")
    GCS_BUCKET_NAME: str = os.getenv("GCS_BUCKET_NAME", "draft_templates")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "")  # Same as Node backend for token verification
    
    @property
    def GCS_IMAGE_BUCKET_NAME(self) -> str:
        return self.GCS_BUCKET_NAME

    class Config:
        env_file = ".env"

settings = Settings()
