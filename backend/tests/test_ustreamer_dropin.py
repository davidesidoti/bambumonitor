from __future__ import annotations

from pathlib import Path

from app.services.ustreamer_dropin import (
    WebcamSettings,
    parse_dropin,
    render_dropin,
    write_dropin,
)


def test_parse_returns_defaults_when_missing(tmp_path: Path) -> None:
    s = parse_dropin(tmp_path / "nope.conf")
    assert s == WebcamSettings()


def test_render_then_parse_round_trip(tmp_path: Path) -> None:
    src = WebcamSettings(
        device="/dev/video2",
        resolution="1920x1080",
        desired_fps=30,
        host="0.0.0.0",
        port=8888,
        drop_same_frames=5,
        exposure=500,
        gain=10,
        contrast=100,
        brightness=120,
    )
    body = render_dropin(src)
    p = tmp_path / "override.conf"
    write_dropin(p, body)
    parsed = parse_dropin(p)
    assert parsed == src


def test_render_includes_clear_execstart() -> None:
    body = render_dropin(WebcamSettings())
    # Must emit empty `ExecStart=` before the new one to override the base unit.
    lines = [ln for ln in body.splitlines() if ln.startswith("ExecStart=")]
    assert lines[0] == "ExecStart="
    assert "ustreamer" in lines[1]
