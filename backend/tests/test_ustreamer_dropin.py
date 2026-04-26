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
        device="/dev/v4l/by-id/usb-Sonix_Technology_Co.__Ltd._JOYACCESS-video-index0",
        resolution="1920x1080",
        desired_fps=30,
        host="0.0.0.0",
        port=8888,
        drop_same_frames=5,
        auto_exposure=False,
        exposure_dynamic_framerate=True,
        exposure_time_absolute=500,
        brightness=-30,
        contrast=45,
        saturation=80,
        gain=20,
        gamma=150,
        sharpness=3,
        backlight_compensation=0,
        white_balance_automatic=True,
        power_line_frequency=1,
    )
    body = render_dropin(src)
    p = tmp_path / "override.conf"
    write_dropin(p, body)
    parsed = parse_dropin(p)
    assert parsed == src


def test_render_supports_negative_brightness() -> None:
    body = render_dropin(WebcamSettings(brightness=-30))
    assert "brightness=-30" in body


def test_render_omits_manual_exposure_when_auto() -> None:
    body = render_dropin(WebcamSettings(auto_exposure=True))
    assert "exposure_time_absolute" not in body
    assert "auto_exposure=3" in body


def test_render_includes_manual_exposure_when_disabled() -> None:
    body = render_dropin(
        WebcamSettings(auto_exposure=False, exposure_time_absolute=420)
    )
    assert "exposure_time_absolute=420" in body
    assert "auto_exposure=1" in body


def test_render_uses_minus_prefixed_execstartpre() -> None:
    body = render_dropin(WebcamSettings())
    # systemd `-` prefix means: ignore non-zero exit (camera lacks the control).
    assert all(
        ln.startswith("ExecStartPre=-") or not ln.startswith("ExecStartPre=")
        for ln in body.splitlines()
    )


def test_render_includes_clear_execstart() -> None:
    body = render_dropin(WebcamSettings())
    lines = [ln for ln in body.splitlines() if ln.startswith("ExecStart=")]
    assert lines[0] == "ExecStart="
    assert "ustreamer" in lines[1]


def test_parse_user_real_world_dropin(tmp_path: Path) -> None:
    """Verify the parser ingests the user's actual production drop-in."""
    p = tmp_path / "override.conf"
    d = "/dev/v4l/by-id/usb-Sonix_Technology_Co.__Ltd._JOYACCESS-video-index0"
    p.write_text(
        "[Service]\n"
        f"ExecStartPre=/usr/bin/v4l2-ctl -d {d} --set-ctrl=power_line_frequency=1\n"
        f"ExecStartPre=/usr/bin/v4l2-ctl -d {d} --set-ctrl=auto_exposure=3\n"
        f"ExecStartPre=/usr/bin/v4l2-ctl -d {d} --set-ctrl=exposure_dynamic_framerate=1\n"
        f"ExecStartPre=/usr/bin/v4l2-ctl -d {d} --set-ctrl=gain=20\n"
        f"ExecStartPre=/usr/bin/v4l2-ctl -d {d} --set-ctrl=brightness=-30\n"
        f"ExecStartPre=/usr/bin/v4l2-ctl -d {d} --set-ctrl=gamma=150\n"
        f"ExecStartPre=/usr/bin/v4l2-ctl -d {d} --set-ctrl=contrast=45\n"
        f"ExecStartPre=/usr/bin/v4l2-ctl -d {d} --set-ctrl=saturation=80\n"
        f"ExecStartPre=/usr/bin/v4l2-ctl -d {d} --set-ctrl=sharpness=3\n"
        f"ExecStartPre=/usr/bin/v4l2-ctl -d {d} --set-ctrl=backlight_compensation=0\n"
        f"ExecStartPre=/usr/bin/v4l2-ctl -d {d} --set-ctrl=white_balance_automatic=1\n",
        encoding="utf-8",
    )
    s = parse_dropin(p)
    assert s.power_line_frequency == 1
    assert s.auto_exposure is True
    assert s.exposure_dynamic_framerate is True
    assert s.gain == 20
    assert s.brightness == -30
    assert s.gamma == 150
    assert s.contrast == 45
    assert s.saturation == 80
    assert s.sharpness == 3
    assert s.backlight_compensation == 0
    assert s.white_balance_automatic is True


def test_parse_preserves_unknown_ctrl(tmp_path: Path) -> None:
    p = tmp_path / "override.conf"
    p.write_text(
        "[Service]\n"
        "ExecStartPre=/usr/bin/v4l2-ctl -d /dev/video0 --set-ctrl=funky_knob=42\n",
        encoding="utf-8",
    )
    s = parse_dropin(p)
    assert s.extra_ctrls.get("funky_knob") == "42"
    body = render_dropin(s)
    assert "funky_knob=42" in body


def test_parse_legacy_dash_c_form(tmp_path: Path) -> None:
    p = tmp_path / "override.conf"
    p.write_text(
        "[Service]\n"
        "ExecStartPre=/usr/bin/v4l2-ctl -d /dev/video0 -c brightness=-50\n"
        "ExecStartPre=/usr/bin/v4l2-ctl -d /dev/video0 -c exposure_auto=3\n",
        encoding="utf-8",
    )
    s = parse_dropin(p)
    assert s.brightness == -50
    assert s.auto_exposure is True
