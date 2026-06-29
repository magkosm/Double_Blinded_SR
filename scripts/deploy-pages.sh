#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS="$ROOT/.secrets.local"

if [[ ! -f "$SECRETS" ]]; then
  echo "Missing .secrets.local — copy from .secrets.local.example"
  exit 1
fi

read_secret() {
  grep "^$1=" "$SECRETS" 2>/dev/null | cut -d= -f2- | head -1 || true
}

API_URL="$(read_secret VITE_API_URL)"
if [[ -z "$API_URL" ]]; then
  API_URL="$(read_secret WORKER_URL)"
fi

if [[ -z "$API_URL" ]]; then
  echo "Set VITE_API_URL or WORKER_URL in .secrets.local"
  exit 1
fi

echo "Building with VITE_API_URL=$API_URL"
cd "$ROOT"
VITE_API_URL="$API_URL" npm run build -w app
cp app/dist/index.html app/dist/404.html

# gh-pages creates a commit; git needs an author even when global user.* is unset.
GIT_AUTHOR_NAME="$(read_secret GIT_AUTHOR_NAME)"
GIT_AUTHOR_EMAIL="$(read_secret GIT_AUTHOR_EMAIL)"

if [[ -z "$GIT_AUTHOR_NAME" ]]; then
  GIT_AUTHOR_NAME="$(git log -1 --format='%an' 2>/dev/null || true)"
fi
if [[ -z "$GIT_AUTHOR_EMAIL" ]]; then
  GIT_AUTHOR_EMAIL="$(git log -1 --format='%ae' 2>/dev/null || true)"
fi
if [[ -z "$GIT_AUTHOR_NAME" ]]; then
  GIT_AUTHOR_NAME="GitHub Pages Deploy"
fi
if [[ -z "$GIT_AUTHOR_EMAIL" || "$GIT_AUTHOR_EMAIL" == *@*.local ]]; then
  GH_USER="$(read_secret GITHUB_USER)"
  if [[ -n "$GH_USER" ]]; then
    GIT_AUTHOR_EMAIL="${GH_USER}@users.noreply.github.com"
  else
    GIT_AUTHOR_EMAIL="deploy@users.noreply.github.com"
  fi
fi

export GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL
export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME"
export GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"

echo "Publishing to gh-pages branch as $GIT_AUTHOR_NAME <$GIT_AUTHOR_EMAIL>..."
npx gh-pages -d app/dist -b gh-pages \
  --repo "$(git remote get-url origin)" \
  --user "$GIT_AUTHOR_NAME <$GIT_AUTHOR_EMAIL>"

echo "Done. Site: https://magkosm.github.io/Double_Blinded_SR/"
echo "GitHub Pages may take 1–2 minutes to update."
