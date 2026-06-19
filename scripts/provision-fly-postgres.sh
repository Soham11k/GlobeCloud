#!/usr/bin/env bash
# Provision Fly Postgres clusters and attach DATABASE_URL secrets to GlobeCloud apps.
#
# Usage:
#   ./scripts/provision-fly-postgres.sh
#
# Optional env:
#   PLATFORM_PG_APP=globecloud-platform-pg
#   REGIONAL_PG_PREFIX=globecloud-pg
#   APPS="globecloud-us globecloud-eu globecloud-ap globecloud"

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v flyctl >/dev/null 2>&1; then
  echo "Install flyctl: https://fly.io/docs/hands-on/install-flyctl/"
  exit 1
fi

PLATFORM_PG_APP="${PLATFORM_PG_APP:-globecloud-platform-pg}"
REGIONAL_PG_PREFIX="${REGIONAL_PG_PREFIX:-globecloud-pg}"
APPS="${APPS:-globecloud-us globecloud-eu globecloud-ap globecloud}"

ensure_postgres() {
  local pg_app="$1"
  local region="$2"
  if ! flyctl apps list 2>/dev/null | grep -qw "$pg_app"; then
    echo "==> Creating Fly Postgres: $pg_app ($region)"
    flyctl postgres create --name "$pg_app" --region "$region" --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 10
  else
    echo "==> Postgres app exists: $pg_app"
  fi
}

attach_db() {
  local app="$1"
  local pg_app="$2"
  local db_name="${3:-globe_platform}"
  echo "==> Attaching $pg_app to $app (database: $db_name)"
  flyctl postgres attach "$pg_app" --app "$app" --database-name "$db_name" || true
}

echo "==> GlobeCloud Fly Postgres provisioning"
echo ""

ensure_postgres "$PLATFORM_PG_APP" "iad"
ensure_postgres "${REGIONAL_PG_PREFIX}-us" "iad"
ensure_postgres "${REGIONAL_PG_PREFIX}-eu" "ams"
ensure_postgres "${REGIONAL_PG_PREFIX}-ap" "bom"

echo ""
echo "==> Attaching platform DB to gateway + regional apps"
for app in globecloud globecloud-us globecloud-eu globecloud-ap; do
  if flyctl apps list 2>/dev/null | grep -qw "$app"; then
    attach_db "$app" "$PLATFORM_PG_APP" "globe_platform"
  fi
done

echo ""
echo "==> Attaching regional DBs"
attach_db "globecloud-us" "${REGIONAL_PG_PREFIX}-us" "globe_us"
attach_db "globecloud-eu" "${REGIONAL_PG_PREFIX}-eu" "globe_eu"
attach_db "globecloud-ap" "${REGIONAL_PG_PREFIX}-ap" "globe_ap"

echo ""
echo "==> Run migrations on a regional app with platform access:"
echo "    flyctl ssh console -a globecloud-us -C 'alembic upgrade head'"
echo ""
echo "Done. Redeploy apps after secrets propagate."
