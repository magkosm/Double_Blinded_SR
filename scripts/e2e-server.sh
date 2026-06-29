#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run build -w app
exec npm run preview -w app -- --host 127.0.0.1 --port 5173
