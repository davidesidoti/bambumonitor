"""Tiny in-process publish-subscribe bus for fan-out to WS clients.

Subscribers get an asyncio.Queue; publishers push messages onto every active
queue. No persistence, no replay; missed messages are missed.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any

Topic = str


class Pubsub:
    def __init__(self) -> None:
        self._subscribers: dict[Topic, set[asyncio.Queue[Any]]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def subscribe(self, topic: Topic, maxsize: int = 256) -> asyncio.Queue[Any]:
        q: asyncio.Queue[Any] = asyncio.Queue(maxsize=maxsize)
        async with self._lock:
            self._subscribers[topic].add(q)
        return q

    async def unsubscribe(self, topic: Topic, queue: asyncio.Queue[Any]) -> None:
        async with self._lock:
            self._subscribers.get(topic, set()).discard(queue)

    def publish(self, topic: Topic, message: Any) -> None:
        # No locking on the hot path: subscribe / unsubscribe operations are
        # rare relative to publish, and we tolerate momentary set mutation
        # since failing to deliver to a just-removed subscriber is fine.
        for q in list(self._subscribers.get(topic, set())):
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                # Slow consumer: drop oldest, then enqueue. Keeps WS clients
                # bounded without back-pressuring the MQTT worker.
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    q.put_nowait(message)
                except asyncio.QueueFull:
                    pass


bus = Pubsub()

TOPIC_STATE_DELTA = "state_delta"
TOPIC_PRINT_EVENT = "print_event"
