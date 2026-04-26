# Architecture

```
┌──────────────────┐    MJPEG     ┌──────────┐
│ USB webcam       ├─────────────▶│ ustreamer│ :9999
│ (/dev/video0)    │              └─────┬────┘
└──────────────────┘                    │ /stream (MJPEG)
                                        ▼
┌──────────────────┐  MQTT TLS    ┌────────────┐    REST + WS    ┌──────────┐
│ Bambu A1 printer │◀────────────▶│  FastAPI   │◀───────────────▶│ Browser  │
│ (LAN mode 8883)  │              │  backend   │                 │  (SPA)   │
└──────────────────┘              └─────┬──────┘                 └──────────┘
                                        │                              ▲
                                        │ SQLite                       │
                                        ▼                              │
                                 ┌────────────┐                        │
                                 │  bambu.db  │                        │
                                 └────────────┘                        │
                                                                       │
                                  ┌──────────────────┐  /, /api, /ws,  │
                                  │ nginx (port 80)  │   /stream       │
                                  └──────────────────┘ ────────────────┘
```

## Components

### Frontend (`frontend/`)

Vite SPA. State sources:
- Live printer state via WebSocket → Zustand store. Single subscription shared across the app via the `useLivePrinterState` ref-counted singleton.
- Historical / aggregate data via TanStack Query against REST endpoints.

Pages:
- `/` Dashboard (live)
- `/prints` Storico (history table)
- `/prints/:id` Dettaglio (charts + notes)
- `/stats` Statistiche (KPIs + heatmap)

Theme: lime accent, dark default, light toggle. Tokens defined in `src/index.css` and exposed to Tailwind via `@theme`.

### Backend (`backend/`)

FastAPI app with a custom `lifespan`:

1. Initialise SQLite via SQLModel.
2. Start the MQTT worker (paho client + asyncio drain task).
3. Start the print tracker (state-machine task subscribed to pubsub).
4. Start the telemetry sampler (10s tick during active prints).

Modules:

| Module | Responsibility |
|---|---|
| `app/state.py` | Singleton `PrinterState` + thread-safe `apply_patch` |
| `app/pubsub.py` | In-process fan-out for `state_delta` and `print_event` |
| `app/mqtt/client.py` | paho client wrapper, TLS-insecure, reconnect loop |
| `app/mqtt/parser.py` | Map raw MQTT JSON to PrinterState patches |
| `app/mqtt/worker.py` | asyncio bridge over the sync paho thread |
| `app/services/print_tracker.py` | Detect start/end, persist Print rows |
| `app/services/telemetry.py` | Periodic TelemetryPoint inserts during prints |
| `app/services/stats.py` | Aggregations for `/api/stats` |
| `app/services/filament.py` | Merge MQTT-detected and user-set filament |
| `app/api/*` | REST + WS handlers |

### Data flow (live)

```
printer (MQTT) ─▶ paho_thread ─▶ stdlib Queue ─▶ asyncio drain ─▶ parser
   ─▶ state.apply_patch() ─▶ pubsub.publish("state_delta", patch)
       ├── WS endpoint subscribers fan it to browsers
       └── print_tracker subscriber may detect a transition and
           write a Print row, then publish("print_event", ...)
              ─▶ WS endpoint also forwards print_event to browsers
              ─▶ telemetry sampler wakes when a print starts
```

### Concurrency model

- The MQTT loop runs in a daemon thread (paho is sync-only). It writes into a `queue.Queue`.
- A single asyncio task drains that queue, runs the parser, and publishes patches to the in-process pubsub.
- WebSocket endpoint instances subscribe to the pubsub and forward to clients.
- DB writes use the async SQLModel/aiosqlite session, never blocking the loop.

### Observability

- Structured logs via structlog (console-formatted in dev, JSON in prod).
- Health endpoint `/api/health` reports MQTT connection state.
- OpenAPI schema served at `/docs`.

## Trade-offs

- **In-memory PrinterState singleton**: trivially fast and correct for one-printer deployments. Won't scale to multiple printers without per-device state, but that's not in scope.
- **In-process pubsub**: same caveat. No durability, no replay. WS clients miss messages they were disconnected for, but the next snapshot they receive on reconnect catches them up.
- **No WS auth**: dashboard runs on a trusted home LAN. Adding auth would mean cookies + session management; out of scope for v1.
- **TLS verification disabled**: documented at length in `app/mqtt/client.py` and `MQTT_NOTES.md`.
