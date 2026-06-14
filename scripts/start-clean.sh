#!/usr/bin/env bash
# Start GlobeCloud cleanly — kills zombie processes on 8000/8001, then starts one server.
#
# Usage: ./scripts/start-clean.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8000}"
cd "$ROOT"

echo "==> Stopping processes on ports 8000 and 8001..."
lsof -ti:8000,8001 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

if [[ ! -d .venv ]]; then
  echo "Run first: python3 -m venv .venv && source .venv/bin/activate && pip install -e ."
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate

echo "==> Starting GlobeCloud on http://127.0.0.1:${PORT}"
echo "    Console: http://127.0.0.1:${PORT}/app"
echo "    Press Ctrl+C to stop"
echo ""

exec globe
