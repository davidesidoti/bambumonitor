#!/usr/bin/env bash
# Pull latest, rebuild, restart. Run as root.
#
# Usage: sudo bash deploy/scripts/update.sh

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/bambu-monitor}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "must run as root (use sudo)" >&2
  exit 1
fi

echo "==> git pull"
git -C "${REPO_ROOT}" pull --ff-only

echo "==> re-running setup.sh (idempotent)"
REPO_ROOT="${REPO_ROOT}" bash "${REPO_ROOT}/deploy/scripts/setup.sh"

echo "==> restarting services"
systemctl restart bambu-monitor.service ustreamer.service
systemctl reload nginx

echo
echo "==> update complete"
systemctl --no-pager --lines=0 status bambu-monitor.service ustreamer.service | head -20
