"""Paho MQTT client wrapper for the Bambu A1 in LAN mode.

Why TLS verification is disabled
================================
The Bambu A1, when set to LAN-only mode, presents a self-signed TLS
certificate on its MQTT broker (port 8883). There is no public CA chain
that signs it, and the cert changes whenever the printer firmware is
re-flashed. Pinning manually would be brittle and add zero security on
a trusted home network. We therefore disable verification: ``cert_reqs
= ssl.CERT_NONE`` and ``tls_insecure_set(True)``. This is the
standard approach used by every Bambu LAN-mode integration in the wild
(bambulabs-api, OctoPrint plugins, Home Assistant, etc.).

Threading model
===============
paho's loop is synchronous and runs in its own thread (``loop_start``).
Callbacks fire on that worker thread. We must NOT touch asyncio state
from callbacks; instead, we drop incoming messages into a thread-safe
``queue.Queue`` that the asyncio worker drains.
"""

from __future__ import annotations

import json
import queue
import ssl
import threading
import time
from dataclasses import dataclass
from typing import Any

import paho.mqtt.client as mqtt

from app.config import get_settings
from app.utils.logging import get_logger

log = get_logger(__name__)

MQTT_PORT = 8883
MQTT_USERNAME = "bblp"
PUSHALL_PAYLOAD = json.dumps({"pushing": {"sequence_id": "0", "command": "pushall"}})


@dataclass
class MqttStatus:
    connected: bool = False
    last_message_at: float | None = None
    last_error: str | None = None


_status = MqttStatus()
_status_lock = threading.Lock()


def mqtt_status() -> MqttStatus:
    with _status_lock:
        return MqttStatus(
            connected=_status.connected,
            last_message_at=_status.last_message_at,
            last_error=_status.last_error,
        )


def _set_connected(value: bool, error: str | None = None) -> None:
    with _status_lock:
        _status.connected = value
        if error is not None:
            _status.last_error = error


def _set_last_message(ts: float) -> None:
    with _status_lock:
        _status.last_message_at = ts


class BambuMqttClient:
    """Owns the paho client + reconnection loop. Thread-bound."""

    def __init__(self, message_queue: queue.Queue[dict[str, Any]]) -> None:
        self._queue = message_queue
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._client: mqtt.Client | None = None
        self._settings = get_settings()
        self._report_topic = f"device/{self._settings.printer_serial}/report"
        self._request_topic = f"device/{self._settings.printer_serial}/request"

    def start(self) -> None:
        if self._thread is not None:
            return
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run,
            name="bambu-mqtt",
            daemon=True,
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._client is not None:
            try:
                self._client.disconnect()
            except Exception:
                pass
            try:
                self._client.loop_stop()
            except Exception:
                pass
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None
        self._client = None
        _set_connected(False)

    def publish_command(self, payload: dict[str, Any]) -> bool:
        """Publish a command on the printer's request topic.

        Returns True if the publish was at least handed off to paho's
        internal queue. Returns False if the client is not connected
        (caller can decide to surface a 503 to the user).
        """
        client = self._client
        if client is None or not client.is_connected():
            return False
        info = client.publish(self._request_topic, json.dumps(payload), qos=0)
        return info.rc == mqtt.MQTT_ERR_SUCCESS

    # ─────────────────────────────────────────────
    # paho callbacks (run on the paho worker thread)
    # ─────────────────────────────────────────────
    def _on_connect(
        self,
        client: mqtt.Client,
        _userdata: Any,
        _flags: dict[str, Any],
        reason_code: Any,
        _properties: Any = None,
    ) -> None:
        if reason_code == 0:
            _set_connected(True)
            log.info("mqtt.connected", topic=self._report_topic)
            client.subscribe(self._report_topic, qos=0)
            # Request a full snapshot so we don't have to wait for delta-ful periods.
            client.publish(self._request_topic, PUSHALL_PAYLOAD, qos=0)
        else:
            _set_connected(False, f"connect rc={reason_code}")
            log.warning("mqtt.connect_failed", reason_code=str(reason_code))

    def _on_disconnect(
        self,
        _client: mqtt.Client,
        _userdata: Any,
        _flags: Any,
        reason_code: Any,
        _properties: Any = None,
    ) -> None:
        _set_connected(False)
        log.warning("mqtt.disconnected", reason_code=str(reason_code))

    def _on_message(
        self,
        _client: mqtt.Client,
        _userdata: Any,
        msg: mqtt.MQTTMessage,
    ) -> None:
        _set_last_message(time.time())
        try:
            payload = json.loads(msg.payload.decode("utf-8", errors="replace"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            log.warning("mqtt.bad_payload", error=str(exc))
            return
        if not isinstance(payload, dict):
            log.warning("mqtt.unexpected_payload_type", got=type(payload).__name__)
            return
        try:
            self._queue.put_nowait(payload)
        except queue.Full:
            # Drop oldest, enqueue new.
            try:
                self._queue.get_nowait()
            except queue.Empty:
                pass
            try:
                self._queue.put_nowait(payload)
            except queue.Full:
                log.warning("mqtt.queue_drop")

    # ─────────────────────────────────────────────
    # Reconnect loop
    # ─────────────────────────────────────────────
    def _build_client(self) -> mqtt.Client:
        client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,  # type: ignore[attr-defined]
            client_id=f"bambu-monitor-{self._settings.printer_serial[-6:]}",
            transport="tcp",
            protocol=mqtt.MQTTv311,
        )
        client.username_pw_set(MQTT_USERNAME, self._settings.printer_access_code)
        client.tls_set(cert_reqs=ssl.CERT_NONE)
        client.tls_insecure_set(True)
        client.on_connect = self._on_connect
        client.on_disconnect = self._on_disconnect
        client.on_message = self._on_message
        return client

    def _run(self) -> None:
        backoff = 1
        while not self._stop_event.is_set():
            self._client = self._build_client()
            try:
                self._client.connect(self._settings.printer_ip, MQTT_PORT, keepalive=30)
                self._client.loop_start()
                # Block until told to stop or paho thread dies.
                while not self._stop_event.is_set():
                    if not self._client.is_connected():
                        # Wait briefly so paho's own auto-reconnect has a chance.
                        time.sleep(1)
                        if not self._client.is_connected():
                            break
                    time.sleep(0.5)
                self._client.loop_stop()
                try:
                    self._client.disconnect()
                except Exception:
                    pass
            except Exception as exc:
                _set_connected(False, str(exc))
                log.warning("mqtt.connect_exception", error=str(exc))
            finally:
                self._client = None

            if self._stop_event.is_set():
                return
            log.info("mqtt.reconnecting", in_seconds=backoff)
            self._stop_event.wait(timeout=backoff)
            backoff = min(60, backoff * 2)
