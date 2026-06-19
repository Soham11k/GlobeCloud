#!/usr/bin/env bash
# Start GlobeCloud with three regional nodes + gateway (real peer probes and replication).
#
# Usage:
#   ./scripts/start-multiregion.sh           # Docker Compose (recommended)
#   ./scripts/start-multiregion.sh --native  # Three local processes + gateway on :8000

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
MODE="${1:-docker}"

if [[ "$MODE" != "docker" && "$MODE" != "--native" && "$MODE" != "native" && "$MODE" != "--docker" ]]; then
  echo "Usage: $0 [docker|--native]"
  exit 1
fi

if [[ ! -d .venv ]]; then
  echo "Run first: ./scripts/setup.sh"
  exit 1
fi

PYTHON="${ROOT}/.venv/bin/python"
if [[ ! -x "$PYTHON" ]]; then
  PYTHON="$(command -v python3 || true)"
fi
GLOBE=("$PYTHON" -m globe.main)

"$PYTHON" -m pip install -q -e . -r requirements.txt

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/scripts/lib/env.sh"
  load_env_file "$ROOT/.env"
fi

if [[ "$MODE" == "docker" || "$MODE" == "--docker" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker not found — falling back to native multi-region mode"
    MODE="native"
  fi
fi

if [[ "$MODE" == "docker" ]]; then
  echo "==> Starting full multi-region stack via Docker Compose"
  exec docker compose -f deploy/docker-compose.yml up --build
fi

_postgres_ready() {
  nc -z "${1:-localhost}" "${2:-5432}" 2>/dev/null || (echo >/dev/tcp/"${1:-localhost}"/"${2:-5432}") 2>/dev/null
}

_test_db_url() {
  local url="$1"
  TEST_DATABASE_URL="$url" "$PYTHON" - <<'PY'
import os, sys
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
try:
    with create_engine(os.environ["TEST_DATABASE_URL"], pool_pre_ping=True).connect() as c:
        c.execute(text("SELECT 1"))
    sys.exit(0)
except OperationalError:
    sys.exit(1)
PY
}

_bootstrap_homebrew_dbs() {
  local role="${1:-globe}"
  local dbs=(globe_platform globe_us globe_eu globe_ap)
  command -v psql >/dev/null 2>&1 && _postgres_ready localhost 5432 || return 1

  echo "==> Bootstrapping Homebrew Postgres (port 5432)..."
  psql -d postgres -v ON_ERROR_STOP=0 <<SQL >/dev/null 2>&1 || true
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${role}') THEN
    CREATE ROLE ${role} WITH LOGIN PASSWORD '${role}' CREATEDB;
  END IF;
END \$\$;
SQL
  local db
  for db in "${dbs[@]}"; do
    createdb -O "$role" "$db" 2>/dev/null || psql -d postgres -c "CREATE DATABASE ${db} OWNER ${role};" 2>/dev/null || true
  done

  export DATABASE_URL="postgresql+psycopg://${role}:${role}@localhost:5432/globe_platform"
  export REGIONAL_US_URL="postgresql+psycopg://${role}:${role}@localhost:5432/globe_us"
  export REGIONAL_EU_URL="postgresql+psycopg://${role}:${role}@localhost:5432/globe_eu"
  export REGIONAL_AP_URL="postgresql+psycopg://${role}:${role}@localhost:5432/globe_ap"
}

_setup_postgres() {
  if command -v docker >/dev/null 2>&1; then
    docker compose -f deploy/docker-compose.yml up -d platform-db us-db eu-db ap-db redis 2>/dev/null || true
    local i
    for i in $(seq 1 30); do
      if docker compose -f deploy/docker-compose.yml exec -T platform-db pg_isready -U globe -d globe_platform >/dev/null 2>&1; then
        export DATABASE_URL="postgresql+psycopg://globe:globe@localhost:5432/globe_platform"
        export REGIONAL_US_URL="postgresql+psycopg://globe:globe@localhost:5433/globe_us"
        export REGIONAL_EU_URL="postgresql+psycopg://globe:globe@localhost:5434/globe_eu"
        export REGIONAL_AP_URL="postgresql+psycopg://globe:globe@localhost:5435/globe_ap"
        return 0
      fi
      sleep 1
    done
  fi
  _bootstrap_homebrew_dbs globe || {
    echo "Error: Postgres required. Run: ./scripts/setup-local-postgres.sh"
    exit 1
  }
}

_wait_health() {
  local port="$1" label="$2" i
  local curl_args=(-sf)
  [[ -n "${API_KEY:-}" ]] && curl_args+=(-H "X-API-Key: ${API_KEY}")
  for i in $(seq 1 90); do
    if curl "${curl_args[@]}" "http://127.0.0.1:${port}/api/v1/health" >/dev/null 2>&1; then
      echo "    ${label} ready on :${port}"
      return 0
    fi
    sleep 1
  done
  echo "Error: ${label} failed on :${port} (check logs above)"
  return 1
}

echo "==> Native multi-region stack"
for port in 8000 8001 8002 8003; do
  lsof -ti:"$port" 2>/dev/null | xargs kill -9 2>/dev/null || true
done
sleep 1

_setup_postgres
unset REGIONAL_DATABASE_URL

_run_migrations_once() {
  if [[ "${ENVIRONMENT:-development}" != "production" ]]; then
    return 0
  fi
  echo "==> Running platform migrations (once)..."
  env DATABASE_URL="$DATABASE_URL" ENVIRONMENT=production \
    "${PYTHON}" -m alembic upgrade head
  export GLOBE_MIGRATIONS_DONE=1
}

_run_migrations_once

export REPLICATION_SECRET="${REPLICATION_SECRET:-dev-replication-secret}"
export API_KEY="${API_KEY:-}"
export ENVIRONMENT="${ENVIRONMENT:-development}"

if ! _postgres_ready localhost 6379; then
  unset REDIS_URL
fi

_common=(DATABASE_URL="$DATABASE_URL" REPLICATION_SECRET="$REPLICATION_SECRET" ENVIRONMENT="$ENVIRONMENT")
[[ -n "${GLOBE_MIGRATIONS_DONE:-}" ]] && _common+=(GLOBE_MIGRATIONS_DONE=1)
[[ -n "${API_KEY:-}" ]] && _common+=(API_KEY="$API_KEY")
[[ -n "${REDIS_URL:-}" ]] && _common+=(REDIS_URL="$REDIS_URL")

_pids=()
trap 'for p in "${_pids[@]}"; do kill "$p" 2>/dev/null || true; done' EXIT INT TERM

_start_region() {
  local region_id="$1" port="$2" regional_url="$3" peers="$4" public="$5"
  echo "==> Starting ${region_id} on :${port}"
  env "${_common[@]}" DEPLOYMENT_MODE=regional REGION_ID="$region_id" \
    REGIONAL_DATABASE_URL="$regional_url" PEER_URLS="$peers" PUBLIC_URL="$public" PORT="$port" \
    "${GLOBE[@]}" &
  _pids+=("$!")
  _wait_health "$port" "$region_id"
}

_start_region us-east-1 8001 "$REGIONAL_US_URL" \
  "eu-west-1:http://127.0.0.1:8002,ap-south-1:http://127.0.0.1:8003" http://127.0.0.1:8001
_start_region eu-west-1 8002 "$REGIONAL_EU_URL" \
  "us-east-1:http://127.0.0.1:8001,ap-south-1:http://127.0.0.1:8003" http://127.0.0.1:8002
_start_region ap-south-1 8003 "$REGIONAL_AP_URL" \
  "us-east-1:http://127.0.0.1:8001,eu-west-1:http://127.0.0.1:8002" http://127.0.0.1:8003

echo "==> Gateway on :8000"
export REGIONAL_DATABASE_URL="$DATABASE_URL"
exec env "${_common[@]}" DEPLOYMENT_MODE=gateway \
  GATEWAY_PEERS="us-east-1:http://127.0.0.1:8001,eu-west-1:http://127.0.0.1:8002,ap-south-1:http://127.0.0.1:8003" \
  OAUTH_REDIRECT_BASE_URL=http://127.0.0.1:8000 REGIONAL_DATABASE_URL="$DATABASE_URL" PORT=8000 \
  "${GLOBE[@]}"
