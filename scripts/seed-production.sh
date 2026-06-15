#!/usr/bin/env bash
# Load production GlobeCloud catalog into fresh regional DBs.
#
# Usage: ./scripts/seed-production.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CATALOG="${CATALOG_FILE:-seed/catalog.json}"

if [[ ! -f "$CATALOG" ]]; then
  echo "Catalog not found: $CATALOG"
  exit 1
fi

echo "==> GlobeCloud production seed"
echo "    Catalog: $CATALOG"

# Ensure .env points at real catalog
if [[ -f .env ]]; then
  if grep -q '^SEED_DEMO_DATA=' .env; then
    sed -i.bak 's/^SEED_DEMO_DATA=.*/SEED_DEMO_DATA=0/' .env
  else
    echo 'SEED_DEMO_DATA=0' >> .env
  fi
  if grep -q '^CATALOG_SEED_FILE=' .env; then
    sed -i.bak "s|^CATALOG_SEED_FILE=.*|CATALOG_SEED_FILE=${CATALOG}|" .env
  else
    echo "CATALOG_SEED_FILE=${CATALOG}" >> .env
  fi
  rm -f .env.bak
else
  cp .env.example .env
  echo 'SEED_DEMO_DATA=0' >> .env
  echo "CATALOG_SEED_FILE=${CATALOG}" >> .env
fi

echo "==> Wiping data/ for clean catalog load..."
rm -rf data/
mkdir -p data

PRODUCT_COUNT=$(python3 -c "import json; print(len(json.load(open('${CATALOG}'))['products']))")
echo "    Products in catalog: ${PRODUCT_COUNT}"
echo ""
echo "Start the server to load catalog:"
echo "  ./scripts/start-clean.sh"
echo ""
echo "Verify:"
echo "  curl http://127.0.0.1:8000/api/v1/regions/us-east-1/products"
