from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Print
from app.services.stats import compute_stats


async def _seed(session: AsyncSession) -> None:
    now = datetime.now(UTC)
    rows = [
        Print(
            file_name="A.3mf",
            started_at=now - timedelta(days=1),
            ended_at=now - timedelta(days=1) + timedelta(seconds=600),
            status="finished",
            total_layers=100,
            duration_seconds=600,
            filament_used_g=10.0,
        ),
        Print(
            file_name="A.3mf",
            started_at=now - timedelta(days=2),
            ended_at=now - timedelta(days=2) + timedelta(seconds=1200),
            status="finished",
            total_layers=100,
            duration_seconds=1200,
            filament_used_g=20.0,
        ),
        Print(
            file_name="B.3mf",
            started_at=now - timedelta(days=3),
            ended_at=now - timedelta(days=3) + timedelta(seconds=300),
            status="failed",
            total_layers=50,
            duration_seconds=300,
            filament_used_g=5.0,
        ),
        Print(
            file_name="C.3mf",
            started_at=now,
            status="running",
            total_layers=120,
        ),
    ]
    for r in rows:
        session.add(r)
    await session.commit()


async def test_compute_stats(session: AsyncSession) -> None:
    await _seed(session)
    stats = await compute_stats(session)

    assert stats["total_prints"] == 4
    assert stats["successful_prints"] == 2
    assert stats["failed_prints"] == 1
    assert stats["total_print_seconds"] == 600 + 1200
    assert stats["average_duration_seconds"] == 900.0
    assert stats["longest_print_seconds"] == 1200
    assert stats["shortest_print_seconds"] == 600
    assert stats["total_filament_g"] == 35.0

    # prints_by_day fills 365 entries (most are zero).
    assert len(stats["prints_by_day"]) == 365
    counted = sum(d["count"] for d in stats["prints_by_day"])
    assert counted == 4

    # Top files: A.3mf has 2 prints, others have 1.
    top = stats["top_files"]
    assert top[0]["file_name"] == "A.3mf"
    assert top[0]["count"] == 2
    assert top[0]["avg_duration_seconds"] == 900.0


async def test_empty_db_returns_zeros(session: AsyncSession) -> None:
    stats = await compute_stats(session)
    assert stats["total_prints"] == 0
    assert stats["successful_prints"] == 0
    assert stats["failed_prints"] == 0
    assert stats["total_print_seconds"] == 0
    assert stats["average_duration_seconds"] is None
    assert stats["longest_print_seconds"] is None
    assert stats["shortest_print_seconds"] is None
    assert stats["total_filament_g"] is None
    assert stats["top_files"] == []
