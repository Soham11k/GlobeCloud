#!/usr/bin/env bash
# Backup Fly Postgres databases to local pg_dump files.
set -euo pipefail

OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"
STAMP=$(date +%Y%m%d_%H%M%S)

for app in globecloud globecloud-us globecloud-eu globecloud-ap; do
  echo "==> Backing up $app"
  flyctl postgres connect -a "${app}-db" -c "pg_dump -Fc globe" > "${OUT_DIR}/${app}_${STAMP}.dump" || true
done

echo "Backups written to $OUT_DIR"
