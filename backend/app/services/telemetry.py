"""Sample PrinterState every N seconds and persist a TelemetryPoint while a print is active."""

from __future__ import annotations

import asyncio

from app.config import get_settings
from app.db.models import TelemetryPoint
from app.db.session import session_scope
from app.services.print_tracker import active_print_id, telemetry_signal
from app.state import snapshot
from app.utils.logging import get_logger
from app.utils.time import utcnow

log = get_logger(__name__)

_task: asyncio.Task[None] | None = None


async def _sample_loop() -> None:
    settings = get_settings()
    interval = max(2, settings.telemetry_interval_seconds)
    signal = telemetry_signal()
    while True:
        if active_print_id() is None:
            signal.clear()
            await signal.wait()
            continue
        try:
            await _record_one()
        except Exception as exc:
            # Telemetry failures are not fatal: log and continue.
            log.warning("telemetry.write_failed", error=str(exc))
        await asyncio.sleep(interval)


async def _record_one() -> None:
    pid = active_print_id()
    if pid is None:
        return
    s = snapshot()
    point = TelemetryPoint(
        print_id=pid,
        timestamp=utcnow(),
        nozzle_temp=s.nozzle_temp,
        nozzle_target=s.nozzle_target,
        bed_temp=s.bed_temp,
        bed_target=s.bed_target,
        layer_num=s.layer_num,
        percent=int(round(s.percent)),
        speed=s.print_speed,
        fan_speed=s.fan_speed,
    )
    async with session_scope() as session:
        session.add(point)


def start() -> None:
    global _task
    if _task is not None:
        return
    _task = asyncio.create_task(_sample_loop(), name="telemetry-sampler")


async def stop() -> None:
    global _task
    if _task is None:
        return
    _task.cancel()
    try:
        await _task
    except (asyncio.CancelledError, BaseException):
        pass
    _task = None
