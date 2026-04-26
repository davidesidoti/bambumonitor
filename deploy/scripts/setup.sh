#!/usr/bin/env bash
# One-shot installer for a fresh Ubuntu 24.04 host.
# Idempotent: re-running it is safe and just brings everything up to date.
#
# Usage: sudo bash deploy/scripts/setup.sh
#
# Assumes you already cloned the repo to /opt/bambu-monitor:
#   sudo git clone https://github.com/<you>/bambumonitor.git /opt/bambu-monitor

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/bambu-monitor}"
SERVICE_USER="${SERVICE_USER:-bambu}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "must run as root (use sudo)" >&2
  exit 1
fi

echo "==> verifying repo at ${REPO_ROOT}"
if [[ ! -d "${REPO_ROOT}/backend" ]]; then
  echo "Repo not found at ${REPO_ROOT}. Clone it first:" >&2
  echo "  sudo git clone https://github.com/<you>/bambumonitor.git ${REPO_ROOT}" >&2
  exit 1
fi

# After the chown below the repo is owned by ${SERVICE_USER}, so root needs
# safe.directory to operate (git pull, etc.). Idempotent.
git config --global --get-all safe.directory | grep -qxF "${REPO_ROOT}" \
  || git config --global --add safe.directory "${REPO_ROOT}"

echo "==> installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  nginx \
  ustreamer \
  python3.12 \
  python3.12-venv \
  ca-certificates \
  curl \
  rsync \
  build-essential \
  v4l-utils

echo "==> installing Node.js 20.x (NodeSource)"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> creating service user '${SERVICE_USER}'"
if ! id "${SERVICE_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin --groups video "${SERVICE_USER}"
fi
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${REPO_ROOT}"

echo "==> installing uv for ${SERVICE_USER}"
sudo -u "${SERVICE_USER}" -H bash -c '
  if ! command -v "$HOME/.local/bin/uv" >/dev/null 2>&1; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
  fi
'

echo "==> syncing backend deps"
sudo -u "${SERVICE_USER}" -H bash -c "cd ${REPO_ROOT}/backend && \$HOME/.local/bin/uv sync"

echo "==> building frontend"
REPO_ROOT="${REPO_ROOT}" bash "${REPO_ROOT}/deploy/scripts/build_frontend.sh"

echo "==> installing services"
REPO_ROOT="${REPO_ROOT}" bash "${REPO_ROOT}/deploy/scripts/install_services.sh"

echo "==> installing sudoers grant for settings tab"
install -d -m 0755 /etc/systemd/system/ustreamer.service.d
install -m 0440 -o root -g root \
  "${REPO_ROOT}/deploy/sudoers/bambu-monitor" \
  /etc/sudoers.d/bambu-monitor
visudo -cf /etc/sudoers.d/bambu-monitor

echo "==> opening firewall (HTTP)"
if command -v ufw >/dev/null 2>&1; then
  if ufw status | grep -qw active; then
    ufw allow 80/tcp || true
    ufw reload || true
  else
    echo "    ufw is installed but inactive: skipping. Open :80 manually if you enable it."
  fi
fi

echo
echo "==> setup complete"
echo
echo "Edit /etc/bambu-monitor.env (PRINTER_IP, PRINTER_SERIAL, PRINTER_ACCESS_CODE),"
echo "then: sudo systemctl start ustreamer.service bambu-monitor.service"
echo
echo "Browse to http://\$(hostname -I | awk '{print \$1}')"
