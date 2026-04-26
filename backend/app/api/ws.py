"""WebSocket endpoint: snapshot + delta + print events.

On connect:
  1. Send {"type": "snapshot", "state": <full PrinterState>}.
  2. Subscribe to state_delta + print_event topics.
  3. Forward each delta as {"type": "delta", "patch": {...}}.
  4. Forward print events as {"type": "print_started|finished|failed", "print": {...}}.

Heartbeat:
  Every N seconds send {"type": "ping"}; if no pong arrives within timeout,
  close the connection so the client reconnects.

Concurrency:
  Each connection gets its own pubsub subscription, so multiple browsers /
  tabs can all listen at once without interfering.
"""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.config import get_settings
from app.db.models import Print
from app.db.session import SessionLocal
from app.pubsub import TOPIC_PRINT_EVENT, TOPIC_STATE_DELTA, bus
from app.state import snapshot
from app.utils.logging import get_logger

router = APIRouter()
log = get_logger(__name__)


@router.websocket("/ws")
async def ws(websocket: WebSocket) -> None:
    await websocket.accept()
    settings = get_settings()
    interval = settings.ws_heartbeat_interval_seconds

    snap = snapshot()
    await websocket.send_text(json.dumps({"type": "snapshot", "state": snap.model_dump()}))

    delta_q = await bus.subscribe(TOPIC_STATE_DELTA)
    event_q = await bus.subscribe(TOPIC_PRINT_EVENT)

    last_pong = asyncio.get_event_loop().time()

    async def reader() -> None:
        nonlocal last_pong
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if isinstance(msg, dict) and msg.get("type") == "pong":
                last_pong = asyncio.get_event_loop().time()

    async def heartbeat() -> None:
        nonlocal last_pong
        while True:
            await asyncio.sleep(interval)
            if asyncio.get_event_loop().time() - last_pong > interval * 2:
                await websocket.close(code=1000, reason="heartbeat lost")
                return
            await websocket.send_text(json.dumps({"type": "ping"}))

    async def fan_deltas() -> None:
        while True:
            patch = await delta_q.get()
            await websocket.send_text(json.dumps({"type": "delta", "patch": patch}))

    async def fan_events() -> None:
        while True:
            evt = await event_q.get()
            print_id = evt.get("print_id")
            payload: dict[str, object] = {"type": evt["event"]}
            if print_id is not None:
                async with SessionLocal() as session:
                    row = (
                        await session.execute(select(Print).where(Print.id == print_id))
                    ).scalar_one_or_none()
                    if row is not None:
                        payload["print"] = json.loads(_serialize_print(row))
            await websocket.send_text(json.dumps(payload))

    tasks = [
        asyncio.create_task(reader(), name="ws-reader"),
        asyncio.create_task(heartbeat(), name="ws-heartbeat"),
        asyncio.create_task(fan_deltas(), name="ws-deltas"),
        asyncio.create_task(fan_events(), name="ws-events"),
    ]
    try:
        done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_EXCEPTION)
        for t in done:
            exc = t.exception()
            if exc and not isinstance(exc, WebSocketDisconnect):
                log.warning("ws.task_failed", task=t.get_name(), error=str(exc))
    except WebSocketDisconnect:
        pass
    finally:
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await bus.unsubscribe(TOPIC_STATE_DELTA, delta_q)
        await bus.unsubscribe(TOPIC_PRINT_EVENT, event_q)


def _serialize_print(p: Print) -> str:
    return json.dumps(
        {
            "id": p.id,
            "file_name": p.file_name,
            "started_at": p.started_at.isoformat() if p.started_at else None,
            "ended_at": p.ended_at.isoformat() if p.ended_at else None,
            "status": p.status,
            "total_layers": p.total_layers,
            "duration_seconds": p.duration_seconds,
            "filament_type": p.filament_type,
            "filament_color": p.filament_color,
            "filament_used_g": p.filament_used_g,
            "notes": p.notes,
        }
    )
