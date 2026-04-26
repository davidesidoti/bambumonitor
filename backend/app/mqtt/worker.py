"""Asyncio bridge over the (sync, threaded) paho MQTT loop.

Lifecycle (called from FastAPI lifespan):
  start_worker() -> launches the paho thread + the asyncio drain task
  stop_worker()  -> graceful shutdown of both
"""

from __future__ import annotations

import asyncio
import queue as stdqueue
from typing import Any

from app.mqtt.client import BambuMqttClient
from app.mqtt.parser import parse_report
from app.pubsub import TOPIC_STATE_DELTA, bus
from app.state import apply_patch
from app.utils.logging import get_logger

log = get_logger(__name__)

_message_queue: stdqueue.Queue[dict[str, Any]] = stdqueue.Queue(maxsize=512)
_client: BambuMqttClient | None = None
_drain_task: asyncio.Task[None] | None = None


async def _drain() -> None:
    loop = asyncio.get_running_loop()
    while True:
        try:
            payload = await loop.run_in_executor(None, _message_queue.get)
        except asyncio.CancelledError:
            raise
        if payload is None:
            return
        try:
            patch = parse_report(payload)
            if patch:
                applied = apply_patch(patch)
                if applied:
                    bus.publish(TOPIC_STATE_DELTA, applied)
        except Exception as exc:
            log.warning("mqtt.process_error", error=str(exc))


def get_client() -> BambuMqttClient | None:
    """Return the running MQTT client or None if not started yet.

    Used by the control API to publish commands without exposing the
    paho internals.
    """
    return _client


def start_worker() -> None:
    global _client, _drain_task
    if _client is not None:
        return
    _client = BambuMqttClient(_message_queue)
    _client.start()
    _drain_task = asyncio.create_task(_drain(), name="mqtt-drain")
    log.info("mqtt.worker_started")


async def stop_worker() -> None:
    global _client, _drain_task
    if _client is not None:
        _client.stop()
        _client = None
    if _drain_task is not None:
        # Push a sentinel so _drain wakes up from queue.get().
        try:
            _message_queue.put_nowait({})  # parse_report returns {} for non-print, no-op
        except stdqueue.Full:
            pass
        _drain_task.cancel()
        try:
            await _drain_task
        except (asyncio.CancelledError, BaseException):
            pass
        _drain_task = None
    log.info("mqtt.worker_stopped")
