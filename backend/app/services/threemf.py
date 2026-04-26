"""Parser for Bambu-flavored .3mf files.

A Bambu .3mf is an OPC ZIP archive. We only read the metadata needed to
preview the project and build the LAN-mode print command:

  * project_settings.config (JSON) — filament_colour, filament_id, bed_type,
    enable_prime_tower, support_type, nozzle/layer/infill, etc.
  * slice_info.config (XML)        — per-plate filament list + weights/durations
  * model_settings.config (XML)    — present/absent flag for the support feature
  * Metadata/plate_<N>.gcode       — must exist (LAN mode requires pre-sliced)
  * Metadata/plate_<N>.png         — preview thumbnail per plate

We do NOT touch geometry: the browser parses 3D/* via three.js 3MFLoader on a
filtered ZIP we serve from `build_geometry_zip`.
"""

from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Any

PLATE_GCODE_RE = re.compile(r"^Metadata/plate_(\d+)\.gcode$", re.IGNORECASE)
PLATE_PNG_RE = re.compile(r"^Metadata/plate_(\d+)\.png$", re.IGNORECASE)


class ThreeMfError(ValueError):
    """Raised when the .3mf is malformed or not pre-sliced."""


@dataclass
class ProjectFilament:
    index: int
    color: str  # hex like #RRGGBB or #RRGGBBAA
    type: str
    filament_id: str | None = None


@dataclass
class PlateInfo:
    index: int
    gcode_path: str
    has_thumbnail: bool
    filaments: list[int] = field(default_factory=list)  # indices into project filaments
    estimated_seconds: int | None = None
    weight_grams: float | None = None


@dataclass
class ProjectSettings:
    bed_type: str | None = None
    nozzle_diameter: float | None = None
    layer_height: float | None = None
    sparse_infill_density: str | None = None
    enable_prime_tower: bool | None = None
    enable_support: bool | None = None
    support_type: str | None = None
    printer_model: str | None = None


@dataclass
class ProjectMetadata:
    plates: list[PlateInfo]
    filaments: list[ProjectFilament]
    settings: ProjectSettings

    def to_json(self) -> dict[str, Any]:
        return {
            "plates": [
                {
                    "index": p.index,
                    "gcode_path": p.gcode_path,
                    "has_thumbnail": p.has_thumbnail,
                    "filaments": p.filaments,
                    "estimated_seconds": p.estimated_seconds,
                    "weight_grams": p.weight_grams,
                }
                for p in self.plates
            ],
            "filaments": [
                {
                    "index": f.index,
                    "color": f.color,
                    "type": f.type,
                    "filament_id": f.filament_id,
                }
                for f in self.filaments
            ],
            "settings": {
                "bed_type": self.settings.bed_type,
                "nozzle_diameter": self.settings.nozzle_diameter,
                "layer_height": self.settings.layer_height,
                "sparse_infill_density": self.settings.sparse_infill_density,
                "enable_prime_tower": self.settings.enable_prime_tower,
                "enable_support": self.settings.enable_support,
                "support_type": self.settings.support_type,
                "printer_model": self.settings.printer_model,
            },
        }


def parse_3mf(path: Path) -> ProjectMetadata:
    """Open the .3mf, validate, and extract the metadata we expose to the UI."""
    if not zipfile.is_zipfile(path):
        raise ThreeMfError("file is not a valid .3mf (not a zip archive)")

    with zipfile.ZipFile(path) as zf:
        names = zf.namelist()
        plate_gcodes: dict[int, str] = {}
        plate_pngs: set[int] = set()
        for name in names:
            m = PLATE_GCODE_RE.match(name)
            if m:
                plate_gcodes[int(m.group(1))] = name
                continue
            m = PLATE_PNG_RE.match(name)
            if m:
                plate_pngs.add(int(m.group(1)))

        if not plate_gcodes:
            raise ThreeMfError(
                "no Metadata/plate_*.gcode found — the .3mf is not pre-sliced "
                "(use 'Export plate sliced 3mf' from Bambu Studio)"
            )

        project_settings = _parse_project_settings(zf)
        slice_info = _parse_slice_info(zf)
        filaments = _build_filament_list(project_settings, slice_info)

        plates: list[PlateInfo] = []
        for idx in sorted(plate_gcodes):
            sl = slice_info.get(idx, {})
            plates.append(
                PlateInfo(
                    index=idx,
                    gcode_path=plate_gcodes[idx],
                    has_thumbnail=idx in plate_pngs,
                    filaments=sl.get("filaments", []),
                    estimated_seconds=sl.get("prediction"),
                    weight_grams=sl.get("weight"),
                )
            )

    return ProjectMetadata(
        plates=plates,
        filaments=filaments,
        settings=_extract_settings(project_settings),
    )


