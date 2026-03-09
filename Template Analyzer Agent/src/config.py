from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os

# Load .env from agent root (parent of src) so it works when running from any cwd
_agent_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_agent_root, ".env"))

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")  # Draft_DB
    AUTH_DATABASE_URL: str = os.getenv("AUTH_DATABASE_URL", "")  # Auth_DB for role check (super_admins, admin_roles, users)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    # Gemini model: use gemini-2.5-pro (default) or gemini-3-pro-preview for latest Pro
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
    GCS_KEY_BASE64: str = os.getenv("GCS_KEY_BASE64", "")
    DOCUMENT_AI_LOCATION: str = os.getenv("DOCUMENT_AI_LOCATION", "")
    DOCUMENT_AI_PROCESSOR_ID: str = os.getenv("DOCUMENT_AI_PROCESSOR_ID", "")
    DOCUMENT_AI_OCR_PROCESSOR_VERSION_ID: str = os.getenv("DOCUMENT_AI_OCR_PROCESSOR_VERSION_ID", "")
    GCLOUD_PROJECT_ID: str = os.getenv("GCLOUD_PROJECT_ID", "")
    GCS_INPUT_BUCKET_NAME: str = os.getenv("GCS_INPUT_BUCKET_NAME", "")
    GCS_OUTPUT_BUCKET_NAME: str = os.getenv("GCS_OUTPUT_BUCKET_NAME", "")
    GCS_BUCKET_NAME: str = os.getenv("GCS_BUCKET_NAME", "draft_templates")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "")  # Same as Node backend for token verification

    @property
    def GCS_IMAGE_BUCKET_NAME(self) -> str:
        return self.GCS_BUCKET_NAME

    model_config = {"env_file": ".env", "extra": "ignore"}

settings = Settings()
