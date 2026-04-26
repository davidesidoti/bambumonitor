from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.services import filament as filament_svc

router = APIRouter()


class FilamentBody(BaseModel):
    type: str
    color: str


@router.get("/filament/current", response_model=FilamentBody, tags=["filament"])
async def get_current(session: AsyncSession = Depends(get_session)) -> FilamentBody:
    data = await filament_svc.get_current(session)
    return FilamentBody(**data)


@router.put("/filament/current", response_model=FilamentBody, tags=["filament"])
async def put_current(
    body: FilamentBody,
    session: AsyncSession = Depends(get_session),
) -> FilamentBody:
    data = await filament_svc.upsert(session, type_=body.type, color=body.color)
    return FilamentBody(**data)
