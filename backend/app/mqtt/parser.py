"""Map raw Bambu MQTT JSON payloads to PrinterState patch dicts.

Field mapping (under the ``print`` object in the message):

  gcode_state                     -> gcode_state
  subtask_name | gcode_file       -> file_name
  mc_percent                      -> percent
  mc_remaining_time               -> remaining_minutes (already minutes)
  gcode_start_time                -> started_at (unix seconds, ISO out)
  layer_num                       -> layer_num
  total_layer_num                 -> total_layer_num
  nozzle_temper                   -> nozzle_temp
  nozzle_target_temper            -> nozzle_target
  bed_temper                      -> bed_temp
  bed_target_temper               -> bed_target
  spd_lvl                         -> print_speed
  cooling_fan_speed               -> fan_speed
  filament_type (best effort)     -> filament_type

Unknown fields are ignored; missing fields just don't appear in the patch.
The parser is defensive: it never raises on malformed payloads.
"""

from __future__ import annotations

from typing import Any, cast

from app.utils.logging import get_logger
from app.utils.time import from_unix_seconds, iso_z

log = get_logger(__name__)

VALID_GCODE_STATES: frozenset[str] = frozenset(
    {"IDLE", "PREPARE", "RUNNING", "PAUSE", "FINISH", "FAILED"}
)

# Map of raw MQTT key -> (state field, coercer). One entry per field we copy
# straight through with a simple type cast.
_DIRECT_FIELDS: dict[str, tuple[str, type]] = {
    "mc_percent": ("percent", float),
    "mc_remaining_time": ("remaining_minutes", int),
    "layer_num": ("layer_num", int),
    "total_layer_num": ("total_layer_num", int),
    "nozzle_temper": ("nozzle_temp", float),
    "nozzle_target_temper": ("nozzle_target", float),
    "bed_temper": ("bed_temp", float),
    "bed_target_temper": ("bed_target", float),
    "spd_lvl": ("print_speed", int),
    "cooling_fan_speed": ("fan_speed", int),
}


def _coerce(raw: Any, kind: type) -> Any | None:
    try:
        return kind(raw)
    except (TypeError, ValueError):
        return None


def parse_report(payload: dict[str, Any]) -> dict[str, Any]:
    """Extract the fields we care about. Returns a (possibly empty) patch dict.

    Accepts both the wrapper shape ``{"print": {...}}`` (the typical
    pushall response) and a bare ``print`` dict. Other top-level keys
    (``info``, ``mc_print``, ``upgrade_state``, etc.) are ignored.
    """
    if not isinstance(payload, dict):
        return {}
    block = payload.get("print", payload)
    if not isinstance(block, dict):
        return {}

    patch: dict[str, Any] = {}

    # gcode_state
    gs = block.get("gcode_state")
    if isinstance(gs, str) and gs in VALID_GCODE_STATES:
        patch["gcode_state"] = gs

    # file_name (prefer subtask_name)
    name = block.get("subtask_name") or block.get("gcode_file")
    if isinstance(name, str):
        # Some firmware reports the absolute path; keep just the basename.
        patch["file_name"] = name.rsplit("/", 1)[-1].strip() or None

    # Direct numeric fields
    for key, (field, kind) in _DIRECT_FIELDS.items():
        if key not in block:
            continue
        val = _coerce(block[key], kind)
        if val is None:
            continue
        # Clamp percentage at 0..100 because firmware sometimes reports 101.
        if field == "percent":
            val = max(0.0, min(100.0, cast(float, val)))
        if field == "fan_speed":
            val = max(0, min(100, cast(int, val)))
        if field == "remaining_minutes":
            val = max(0, cast(int, val))
        patch[field] = val

    # gcode_start_time -> ISO string
    if "gcode_start_time" in block:
        dt = from_unix_seconds(block.get("gcode_start_time"))
        patch["started_at"] = iso_z(dt) if dt else None

    # Filament best-effort
    ftype = block.get("filament_type") or block.get("filament_id")
    if isinstance(ftype, str) and ftype.strip():
        patch["filament_type"] = ftype.strip()

    return patch
