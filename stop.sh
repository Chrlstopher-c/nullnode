#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ -f logs/nullnode.pid ]]; then
  kill "$(cat logs/nullnode.pid)" 2>/dev/null || true
  rm -f logs/nullnode.pid
  echo "nullnode stopped"
else
  pkill -f "vite" 2>/dev/null || true
  echo "no pid file — sent fallback kill"
fi

./relay/stop.sh
