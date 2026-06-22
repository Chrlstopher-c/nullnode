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

# WebKitGTK + NVIDIA : l'accélération GPU via le renderer DMABUF est inatteignable ici — quel que
# soit le tuning (XWayland, GBM_BACKEND=nvidia-drm, FORCE_COMPOSITING), l'allocation de buffer GBM
# échoue ("Failed to create GBM buffer") → écran blanc/noir. Le seul état stable est DMABUF désactivé
# (copie logicielle). La scène 3D n'est alors pas montée (probe FPS côté app) ; fond CSS statique.
# XWayland (GDK_BACKEND=x11) reste le plus fiable sur NVIDIA pour éviter "Gdk Error 71".
if [[ "${XDG_SESSION_TYPE:-}" == "wayland" ]]; then
  export WEBKIT_DISABLE_DMABUF_RENDERER=1
  GPU_LIST="$(lspci 2>/dev/null || true)"
  [[ "$GPU_LIST" == *NVIDIA* ]] && export GDK_BACKEND=x11
fi

echo "[gpu-env] GDK_BACKEND=${GDK_BACKEND:-unset} DMABUF_DISABLE=${WEBKIT_DISABLE_DMABUF_RENDERER:-unset}"

# setsid : nouveau groupe de process → stop-desktop.sh tue tout l'arbre (vite + cargo + webview).
setsid bun run tauri:dev > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "desktop started (pgid $(cat "$PID_FILE")) — logs: $LOG_FILE"
echo "relay  ${VITE_RELAY_URL:-ws://127.0.0.1:8791 (local, défaut)}"
echo "1re compilation Rust : quelques minutes. La fenêtre s'ouvrira ensuite."
