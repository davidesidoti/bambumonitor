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
  lights_report[node=chamber_light].mode -> chamber_light (bool)

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

    # gcode_start_time -> ISO string. Only emit when we have a valid value;
    # the printer sometimes pushes 0/empty in incremental updates and we don't
    # want to clobber a previously captured start time.
    if "gcode_start_time" in block:
        dt = from_unix_seconds(block.get("gcode_start_time"))
        if dt is not None:
            patch["started_at"] = iso_z(dt)

    # Filament: prefer the AMS active tray (rich data with brand + color),
    # fall back to the human-readable top-level filament_type otherwise. We
    # deliberately ignore filament_id (Bambu catalog codes like "GFL99") since
    # they are not user-friendly.
    ams_filament = _extract_ams_active_filament(block)
    if ams_filament is not None:
        patch.update(ams_filament)
    else:
        ftype = block.get("filament_type")
        if isinstance(ftype, str) and ftype.strip():
            patch["filament_type"] = ftype.strip()

    lights = block.get("lights_report")
    if isinstance(lights, list):
        for entry in lights:
            if not isinstance(entry, dict):
                continue
            if entry.get("node") != "chamber_light":
                continue
            mode = entry.get("mode")
            if mode == "on":
                patch["chamber_light"] = True
            elif mode == "off":
                patch["chamber_light"] = False
            break

    return patch


def _extract_ams_active_filament(block: dict[str, Any]) -> dict[str, Any] | None:
    """Pull type + color from the currently-active AMS tray.

    Bambu's AMS payload looks roughly like:
        "ams": {
            "tray_now": "0",
            "ams": [{"id": "0", "tray": [{"id": "0", "tray_type": "PLA",
                     "tray_sub_brands": "Generic", "tray_color": "FFD400FF"}, ...]}]
        }
    `tray_now` is a string slot index. "254" = external spool, "255" = none.
    For the A1 AMS Lite there's a single AMS unit with 4 trays.
    """
    ams_root = block.get("ams")
    if not isinstance(ams_root, dict):
        return None
    units = ams_root.get("ams")
    if not isinstance(units, list) or not units:
        return None
    tray_now_raw = ams_root.get("tray_now")
    try:
        tray_now = int(tray_now_raw) if tray_now_raw is not None else None
    except (TypeError, ValueError):
        return None
    if tray_now is None or tray_now >= 254:
        return None

    # Search every unit for a tray whose id matches tray_now (per-unit ids 0..3
    # on A1 AMS Lite; on the bigger AMS the global index can span 0..15).
    for unit in units:
        if not isinstance(unit, dict):
            continue
        try:
            unit_id = int(unit.get("id", 0))
        except (TypeError, ValueError):
            unit_id = 0
        trays = unit.get("tray")
        if not isinstance(trays, list):
            continue
        for tray in trays:
            if not isinstance(tray, dict):
                continue
            try:
                tray_id = int(tray.get("id", -1))
            except (TypeError, ValueError):
                continue
            if unit_id * 4 + tray_id != tray_now and tray_id != tray_now:
                continue
            return _format_tray(tray)
    return None


def _format_tray(tray: dict[str, Any]) -> dict[str, Any] | None:
    type_ = (tray.get("tray_type") or "").strip()
    brand = (tray.get("tray_sub_brands") or "").strip()
    color_raw = (tray.get("tray_color") or "").strip()
    if not type_ and not color_raw:
        return None
    out: dict[str, Any] = {}
    if type_:
        out["filament_type"] = f"{brand} {type_}".strip() if brand else type_
    if color_raw:
        # Bambu sends 8-char RRGGBBAA hex (e.g. "FFD400FF"); drop the alpha
        # and prefix with '#' so the frontend can use it directly as CSS.
        hex6 = color_raw[:6].upper()
        if all(c in "0123456789ABCDEF" for c in hex6) and len(hex6) == 6:
            out["filament_color"] = f"#{hex6}"
    return out or None
