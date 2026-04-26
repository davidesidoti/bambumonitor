from __future__ import annotations

import json
import zipfile
from pathlib import Path

import pytest

from app.services.threemf import ThreeMfError, build_geometry_zip, parse_3mf, read_thumbnail


PROJECT_SETTINGS = {
    "filament_colour": ["#FF0000", "#00FF00", "#0000FF"],
    "filament_type": ["PLA", "PLA", "PETG"],
    "filament_ids": ["GFA00", "GFA00", "GFG00"],
    "curr_bed_type": "textured_plate",
    "nozzle_diameter": ["0.4"],
    "layer_height": "0.20",
    "sparse_infill_density": "15%",
    "enable_prime_tower": "1",
    "enable_support": "0",
    "support_type": "tree(auto)",
    "printer_settings_id": "Bambu Lab A1 0.4 nozzle",
}

SLICE_INFO_XML = """<?xml version="1.0"?>
<config>
  <plate>
    <metadata key="index" value="1"/>
    <metadata key="prediction" value="3600"/>
    <metadata key="weight" value="42.5"/>
    <filament id="1" tray_info_idx="GFA00" color="#FF0000"/>
    <filament id="2" tray_info_idx="GFA00" color="#00FF00"/>
  </plate>
  <plate>
    <metadata key="index" value="2"/>
    <metadata key="prediction" value="1800"/>
    <metadata key="weight" value="12"/>
    <filament id="3" tray_info_idx="GFG00" color="#0000FF"/>
  </plate>
</config>
"""

MODEL_XML = b'<?xml version="1.0"?><model/>'


def _build_minimal_3mf(path: Path, *, with_gcode: bool = True) -> None:
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("[Content_Types].xml", "<types/>")
        zf.writestr("3D/3dmodel.model", MODEL_XML)
        zf.writestr("3D/Objects/object_1.model", MODEL_XML)
        zf.writestr("Metadata/project_settings.config", json.dumps(PROJECT_SETTINGS))
        zf.writestr("Metadata/slice_info.config", SLICE_INFO_XML)
        zf.writestr("Metadata/model_settings.config", "<config/>")
        if with_gcode:
            zf.writestr("Metadata/plate_1.gcode", "G28\n")
            zf.writestr("Metadata/plate_1.png", b"\x89PNG\r\n\x1a\n")
            zf.writestr("Metadata/plate_2.gcode", "G28\n")


def test_parse_extracts_plates_filaments_settings(tmp_path: Path) -> None:
    p = tmp_path / "demo.3mf"
    _build_minimal_3mf(p)

    meta = parse_3mf(p)

    assert [pl.index for pl in meta.plates] == [1, 2]
    assert meta.plates[0].has_thumbnail is True
    assert meta.plates[1].has_thumbnail is False
    assert meta.plates[0].estimated_seconds == 3600
    assert meta.plates[0].weight_grams == pytest.approx(42.5)
    assert meta.plates[0].filaments == [0, 1]
    assert meta.plates[1].filaments == [2]

    assert len(meta.filaments) == 3
    assert meta.filaments[0].color == "#FF0000"
    assert meta.filaments[2].type == "PETG"
    assert meta.filaments[0].filament_id == "GFA00"

    s = meta.settings
    assert s.bed_type == "textured_plate"
    assert s.nozzle_diameter == pytest.approx(0.4)
    assert s.layer_height == pytest.approx(0.2)
    assert s.enable_prime_tower is True
    assert s.enable_support is False
    assert s.support_type == "tree(auto)"


def test_parse_rejects_non_sliced_3mf(tmp_path: Path) -> None:
    p = tmp_path / "raw.3mf"
    _build_minimal_3mf(p, with_gcode=False)

    with pytest.raises(ThreeMfError, match="not pre-sliced"):
        parse_3mf(p)


def test_parse_rejects_non_zip(tmp_path: Path) -> None:
    p = tmp_path / "garbage.3mf"
    p.write_bytes(b"not a zip")
    with pytest.raises(ThreeMfError):
        parse_3mf(p)


def test_read_thumbnail(tmp_path: Path) -> None:
    p = tmp_path / "demo.3mf"
    _build_minimal_3mf(p)

    assert read_thumbnail(p, 1) is not None
    assert read_thumbnail(p, 2) is None
    assert read_thumbnail(p, 99) is None


def test_geometry_zip_strips_gcode(tmp_path: Path) -> None:
    p = tmp_path / "demo.3mf"
    _build_minimal_3mf(p)

    payload = build_geometry_zip(p)
    with zipfile.ZipFile(__import__("io").BytesIO(payload)) as zf:
        names = set(zf.namelist())
    assert "3D/3dmodel.model" in names
    assert "3D/Objects/object_1.model" in names
    assert "Metadata/model_settings.config" in names
    assert all(not n.endswith(".gcode") for n in names)
    assert all(not n.endswith(".png") for n in names)
    assert "Metadata/project_settings.config" not in names
