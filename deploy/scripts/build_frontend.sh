#!/usr/bin/env bash
# Build the frontend SPA and publish it under /var/www/bambu-monitor.
# Run as root (or with sudo) so we can write to /var/www.

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/bambu-monitor}"
TARGET="${TARGET:-/var/www/bambu-monitor}"

cd "${REPO_ROOT}/frontend"

echo "==> npm ci"
npm ci

echo "==> npm run build"
npm run build

echo "==> publishing to ${TARGET}"
mkdir -p "${TARGET}"
rsync -a --delete dist/ "${TARGET}/"
chown -R www-data:www-data "${TARGET}" || true

echo "==> done"
