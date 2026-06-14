#!/usr/bin/env bash
# Push latest GlobeCloud changes to GitHub.
#
# Usage: ./scripts/publish-github.sh
#
# Remote: https://github.com/Soham11k/GlobeCloud.git

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REMOTE="${GLOBECLOUD_REMOTE:-origin}"
BRANCH="${GLOBECLOUD_BRANCH:-main}"
REPO_URL="${GLOBECLOUD_REPO:-https://github.com/Soham11k/GlobeCloud.git}"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "==> Initializing git repository..."
  git init -b "$BRANCH"
fi

if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "==> Adding remote $REMOTE → $REPO_URL"
  git remote add "$REMOTE" "$REPO_URL"
elif [[ "$(git remote get-url "$REMOTE")" != "$REPO_URL" ]]; then
  echo "==> Updating remote $REMOTE → $REPO_URL"
  git remote set-url "$REMOTE" "$REPO_URL"
fi

echo "==> Staging changes..."
git add -A

if git diff --cached --quiet; then
  echo "Nothing to commit."
else
  MSG="${1:-Update GlobeCloud $(date -u +"%Y-%m-%d")}"
  git commit -m "$MSG"
fi

echo "==> Pushing to $REMOTE/$BRANCH..."
git push -u "$REMOTE" "$BRANCH"

echo ""
echo "Published: $REPO_URL"
echo "Branch:    $BRANCH"
