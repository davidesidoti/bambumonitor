from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import control as control_api
from app.api import filament as filament_api
from app.api import health as health_api
from app.api import prints as prints_api
from app.api import settings as settings_api
from app.api import state as state_api
from app.api import stats as stats_api
from app.api import ws as ws_api
from app.config import get_settings
from app.db.session import init_db
from app.mqtt import worker as mqtt_worker
from app.services import print_tracker, telemetry
from app.utils.logging import configure_logging, get_logger

log = get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level, settings.dev_mode)
    log.info("app.starting", version=settings_api.get_version().version)

    await init_db()
    mqtt_worker.start_worker()
    print_tracker.start()
    telemetry.start()

    try:
        yield
    finally:
        log.info("app.stopping")
        await telemetry.stop()
        await print_tracker.stop()
        await mqtt_worker.stop_worker()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Bambu Monitor API",
        version=settings_api.get_version().version,
        lifespan=lifespan,
    )

    if get_settings().dev_mode:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.include_router(health_api.router, prefix="/api")
    app.include_router(state_api.router, prefix="/api")
    app.include_router(prints_api.router, prefix="/api")
    app.include_router(stats_api.router, prefix="/api")
    app.include_router(filament_api.router, prefix="/api")
    app.include_router(control_api.router, prefix="/api")
    app.include_router(settings_api.router, prefix="/api")
    app.include_router(ws_api.router)

    return app


app = create_app()
