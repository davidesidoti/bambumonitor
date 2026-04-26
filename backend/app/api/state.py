from __future__ import annotations

from fastapi import APIRouter

from app.state import PrinterState, snapshot

router = APIRouter()


@router.get("/state", response_model=PrinterState, tags=["state"])
async def get_state() -> PrinterState:
    return snapshot()
