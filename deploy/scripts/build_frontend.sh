#!/usr/bin/env bash
# Build the frontend SPA and publish it under /var/www/bambu-monitor.
# Run as root (or with sudo) so we can write to /var/www.

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/bambu-monitor}"
TARGET="${TARGET:-/var/www/bambu-monitor}"

cd "${REPO_ROOT}/frontend"

# Keep npm cache inside the project so writes don't hit /root/.npm, which is
# blocked by ProtectHome=read-only when running from within the service namespace.
export npm_config_cache="${REPO_ROOT}/frontend/.npm-cache"

echo "==> npm ci"
npm ci

echo "==> npm run build"
npm run build

echo "==> publishing to ${TARGET}"
mkdir -p "${TARGET}"
rsync -a --delete dist/ "${TARGET}/"
chown -R www-data:www-data "${TARGET}" || true

echo "==> done"
