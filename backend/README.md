# Bambu Monitor — backend

FastAPI service: MQTT bridge to a Bambu Lab A1 (LAN mode), REST + WebSocket API, SQLite persistence.

## Setup

```bash
cd backend
cp .env.example .env   # edit with your printer's IP, serial, access code
uv sync
```

## Run (dev)

```bash
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/api/health
# → {"ok": true, "mqtt_connected": true}
```

OpenAPI docs at http://127.0.0.1:8000/docs.

## Quality gates

```bash
uv run ruff check app
uv run mypy --strict app
uv run pytest -q
```

## File map

```
app/
  main.py        FastAPI factory + lifespan
  config.py      Settings from .env
  state.py       PrinterState singleton
  pubsub.py      In-process pubsub for WS fan-out
  mqtt/
    client.py    paho client wrapper (TLS-insecure, auth, reconnect)
    parser.py    raw MQTT JSON to PrinterState patches
    worker.py    asyncio bridge over paho's sync loop
  db/
    session.py   async engine + sessionmaker
    models.py    Print, TelemetryPoint, FilamentSetting
  services/
    print_tracker.py  gcode_state state machine
    telemetry.py      10s sampler during prints
    stats.py          aggregations for /api/stats
    filament.py       filament merge logic
  api/
    health.py    GET /api/health
    state.py     GET /api/state
    prints.py    GET/PATCH /api/prints[/...]
    stats.py     GET /api/stats
    filament.py  GET/PUT /api/filament/current
    ws.py        WS /ws
  utils/
    logging.py
    time.py
```
