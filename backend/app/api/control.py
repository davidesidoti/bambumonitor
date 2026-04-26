"""Printer control endpoints (publish commands on the MQTT request topic)."""

from __future__ import annotations

import time
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.mqtt import worker as mqtt_worker
from app.pubsub import TOPIC_STATE_DELTA, bus
from app.state import apply_patch
from app.utils.logging import get_logger

router = APIRouter()
log = get_logger(__name__)


SpeedLevel = Literal[1, 2, 3, 4]


class SpeedBody(BaseModel):
    level: SpeedLevel = Field(description="1=Silent, 2=Standard, 3=Sport, 4=Ludicrous")


class CommandResult(BaseModel):
    ok: bool
    detail: str


def _publish(payload: dict[str, Any]) -> bool:
    client = mqtt_worker.get_client()
    if client is None:
        return False
    return client.publish_command(payload)


@router.post("/control/speed", response_model=CommandResult, tags=["control"])
async def set_speed(body: SpeedBody) -> CommandResult:
    payload = {
        "print": {
            "sequence_id": str(int(time.time())),
            "command": "print_speed",
            "param": str(body.level),
        }
    }
    if not _publish(payload):
        raise HTTPException(503, "MQTT not connected")
    log.info("control.speed", level=body.level)

    # Optimistic local update so the UI reflects the change immediately. The
    # printer's next report will overwrite this if the command was rejected.
    applied = apply_patch({"print_speed": body.level})
    if applied:
        bus.publish(TOPIC_STATE_DELTA, applied)

    return CommandResult(ok=True, detail=f"speed set to {body.level}")
