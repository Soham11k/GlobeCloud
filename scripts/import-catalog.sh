#!/usr/bin/env bash
# Import a custom product catalog into GlobeCloud.
#
# Local fresh start (loads catalog at DB init):
#   ./scripts/import-catalog.sh --local
#
# Import into a running server via API:
#   ./scripts/import-catalog.sh --api
#   BASE_URL=https://globecloud-us.fly.dev REGION=us-east-1 API_KEY=... ./scripts/import-catalog.sh --api
#
# Fly gateway (import to US region, then sync):
#   BASE_URL=https://globecloud.fly.dev REGION=us-east-1 API_KEY=... ./scripts/import-catalog.sh --api --sync

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CATALOG_FILE="${CATALOG_FILE:-seed/catalog.json}"
BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
REGION="${REGION:-us-east-1}"
API_KEY="${API_KEY:-}"
MODE=""
RUN_SYNC=0

usage() {
  sed -n '2,12p' "$0"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local) MODE=local; shift ;;
    --api) MODE=api; shift ;;
    --sync) RUN_SYNC=1; shift ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

[[ -n "$MODE" ]] || usage

if [[ ! -f "$CATALOG_FILE" ]]; then
  echo "Catalog file not found: $CATALOG_FILE"
  exit 1
fi

if [[ "$MODE" == "local" ]]; then
  echo "==> Local catalog import (fresh DB on next start)"
  echo "    Catalog: $CATALOG_FILE"

  if [[ -f .env ]]; then
    if grep -q '^SEED_DEMO_DATA=' .env; then
      sed -i.bak 's/^SEED_DEMO_DATA=.*/SEED_DEMO_DATA=0/' .env
    else
      echo 'SEED_DEMO_DATA=0' >> .env
    fi
    if grep -q '^CATALOG_SEED_FILE=' .env; then
      sed -i.bak "s|^CATALOG_SEED_FILE=.*|CATALOG_SEED_FILE=${CATALOG_FILE}|" .env
    else
      echo "CATALOG_SEED_FILE=${CATALOG_FILE}" >> .env
    fi
    rm -f .env.bak
  else
    cp .env.example .env
    echo 'SEED_DEMO_DATA=0' >> .env
    echo "CATALOG_SEED_FILE=${CATALOG_FILE}" >> .env
  fi

  echo "==> Wiping data/ for clean seed..."
  rm -rf data/
  mkdir -p data

  echo ""
  echo "Done. Start the server:"
  echo "  ./scripts/start-clean.sh"
  echo ""
  echo "Verify:"
  echo "  curl http://127.0.0.1:8000/api/v1/regions/us-east-1/products"
  exit 0
fi

echo "==> API catalog import"
echo "    Server:  ${BASE_URL}"
echo "    Region:  ${REGION}"
echo "    Catalog: ${CATALOG_FILE}"

headers=(-H "Content-Type: application/json")
if [[ -n "$API_KEY" ]]; then
  headers+=(-H "X-API-Key: ${API_KEY}")
fi

payload=$(python3 -c "
import json, sys
data = json.load(open('${CATALOG_FILE}'))
print(json.dumps({'products': data['products'], 'knowledge': data.get('knowledge', [])}))
")

tmp=$(mktemp)
http_code=$(curl -s -w "%{http_code}" -o "$tmp" "${headers[@]}" -X POST \
  "${BASE_URL}/api/v1/regions/${REGION}/products/import" \
  -d "$payload") || { echo "FAIL: could not reach ${BASE_URL}"; rm -f "$tmp"; exit 1; }

if [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
  echo "FAIL: import returned HTTP ${http_code}"
  cat "$tmp" | python3 -m json.tool 2>/dev/null || cat "$tmp"
  rm -f "$tmp"
  exit 1
fi

cat "$tmp" | python3 -m json.tool
rm -f "$tmp"

if [[ "$RUN_SYNC" -eq 1 ]]; then
  echo ""
  echo "==> Running replication sync..."
  curl -sf "${headers[@]}" -X POST "${BASE_URL}/api/v1/sync/run" | python3 -m json.tool
fi

echo ""
echo "Import complete."
