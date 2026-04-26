from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.services.stats import compute_stats

router = APIRouter()


@router.get("/stats", tags=["stats"])
async def stats(session: AsyncSession = Depends(get_session)) -> dict[str, Any]:
    return await compute_stats(session)
