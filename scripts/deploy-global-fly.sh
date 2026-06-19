#!/usr/bin/env bash
# GlobeCloud — deploy global product to Fly.io (3 regional apps + 1 gateway)
# Prerequisites: flyctl installed and logged in
#
# Usage:
#   export API_KEY=$(openssl rand -hex 32)
#   export REPLICATION_SECRET=$(openssl rand -hex 32)
#   ./scripts/deploy-global-fly.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v flyctl >/dev/null 2>&1; then
  echo "Install flyctl: https://fly.io/docs/hands-on/install-flyctl/"
  exit 1
fi

GATEWAY_APP="${GATEWAY_APP:-globecloud}"
US_APP="${US_APP:-globecloud-us}"
EU_APP="${EU_APP:-globecloud-eu}"
AP_APP="${AP_APP:-globecloud-ap}"

US_URL="https://${US_APP}.fly.dev"
EU_URL="https://${EU_APP}.fly.dev"
AP_URL="https://${AP_APP}.fly.dev"
GATEWAY_URL="https://${GATEWAY_APP}.fly.dev"

API_KEY="${API_KEY:-$(openssl rand -hex 32)}"
REPLICATION_SECRET="${REPLICATION_SECRET:-$(openssl rand -hex 32)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
CORS_ORIGINS="${CORS_ORIGINS:-${GATEWAY_URL}}"

echo "==> GlobeCloud Global Deploy"
echo "    Postgres: run ./scripts/provision-fly-postgres.sh before first deploy (or set DATABASE_URL secrets manually)"
if [[ "${PROVISION_POSTGRES:-0}" == "1" ]]; then
  echo "==> PROVISION_POSTGRES=1 — provisioning Fly Postgres..."
  chmod +x scripts/provision-fly-postgres.sh
  ./scripts/provision-fly-postgres.sh
fi
echo ""

ensure_app() {
  local app="$1"
  local config="$2"
  if ! flyctl apps list 2>/dev/null | grep -qw "$app"; then
    echo "==> Creating app: $app"
    flyctl apps create "$app" || true
  fi
  cp "$config" fly.toml
}

ensure_volume() {
  local app="$1"
  local region="$2"
  if ! flyctl volumes list -a "$app" 2>/dev/null | grep -q globe_data; then
    echo "==> Creating volume for $app in $region"
    flyctl volumes create globe_data --region "$region" --size 1 -y -a "$app"
  fi
}

deploy_regional() {
  local app="$1"
  local config="$2"
  local region_id="$3"
  local fly_region="$4"
  local public_url="$5"
  local peer_urls="$6"

  echo ""
  echo "==> Deploying regional app: $app ($region_id)"
  ensure_app "$app" "$config"
  ensure_volume "$app" "$fly_region"

  flyctl secrets set \
    "API_KEY=${API_KEY}" \
    "REPLICATION_SECRET=${REPLICATION_SECRET}" \
    "CORS_ORIGINS=${CORS_ORIGINS}" \
    "PEER_URLS=${peer_urls}" \
    "PUBLIC_URL=${public_url}" \
    "DEPLOYMENT_MODE=regional" \
    "REGION_ID=${region_id}" \
    "ENVIRONMENT=production" \
    -a "$app"

  flyctl deploy -a "$app" --ha=false
}

deploy_gateway() {
  local gateway_peers="us-east-1:${US_URL},eu-west-1:${EU_URL},ap-south-1:${AP_URL}"

  echo ""
  echo "==> Deploying global gateway: $GATEWAY_APP"
  ensure_app "$GATEWAY_APP" "deploy/fly/gateway.toml"

  flyctl secrets set \
    "API_KEY=${API_KEY}" \
    "CORS_ORIGINS=${CORS_ORIGINS}" \
    "GATEWAY_PEERS=${gateway_peers}" \
    "PUBLIC_URL=${GATEWAY_URL}" \
    "DEPLOYMENT_MODE=gateway" \
    "JWT_SECRET=${JWT_SECRET}" \
    "AUTH_REQUIRED=true" \
    "OAUTH_REDIRECT_BASE_URL=${GATEWAY_URL}" \
    -a "$GATEWAY_APP"

  if [[ -n "${GOOGLE_CLIENT_ID:-}" && -n "${GOOGLE_CLIENT_SECRET:-}" ]]; then
    flyctl secrets set \
      "GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}" \
      "GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}" \
      -a "$GATEWAY_APP"
  fi
  if [[ -n "${GITHUB_CLIENT_ID:-}" && -n "${GITHUB_CLIENT_SECRET:-}" ]]; then
    flyctl secrets set \
      "GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}" \
      "GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}" \
      -a "$GATEWAY_APP"
  fi

  cp deploy/fly/gateway.toml fly.toml
  flyctl deploy -a "$GATEWAY_APP" --ha=false
}

# Regional backends first (US → EU → AP)
deploy_regional "$US_APP" "deploy/fly/us.toml" "us-east-1" "iad" "$US_URL" \
  "eu-west-1:${EU_URL},ap-south-1:${AP_URL}"

deploy_regional "$EU_APP" "deploy/fly/eu.toml" "eu-west-1" "ams" "$EU_URL" \
  "us-east-1:${US_URL},ap-south-1:${AP_URL}"

deploy_regional "$AP_APP" "deploy/fly/ap.toml" "ap-south-1" "bom" "$AP_URL" \
  "us-east-1:${US_URL},eu-west-1:${EU_URL}"

# Global gateway last
deploy_gateway

echo ""
echo "=========================================="
echo " GlobeCloud Global Product Deployed"
echo "=========================================="
echo ""
echo " Global URL:  ${GATEWAY_URL}/app"
echo " API:         ${GATEWAY_URL}/api/v1/global/status"
echo ""
echo " API_KEY (save this): ${API_KEY}"
echo ""

cat > .env.deploy <<EOF
# GlobeCloud deploy — $(date -u +"%Y-%m-%dT%H:%M:%SZ")
API_KEY=${API_KEY}
REPLICATION_SECRET=${REPLICATION_SECRET}
JWT_SECRET=${JWT_SECRET}
GATEWAY_URL=${GATEWAY_URL}
OAUTH_REDIRECT_BASE_URL=${GATEWAY_URL}
EOF
echo " Saved credentials to .env.deploy"
echo ""

if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  echo "==> Setting OPENAI_API_KEY on regional apps..."
  for app in "$US_APP" "$EU_APP" "$AP_APP"; do
    flyctl secrets set "OPENAI_API_KEY=${OPENAI_API_KEY}" -a "$app" 2>/dev/null || true
  done
fi

echo "==> Post-deploy smoke test..."
sleep 5
if API_KEY="${API_KEY}" BASE_URL="${GATEWAY_URL}" ./scripts/smoke-test.sh; then
  echo " Smoke test passed."
else
  echo " WARNING: smoke test failed — check fly logs"
fi

echo ""
echo " Verify:"
echo "   curl ${GATEWAY_URL}/api/v1/health"
echo "   curl -H 'X-API-Key: ${API_KEY}' ${GATEWAY_URL}/api/v1/global/status"
echo ""
echo " Custom domain (gateway only):"
echo "   fly certs add app.yourdomain.com -a ${GATEWAY_APP}"
echo ""
