from __future__ import annotations

from app.mqtt.parser import parse_report

# A trimmed but realistic Bambu A1 MQTT report payload.
SAMPLE_REPORT = {
    "print": {
        "gcode_state": "RUNNING",
        "subtask_name": "Calibration_cube_v3.gcode.3mf",
        "gcode_file": "/data/printer.gcode",
        "mc_percent": 54.5,
        "mc_remaining_time": 73,
        "gcode_start_time": 1714153500,
        "layer_num": 142,
        "total_layer_num": 380,
        "nozzle_temper": 218.4,
        "nozzle_target_temper": 220,
        "bed_temper": 60.1,
        "bed_target_temper": 60,
        "spd_lvl": 2,
        "cooling_fan_speed": 65,
        "filament_type": "PLA",
    }
}


def test_parses_full_report() -> None:
    patch = parse_report(SAMPLE_REPORT)
    assert patch["gcode_state"] == "RUNNING"
    assert patch["file_name"] == "Calibration_cube_v3.gcode.3mf"  # subtask_name wins over gcode_file
    assert patch["percent"] == 54.5
    assert patch["remaining_minutes"] == 73
    assert patch["layer_num"] == 142
    assert patch["total_layer_num"] == 380
    assert patch["nozzle_temp"] == 218.4
    assert patch["nozzle_target"] == 220.0
    assert patch["bed_temp"] == 60.1
    assert patch["bed_target"] == 60.0
    assert patch["print_speed"] == 2
    assert patch["fan_speed"] == 65
    assert patch["filament_type"] == "PLA"
    # gcode_start_time was a unix-second int; should serialise to ISO Z.
    assert patch["started_at"].endswith("Z")


def test_handles_bare_print_dict() -> None:
    """Some firmware emits the print block as the top-level message."""
    bare = SAMPLE_REPORT["print"]
    patch = parse_report(bare)
    assert patch["gcode_state"] == "RUNNING"


def test_ignores_non_print_payloads() -> None:
    assert parse_report({"info": {"foo": "bar"}}) == {}
    assert parse_report({}) == {}


def test_falls_back_to_gcode_file_when_no_subtask_name() -> None:
    patch = parse_report({"print": {"gcode_file": "/data/Bracket_v2.3mf"}})
    assert patch["file_name"] == "Bracket_v2.3mf"


def test_clamps_percent() -> None:
    patch = parse_report({"print": {"mc_percent": 142}})
    assert patch["percent"] == 100.0
    patch = parse_report({"print": {"mc_percent": -5}})
    assert patch["percent"] == 0.0


def test_skips_unknown_gcode_state() -> None:
    patch = parse_report({"print": {"gcode_state": "WAT"}})
    assert "gcode_state" not in patch


def test_drops_zero_unix_start_time() -> None:
    # gcode_start_time=0 means "no value yet"; we must not emit the field so
    # an existing (good) started_at on PrinterState isn't clobbered.
    patch = parse_report({"print": {"gcode_start_time": 0}})
    assert "started_at" not in patch


def test_ignores_filament_id_catalog_code() -> None:
    # filament_id (e.g. "GFL99") is Bambu's internal catalog code, not a
    # human-readable name; the parser must not surface it.
    patch = parse_report({"print": {"filament_id": "GFL99"}})
    assert "filament_type" not in patch


def test_garbage_input_is_safe() -> None:
    # Should not raise.
    assert parse_report(None) == {}  # type: ignore[arg-type]
    assert parse_report({"print": "not a dict"}) == {}
    assert parse_report({"print": {"mc_percent": "garbage"}}) == {}


def test_empty_filament_string_is_dropped() -> None:
    patch = parse_report({"print": {"filament_type": "  "}})
    assert "filament_type" not in patch


# ─────────────────────────────────────────────
# AMS extraction
# ─────────────────────────────────────────────
AMS_PAYLOAD = {
    "print": {
        "ams": {
            "tray_now": "1",
            "tray_pre": "255",
            "ams": [
                {
                    "id": "0",
                    "tray": [
                        {
                            "id": "0",
                            "tray_type": "PLA",
                            "tray_sub_brands": "Bambu",
                            "tray_color": "FF0000FF",
                        },
                        {
                            "id": "1",
                            "tray_type": "PETG",
                            "tray_sub_brands": "Generic",
                            "tray_color": "FFD400FF",
                        },
                    ],
                }
            ],
        }
    }
}


def test_ams_extracts_active_tray() -> None:
    patch = parse_report(AMS_PAYLOAD)
    assert patch["filament_type"] == "Generic PETG"
    assert patch["filament_color"] == "#FFD400"


def test_ams_external_spool_slot_is_skipped() -> None:
    payload = {"print": {"ams": {"tray_now": "254", "ams": []}}}
    patch = parse_report(payload)
    assert "filament_type" not in patch
    assert "filament_color" not in patch


def test_ams_no_brand_uses_type_alone() -> None:
    payload = {
        "print": {
            "ams": {
                "tray_now": "0",
                "ams": [
                    {
                        "id": "0",
                        "tray": [
                            {"id": "0", "tray_type": "PLA", "tray_color": "00FF00FF"}
                        ],
                    }
                ],
            }
        }
    }
    patch = parse_report(payload)
    assert patch["filament_type"] == "PLA"
    assert patch["filament_color"] == "#00FF00"


def test_ams_invalid_color_is_dropped() -> None:
    payload = {
        "print": {
            "ams": {
                "tray_now": "0",
                "ams": [
                    {"id": "0", "tray": [{"id": "0", "tray_type": "PLA", "tray_color": "ZZZ"}]}
                ],
            }
        }
    }
    patch = parse_report(payload)
    assert patch["filament_type"] == "PLA"
    assert "filament_color" not in patch