def read_thumbnail(path: Path, plate_index: int) -> bytes | None:
    with zipfile.ZipFile(path) as zf:
        candidate = f"Metadata/plate_{plate_index}.png"
        if candidate in zf.namelist():
            return zf.read(candidate)
    return None


def build_geometry_zip(path: Path) -> bytes:
    """Return a small ZIP containing only files three.js 3MFLoader needs.

    Strips the multi-megabyte Metadata/plate_*.gcode entries so the browser
    download stays manageable.
    """
    keep_prefixes = ("3D/", "_rels/", "[Content_Types].xml")
    keep_files = {
        "Metadata/model_settings.config",
        "Metadata/Materials.xml",
    }
    out = BytesIO()
    with zipfile.ZipFile(path) as src, zipfile.ZipFile(
        out, "w", zipfile.ZIP_DEFLATED
    ) as dst:
        for info in src.infolist():
            keep = info.filename in keep_files or any(
                info.filename.startswith(p) for p in keep_prefixes
            )
            if not keep:
                continue
            dst.writestr(info, src.read(info.filename))
    return out.getvalue()


# ─── internals ───────────────────────────────────────────────────────────────


def _parse_project_settings(zf: zipfile.ZipFile) -> dict[str, Any]:
    candidates = (
        "Metadata/project_settings.config",
        "Metadata/process_settings_1.config",
    )
    for name in candidates:
        if name in zf.namelist():
            try:
                parsed = json.loads(zf.read(name).decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError) as exc:
                raise ThreeMfError(f"corrupt {name}: {exc}") from exc
            if isinstance(parsed, dict):
                return dict(parsed)
            return {}
    return {}


def _parse_slice_info(zf: zipfile.ZipFile) -> dict[int, dict[str, Any]]:
    name = "Metadata/slice_info.config"
    if name not in zf.namelist():
        return {}
    try:
        root = ET.fromstring(zf.read(name).decode("utf-8"))
    except (ET.ParseError, UnicodeDecodeError) as exc:
        raise ThreeMfError(f"corrupt {name}: {exc}") from exc

    plates: dict[int, dict[str, Any]] = {}
    for plate in root.iter("plate"):
        idx_str = _find_metadata(plate, "index")
        if idx_str is None:
            continue
        try:
            idx = int(idx_str)
        except ValueError:
            continue
        prediction = _find_metadata(plate, "prediction")
        weight = _find_metadata(plate, "weight")
        filaments: list[int] = []
        for fil in plate.iter("filament"):
            fid = fil.get("id")
            if fid is None:
                continue
            try:
                filaments.append(int(fid) - 1)
            except ValueError:
                continue
        plates[idx] = {
            "filaments": filaments,
            "prediction": _safe_int(prediction),
            "weight": _safe_float(weight),
        }
    return plates


def _find_metadata(elem: ET.Element, key: str) -> str | None:
    for meta in elem.iter("metadata"):
        if meta.get("key") == key:
            value = meta.get("value")
            return value if value is not None else None
    return None


def _build_filament_list(
    project_settings: dict[str, Any],
    _slice_info: dict[int, dict[str, Any]],
) -> list[ProjectFilament]:
    colors = project_settings.get("filament_colour") or []
    types = project_settings.get("filament_type") or []
    ids = project_settings.get("filament_ids") or []
    n = max(len(colors), len(types), len(ids))
    out: list[ProjectFilament] = []
    for i in range(n):
        out.append(
            ProjectFilament(
                index=i,
                color=str(colors[i]) if i < len(colors) else "#FFFFFF",
                type=str(types[i]) if i < len(types) else "PLA",
                filament_id=str(ids[i]) if i < len(ids) else None,
            )
        )
    return out


def _extract_settings(project_settings: dict[str, Any]) -> ProjectSettings:
    def first(value: Any) -> Any:
        if isinstance(value, list):
            return value[0] if value else None
        return value

    return ProjectSettings(
        bed_type=_safe_str(first(project_settings.get("curr_bed_type"))),
        nozzle_diameter=_safe_float(first(project_settings.get("nozzle_diameter"))),
        layer_height=_safe_float(first(project_settings.get("layer_height"))),
        sparse_infill_density=_safe_str(
            first(project_settings.get("sparse_infill_density"))
        ),
        enable_prime_tower=_safe_bool(project_settings.get("enable_prime_tower")),
        enable_support=_safe_bool(project_settings.get("enable_support")),
        support_type=_safe_str(first(project_settings.get("support_type"))),
        printer_model=_safe_str(first(project_settings.get("printer_settings_id"))),
    )


def _safe_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_str(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def _safe_bool(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        v = value.strip().lower()
        if v in {"1", "true", "yes", "on"}:
            return True
        if v in {"0", "false", "no", "off"}:
            return False
    return None
