from __future__ import annotations

from app import state


def test_apply_patch_returns_only_changes() -> None:
    state.reset()
    applied = state.apply_patch({"percent": 25.0, "gcode_state": "RUNNING"})
    assert applied["percent"] == 25.0
    assert applied["gcode_state"] == "RUNNING"
    # last_update is always stamped when something changed.
    assert "last_update" in applied


def test_apply_patch_skips_no_op_fields() -> None:
    state.reset()
    state.apply_patch({"percent": 25.0})
    applied = state.apply_patch({"percent": 25.0})
    assert applied == {}


def test_apply_patch_ignores_unknown_keys() -> None:
    state.reset()
    applied = state.apply_patch({"definitely_not_a_field": 1})
    assert applied == {}


def test_snapshot_is_a_copy() -> None:
    state.reset()
    state.apply_patch({"percent": 12.0})
    snap = state.snapshot()
    snap.percent = 99.0
    assert state.snapshot().percent == 12.0
