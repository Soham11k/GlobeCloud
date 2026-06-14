#!/usr/bin/env bash
# Expose local GlobeCloud to the internet via Cloudflare Tunnel (no credit card).
#
# Usage:
#   ./scripts/share-tunnel.sh
#   ./scripts/share-demo.sh   (alias — restarts server fresh by default)
#
# Optional env:
#   PORT=8000            Local GlobeCloud port
#   START_SERVER=1       Start globe if not running (default: 1)
#   RESTART_SERVER=0     Kill and restart globe even if already running (share-demo sets 1)
#   API_KEY=...          Set API_KEY before starting server (optional; leave unset for open demos)
#
# For protected demos: export API_KEY=$(openssl rand -hex 32) before running.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8000}"
START_SERVER="${START_SERVER:-1}"
RESTART_SERVER="${RESTART_SERVER:-0}"
LOCAL_URL="http://127.0.0.1:${PORT}"
TUNNEL_URL_FILE="${ROOT}/.tunnel-url"
CLOUDFLARED_LOG="/tmp/globecloud-cloudflared.log"

install_cloudflared_hint() {
  echo ""
  echo "cloudflared is not installed. Install it:"
  echo ""
  echo "  macOS (Homebrew):  brew install cloudflared"
  echo "  Linux:             https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
  echo ""
  exit 1
}

ensure_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then
    return 0
  fi
  if command -v brew >/dev/null 2>&1; then
    echo "==> Installing cloudflared via Homebrew..."
    brew install cloudflared
    return 0
  fi
  install_cloudflared_hint
}

server_up() {
  curl -sf "${LOCAL_URL}/api/v1/health" >/dev/null 2>&1
}

kill_zombie_ports() {
  echo "==> Stopping processes on ports 8000 and 8001..."
  lsof -ti:8000,8001 2>/dev/null | xargs kill -9 2>/dev/null || true
  sleep 1
}

start_globe() {
  echo "==> Starting GlobeCloud on port ${PORT}..."
  cd "$ROOT"
  # shellcheck disable=SC1091
  source .venv/bin/activate
  if [[ -n "${API_KEY:-}" ]]; then
    export API_KEY
    echo "    API key auth enabled — share the key with visitors"
  else
    echo "    No API_KEY set — console is open for demo visitors"
  fi
  nohup globe >/tmp/globecloud.log 2>&1 &
  echo $! >/tmp/globecloud.pid

  for _ in $(seq 1 30); do
    if server_up; then
      echo "==> GlobeCloud is up at ${LOCAL_URL}"
      echo "    Console: ${LOCAL_URL}/app"
      return 0
    fi
    sleep 0.5
  done
  echo "Failed to start GlobeCloud. See /tmp/globecloud.log"
  tail -20 /tmp/globecloud.log 2>/dev/null || true
  exit 1
}

print_share_block() {
  local url="$1"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Share with your customer:"
  echo "  Landing:  ${url}/"
  echo "  Console:  ${url}/app"
  echo ""
  echo "Tell them: Open Console → follow the Getting Started checklist"
  echo "Wait 10–20s after this appears before opening the URL in a browser."
  if [[ -n "${API_KEY:-}" ]]; then
    echo ""
    echo "API key required — paste in console sidebar:"
    echo "  ${API_KEY}"
  fi
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

watch_for_tunnel_url() {
  local printed=0
  for _ in $(seq 1 120); do
    if [[ -f "$CLOUDFLARED_LOG" ]]; then
      local url
      url=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$CLOUDFLARED_LOG" 2>/dev/null | head -1 || true)
      if [[ -n "$url" && "$printed" -eq 0 ]]; then
        echo "$url" > "$TUNNEL_URL_FILE"
        print_share_block "$url"
        printed=1
      fi
    fi
    sleep 0.25
  done
}

cd "$ROOT"

if [[ "$RESTART_SERVER" == "1" ]]; then
  kill_zombie_ports
  if [[ "$START_SERVER" == "1" ]]; then
    if [[ ! -d .venv ]]; then
      echo "Run first: ./scripts/setup.sh"
      exit 1
    fi
    start_globe
  fi
else
  if lsof -ti:8001 >/dev/null 2>&1; then
    echo "==> Stopping leftover process on port 8001..."
    lsof -ti:8001 2>/dev/null | xargs kill -9 2>/dev/null || true
    sleep 0.5
  fi

  if ! server_up; then
    kill_zombie_ports
  fi

  if ! server_up; then
    if [[ "$START_SERVER" == "1" ]]; then
      if [[ ! -d .venv ]]; then
        echo "Run first: ./scripts/setup.sh"
        exit 1
      fi
      start_globe
    else
      echo "GlobeCloud is not running on ${LOCAL_URL}"
      echo "Start it: ./scripts/start-clean.sh"
      exit 1
    fi
  else
    echo "==> GlobeCloud already running at ${LOCAL_URL}"
    echo "    Console: ${LOCAL_URL}/app"
    echo "    Tip: use ./scripts/share-demo.sh to restart fresh"
  fi
fi

ensure_cloudflared

echo ""
echo "==> Opening Cloudflare Tunnel (free, no card required)"
echo "    Local:  ${LOCAL_URL}"
echo "    Press Ctrl+C to stop the tunnel"
echo ""

: > "$CLOUDFLARED_LOG"
watch_for_tunnel_url &
WATCHER_PID=$!
trap 'kill $WATCHER_PID 2>/dev/null || true' EXIT INT TERM

cloudflared tunnel --url "${LOCAL_URL}" 2>&1 | tee -a "$CLOUDFLARED_LOG"
