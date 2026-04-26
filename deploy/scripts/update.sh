#!/usr/bin/env bash
# Pull latest code, rebuild, restart services.
# Called via sudo from the bambu-monitor settings tab; also safe to run manually.
#
# This script intentionally does NOT run apt-get: it must work from within the
# service's mount namespace where /usr is read-only (ProtectSystem=true).
# For a first-time install or to upgrade system packages, run setup.sh instead.
#
# Usage: sudo bash deploy/scripts/update.sh

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/bambu-monitor}"
SERVICE_USER="${SERVICE_USER:-bambu}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "must run as root (use sudo)" >&2
  exit 1
fi

echo "==> ensuring scripts are executable"
chmod +x "${REPO_ROOT}/deploy/scripts/"*.sh

echo "==> git pull"
# Repo is owned by the service user; git refuses to operate on it as root
# unless we explicitly mark the path safe (CVE-2022-24765 mitigation).
git config --global --get-all safe.directory | grep -qxF "${REPO_ROOT}" \
  || git config --global --add safe.directory "${REPO_ROOT}"
git -C "${REPO_ROOT}" pull --ff-only

echo "==> syncing backend deps"
# UV_CACHE_DIR must point inside the project dir: ProtectHome=read-only blocks
# writes to ~/.uv and the service namespace covers /root when running as root.
sudo -u "${SERVICE_USER}" -H \
  env UV_CACHE_DIR="${REPO_ROOT}/backend/.uv-cache" \
  bash -c "cd '${REPO_ROOT}/backend' && \$HOME/.local/bin/uv sync"

echo "==> building frontend"
REPO_ROOT="${REPO_ROOT}" bash "${REPO_ROOT}/deploy/scripts/build_frontend.sh"

echo "==> installing updated service files"
REPO_ROOT="${REPO_ROOT}" bash "${REPO_ROOT}/deploy/scripts/install_services.sh"

echo "==> restarting services"
systemctl restart bambu-monitor.service ustreamer.service
systemctl reload nginx

echo
echo "==> update complete"
systemctl --no-pager --lines=0 status bambu-monitor.service ustreamer.service | head -20
