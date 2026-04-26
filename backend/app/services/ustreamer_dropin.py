"""Read and write the systemd drop-in for the ustreamer.service unit.

The drop-in lives at /etc/systemd/system/ustreamer.service.d/override.conf and
is consumed by `systemctl daemon-reload && systemctl restart ustreamer`. We
parse it back into a typed model so the UI can show the current values, and
re-render it from the model on save.

The base ustreamer.service in the repo defines an ExecStart= line; to override
it from a drop-in we must emit an empty `ExecStart=` first to clear the prior
value, then a new `ExecStart=` with our flags. v4l2 controls go in
ExecStartPre= lines (one per knob).
"""

from __future__ import annotations

import re
import shlex
import subprocess
from dataclasses import dataclass
from pathlib import Path

DEFAULTS = {
    "device": "/dev/video0",
    "resolution": "1280x720",
    "desired_fps": 15,
    "host": "127.0.0.1",
    "port": 9999,
    "drop_same_frames": 0,
    "exposure": 250,
    "gain": 0,
    "contrast": 128,
    "brightness": 128,
}


@dataclass
class WebcamSettings:
    device: str = "/dev/video0"
    resolution: str = "1280x720"
    desired_fps: int = 15
    host: str = "127.0.0.1"
    port: int = 9999
    drop_same_frames: int = 0
    exposure: int = 250
    gain: int = 0
    contrast: int = 128
    brightness: int = 128


_V4L2_CTL_RE = re.compile(
    r"^ExecStartPre=.*v4l2-ctl.*-c\s+(?P<name>[A-Za-z_]+)=(?P<val>-?\d+)\s*$"
)
_FLAG_RE = re.compile(r"--(?P<key>[a-z0-9-]+)(?:=(?P<val>\S+))?")
_V4L2_TO_FIELD = {
    "exposure_absolute": "exposure",
    "gain": "gain",
    "contrast": "contrast",
    "brightness": "brightness",
}
_FLAG_TO_FIELD = {
    "device": "device",
    "resolution": "resolution",
    "desired-fps": "desired_fps",
    "host": "host",
    "port": "port",
    "drop-same-frames": "drop_same_frames",
}
_INT_FIELDS = {
    "desired_fps",
    "port",
    "drop_same_frames",
    "exposure",
    "gain",
    "contrast",
    "brightness",
}


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
        m = _V4L2_CTL_RE.match(line)
        if m:
            field = _V4L2_TO_FIELD.get(m.group("name"))
            if field:
                setattr(s, field, int(m.group("val")))
            continue
        if line.startswith("ExecStart=") and "ustreamer" in line:
            for flag in _FLAG_RE.finditer(line):
                field = _FLAG_TO_FIELD.get(flag.group("key"))
                if field is None:
                    continue
                val = flag.group("val")
                if val is None:
                    continue
                if field in _INT_FIELDS:
                    try:
                        setattr(s, field, int(val))
                    except ValueError:
                        continue
                else:
                    setattr(s, field, val)
    return s


def render_dropin(s: WebcamSettings) -> str:
    """Render WebcamSettings back into a systemd drop-in file body."""
    lines = [
        "# Managed by bambu-monitor settings tab. Edits via UI overwrite this file.",
        "[Service]",
        f"ExecStartPre=/usr/bin/v4l2-ctl -d {s.device} -c exposure_auto=1",
        f"ExecStartPre=/usr/bin/v4l2-ctl -d {s.device} -c exposure_absolute={s.exposure}",
        f"ExecStartPre=/usr/bin/v4l2-ctl -d {s.device} -c gain={s.gain}",
        f"ExecStartPre=/usr/bin/v4l2-ctl -d {s.device} -c contrast={s.contrast}",
        f"ExecStartPre=/usr/bin/v4l2-ctl -d {s.device} -c brightness={s.brightness}",
        "ExecStart=",
        (
            f"ExecStart=/usr/bin/ustreamer "
            f"--device={s.device} "
            f"--resolution={s.resolution} "
            f"--desired-fps={s.desired_fps} "
            f"--format=MJPEG "
            f"--host={s.host} "
            f"--port={s.port} "
            f"--drop-same-frames={s.drop_same_frames} "
            f"--slowdown"
        ),
    ]
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
