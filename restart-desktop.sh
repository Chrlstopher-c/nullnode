#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./stop-desktop.sh || true
sleep 1
./start-desktop.sh
