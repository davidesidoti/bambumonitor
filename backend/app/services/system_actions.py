"""System-level side effects triggered by the settings tab.

All operations require sudoers grants for the `bambu` user (see
deploy/sudoers/bambu-monitor). Each function raises PermissionError on a
non-zero exit so the API layer can return 500 with a useful message.
"""

from __future__ import annotations

import asyncio
import shlex
import subprocess
from collections.abc import AsyncIterator
from pathlib import Path

from app.utils.logging import get_logger

log = get_logger(__name__)

_update_lock = asyncio.Lock()
_pending_tasks: set[asyncio.Task[None]] = set()


def daemon_reload() -> None:
    _run(["sudo", "-n", "/bin/systemctl", "daemon-reload"])


def restart_service(name: str) -> None:
    """Restart a systemd unit. Whitelisted to known service names."""
    if name not in {"bambu-monitor.service", "ustreamer.service"}:
        raise ValueError(f"refusing to restart unknown unit: {name}")
    _run(["sudo", "-n", "/bin/systemctl", "restart", name])


async def schedule_restart(name: str, delay_seconds: float = 1.0) -> None:
    """Restart a service after `delay_seconds`. Used so the HTTP response can
    return before the backend kills itself."""

    async def _later() -> None:
        await asyncio.sleep(delay_seconds)
        try:
            restart_service(name)
        except Exception as exc:  # pragma: no cover - logged for ops
            log.error("settings.restart_failed", service=name, error=str(exc))

    task = asyncio.create_task(_later())
    _pending_tasks.add(task)
    task.add_done_callback(_pending_tasks.discard)


def update_lock_held() -> bool:
    return _update_lock.locked()


async def run_update_streaming(script_path: Path) -> AsyncIterator[str]:
    """Run the update script via sudo, yielding stdout/stderr lines.

    Yields plain text lines (no SSE framing — the API layer wraps them).
    Raises RuntimeError if another update is already running.
    """
    if _update_lock.locked():
        raise RuntimeError("update already in progress")

    async with _update_lock:
        proc = await asyncio.create_subprocess_exec(
            "sudo",
            "-n",
            str(script_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        assert proc.stdout is not None
        try:
            async for raw in proc.stdout:
                yield raw.decode("utf-8", errors="replace").rstrip("\n")
        finally:
            rc = await proc.wait()
        yield f"__exit__:{rc}"


def _run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        raise PermissionError(
            f"command failed ({proc.returncode}): {shlex.join(cmd)}\n"
            f"{proc.stderr.strip() or proc.stdout.strip()}"
        )
