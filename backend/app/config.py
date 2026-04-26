from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Process configuration loaded from environment / .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    printer_ip: str = "192.168.1.100"
    printer_serial: str = "00000000000000"
    printer_access_code: str = "00000000"

    database_url: str = "sqlite+aiosqlite:///./bambu.db"

    log_level: str = "INFO"
    dev_mode: bool = True

    ws_path: str = "/ws"
    ustreamer_url: str = "http://127.0.0.1:8080"

    telemetry_interval_seconds: int = 10
    ws_heartbeat_interval_seconds: int = 30


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
