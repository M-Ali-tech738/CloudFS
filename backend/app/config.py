from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Google OAuth
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str = "http://localhost:8000/auth/google/callback"

    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24

    # Token encryption (AES-256 key as 64-char hex string)
    token_encryption_key: str

    # Database
    database_url: str = "postgresql+asyncpg://cloudfs:cloudfs_dev@localhost:5432/cloudfs"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # App
    frontend_url: str = "http://localhost:3000"
    environment: str = "development"
    max_upload_bytes: int = 104_857_600  # 100 MB

    @property
    def is_production(self) -> bool:
        return self.environment == "production"
    
    @property
    def cors_origins(self) -> list[str]:
        """Get all allowed CORS origins based on environment"""
        origins = ["http://localhost:3000"]
        
        if self.frontend_url and self.frontend_url not in origins:
            origins.append(self.frontend_url)
        
        if self.is_production:
            # Add common production URLs
            origins.extend([
                "https://cloud-fs-xi.vercel.app",
                "https://cloud-fs-xi.vercel.app/",
            ])
        
        # Remove duplicates while preserving order
        seen = set()
        return [x for x in origins if not (x in seen or seen.add(x))]


@lru_cache
def get_settings() -> Settings:
    return Settings()
