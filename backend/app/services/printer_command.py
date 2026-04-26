"""High-level MQTT commands for sending a print job to the printer.

The actual MQTT publish goes through ``mqtt_worker.get_client().publish_command``
(same path used by control endpoints). This module just builds the payload.
"""

from __future__ import annotations

import time
from typing import Any

from app.mqtt import worker as mqtt_worker
from app.utils.logging import get_logger

log = get_logger(__name__)


def build_project_file_payload(
    *,
    plate_index: int,
    subtask_name: str,
    remote_path: str,
    bed_type: str | None,
    use_ams: bool,
    ams_mapping: list[int],
    bed_leveling: bool = True,
    flow_cali: bool = False,
    vibration_cali: bool = True,
    layer_inspect: bool = True,
    timelapse: bool = False,
) -> dict[str, Any]:
    """Build the LAN-mode `project_file` MQTT payload.

    `remote_path` is the FTP path returned by `printer_files.upload_to_printer`
    (e.g. ``/myjob.3mf``). The printer reads the file over its local FTPS
    handler when the URL scheme is ``ftp://`` or ``file:///mnt/sdcard/...``.
    """
    return {
        "print": {
            "sequence_id": str(int(time.time())),
            "command": "project_file",
            "param": f"Metadata/plate_{plate_index}.gcode",
            "subtask_name": subtask_name,
            "url": f"ftp://{remote_path.lstrip('/')}",
            "bed_type": bed_type or "auto",
            "timelapse": timelapse,
            "bed_leveling": bed_leveling,
            "flow_cali": flow_cali,
            "vibration_cali": vibration_cali,
            "layer_inspect": layer_inspect,
            "use_ams": use_ams,
            "ams_mapping": ams_mapping,
            "profile_id": "0",
            "project_id": "0",
            "subtask_id": "0",
            "task_id": "0",
        }
    }


def send_project_file(payload: dict[str, Any]) -> bool:
    """Publish the payload on the printer's request topic. Returns True on success."""
    client = mqtt_worker.get_client()
    if client is None:
        log.warning("send_project_file.no_client")
        return False
    ok = client.publish_command(payload)
    log.info("send_project_file.sent", ok=ok)
    return ok
