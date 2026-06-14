#!/usr/bin/env bash
# Alias for share-tunnel.sh — restarts server fresh, then opens public demo tunnel.
export RESTART_SERVER=1
exec "$(cd "$(dirname "$0")" && pwd)/share-tunnel.sh" "$@"
