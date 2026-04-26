"""Implicit FTPS upload to a Bambu printer in LAN mode.

The printer accepts files on port 990 with implicit TLS, user ``bblp``,
password = LAN access code. Cert is self-signed, so verification is disabled
(same rationale as the MQTT client).

Implicit FTPS is not directly supported by ``ftplib.FTP_TLS`` — we wrap the
socket in TLS before any FTP command is sent (override ``ntransfercmd`` so
the data channel is protected too).
"""

from __future__ import annotations

import ftplib
import socket
import ssl
from pathlib import Path

from app.config import get_settings
from app.utils.logging import get_logger

log = get_logger(__name__)


class _ImplicitFTPTLS(ftplib.FTP_TLS):
    """FTP_TLS that wraps the control socket immediately on connect."""

    def __init__(self, context: ssl.SSLContext, timeout: float) -> None:
        super().__init__(context=context, timeout=timeout)
        self._sock_storage: socket.socket | None = None

    @property
    def sock(self) -> socket.socket | None:
        return self._sock_storage

    @sock.setter
    def sock(self, value: socket.socket | None) -> None:
        if value is not None and not isinstance(value, ssl.SSLSocket):
            assert self.context is not None
            value = self.context.wrap_socket(value, server_hostname=self.host)
        self._sock_storage = value


def _build_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def upload_to_printer(
    local_path: Path,
    remote_name: str,
    *,
    timeout: float = 30.0,
) -> str:
    """Upload `local_path` to the printer's `/` (root cache).

    Returns the remote path the printer will see (e.g. ``/myjob.3mf``).
    Raises ``ftplib.all_errors`` on failure.
    """
    settings = get_settings()
    ctx = _build_context()

    safe_name = _sanitize_remote_name(remote_name)
    log.info("ftps.upload_start", host=settings.printer_ip, file=safe_name)

    with _ImplicitFTPTLS(context=ctx, timeout=timeout) as ftp:
        ftp.connect(settings.printer_ip, settings.printer_ftps_port, timeout=timeout)
        ftp.login(settings.printer_ftps_user, settings.printer_access_code)
        ftp.prot_p()
        ftp.set_pasv(True)
        with local_path.open("rb") as fh:
            ftp.storbinary(f"STOR {safe_name}", fh, blocksize=64 * 1024)

    log.info("ftps.upload_done", file=safe_name)
    return f"/{safe_name}"


def _sanitize_remote_name(name: str) -> str:
    base = name.replace("\\", "/").rsplit("/", 1)[-1]
    cleaned = "".join(c for c in base if c.isalnum() or c in "._- ").strip()
    if not cleaned:
        cleaned = "job.3mf"
    if not cleaned.lower().endswith(".3mf"):
        cleaned += ".3mf"
    return cleaned
