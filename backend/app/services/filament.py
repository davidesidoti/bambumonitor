"""Filament merging.

The Bambu A1 base (no AMS Lite) does not reliably report the loaded
filament. Strategy:
  1. If the printer reported a filament_type via MQTT (in PrinterState),
     use that as the type.
  2. Otherwise fall back to whatever the user last saved via PUT
     /api/filament/current.
  3. The color always comes from the user-set value (printer never
     reports color on this hardware).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import FilamentSetting
from app.state import snapshot
from app.utils.time import utcnow


async def get_current(session: AsyncSession) -> dict[str, str]:
    s = snapshot()
    row = (
        await session.execute(
            select(FilamentSetting).order_by(FilamentSetting.id.desc()).limit(1)
        )
    ).scalar_one_or_none()
    user_type = row.type if row else ""
    user_color = row.color if row else ""
    return {
        "type": s.filament_type or user_type,
        "color": user_color,
    }


async def upsert(session: AsyncSession, *, type_: str, color: str) -> dict[str, str]:
    row = (
        await session.execute(
            select(FilamentSetting).order_by(FilamentSetting.id.desc()).limit(1)
        )
    ).scalar_one_or_none()
    if row is None:
        row = FilamentSetting(type=type_, color=color, updated_at=utcnow())
    else:
        row.type = type_
        row.color = color
        row.updated_at = utcnow()
    session.add(row)
    return {"type": row.type, "color": row.color}
