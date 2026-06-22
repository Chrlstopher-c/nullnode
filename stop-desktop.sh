#!/usr/bin/env bash
# Arrête l'app desktop : tue tout le groupe de process (vite + cargo + webview + daemon).
set -euo pipefail
cd "$(dirname "$0")"

PID_FILE="logs/desktop.pid"

if [[ -f "$PID_FILE" ]]; then
  PGID="$(cat "$PID_FILE")"
  kill -- "-$PGID" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "desktop stopped (pgid $PGID)"
else
  echo "no pid file — fallback kill"
fi

# Le relay local est levé par beforeDevCommand (en background) → l'arrêter explicitement.
./relay/stop.sh 2>/dev/null || true

# Filet de sécurité : restes éventuels (binaire daemon, vite du beforeDevCommand).
pkill -f "nullnode-daemon" 2>/dev/null || true
pkill -f "tauri dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
echo "cleanup done"
