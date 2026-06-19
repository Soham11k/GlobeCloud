#!/usr/bin/env bash
# Apply platform database migrations (Alembic).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source .venv/bin/activate 2>/dev/null || true
alembic upgrade head
