from __future__ import annotations

from datetime import datetime

from sqlalchemy import Index
from sqlmodel import Field, SQLModel


class Print(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    file_name: str = Field(index=True)
    started_at: datetime = Field(index=True)
    ended_at: datetime | None = None
    status: str = Field(index=True)  # running | finished | failed | cancelled
    total_layers: int = 0
    duration_seconds: int | None = None
    filament_type: str | None = None
    filament_color: str | None = None
    filament_used_g: float | None = None
    notes: str | None = None


class TelemetryPoint(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    print_id: int = Field(foreign_key="print.id", index=True)
    timestamp: datetime
    nozzle_temp: float = 0.0
    nozzle_target: float = 0.0
    bed_temp: float = 0.0
    bed_target: float = 0.0
    layer_num: int = 0
    percent: int = 0
    speed: int = 0
    fan_speed: int = 0

    __table_args__ = (Index("ix_telemetry_print_ts", "print_id", "timestamp"),)


class FilamentSetting(SQLModel, table=True):
    """Single-row table holding the manually-set filament fallback."""

    id: int | None = Field(default=None, primary_key=True)
    type: str = ""
    color: str = ""
    updated_at: datetime


class Job(SQLModel, table=True):
    """An uploaded .3mf project waiting to be (or already) sent to the printer."""

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(index=True)
    original_filename: str
    stored_path: str
    size_bytes: int = 0
    status: str = Field(index=True, default="uploaded")
    plate_count: int = 0
    metadata_json: str = ""
    last_send_payload_json: str | None = None
    print_id: int | None = Field(default=None, foreign_key="print.id", index=True)
