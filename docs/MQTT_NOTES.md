# MQTT notes (Bambu Lab A1, LAN-only mode)

These are field notes from wiring up `app/mqtt/client.py` and `app/mqtt/parser.py`. Keep them honest as you discover more.

## Connection

| Setting | Value |
|---|---|
| Host | The printer's LAN IP. |
| Port | `8883`. |
| Transport | TCP. |
| TLS | Self-signed certificate (changes after firmware updates). |
| Verification | **Disabled** (`cert_reqs=CERT_NONE`, `tls_insecure_set(True)`). |
| Username | Literal `bblp`. |
| Password | The 8-digit access code shown on the printer's display. |
| Client ID | Anything unique; we use `bambu-monitor-<last6serial>`. |
| Keepalive | 30 s works well. |

The printer accepts **one client at a time** on its broker. If Bambu Handy / Studio / OrcaSlicer are connected, the backend will be kicked off. Either keep the Bambu app closed or accept the contention.

## Topics

| Topic | Direction | Purpose |
|---|---|---|
| `device/{SERIAL}/report` | printer ▶ us | Printer state, both full snapshots and deltas. |
| `device/{SERIAL}/request` | us ▶ printer | Commands, including the "send full state" pushall. |

`SERIAL` is the printer's exact serial, case-sensitive.

## Pushall

On every (re)connect, publish:

```json
{"pushing": {"sequence_id": "0", "command": "pushall"}}
```

Otherwise you only see incremental field updates and may wait minutes for a full picture.

## Payload shape

The printer sends JSON wrapped in a top-level key, usually `print` for state reports. Other top-level keys (`info`, `mc_print`, `upgrade_state`, `system`, `xcam`) appear during heating, firmware upgrades, etc.; `parse_report` ignores them.

Example trimmed report:

```json
{
  "print": {
    "gcode_state": "RUNNING",
    "subtask_name": "Calibration_cube_v3.gcode.3mf",
    "gcode_file": "/data/printer.gcode",
    "mc_percent": 54.5,
    "mc_remaining_time": 73,
    "gcode_start_time": 1714153500,
    "layer_num": 142,
    "total_layer_num": 380,
    "nozzle_temper": 218.4,
    "nozzle_target_temper": 220,
    "bed_temper": 60.1,
    "bed_target_temper": 60,
    "spd_lvl": 2,
    "cooling_fan_speed": 65,
    "filament_type": "PLA"
  }
}
```

## Field mapping (canonical)

See `app/mqtt/parser.py`. Quick reference:

| Raw key | PrinterState field | Notes |
|---|---|---|
| `gcode_state` | `gcode_state` | enum `IDLE\|PREPARE\|RUNNING\|PAUSE\|FINISH\|FAILED` |
| `subtask_name` (preferred) or `gcode_file` | `file_name` | basename only |
| `mc_percent` | `percent` | clamped 0..100 |
| `mc_remaining_time` | `remaining_minutes` | already minutes |
| `gcode_start_time` | `started_at` | unix seconds → ISO 8601 with `Z` |
| `layer_num`, `total_layer_num` | same | |
| `nozzle_temper`, `nozzle_target_temper` | `nozzle_temp`, `nozzle_target` | |
| `bed_temper`, `bed_target_temper` | `bed_temp`, `bed_target` | |
| `spd_lvl` | `print_speed` | 1=Silenzioso, 2=Standard, 3=Sport, 4=Ludicrous |
| `cooling_fan_speed` | `fan_speed` | clamped 0..100 |
| `filament_type` (best-effort) | `filament_type` | the A1 base often omits this |

Anything else is intentionally ignored. Add to `_DIRECT_FIELDS` if you want to surface more.

## Quirks observed

- **`mc_remaining_time` units**: minutes, not seconds. Easy to get wrong — the frontend also expects minutes.
- **`gcode_start_time` value `0`**: the printer reports zero when no print is active; we treat that as `None`, not "1970-01-01".
- **`mc_percent` of 101**: seen during the final-layer wrap-up. Clamp it.
- **`PREPARE` state**: heating phase before the first layer. We start the Print row at PREPARE so heating telemetry is captured. `total_layer_num` may still be 0 at that point; `parser` re-reads it from later messages and `print_tracker` backfills.
- **Filament info**: on the A1 base (no AMS), `filament_type` is sometimes set, sometimes empty. The user-set fallback (PUT `/api/filament/current`) is the source of truth for color.
- **Cert rotation**: the printer's TLS cert changes on every firmware update. Pinning is not worth it on a trusted LAN.

## Debugging tips

- `LOG_LEVEL=DEBUG uv run uvicorn app.main:app` dumps every parsed delta to the log.
- A short script using `paho-mqtt` directly (no app code) is the fastest way to confirm credentials work.
- If you see `mqtt.connect_failed reason_code=4`: bad username/password. `5`: not authorised (most common: wrong access code).
