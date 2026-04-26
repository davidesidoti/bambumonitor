from __future__ import annotations

from functools import lru_cache
from pathlib import Path

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
    ustreamer_url: str = "http://127.0.0.1:9999"

    telemetry_interval_seconds: int = 10
    ws_heartbeat_interval_seconds: int = 30

    # Paths used by the settings tab. Defaults match the production layout
    # described in deploy/. Tests override via env vars.
    repo_root: Path = Path("/opt/bambu-monitor")
    env_file_path: Path = Path("/etc/bambu-monitor.env")
    ustreamer_dropin_path: Path = Path(
        "/etc/systemd/system/ustreamer.service.d/override.conf"
    )
    update_script_path: Path = Path("/opt/bambu-monitor/deploy/scripts/update.sh")

    # Send-print feature.
    jobs_dir: Path = Path("/var/lib/bambu-monitor/jobs")
    jobs_max_upload_mb: int = 800
    jobs_ttl_minutes: int = 360
    printer_ftps_port: int = 990
    printer_ftps_user: str = "bblp"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
