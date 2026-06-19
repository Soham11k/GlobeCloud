#!/usr/bin/env bash
# Production-mode local stack: fills .env secrets, Postgres, 3 regions + gateway.
#
# Usage:
#   ./scripts/start-production-local.sh
#   ./scripts/start-production-local.sh --tunnel   # also open Cloudflare tunnel on :8000
#
# Requires: ./scripts/setup.sh once, Homebrew Postgres (or Docker)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
TUNNEL=0
[[ "${1:-}" == "--tunnel" ]] && TUNNEL=1

if [[ ! -d .venv ]]; then
  echo "==> First-time setup..."
  ./scripts/setup.sh
fi

echo "==> Syncing .env secrets (only fills empty values)..."
"$ROOT/.venv/bin/python" "$ROOT/scripts/sync-env-secrets.py" --all --production --fetch-stripe

# shellcheck disable=SC1091
source "$ROOT/scripts/lib/env.sh"
load_env_file "$ROOT/.env"

echo ""
echo "==> Production local GlobeCloud"
echo "    ENVIRONMENT=${ENVIRONMENT:-production}"
echo "    DATABASE_URL=${DATABASE_URL:-}"
echo "    API_KEY is set: $([[ -n "${API_KEY:-}" ]] && echo yes || echo no)"
echo "    JWT_SECRET is set: $([[ -n "${JWT_SECRET:-}" ]] && echo yes || echo no)"
echo "    OpenAI: $([[ -n "${OPENAI_API_KEY:-}" ]] && echo configured || echo not set)"
echo "    Stripe: $([[ -n "${STRIPE_SECRET_KEY:-}" ]] && echo configured || echo not set)"
echo "    Resend: $([[ -n "${RESEND_API_KEY:-}" ]] && echo configured || echo not set)"
echo ""

if command -v psql >/dev/null 2>&1; then
  ./scripts/setup-local-postgres.sh >/dev/null 2>&1 || true
fi

if [[ "$TUNNEL" == 1 ]]; then
  echo "==> Starting multi-region stack in background for tunnel..."
  ./scripts/start-multiregion.sh --native &
  MR_PID=$!
  trap 'kill "$MR_PID" 2>/dev/null || true' EXIT INT TERM
  sleep 15
  PORT=8000 RESTART_SERVER=0 ./scripts/share-tunnel.sh
else
  exec ./scripts/start-multiregion.sh --native
fi
