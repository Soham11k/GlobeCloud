#!/usr/bin/env bash
# Configure GlobeCloud to use Supabase Postgres (hosted PostgreSQL).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No .env at $ENV_FILE — copy from .env.example first."
  exit 1
fi

echo "GlobeCloud → Supabase setup"
echo "============================="
echo ""
echo "1. Create a project at https://supabase.com/dashboard"
echo "2. Project Settings → Database → Connection string"
echo "   Use 'URI' mode. Prefer the transaction pooler (port 6543) for the app."
echo "3. SQL Editor — enable pgvector (required for RAG):"
echo "     CREATE EXTENSION IF NOT EXISTS vector;"
echo ""
echo "4. Add to .env (either form works):"
echo ""
echo "   SUPABASE_DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"
echo "   # or"
echo "   DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@db.[ref].supabase.co:5432/postgres"
echo ""
echo "   Leave REGIONAL_DATABASE_URL empty to use the same Supabase DB for platform + regional tables."
echo "   For local multiregion simulation, keep local Postgres URLs in start-multiregion.sh — Supabase is one region."
echo ""
echo "5. Run migrations:"
echo "   ./scripts/migrate.sh"
echo ""
echo "6. Restart the server."
echo ""

if grep -qE '^(SUPABASE_DATABASE_URL|DATABASE_URL)=.*supabase' "$ENV_FILE" 2>/dev/null; then
  echo "✓ Supabase URL found in $ENV_FILE"
else
  echo "✗ No Supabase URL in $ENV_FILE yet"
  exit 1
fi
