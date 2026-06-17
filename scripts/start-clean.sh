#!/usr/bin/env bash
# Start GlobeCloud cleanly — kills zombie processes on 8000/8001, then starts one server.
#
# Usage: ./scripts/start-clean.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8000}"
cd "$ROOT"
mkdir -p data

echo "==> Stopping processes on ports 8000 and 8001..."
lsof -ti:8000,8001 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

if [[ ! -d .venv ]]; then
  echo "Run first: python3 -m venv .venv && source .venv/bin/activate && pip install -e ."
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate

pip install -q -e . -r requirements.txt

_postgres_ready() {
  local host="${1:-localhost}"
  local port="${2:-5432}"
  if command -v nc >/dev/null 2>&1; then
    nc -z "$host" "$port" 2>/dev/null
    return
  fi
  (echo >/dev/tcp/"$host"/"$port") 2>/dev/null
}

# Start Postgres when Docker is available
if command -v docker >/dev/null 2>&1; then
  echo "==> Starting Postgres (platform-db + us-db)..."
  docker compose -f deploy/docker-compose.yml up -d platform-db us-db 2>/dev/null || true
  for _ in $(seq 1 30); do
    if docker compose -f deploy/docker-compose.yml exec -T platform-db pg_isready -U globe -d globe_platform >/dev/null 2>&1; then
      export DATABASE_URL="postgresql+psycopg://globe:globe@localhost:5432/globe_platform"
      export REGIONAL_DATABASE_URL="postgresql+psycopg://globe:globe@localhost:5433/globe_us"
      break
    fi
    sleep 1
  done
fi

# Load database URLs from .env when not already exported
if [[ -f .env ]]; then
  if [[ -z "${DATABASE_URL:-}" ]]; then
    DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '\r' || true)
  fi
  if [[ -z "${REGIONAL_DATABASE_URL:-}" ]]; then
    REGIONAL_DATABASE_URL=$(grep '^REGIONAL_DATABASE_URL=' .env | cut -d= -f2- | tr -d '\r' || true)
  fi
  env_api=$(grep '^API_KEY=' .env | cut -d= -f2- || true)
  if [[ -z "${env_api// /}" ]]; then
    unset API_KEY
  fi
fi

# Use Postgres when reachable; otherwise SQLite (no Docker/Postgres install required)
if [[ "${DATABASE_URL:-}" == postgresql* ]] && _postgres_ready localhost 5432; then
  export DATABASE_URL="${DATABASE_URL}"
  if [[ "${REGIONAL_DATABASE_URL:-}" == *":5433/"* ]] && ! _postgres_ready localhost 5433; then
    echo "==> Regional Postgres (:5433) not running — using platform DB on :5432"
    export REGIONAL_DATABASE_URL="${DATABASE_URL}"
  elif [[ -z "${REGIONAL_DATABASE_URL:-}" ]]; then
    export REGIONAL_DATABASE_URL="${DATABASE_URL}"
  else
    export REGIONAL_DATABASE_URL="${REGIONAL_DATABASE_URL}"
  fi
else
  echo "==> Postgres not available — using SQLite (data/globe.db)"
  export DATABASE_URL="sqlite:///${ROOT}/data/globe.db"
  export REGIONAL_DATABASE_URL=""
fi

export DEPLOYMENT_MODE="${DEPLOYMENT_MODE:-regional}"
export REGION_ID="${REGION_ID:-us-east-1}"
export REPLICATION_SECRET="${REPLICATION_SECRET:-dev-replication-secret}"
export ENVIRONMENT="${ENVIRONMENT:-development}"

echo "==> Starting GlobeCloud on http://127.0.0.1:${PORT}"
echo "    Database: ${DATABASE_URL}"
echo "    Console: http://127.0.0.1:${PORT}/app"
echo "    Press Ctrl+C to stop"
echo ""

exec globe
