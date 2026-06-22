#!/usr/bin/env bash
# Lance l'app desktop native (Tauri dev) : fenêtre WebView + daemon ghost/tray + hot-reload.
# beforeDevCommand (dev:tauri) lève le relay LOCAL + Vite (:5180) → marche out-of-the-box,
# sans dépendre d'un node externe. Le Pi reste joignable en 1 clic via les presets/settings.
# Override explicite : VITE_RELAY_URL=wss://... ./start-desktop.sh
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

# WebKitGTK + Wayland : galère connue (NVIDIA surtout).
#  - "Gdk Error 71 (Protocol error)" → désactiver le renderer DMABUF.
#  - "Failed to create GBM buffer / page blanche" → le path GPU Wayland natif échoue sur NVIDIA ;
#    XWayland (GLX) est fiable ET garde l'accélération GPU (≠ désactiver le compositing, qui
#    tuerait le WebGL). On force x11 uniquement si GPU NVIDIA détecté ; autres GPU = Wayland natif.
if [[ "${XDG_SESSION_TYPE:-}" == "wayland" ]]; then
  export WEBKIT_DISABLE_DMABUF_RENDERER=1
  if lspci 2>/dev/null | grep -qi 'nvidia'; then
    export GDK_BACKEND=x11
  fi
fi

# setsid : nouveau groupe de process → stop-desktop.sh tue tout l'arbre (vite + cargo + webview).
setsid bun run tauri:dev > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "desktop started (pgid $(cat "$PID_FILE")) — logs: $LOG_FILE"
echo "relay  ${VITE_RELAY_URL:-ws://127.0.0.1:8791 (local, défaut)}"
echo "1re compilation Rust : quelques minutes. La fenêtre s'ouvrira ensuite."
