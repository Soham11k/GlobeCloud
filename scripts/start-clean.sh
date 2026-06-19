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

PYTHON="${ROOT}/.venv/bin/python"
if [[ ! -x "$PYTHON" ]]; then
  PYTHON="$(command -v python3 || true)"
fi

"$PYTHON" -m pip install -q -e . -r requirements.txt

_postgres_ready() {
  local host="${1:-localhost}"
  local port="${2:-5432}"
  if command -v nc >/dev/null 2>&1; then
    nc -z "$host" "$port" 2>/dev/null
    return
  fi
  (echo >/dev/tcp/"$host"/"$port") 2>/dev/null
}

# Exit 0 = usable, 1 = cannot connect, 2 = table access denied, 3 = cannot CREATE in public
_test_db_access() {
  local url="$1"
  [[ -z "$url" ]] && return 1
  TEST_DATABASE_URL="$url" "$PYTHON" - <<'PY'
import os, sys
from sqlalchemy import create_engine, text
from sqlalchemy.exc import ProgrammingError, OperationalError

url = os.environ["TEST_DATABASE_URL"]
try:
    engine = create_engine(url, pool_pre_ping=True)
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
        try:
            conn.execute(text("SELECT 1 FROM organizations LIMIT 1"))
        except ProgrammingError as exc:
            msg = str(getattr(exc, "orig", exc)).lower()
            if "permission denied" in msg:
                sys.exit(2)
            if "does not exist" in msg or "undefined_table" in msg:
                pass
            else:
                raise
        can_create = conn.execute(
            text("SELECT has_schema_privilege(current_user, 'public', 'CREATE')")
        ).scalar()
        if not can_create:
            sys.exit(3)
    sys.exit(0)
except OperationalError:
    sys.exit(1)
except SystemExit:
    raise
except Exception as exc:
    if "permission denied" in str(exc).lower():
        sys.exit(2)
    sys.exit(1)
PY
}

_fix_postgres_grants() {
  local db="${1:-globe_platform}"
  local role="${2:-globe}"
  command -v psql >/dev/null 2>&1 || return 1
  psql -d postgres -v ON_ERROR_STOP=0 <<SQL >/dev/null 2>&1 || true
\\connect ${db}
ALTER SCHEMA public OWNER TO ${role};
GRANT ALL PRIVILEGES ON SCHEMA public TO ${role};
GRANT CREATE ON SCHEMA public TO ${role};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${role};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${role};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${role};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${role};
DO \$\$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO ${role}';
  END LOOP;
  FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public' LOOP
    EXECUTE 'ALTER SEQUENCE public.' || quote_ident(r.sequence_name) || ' OWNER TO ${role}';
  END LOOP;
END \$\$;
SQL
}

_bootstrap_macos_postgres() {
  local dbname="${1:-globe_platform}"
  local base="postgresql+psycopg://${USER}@localhost:5432"
  local target="${base}/${dbname}"
  if _test_db_access "$target"; then
    echo "$target"
    return 0
  fi
  if _test_db_access "${base}/postgres"; then
    if command -v createdb >/dev/null 2>&1; then
      createdb "$dbname" 2>/dev/null || true
    fi
    if _test_db_access "$target"; then
      echo "$target"
      return 0
    fi
  fi
  return 1
}

_use_postgres_url() {
  local url="$1"
  local regional="${2:-}"
  export DATABASE_URL="$url"
  if [[ -n "$regional" && "$regional" == postgresql* ]] && _test_db_access "$regional"; then
    export REGIONAL_DATABASE_URL="$regional"
  else
    if [[ -n "$regional" && "$regional" != "$url" ]]; then
      echo "==> Regional Postgres not reachable — using platform DB"
    fi
    export REGIONAL_DATABASE_URL="$url"
  fi
}

_select_database() {
  local preferred="${DATABASE_URL:-}"
  local regional="${REGIONAL_DATABASE_URL:-}"

  if [[ "$preferred" == postgresql* ]]; then
    local code=0
    _test_db_access "$preferred" || code=$?
    if [[ $code -eq 2 || $code -eq 3 ]]; then
      echo "==> Fixing Postgres permissions (globe role needs CREATE on public schema)..."
      _fix_postgres_grants globe_platform globe
      code=0
      _test_db_access "$preferred" || code=$?
    fi
    if [[ $code -eq 0 ]]; then
      _use_postgres_url "$preferred" "$regional"
      return 0
    fi
  fi

  if _postgres_ready localhost 5432; then
    local url=""
    url=$(_bootstrap_macos_postgres globe_platform) || true
    if [[ -n "$url" ]]; then
      echo "==> Using local Postgres as ${USER}@localhost (Homebrew default)"
      _use_postgres_url "$url" "$url"
      return 0
    fi
  fi

  if [[ "${preferred:-}" == postgresql* ]]; then
    echo "==> Postgres unavailable or misconfigured — using SQLite (data/globe.db)"
    echo "    Tip: DATABASE_URL=postgresql+psycopg://${USER}@localhost:5432/globe_platform"
  else
    echo "==> Postgres not available — using SQLite (data/globe.db)"
  fi
  export DATABASE_URL="sqlite:///${ROOT}/data/globe.db"
  export REGIONAL_DATABASE_URL=""
}

# Start Postgres when Docker is available
if command -v docker >/dev/null 2>&1; then
  echo "==> Starting Postgres (platform-db + us-db)..."
  docker compose -f deploy/docker-compose.yml up -d platform-db us-db 2>/dev/null || true
  for _ in $(seq 1 30); do
    if docker compose -f deploy/docker-compose.yml exec -T platform-db pg_isready -U globe -d globe_platform >/dev/null 2>&1; then
      DATABASE_URL="postgresql+psycopg://globe:globe@localhost:5432/globe_platform"
      REGIONAL_DATABASE_URL="postgresql+psycopg://globe:globe@localhost:5433/globe_us"
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

_select_database

# Redis is optional locally — avoid 500s when REDIS_URL is set but redis-server isn't running
_redis_ready() {
  _postgres_ready localhost "${1:-6379}"
}

if [[ -n "${REDIS_URL:-}" ]] && ! _redis_ready 6379; then
  echo "==> Redis not reachable — rate limits will use in-memory store"
  unset REDIS_URL
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

exec "$PYTHON" -m globe.main
