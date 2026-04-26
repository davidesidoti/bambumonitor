# Deployment

Target: a single Ubuntu 24.04 host (laptop or mini-PC) on the same LAN as the printer. The same host runs the FastAPI backend, ustreamer (USB webcam), and nginx.

## Prerequisites

- Ubuntu 24.04 (works on Debian 12 too with minor package-name tweaks).
- The Bambu A1 in **LAN-only mode** with the access code visible on the printer's display.
- A USB webcam attached to the host (any UVC camera, e.g. Logitech C920).
- The host's IP discoverable via mDNS (`bambu.local`) or known on the LAN.

## One-shot install

```bash
sudo git clone https://github.com/<you>/bambumonitor.git /opt/bambu-monitor
sudo bash /opt/bambu-monitor/deploy/scripts/setup.sh
```

`setup.sh` is idempotent. Re-run it after `git pull` to redeploy.

It does, in order:
1. apt-installs nginx, ustreamer, Python 3.12, Node 20, v4l-utils, build tools.
2. Creates the `bambu` system user (member of `video` for camera access).
3. Installs `uv` for `bambu`.
4. Runs `uv sync` in the backend.
5. Builds the frontend SPA (`npm ci && npm run build`) and rsyncs `dist/` to `/var/www/bambu-monitor/`.
6. Installs `bambu-monitor.service`, `ustreamer.service`, and the nginx site config.
7. Drops `/etc/bambu-monitor.env` (copied from `.env.example`) the first time.

## Configure

Two files need editing on first install:

### `/etc/bambu-monitor.env`

```ini
PRINTER_IP=192.168.1.42        # the printer's address on your LAN
PRINTER_SERIAL=01P00A...       # exact serial from Bambu Studio
PRINTER_ACCESS_CODE=12345678   # shown on the printer display, Settings > Network
LOG_LEVEL=INFO
DEV_MODE=false                 # JSON logs, no CORS dev rule
```

### `/etc/systemd/system/ustreamer.service`

Edit the `--device=` flag. To find your camera:

```bash
v4l2-ctl --list-devices
```

Use a stable `/dev/v4l/by-id/...` path if you have multiple cameras attached.

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl start ustreamer.service bambu-monitor.service
```

## Verify

```bash
# Backend health (also reports MQTT connection):
curl http://127.0.0.1:1111/api/health
# { "ok": true, "mqtt_connected": true }

# nginx serving the SPA:
curl -I http://127.0.0.1/
# HTTP/1.1 200 OK

# WS upgrade:
curl -I -H "Connection: Upgrade" -H "Upgrade: websocket" http://127.0.0.1/ws

# Logs:
journalctl -u bambu-monitor.service -f
journalctl -u ustreamer.service -f
sudo tail -f /var/log/nginx/error.log
```

Open `http://<host-ip>` (or `http://bambu.local`) on any device on the LAN. The dashboard loads, connects to the WebSocket within 1-2 seconds, and starts streaming live state.

## Updates

```bash
cd /opt/bambu-monitor
sudo git pull
sudo bash deploy/scripts/setup.sh   # re-runs install steps idempotently
sudo systemctl restart bambu-monitor.service
```

## Backup

The only stateful file is `/opt/bambu-monitor/backend/bambu.db`. Snapshot it however you like:

```bash
sudo cp /opt/bambu-monitor/backend/bambu.db /backup/bambu.$(date +%F).db
```

## Common issues

| Symptom | Cause / fix |
|---|---|
| `mqtt_connected: false` in health | Wrong IP, serial, or access code in `/etc/bambu-monitor.env`. Restart the service after editing. |
| `mqtt_connected: false`, port unreachable | Printer not in LAN-only mode, or another client is hogging the broker. The Bambu broker accepts only one client at a time; close Bambu Handy / Studio. |
| ustreamer fails with "permission denied" | The `bambu` user is not in the `video` group, or the camera node has wrong perms. `sudo usermod -aG video bambu && sudo systemctl restart ustreamer`. |
| Webcam tile shows the placeholder | Either ustreamer is down or the device path is wrong. `journalctl -u ustreamer.service -f`. |
| `502 Bad Gateway` on /api or /ws | Backend service is down. `systemctl status bambu-monitor.service`. |
| TLS handshake errors at startup | Almost always wrong access code. Double-check on the printer display. |
