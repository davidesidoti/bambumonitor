from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.mqtt.client import mqtt_status

router = APIRouter()


class Health(BaseModel):
    ok: bool
    mqtt_connected: bool


@router.get("/health", response_model=Health, tags=["health"])
async def health() -> Health:
    return Health(ok=True, mqtt_connected=mqtt_status().connected)
