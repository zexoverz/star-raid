#!/usr/bin/env bash
# Build the app and (re)start the production server locally on $PORT (default 8092).
# The server caches index.html in memory, so a stale process would keep serving the old build.
set -euo pipefail
PORT=${PORT:-8092}
cd "$(dirname "$0")/../app"
pid=$(ss -ltnp 2>/dev/null | awk -v p=":$PORT" '$4 ~ p"$" {print}' | grep -oP 'pid=\K[0-9]+' | head -1 || true)
[ -n "${pid:-}" ] && kill "$pid" && sleep 0.5
npx vite build >/dev/null
PORT=$PORT nohup node server/index.mjs >"${TMPDIR:-/tmp}/starraid-web-$PORT.log" 2>&1 &
for _ in $(seq 1 20); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.25; done
served=$(curl -s "http://127.0.0.1:$PORT/" | grep -o 'assets/index-[^"]*\.js' | head -1)
built=$(grep -o 'assets/index-[^"]*\.js' dist/index.html | head -1)
[ "$served" = "$built" ] && echo "serving $built on :$PORT" || { echo "stale: served $served, built $built"; exit 1; }
