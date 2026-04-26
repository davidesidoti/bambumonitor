# Bambu Monitor

Self-hosted dashboard for the Bambu Lab A1 3D printer. Runs on a single Ubuntu laptop on the LAN: FastAPI backend talks MQTT to the printer, ustreamer serves the webcam, nginx fronts the lot. Italian UI.

## Stack

- Backend: Python 3.11+, FastAPI, SQLModel, paho-mqtt, structlog
- Frontend: React 18 + TypeScript, Vite, Tailwind + shadcn/ui, TanStack Query, Zustand, Recharts
- Webcam: ustreamer (MJPEG)
- Reverse proxy: nginx
- Service supervision: systemd

## Quick start (dev, mock backend)

```bash
cd frontend
npm install
VITE_USE_MOCK=true npm run dev
```

Open http://localhost:5173 . The dashboard runs entirely on synthetic data, no printer required.

## Quick start (dev, real backend)

```bash
# Terminal 1: backend
cd backend
cp .env.example .env   # edit with PRINTER_IP, PRINTER_SERIAL, PRINTER_ACCESS_CODE
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2: frontend
cd frontend
npm install
npm run dev   # proxies /api and /ws to localhost:8000
```

## Production deploy (Ubuntu 24.04)

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Short version:

```bash
sudo bash deploy/scripts/setup.sh
```

## Repo layout

- `frontend/` Vite React app (UI in Italian, code in English)
- `backend/` FastAPI app + MQTT bridge + SQLite persistence
- `deploy/` nginx config, systemd units, setup scripts
- `docs/` architecture, deployment, MQTT notes
- `bambu_monitor_design_prompt.md`, `bambu_monitor_claudecode_prompt.md` original spec sources
- `CONTEXT.md` handoff doc for future AI sessions

## License

See [LICENSE](LICENSE).
