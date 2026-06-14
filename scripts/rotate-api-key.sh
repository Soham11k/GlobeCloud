#!/usr/bin/env bash
# Rotate GlobeCloud API key across Fly.io apps.
#
# Usage:
#   ./scripts/rotate-api-key.sh
#   NEW_KEY=$(openssl rand -hex 32) ./scripts/rotate-api-key.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NEW_KEY="${NEW_KEY:-$(openssl rand -hex 32)}"
GATEWAY_APP="${GATEWAY_APP:-globecloud}"
APPS=("${GATEWAY_APP}" "${US_APP:-globecloud-us}" "${EU_APP:-globecloud-eu}" "${AP_APP:-globecloud-ap}")

if ! command -v flyctl >/dev/null 2>&1; then
  echo "Install flyctl first: https://fly.io/docs/hands-on/install-flyctl/"
  exit 1
fi

echo "==> Rotating API key on Fly apps..."
for app in "${APPS[@]}"; do
  if flyctl apps list 2>/dev/null | grep -qw "$app"; then
    echo "    $app"
    flyctl secrets set "API_KEY=${NEW_KEY}" -a "$app"
  fi
done

cat > .env.deploy <<EOF
# Generated $(date -u +"%Y-%m-%dT%H:%M:%SZ")
API_KEY=${NEW_KEY}
GATEWAY_URL=https://${GATEWAY_APP}.fly.dev
EOF

echo ""
echo "New API key saved to .env.deploy"
echo "Share with customers: https://${GATEWAY_APP}.fly.dev/app"
echo ""
echo "IMPORTANT: Update any stored keys — old key is now invalid."
