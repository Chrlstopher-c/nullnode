#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Dev local : relay local d'abord (idempotent), puis l'app pointée dessus.
./relay/start.sh

mkdir -p logs
: > logs/dev.log
export VITE_RELAY_URL="ws://127.0.0.1:8791"
bun run dev > logs/dev.log 2>&1 &
echo $! > logs/nullnode.pid

echo "relay  ws://127.0.0.1:8791"
echo "app    http://localhost:5180 — pid $(cat logs/nullnode.pid)"
