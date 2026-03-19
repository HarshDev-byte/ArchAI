from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    environment: str = "development"
    secret_key: str = "changeme"
    app_url: str = "http://localhost:3000"

    # AI
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-4-6"

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"

    # Database (direct Postgres, optional)
    database_url: str = "sqlite:///./designai.db"

    # Storage
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    s3_bucket_name: str = "designai-exports"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
