#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS="$ROOT/.secrets.local"

if [[ ! -f "$SECRETS" ]]; then
  echo "Missing .secrets.local — copy from .secrets.local.example"
  exit 1
fi

read_secret() {
  grep "^$1=" "$SECRETS" | cut -d= -f2- | head -1
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

echo "Publishing to gh-pages branch..."
npx gh-pages -d app/dist -b gh-pages --repo "$(git remote get-url origin)"

echo "Done. Site: https://magkosm.github.io/Double_Blinded_SR/"
echo "GitHub Pages may take 1–2 minutes to update."
