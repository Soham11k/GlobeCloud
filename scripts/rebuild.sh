#!/usr/bin/env bash
# Full clean rebuild — wipe venv + data, reinstall, start, smoke test.
#
# Usage: ./scripts/rebuild.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8000}"
cd "$ROOT"

echo "==> GlobeCloud full rebuild"
echo "    Project: ${ROOT}"
echo ""

echo "==> Stopping servers on ports 8000 and 8001..."
lsof -ti:8000,8001 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

echo "==> Removing virtualenv, database, and build artifacts..."
rm -rf .venv data src/globe_agent.egg-info .tunnel-url
find src -type d -name __pycache__ -print0 2>/dev/null | xargs -0 rm -rf 2>/dev/null || true

echo "==> Fresh install..."
./scripts/setup.sh

# shellcheck disable=SC1091
source .venv/bin/activate

echo "==> Starting GlobeCloud on http://127.0.0.1:${PORT}..."
nohup globe >/tmp/globecloud.log 2>&1 &

ready=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  if curl -sf --max-time 3 "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null; then
    ready=1
    break
  fi
done

if [[ "$ready" -ne 1 ]]; then
  echo "FAIL: server did not start. Check /tmp/globecloud.log"
  tail -20 /tmp/globecloud.log 2>/dev/null || true
  exit 1
fi

echo "==> Running smoke test..."
./scripts/smoke-test.sh

echo ""
echo "Rebuild complete."
echo "  Console: http://127.0.0.1:${PORT}/app"
echo "  Logs:    tail -f /tmp/globecloud.log"
echo ""
