"""Settings tab endpoints: app config, webcam (ustreamer drop-in), version, update."""

from __future__ import annotations

import subprocess
import tomllib
from collections.abc import AsyncIterator
from functools import lru_cache
from ipaddress import ip_address
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from app.config import get_settings
from app.services import system_actions
from app.services.env_writer import parse_env_file, write_env_file
from app.services.ustreamer_dropin import (
    WebcamSettings,
    parse_dropin,
    render_dropin,
    write_dropin,
)
from app.utils.logging import get_logger

log = get_logger(__name__)
router = APIRouter()

ACCESS_CODE_MASK = "********"


# -- Pydantic models ----------------------------------------------------------


class AppSettingsRead(BaseModel):
    printer_ip: str
    printer_serial: str
    printer_access_code: str  # always returned masked
    log_level: str
    dev_mode: bool
    ustreamer_url: str
    telemetry_interval_seconds: int
    ws_heartbeat_interval_seconds: int


class AppSettingsWrite(BaseModel):
    printer_ip: str
    printer_serial: str = Field(min_length=14, max_length=14)
    printer_access_code: str  # may be ACCESS_CODE_MASK to keep current
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"]
    dev_mode: bool
    ustreamer_url: str
    telemetry_interval_seconds: Annotated[int, Field(ge=1, le=300)]
    ws_heartbeat_interval_seconds: Annotated[int, Field(ge=5, le=300)]

    @field_validator("printer_ip")
    @classmethod
    def _ip(cls, v: str) -> str:
        try:
            ip_address(v)
        except ValueError as e:
            raise ValueError("must be a valid IP address") from e
        return v

    @field_validator("printer_serial")
    @classmethod
    def _serial(cls, v: str) -> str:
        if not v.isalnum():
            raise ValueError("serial must be alphanumeric")
        return v.upper()

    @field_validator("printer_access_code")
    @classmethod
    def _access_code(cls, v: str) -> str:
        if v == ACCESS_CODE_MASK:
            return v
        if not (v.isdigit() and len(v) == 8):
            raise ValueError("access code must be 8 digits")
        return v


class WebcamSettingsModel(BaseModel):
    device: str = Field(pattern=r"^/dev/video\d+$")
    resolution: str = Field(pattern=r"^\d{3,4}x\d{3,4}$")
    desired_fps: Annotated[int, Field(ge=1, le=60)]
    host: str
    port: Annotated[int, Field(ge=1, le=65535)]
    drop_same_frames: Annotated[int, Field(ge=0, le=30)]
    exposure: Annotated[int, Field(ge=1, le=10000)]
    gain: Annotated[int, Field(ge=0, le=100)]
    contrast: Annotated[int, Field(ge=0, le=255)]
    brightness: Annotated[int, Field(ge=0, le=255)]


class VersionInfo(BaseModel):
    version: str
    git_sha: str
    branch: str


# -- /app ---------------------------------------------------------------------


_ENV_KEYS = (
    "PRINTER_IP",
    "PRINTER_SERIAL",
    "PRINTER_ACCESS_CODE",
    "LOG_LEVEL",
    "DEV_MODE",
    "USTREAMER_URL",
    "TELEMETRY_INTERVAL_SECONDS",
    "WS_HEARTBEAT_INTERVAL_SECONDS",
)


@router.get("/settings/app", response_model=AppSettingsRead, tags=["settings"])
async def get_app_settings() -> AppSettingsRead:
    cfg = get_settings()
    raw = parse_env_file(cfg.env_file_path)
    # Fall back to live process settings for any keys missing from the file.
    return AppSettingsRead(
        printer_ip=raw.get("PRINTER_IP", cfg.printer_ip),
        printer_serial=raw.get("PRINTER_SERIAL", cfg.printer_serial),
        printer_access_code=ACCESS_CODE_MASK,
        log_level=raw.get("LOG_LEVEL", cfg.log_level),
        dev_mode=_parse_bool(raw.get("DEV_MODE"), cfg.dev_mode),
        ustreamer_url=raw.get("USTREAMER_URL", cfg.ustreamer_url),
        telemetry_interval_seconds=int(
            raw.get("TELEMETRY_INTERVAL_SECONDS", cfg.telemetry_interval_seconds)
        ),
        ws_heartbeat_interval_seconds=int(
            raw.get(
                "WS_HEARTBEAT_INTERVAL_SECONDS", cfg.ws_heartbeat_interval_seconds
            )
        ),
    )


