from __future__ import annotations

import os
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

# Force a memory DB before any app module imports it.
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("PRINTER_IP", "127.0.0.1")
os.environ.setdefault("PRINTER_SERIAL", "TEST")
os.environ.setdefault("PRINTER_ACCESS_CODE", "00000000")


@pytest_asyncio.fixture
async def session() -> AsyncIterator[AsyncSession]:
    """Per-test in-memory async SQLite session."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
    )
    # Importing models registers them on SQLModel.metadata.
    from app.db import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)
    async with SessionLocal() as s:
        yield s
    await engine.dispose()


@pytest.fixture(autouse=True)
def reset_state() -> None:
    from app import state

    state.reset()
