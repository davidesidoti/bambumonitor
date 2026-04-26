from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.db.models import Print, TelemetryPoint

router = APIRouter()


class PrintsPage(BaseModel):
    items: list[Print]
    total: int
    page: int
    page_size: int


class PrintDetail(BaseModel):
    id: int
    file_name: str
    started_at: datetime
    ended_at: datetime | None
    status: str
    total_layers: int
    duration_seconds: int | None
    filament_type: str | None
    filament_color: str | None
    filament_used_g: float | None
    notes: str | None
    telemetry: list[TelemetryPoint]


class PrintPatch(BaseModel):
    notes: str | None = None
    filament_color: str | None = None


@router.get("/prints", response_model=PrintsPage, tags=["prints"])
async def list_prints(
    status: str | None = Query(default=None, description="CSV of statuses to include"),
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> PrintsPage:
    statuses = [s.strip() for s in status.split(",")] if status else None
    where: list[Any] = []
    if statuses:
        where.append(Print.status.in_(statuses))
    if from_:
        try:
            from_dt = datetime.fromisoformat(from_.replace("Z", "+00:00"))
        except ValueError as exc:
            raise HTTPException(400, f"invalid 'from' date: {exc}") from exc
        where.append(Print.started_at >= from_dt)
    if to:
        try:
            to_dt = datetime.fromisoformat(to.replace("Z", "+00:00"))
        except ValueError as exc:
            raise HTTPException(400, f"invalid 'to' date: {exc}") from exc
        where.append(Print.started_at <= to_dt)

    base = select(Print)
    if where:
        base = base.where(*where)
    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        await session.execute(
            base.order_by(Print.started_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    return PrintsPage(items=list(rows), total=int(total), page=page, page_size=page_size)


@router.get("/prints/{print_id}", response_model=PrintDetail, tags=["prints"])
async def get_print(
    print_id: int,
    session: AsyncSession = Depends(get_session),
) -> PrintDetail:
    row = await session.get(Print, print_id)
    if row is None:
        raise HTTPException(404, "print not found")
    points = (
        await session.execute(
            select(TelemetryPoint)
            .where(TelemetryPoint.print_id == print_id)
            .order_by(TelemetryPoint.timestamp.asc())
        )
    ).scalars().all()
    return PrintDetail(
        id=row.id or 0,
        file_name=row.file_name,
        started_at=row.started_at,
        ended_at=row.ended_at,
        status=row.status,
        total_layers=row.total_layers,
        duration_seconds=row.duration_seconds,
        filament_type=row.filament_type,
        filament_color=row.filament_color,
        filament_used_g=row.filament_used_g,
        notes=row.notes,
        telemetry=list(points),
    )


@router.patch("/prints/{print_id}", response_model=PrintDetail, tags=["prints"])
async def update_print(
    print_id: int,
    body: PrintPatch,
    session: AsyncSession = Depends(get_session),
) -> PrintDetail:
    row = await session.get(Print, print_id)
    if row is None:
        raise HTTPException(404, "print not found")
    if body.notes is not None:
        row.notes = body.notes
    if body.filament_color is not None:
        row.filament_color = body.filament_color
    session.add(row)
    await session.flush()
    return await get_print(print_id, session)
