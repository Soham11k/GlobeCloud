#!/usr/bin/env bash
# Legacy single-app deploy — use deploy-global-fly.sh for the global product
echo "Use ./scripts/deploy-global-fly.sh for the global Fly.io product."
echo "See docs/DEPLOY.md"
exec "$(dirname "$0")/deploy-global-fly.sh" "$@"
