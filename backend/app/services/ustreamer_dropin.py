"""Read and write the systemd drop-in for the ustreamer.service unit.

The drop-in lives at /etc/systemd/system/ustreamer.service.d/override.conf and
is consumed by `systemctl daemon-reload && systemctl restart ustreamer`. We
parse it back into a typed model so the UI can show the current values, and
re-render it from the model on save.

The base ustreamer.service in the repo defines an ExecStart= line; to override
it from a drop-in we must emit an empty `ExecStart=` first to clear the prior
value, then a new `ExecStart=` with our flags. v4l2 controls go in
ExecStartPre= lines (one per knob).

ExecStartPre lines are prefixed with `-` so a control that the camera does
not expose (e.g. `power_line_frequency` on a webcam that has no such control)
returns non-zero from v4l2-ctl without aborting the unit start.
"""

from __future__ import annotations

import re
import shlex
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

# v4l2 auto-exposure mode values (UVC):
#   1 = Manual
#   3 = Aperture Priority (auto)
AUTO_EXPOSURE_AUTO = 3
AUTO_EXPOSURE_MANUAL = 1


@dataclass
class WebcamSettings:
    # Stream
    device: str = "/dev/video0"
    resolution: str = "1280x720"
    desired_fps: int = 15
    host: str = "127.0.0.1"
    port: int = 9999
    drop_same_frames: int = 0

    # Exposure
    auto_exposure: bool = True
    exposure_dynamic_framerate: bool = True
    exposure_time_absolute: int = 250  # used only when auto_exposure is False

    # Image
    brightness: int = 0
    contrast: int = 128
    saturation: int = 128
    gain: int = 0
    gamma: int = 100
    sharpness: int = 3
    backlight_compensation: int = 0

    # White balance
    white_balance_automatic: bool = True

    # Power line (0=off, 1=50Hz, 2=60Hz)
    power_line_frequency: int = 1

    # Extra controls the UI does not expose, preserved on round-trip so we
    # don't silently drop user-added knobs.
    extra_ctrls: dict[str, str] = field(default_factory=dict)


# Controls owned by the typed model (NOT preserved in extra_ctrls).
_KNOWN_CTRLS = {
    "auto_exposure",
    "exposure_dynamic_framerate",
    "exposure_time_absolute",
    "exposure_absolute",  # legacy alias of exposure_time_absolute
    "exposure_auto",  # legacy alias of auto_exposure
    "brightness",
    "contrast",
    "saturation",
    "gain",
    "gamma",
    "sharpness",
    "backlight_compensation",
    "white_balance_automatic",
    "white_balance_temperature_auto",  # legacy alias
    "power_line_frequency",
}

# Match: ExecStartPre[=-]/usr/bin/v4l2-ctl ... (--set-ctrl=K=V | -c K=V)
_CTRL_RE = re.compile(
    r"ExecStartPre=-?.*v4l2-ctl.*?(?:--set-ctrl[= ]|-c\s+)"
    r"(?P<name>[A-Za-z_]+)=(?P<val>-?\d+)"
)
_FLAG_RE = re.compile(r"--(?P<key>[a-z0-9-]+)(?:=(?P<val>\S+))?")
_FLAG_TO_FIELD = {
    "device": "device",
    "resolution": "resolution",
    "desired-fps": "desired_fps",
    "host": "host",
    "port": "port",
    "drop-same-frames": "drop_same_frames",
}
_INT_FIELDS = {"desired_fps", "port", "drop_same_frames"}


