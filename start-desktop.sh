#!/usr/bin/env bash
# Lance l'app desktop native (Tauri dev) : fenêtre WebView + daemon ghost/tray + hot-reload.
# Vite (:5180) est lancé automatiquement par beforeDevCommand. Relay = Pi par défaut.
# Override dev local : VITE_RELAY_URL=ws://127.0.0.1:8791 ./start-desktop.sh
set -euo pipefail
cd "$(dirname "$0")"

LOG_DIR="logs"
PID_FILE="$LOG_DIR/desktop.pid"
LOG_FILE="$LOG_DIR/desktop.log"

mkdir -p "$LOG_DIR"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "desktop already running (pgid $(cat "$PID_FILE")) — ./stop-desktop.sh d'abord"
  exit 0
fi

: > "$LOG_FILE"

# setsid : nouveau groupe de process → stop-desktop.sh tue tout l'arbre (vite + cargo + webview).
setsid bun run tauri:dev > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "desktop started (pgid $(cat "$PID_FILE")) — logs: $LOG_FILE"
echo "relay  ${VITE_RELAY_URL:-wss://relai.exemple (défaut Pi)}"
echo "1re compilation Rust : quelques minutes. La fenêtre s'ouvrira ensuite."
