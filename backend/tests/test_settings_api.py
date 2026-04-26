from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.api.settings import (
    ACCESS_CODE_MASK,
    AppSettingsWrite,
    WebcamSettingsModel,
    get_app_settings,
)
from app.config import get_settings


@pytest.mark.asyncio
async def test_get_app_settings_masks_access_code(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    env = tmp_path / "env"
    env.write_text(
        "PRINTER_IP=10.0.0.1\n"
        "PRINTER_SERIAL=ABCDEFGHIJKLMN\n"
        "PRINTER_ACCESS_CODE=12345678\n"
        "LOG_LEVEL=DEBUG\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(get_settings(), "env_file_path", env)

    body = await get_app_settings()
    assert body.printer_access_code == ACCESS_CODE_MASK
    assert body.printer_ip == "10.0.0.1"
    assert body.printer_serial == "ABCDEFGHIJKLMN"
    assert body.log_level == "DEBUG"


def test_app_write_rejects_invalid_ip() -> None:
    with pytest.raises(ValidationError):
        AppSettingsWrite(
            printer_ip="not-an-ip",
            printer_serial="ABCDEFGHIJKLMN",
            printer_access_code="12345678",
            log_level="INFO",
            dev_mode=False,
            ustreamer_url="http://x",
            telemetry_interval_seconds=10,
            ws_heartbeat_interval_seconds=30,
        )


def test_app_write_rejects_short_access_code() -> None:
    with pytest.raises(ValidationError):
        AppSettingsWrite(
            printer_ip="10.0.0.1",
            printer_serial="ABCDEFGHIJKLMN",
            printer_access_code="123",
            log_level="INFO",
            dev_mode=False,
            ustreamer_url="http://x",
            telemetry_interval_seconds=10,
            ws_heartbeat_interval_seconds=30,
        )


def test_app_write_accepts_masked_access_code_as_sentinel() -> None:
    body = AppSettingsWrite(
        printer_ip="10.0.0.1",
        printer_serial="ABCDEFGHIJKLMN",
        printer_access_code=ACCESS_CODE_MASK,
        log_level="INFO",
        dev_mode=False,
        ustreamer_url="http://x",
        telemetry_interval_seconds=10,
        ws_heartbeat_interval_seconds=30,
    )
    assert body.printer_access_code == ACCESS_CODE_MASK


def _webcam_kwargs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = dict(
        device="/dev/video0",
        resolution="1280x720",
        desired_fps=15,
        host="127.0.0.1",
        port=9999,
        drop_same_frames=0,
        auto_exposure=True,
        exposure_dynamic_framerate=True,
        exposure_time_absolute=250,
        brightness=0,
        contrast=128,
        saturation=128,
        gain=0,
        gamma=100,
        sharpness=3,
        backlight_compensation=0,
        white_balance_automatic=True,
        power_line_frequency=1,
    )
    base.update(overrides)
    return base


def test_webcam_validation_rejects_bad_device() -> None:
    with pytest.raises(ValidationError):
        WebcamSettingsModel(**_webcam_kwargs(device="/tmp/something"))


def test_webcam_validation_clamps_fps() -> None:
    with pytest.raises(ValidationError):
        WebcamSettingsModel(**_webcam_kwargs(desired_fps=999))


def test_webcam_validation_accepts_by_id_device() -> None:
    m = WebcamSettingsModel(
        **_webcam_kwargs(
            device="/dev/v4l/by-id/usb-Sonix_Technology_Co.__Ltd._JOYACCESS-video-index0"
        )
    )
    assert m.device.startswith("/dev/v4l/by-id/")


def test_webcam_validation_accepts_negative_brightness() -> None:
    m = WebcamSettingsModel(**_webcam_kwargs(brightness=-30))
    assert m.brightness == -30