def parse_dropin(path: Path) -> WebcamSettings:
    """Parse the drop-in file into a WebcamSettings, falling back to defaults."""
    s = WebcamSettings()
    if not path.exists():
        return s

    text = path.read_text(encoding="utf-8")
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith("["):
            continue
        m = _CTRL_RE.search(line)
        if m:
            _apply_ctrl(s, m.group("name"), m.group("val"))
            continue
        if line.startswith("ExecStart=") and "ustreamer" in line:
            for flag in _FLAG_RE.finditer(line):
                field_name = _FLAG_TO_FIELD.get(flag.group("key"))
                if field_name is None:
                    continue
                val = flag.group("val")
                if val is None:
                    continue
                if field_name in _INT_FIELDS:
                    try:
                        setattr(s, field_name, int(val))
                    except ValueError:
                        continue
                else:
                    setattr(s, field_name, val)
    return s


def _apply_ctrl(s: WebcamSettings, name: str, raw: str) -> None:
    try:
        val = int(raw)
    except ValueError:
        return
    # Normalise legacy aliases.
    if name in {"auto_exposure", "exposure_auto"}:
        s.auto_exposure = val == AUTO_EXPOSURE_AUTO
        return
    if name in {"exposure_time_absolute", "exposure_absolute"}:
        s.exposure_time_absolute = val
        return
    if name in {"white_balance_automatic", "white_balance_temperature_auto"}:
        s.white_balance_automatic = bool(val)
        return
    if name == "exposure_dynamic_framerate":
        s.exposure_dynamic_framerate = bool(val)
        return
    if hasattr(s, name) and name in _KNOWN_CTRLS:
        setattr(s, name, val)
        return
    # Unknown control: preserve verbatim so saves don't strip it.
    s.extra_ctrls[name] = raw


def render_dropin(s: WebcamSettings) -> str:
    """Render WebcamSettings back into a systemd drop-in file body."""
    d = s.device
    ctrls: list[tuple[str, int | str]] = [
        ("power_line_frequency", s.power_line_frequency),
        (
            "auto_exposure",
            AUTO_EXPOSURE_AUTO if s.auto_exposure else AUTO_EXPOSURE_MANUAL,
        ),
        ("exposure_dynamic_framerate", 1 if s.exposure_dynamic_framerate else 0),
    ]
    if not s.auto_exposure:
        ctrls.append(("exposure_time_absolute", s.exposure_time_absolute))
    ctrls.extend(
        [
            ("gain", s.gain),
            ("brightness", s.brightness),
            ("gamma", s.gamma),
            ("contrast", s.contrast),
            ("saturation", s.saturation),
            ("sharpness", s.sharpness),
            ("backlight_compensation", s.backlight_compensation),
            ("white_balance_automatic", 1 if s.white_balance_automatic else 0),
        ]
    )
    for k, v in s.extra_ctrls.items():
        ctrls.append((k, v))

    lines = [
        "# Managed by bambu-monitor settings tab. Edits via UI overwrite this file.",
        "[Service]",
    ]
    for name, value in ctrls:
        lines.append(
            f"ExecStartPre=-/usr/bin/v4l2-ctl -d {d} --set-ctrl={name}={value}"
        )
    lines.append("ExecStart=")
    lines.append(
        "ExecStart=/usr/bin/ustreamer "
        f"--device={d} "
        f"--resolution={s.resolution} "
        f"--desired-fps={s.desired_fps} "
        f"--format=MJPEG "
        f"--host={s.host} "
        f"--port={s.port} "
        f"--drop-same-frames={s.drop_same_frames} "
        f"--slowdown"
    )
    return "\n".join(lines) + "\n"


def write_dropin(path: Path, content: str) -> None:
    """Write the drop-in file, using sudo tee if the path is not writable."""
    if _can_write(path):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return
    cmd = ["sudo", "-n", "tee", str(path)]
    proc = subprocess.run(
        cmd, input=content, text=True, capture_output=True, check=False
    )
    if proc.returncode != 0:
        raise PermissionError(
            f"sudo tee failed for {path}: {proc.stderr.strip() or proc.stdout.strip()}"
            f" (cmd: {shlex.join(cmd)})"
        )


def _can_write(path: Path) -> bool:
    import os

    target = path if path.exists() else path.parent
    if not target.exists():
        return False
    return os.access(target, os.W_OK)
