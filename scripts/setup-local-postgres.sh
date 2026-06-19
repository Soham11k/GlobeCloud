#!/usr/bin/env bash
# One-time local Postgres setup for GlobeCloud (Homebrew Postgres on Mac).
set -euo pipefail

DB="${1:-globe_platform}"
ROLE="${2:-globe}"

if ! command -v psql >/dev/null 2>&1; then
  echo "Install Postgres first: brew install postgresql@16 && brew services start postgresql@16"
  exit 1
fi

psql -d postgres -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${ROLE}') THEN
    CREATE ROLE ${ROLE} WITH LOGIN PASSWORD '${ROLE}' CREATEDB;
  END IF;
END \$\$;
SELECT 'CREATE DATABASE ${DB} OWNER ${ROLE}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB}')\\gexec
SQL

if psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB}'" | grep -q 1; then
  psql -d postgres -c "ALTER DATABASE ${DB} OWNER TO ${ROLE};" 2>/dev/null || true
fi

psql -d "${DB}" -v ON_ERROR_STOP=0 <<SQL
ALTER SCHEMA public OWNER TO ${ROLE};
GRANT ALL PRIVILEGES ON SCHEMA public TO ${ROLE};
GRANT CREATE ON SCHEMA public TO ${ROLE};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${ROLE};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${ROLE};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${ROLE};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${ROLE};
SQL

echo ""
echo "Done. Add to .env:"
echo "DATABASE_URL=postgresql+psycopg://${ROLE}:${ROLE}@localhost:5432/${DB}"
echo "REGIONAL_DATABASE_URL="
