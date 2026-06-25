#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS="$ROOT/.secrets.local"

if [[ ! -f "$SECRETS" ]]; then
  echo "Missing .secrets.local — copy from .secrets.local.example"
  exit 1
fi

# shellcheck disable=SC1090
source <(grep -E '^(VITE_API_URL|WORKER_URL)=' "$SECRETS" | sed 's/^/export /')

API_URL="${VITE_API_URL:-${WORKER_URL:-}}"
if [[ -z "$API_URL" ]]; then
  echo "Set VITE_API_URL or WORKER_URL in .secrets.local"
  exit 1
fi

echo "Building with VITE_API_URL=$API_URL"
cd "$ROOT"
npm run build -w app
cp app/dist/index.html app/dist/404.html

echo "Publishing to gh-pages branch..."
npx gh-pages -d app/dist -b gh-pages --repo "$(git remote get-url origin)"

echo "Done. Site: https://magkosm.github.io/Double_Blinded_SR/"
echo "GitHub Pages may take 1–2 minutes to update."
