#!/usr/bin/env bash
set -euo pipefail
PORT="${1:-4173}"
echo "HisabApp demo: http://localhost:${PORT}"
python3 -m http.server "$PORT"
