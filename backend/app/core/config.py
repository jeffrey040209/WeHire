from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "WeHire API"
    database_url: SecretStr | None = None
    cors_origins: list[str] = ["http://localhost:3012"]

    bootstrap_token: SecretStr | None = None

    auth_cookie_secure: bool = True
    auth_session_seconds: int = Field(default=28800, ge=300, le=604800)
    auth_login_window_seconds: int = Field(default=300, ge=30, le=3600)
    auth_login_account_limit: int = Field(default=5, ge=1, le=100)
    auth_login_ip_limit: int = Field(default=30, ge=1, le=1000)

    auth_register_window_seconds: int = Field(default=3600, ge=60, le=86400)
    auth_register_email_limit: int = Field(default=3, ge=1, le=100)
    auth_register_ip_limit: int = Field(default=10, ge=1, le=1000)

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[3] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
