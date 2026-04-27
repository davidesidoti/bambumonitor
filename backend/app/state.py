"""Module-level singleton holding the current PrinterState.

Mutated by the MQTT worker via :func:`apply_patch`. Read by the WS endpoint
and ``GET /api/state``.
"""

from __future__ import annotations

import threading
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.utils.time import iso_z, utcnow

GcodeState = Literal["IDLE", "PREPARE", "RUNNING", "PAUSE", "FINISH", "FAILED"]


class PrinterState(BaseModel):
    gcode_state: GcodeState = "IDLE"
    file_name: str | None = None
    percent: float = 0.0
    remaining_minutes: int = 0
    started_at: str | None = None
    layer_num: int = 0
    total_layer_num: int = 0
    nozzle_temp: float = 0.0
    nozzle_target: float = 0.0
    bed_temp: float = 0.0
    bed_target: float = 0.0
    print_speed: int = 2
    fan_speed: int = 0
    filament_type: str | None = None
    filament_color: str | None = None
    chamber_light: bool = False
    last_update: str = Field(default_factory=lambda: iso_z(utcnow()))


_state = PrinterState()
_lock = threading.RLock()


def snapshot() -> PrinterState:
    with _lock:
        return _state.model_copy()


def apply_patch(patch: dict[str, Any]) -> dict[str, Any]:
    """Apply a partial update; return the diff that was actually applied.

    Fields whose new value equals the current one are dropped from the diff so
    we don't broadcast no-op deltas over the WebSocket.
    """
    if not patch:
        return {}
    applied: dict[str, Any] = {}
    with _lock:
        valid_keys = set(PrinterState.model_fields.keys())
        for k, v in patch.items():
            if k not in valid_keys:
                continue
            if getattr(_state, k) == v:
                continue
            setattr(_state, k, v)
            applied[k] = v
        if applied:
            _state.last_update = iso_z(utcnow())
            applied["last_update"] = _state.last_update
    return applied


def reset() -> None:
    """Test helper: restore the singleton to defaults."""
    global _state
    with _lock:
        _state = PrinterState()
