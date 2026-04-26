"""Detect print start/end transitions from gcode_state changes and persist them.

State machine
=============
* IDLE/FINISH/FAILED -> PREPARE/RUNNING : a new print is starting.
  Insert a Print row with status="running", started_at = gcode_start_time
  if available else now, copy file_name, total_layers, filament info.
  Remember the new id as the "active print".
* RUNNING/PAUSE -> FINISH : update active print, status="finished",
  ended_at = now, duration computed.
* RUNNING/PAUSE -> FAILED : same but status="failed".

Edge cases
==========
* Backend boots mid-print: on the first state we see, if gcode_state is
  RUNNING/PAUSE and we have no active print in memory, treat it as a
  start, deriving started_at from gcode_start_time when present.
* total_layers is sometimes 0 on the first PREPARE message; later messages
  carry the right value, so we backfill the active row whenever we see a
  larger total_layer_num.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any

from sqlmodel import select

from app.db.models import Print
from app.db.session import session_scope
from app.pubsub import TOPIC_PRINT_EVENT, TOPIC_STATE_DELTA, bus
from app.state import snapshot
from app.utils.logging import get_logger
from app.utils.time import utcnow

log = get_logger(__name__)

ACTIVE_STATES: frozenset[str] = frozenset({"PREPARE", "RUNNING", "PAUSE"})
END_STATES: frozenset[str] = frozenset({"FINISH", "FAILED"})

_active_id: int | None = None
_last_gcode: str | None = None
_telemetry_event: asyncio.Event | None = None
_task: asyncio.Task[None] | None = None


def telemetry_signal() -> asyncio.Event:
    global _telemetry_event
    if _telemetry_event is None:
        _telemetry_event = asyncio.Event()
    return _telemetry_event


def active_print_id() -> int | None:
    return _active_id


async def _create_print(state_now: Any) -> Print:
    started = (
        datetime.fromisoformat(state_now.started_at.replace("Z", "+00:00"))
        if state_now.started_at
        else utcnow()
    )
    row = Print(
        file_name=state_now.file_name or "(sconosciuto)",
        started_at=started,
        ended_at=None,
        status="running",
        total_layers=state_now.total_layer_num,
        duration_seconds=None,
        filament_type=state_now.filament_type,
        filament_color=state_now.filament_color,
        filament_used_g=None,
        notes=None,
    )
    async with session_scope() as session:
        session.add(row)
        await session.flush()
        await session.refresh(row)
    log.info("print.started", id=row.id, file=row.file_name)
    return row


async def _close_print(print_id: int, status: str) -> Print | None:
    async with session_scope() as session:
        row = await session.get(Print, print_id)
        if row is None:
            return None
        row.ended_at = utcnow()
        row.status = status
        row.duration_seconds = int(
            (row.ended_at - row.started_at).total_seconds()
        )
        session.add(row)
        await session.flush()
        await session.refresh(row)
    log.info("print.ended", id=print_id, status=status)
    return row


async def _backfill_layers(print_id: int, total_layers: int) -> None:
    async with session_scope() as session:
        row = await session.get(Print, print_id)
        if row is None:
            return
        if row.total_layers < total_layers:
            row.total_layers = total_layers
            session.add(row)


async def _restore_active_from_db() -> None:
    """On boot: if there's a row with status='running' it was orphaned by a
    previous shutdown. Adopt it so we don't double-record."""
    global _active_id
    async with session_scope() as session:
        result = await session.exec(
            select(Print).where(Print.status == "running").order_by(Print.id.desc())
        )
        row = result.first()
        if row is not None:
            _active_id = row.id
            log.info("print.adopted_orphan", id=row.id)


async def _handle_delta(_delta: dict[str, Any]) -> None:
    global _active_id, _last_gcode
    state_now = snapshot()
    gcode = state_now.gcode_state

    if _last_gcode == gcode:
        # No transition; still maybe backfill total_layers.
        if _active_id is not None and state_now.total_layer_num > 0:
            await _backfill_layers(_active_id, state_now.total_layer_num)
        return

    log.info("print.transition", from_=_last_gcode, to=gcode)

    if gcode in ACTIVE_STATES and _active_id is None:
        row = await _create_print(state_now)
        _active_id = row.id
        bus.publish(TOPIC_PRINT_EVENT, {"event": "print_started", "print_id": row.id})
        telemetry_signal().set()
    elif gcode in END_STATES and _active_id is not None:
        status = "finished" if gcode == "FINISH" else "failed"
        row = await _close_print(_active_id, status)
        if row is not None:
            event = "print_finished" if status == "finished" else "print_failed"
            bus.publish(TOPIC_PRINT_EVENT, {"event": event, "print_id": _active_id})
        _active_id = None
        ev = telemetry_signal()
        ev.clear()

    _last_gcode = gcode


async def _run() -> None:
    global _last_gcode
    queue = await bus.subscribe(TOPIC_STATE_DELTA)
    await _restore_active_from_db()
    _last_gcode = snapshot().gcode_state
    try:
        while True:
            delta = await queue.get()
            try:
                await _handle_delta(delta)
            except Exception as exc:
                log.warning("print_tracker.error", error=str(exc))
    except asyncio.CancelledError:
        await bus.unsubscribe(TOPIC_STATE_DELTA, queue)
        raise


def start() -> None:
    global _task
    if _task is not None:
        return
    _task = asyncio.create_task(_run(), name="print-tracker")


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
