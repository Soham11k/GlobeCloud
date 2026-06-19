#!/usr/bin/env bash
# Print OAuth setup checklist and validate .env vars.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No .env at $ENV_FILE — copy from .env.example first."
  exit 1
fi

get_var() {
  grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- || true
}

BASE="${OAUTH_REDIRECT_BASE_URL:-$(get_var OAUTH_REDIRECT_BASE_URL)}"
BASE="${BASE:-http://127.0.0.1:8000}"
BASE="${BASE%/}"

echo "GlobeCloud OAuth setup"
echo "======================"
echo ""
echo "1. Google — https://console.cloud.google.com/apis/credentials"
echo "   Create OAuth 2.0 Client ID (Web application)"
echo "   Authorized redirect URI:"
echo "     ${BASE}/auth/oauth/callback/google"
echo ""
echo "2. GitHub — https://github.com/settings/developers"
echo "   New OAuth App → Authorization callback URL:"
echo "     ${BASE}/auth/oauth/callback/github"
echo ""
echo "3. Add to .env (both ID and secret required per provider):"
echo "   GOOGLE_CLIENT_ID=..."
echo "   GOOGLE_CLIENT_SECRET=..."
echo "   GITHUB_CLIENT_ID=..."
echo "   GITHUB_CLIENT_SECRET=..."
echo "   OAUTH_REDIRECT_BASE_URL=${BASE}"
echo ""
echo "4. Restart the server."
echo ""

missing=0
for pair in "GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET google" "GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET github"; do
  set -- $pair
  id="$(get_var "$1")"
  secret="$(get_var "$2")"
  name="$3"
  if [[ -n "${id// /}" && -n "${secret// /}" ]]; then
    echo "✓ ${name} configured"
  else
    echo "✗ ${name} missing ($1 / $2 empty in .env)"
    missing=$((missing + 1))
  fi
done

if [[ "$missing" -eq 0 ]]; then
  echo ""
  echo "All OAuth providers configured. Restart server if you just edited .env."
  exit 0
fi

echo ""
echo "$missing provider(s) still need credentials."
exit 1
