#!/usr/bin/env bash
# Install / update systemd units + nginx config. Idempotent.

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/bambu-monitor}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "must run as root" >&2
  exit 1
fi

echo "==> installing systemd units"
install -m 0644 "${REPO_ROOT}/deploy/systemd/bambu-monitor.service" /etc/systemd/system/
install -m 0644 "${REPO_ROOT}/deploy/systemd/ustreamer.service" /etc/systemd/system/

# Per-host customisations live in drop-in directories and are preserved.
for unit in bambu-monitor ustreamer; do
  dir="/etc/systemd/system/${unit}.service.d"
  if [[ -d "${dir}" ]] && compgen -G "${dir}/*.conf" > /dev/null; then
    echo "    preserved drop-in overrides in ${dir}"
  fi
done

echo "==> installing nginx site"
install -m 0644 "${REPO_ROOT}/deploy/nginx/bambu-monitor.conf" /etc/nginx/sites-available/bambu-monitor.conf
ln -sf /etc/nginx/sites-available/bambu-monitor.conf /etc/nginx/sites-enabled/bambu-monitor.conf
# Disable the default site if still present.
rm -f /etc/nginx/sites-enabled/default

echo "==> writing /etc/bambu-monitor.env"
if [[ ! -f /etc/bambu-monitor.env ]]; then
  install -m 0640 "${REPO_ROOT}/backend/.env.example" /etc/bambu-monitor.env
  chown root:bambu /etc/bambu-monitor.env
  echo "    Created /etc/bambu-monitor.env from .env.example. EDIT IT before starting the service."
fi

echo "==> reloading systemd + nginx"
systemctl daemon-reload
nginx -t
systemctl reload nginx

echo "==> enabling services (start manually after editing /etc/bambu-monitor.env)"
systemctl enable bambu-monitor.service
systemctl enable ustreamer.service

echo
echo "Next:"
echo "  1) sudo nano /etc/bambu-monitor.env       # set PRINTER_IP, PRINTER_SERIAL, PRINTER_ACCESS_CODE"
echo "  2) sudo nano /etc/systemd/system/ustreamer.service   # set --device path"
echo "  3) sudo systemctl daemon-reload"
echo "  4) sudo systemctl start ustreamer.service bambu-monitor.service"
echo "  5) journalctl -u bambu-monitor.service -f"