@router.put("/settings/app", tags=["settings"])
async def put_app_settings(body: AppSettingsWrite) -> dict[str, bool]:
    cfg = get_settings()
    updates: dict[str, str] = {
        "PRINTER_IP": body.printer_ip,
        "PRINTER_SERIAL": body.printer_serial,
        "LOG_LEVEL": body.log_level,
        "DEV_MODE": "true" if body.dev_mode else "false",
        "USTREAMER_URL": body.ustreamer_url,
        "TELEMETRY_INTERVAL_SECONDS": str(body.telemetry_interval_seconds),
        "WS_HEARTBEAT_INTERVAL_SECONDS": str(body.ws_heartbeat_interval_seconds),
    }
    if body.printer_access_code != ACCESS_CODE_MASK:
        updates["PRINTER_ACCESS_CODE"] = body.printer_access_code

    try:
        write_env_file(cfg.env_file_path, updates)
    except PermissionError as e:
        log.error("settings.app.write_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e

    await system_actions.schedule_restart("bambu-monitor.service", delay_seconds=1.0)
    return {"restart_scheduled": True}


# -- /webcam ------------------------------------------------------------------


@router.get("/settings/webcam", response_model=WebcamSettingsModel, tags=["settings"])
async def get_webcam_settings() -> WebcamSettingsModel:
    cfg = get_settings()
    parsed = parse_dropin(cfg.ustreamer_dropin_path)
    return WebcamSettingsModel(**parsed.__dict__)


@router.put("/settings/webcam", tags=["settings"])
async def put_webcam_settings(body: WebcamSettingsModel) -> dict[str, bool]:
    cfg = get_settings()
    settings = WebcamSettings(**body.model_dump())
    content = render_dropin(settings)
    try:
        write_dropin(cfg.ustreamer_dropin_path, content)
        system_actions.daemon_reload()
        system_actions.restart_service("ustreamer.service")
    except PermissionError as e:
        log.error("settings.webcam.write_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e
    return {"restarted": True}


# -- /version -----------------------------------------------------------------


@lru_cache(maxsize=1)
def _read_version() -> VersionInfo:
    # backend/app/api/settings.py -> backend/pyproject.toml
    pyproject = Path(__file__).resolve().parents[2] / "pyproject.toml"
    version = "unknown"
    if pyproject.exists():
        with pyproject.open("rb") as f:
            data = tomllib.load(f)
        version = str(data.get("project", {}).get("version", "unknown"))
    sha = _git("rev-parse", "--short", "HEAD") or "unknown"
    branch = _git("rev-parse", "--abbrev-ref", "HEAD") or "unknown"
    return VersionInfo(version=version, git_sha=sha, branch=branch)


def get_version() -> VersionInfo:
    return _read_version()


@router.get("/settings/version", response_model=VersionInfo, tags=["settings"])
async def get_version_endpoint() -> VersionInfo:
    return get_version()


# -- /update/stream -----------------------------------------------------------


@router.get("/settings/update/stream", tags=["settings"])
async def update_stream() -> StreamingResponse:
    cfg = get_settings()
    if system_actions.update_lock_held():
        raise HTTPException(status_code=409, detail="update already in progress")
    if not cfg.update_script_path.exists():
        raise HTTPException(
            status_code=500, detail=f"update script missing: {cfg.update_script_path}"
        )

    async def event_stream() -> AsyncIterator[bytes]:
        try:
            async for line in system_actions.run_update_streaming(cfg.update_script_path):
                if line.startswith("__exit__:"):
                    rc = line.split(":", 1)[1]
                    yield f"event: done\ndata: {rc}\n\n".encode()
                else:
                    yield _sse("log", line)
        except RuntimeError as e:
            yield _sse("error", str(e))
            yield b"event: done\ndata: -1\n\n"
        except Exception as e:  # pragma: no cover
            log.error("settings.update.stream_failed", error=str(e))
            yield _sse("error", str(e))
            yield b"event: done\ndata: -1\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# -- helpers ------------------------------------------------------------------


def _sse(event: str, data: str) -> bytes:
    # Multi-line data must be prefixed per line per the SSE spec.
    payload = "\n".join(f"data: {ln}" for ln in data.splitlines() or [""])
    return f"event: {event}\n{payload}\n\n".encode()


def _parse_bool(raw: str | None, default: bool) -> bool:
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _git(*args: str) -> str | None:
    cfg = get_settings()
    repo = cfg.repo_root if cfg.repo_root.exists() else Path(__file__).resolve().parents[3]
    try:
        out = subprocess.run(
            ["git", "-C", str(repo), *args],
            capture_output=True,
            text=True,
            check=False,
            timeout=2,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if out.returncode != 0:
        return None
    return out.stdout.strip() or None


