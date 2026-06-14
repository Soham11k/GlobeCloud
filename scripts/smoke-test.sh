#!/usr/bin/env bash
# Smoke test — verify GlobeCloud API before sharing a demo.
#
# Usage:
#   ./scripts/smoke-test.sh
#   BASE_URL=https://xxx.trycloudflare.com ./scripts/smoke-test.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
API="${BASE_URL}/api/v1"
API_KEY="${API_KEY:-}"

headers=(-H "Content-Type: application/json")
if [[ -n "$API_KEY" ]]; then
  headers+=(-H "X-API-Key: ${API_KEY}")
fi

curl_json() {
  curl -sf "${headers[@]}" "$@"
}

echo "==> Smoke testing GlobeCloud at ${BASE_URL}"

echo "  health..."
curl_json "${API}/health" | grep -q '"status"' || { echo "FAIL: health"; exit 1; }

echo "  product..."
curl_json "${API}/product" | grep -q '"name"' || { echo "FAIL: product"; exit 1; }

echo "  route..."
route=$(curl_json "${API}/route?client_lat=40.0&client_lon=-74.0")
region=$(echo "$route" | python3 -c "import sys,json; print(json.load(sys.stdin)['selected_region'])")

echo "  inventory (${region})..."
products_json=$(curl_json "${API}/regions/${region}/products")
echo "$products_json" | grep -q '"products"' || { echo "FAIL: products"; exit 1; }

read -r product_id stock_before <<< "$(echo "$products_json" | python3 -c "
import sys, json
ps = json.load(sys.stdin)['products']
if not ps:
    raise SystemExit('FAIL: no products in catalog')
p = ps[0]
print(p['id'], p['stock'])
")"

echo "  order (${product_id})..."
curl_json -X POST "${API}/regions/${region}/orders" \
  -d "{\"product_id\":\"${product_id}\",\"quantity\":1}" \
  | grep -q '"id"' || { echo "FAIL: order"; exit 1; }

products_after=$(curl_json "${API}/regions/${region}/products")
stock_after_order=$(echo "$products_after" | python3 -c "
import sys, json
ps = json.load(sys.stdin)['products']
p = next(x for x in ps if x['id'] == '${product_id}')
print(p['stock'])
")

if [[ "$stock_after_order" -ge "$stock_before" ]]; then
  echo "FAIL: stock did not decrease after order ($stock_before -> $stock_after_order)"
  exit 1
fi

echo "  sync..."
curl_json -X POST "${API}/sync/run" | grep -q '"entries_applied"' || { echo "FAIL: sync"; exit 1; }

sleep 1
products_sync1=$(curl_json "${API}/regions/${region}/products")
stock_sync1=$(echo "$products_sync1" | python3 -c "
import sys, json
ps = json.load(sys.stdin)['products']
p = next(x for x in ps if x['id'] == '${product_id}')
print(p['stock'])
")

curl_json -X POST "${API}/sync/run" >/dev/null
sleep 1
products_sync2=$(curl_json "${API}/regions/${region}/products")
stock_sync2=$(echo "$products_sync2" | python3 -c "
import sys, json
ps = json.load(sys.stdin)['products']
p = next(x for x in ps if x['id'] == '${product_id}')
print(p['stock'])
")

if [[ "$stock_sync1" != "$stock_sync2" ]]; then
  echo "FAIL: stock drift after repeated sync ($stock_sync1 -> $stock_sync2)"
  exit 1
fi

echo "  agent..."
curl_json -X POST "${API}/agent/ask" \
  -d '{"question":"How does replication work?","client_lat":40.0,"client_lon":-74.0}' \
  | grep -q '"answer"' || { echo "FAIL: agent"; exit 1; }

echo ""
echo "All checks passed. Safe to share: ${BASE_URL}/app"
