from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://archai_user:archai_pass@localhost:5432/archai"
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    
    # AI API Keys
    ANTHROPIC_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    NREL_API_KEY: str = ""
    
    # Maps & Geo
    MAPBOX_TOKEN: str = ""
    
    # Security
    JWT_SECRET: str = "your-secret-key"
    
    # Environment
    ENVIRONMENT: str = "development"
    
    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Blender
    BLENDER_PATH: str = "/usr/bin/blender"
    BLENDER_SCRIPTS_PATH: str = "./blender"
    
    # Redis (Upstash or local)
    REDIS_URL: str = "redis://localhost:6379"
    
    # Generation Configuration
    MAX_DESIGN_VARIANTS: int = 5
    EVOLUTION_GENERATIONS: int = 3
    ENABLE_VR: bool = True
    
    # API URLs
    NEXT_PUBLIC_API_URL: str = "http://localhost:8000"
    
    class Config:
        env_file = ".env"


settings = Settings()