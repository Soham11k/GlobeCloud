#!/usr/bin/env bash
# One-time bootstrap for GlobeCloud (idempotent).
#
# Usage: ./scripts/setup.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Setting up GlobeCloud in ${ROOT}"

if [[ ! -d .venv ]]; then
  echo "==> Creating virtual environment..."
  python3 -m venv .venv
else
  echo "==> Virtual environment already exists"
fi

# shellcheck disable=SC1091
source .venv/bin/activate

echo "==> Installing GlobeCloud (editable)..."
pip install -e .

if command -v npm >/dev/null 2>&1 && [[ -f frontend/package.json ]]; then
  echo "==> Building React frontend..."
  cd frontend
  npm ci
  npm run build
  cd "$ROOT"
else
  echo "==> Skipping frontend build (npm not found or frontend/ missing)"
fi

if [[ ! -f .env ]] && [[ -f .env.example ]]; then
  cp .env.example .env
  echo "==> Created .env from .env.example"
elif [[ -f .env ]]; then
  echo "==> .env already exists"
fi

echo ""
echo "Setup complete."
echo ""
echo "Next steps:"
echo "  Share a public demo:  ./scripts/share-demo.sh"
echo "  Local development:    ./scripts/start-clean.sh"
echo "  Frontend dev server:  cd frontend && npm run dev"
echo "  Full guide:           docs/GETTING_STARTED.md"
echo ""
