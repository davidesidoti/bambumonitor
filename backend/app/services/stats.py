"""Aggregations powering /api/stats."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Print


async def compute_stats(session: AsyncSession) -> dict[str, Any]:
    total = (await session.execute(select(func.count(Print.id)))).scalar_one()
    successful = (
        await session.execute(
            select(func.count(Print.id)).where(Print.status == "finished")
        )
    ).scalar_one()
    failed = (
        await session.execute(
            select(func.count(Print.id)).where(Print.status == "failed")
        )
    ).scalar_one()

    # Time aggregates over finished prints with a duration.
    duration_q = select(
        func.coalesce(func.sum(Print.duration_seconds), 0),
        func.avg(Print.duration_seconds),
        func.max(Print.duration_seconds),
        func.min(Print.duration_seconds),
    ).where(Print.status == "finished", Print.duration_seconds.is_not(None))
    total_seconds, avg_seconds, max_seconds, min_seconds = (
        await session.execute(duration_q)
    ).one()

    total_filament = (
        await session.execute(
            select(func.coalesce(func.sum(Print.filament_used_g), 0.0))
        )
    ).scalar_one()

    # Per-day counts (last 365 days), filled with zeros for empty days.
    now = datetime.now(UTC)
    cutoff = now - timedelta(days=365)
    rows = (
        await session.execute(
            select(
                func.date(Print.started_at).label("d"),
                func.count(Print.id).label("c"),
            )
            .where(Print.started_at >= cutoff)
            .group_by("d")
        )
    ).all()
    by_day: dict[str, int] = {str(r.d): int(r.c) for r in rows}
    days: list[dict[str, Any]] = []
    for i in range(365):
        d = (now - timedelta(days=364 - i)).date().isoformat()
        days.append({"date": d, "count": by_day.get(d, 0)})

    # Top files by count.
    top_rows = (
        await session.execute(
            select(
                Print.file_name,
                func.count(Print.id).label("c"),
                func.coalesce(func.avg(Print.duration_seconds), 0.0).label("avg"),
            )
            .group_by(Print.file_name)
            .order_by(func.count(Print.id).desc())
            .limit(10)
        )
    ).all()
    top_files = [
        {
            "file_name": r.file_name,
            "count": int(r.c),
            "avg_duration_seconds": float(r.avg or 0.0),
        }
        for r in top_rows
    ]

    return {
        "total_prints": int(total),
        "successful_prints": int(successful),
        "failed_prints": int(failed),
        "total_print_seconds": int(total_seconds or 0),
        "total_filament_g": float(total_filament) if total_filament else None,
        "average_duration_seconds": float(avg_seconds) if avg_seconds is not None else None,
        "longest_print_seconds": int(max_seconds) if max_seconds is not None else None,
        "shortest_print_seconds": int(min_seconds) if min_seconds is not None else None,
        "prints_by_day": days,
        "top_files": top_files,
    }
