#!/bin/sh
# The API and a production build of the web app, on this machine, with nothing leaving it.
#
# Usage: sh servers.sh start [--no-build] | stop | status
#   PROBE_DIR   where logs go (default: $TMPDIR/nutria-probe) — pass your scratchpad
#
# What `start` guarantees, because each was once learnt the hard way:
#   - the database is not production (guard.mjs), checked before anything is built;
#   - no mail: every SMTP_* and OWNER_EMAIL is emptied, so sign-up's verification mail and
#     the owner's "an account is waiting" notice go to the log instead of to somebody;
#   - no model call: AI_PROVIDER=stub unless the caller exports another;
#   - AI_REWRITE_STEPS=false, explicitly — an empty value fails environment validation;
#   - the API is up BEFORE the web app is built: the sign-in pages ask it which providers to
#     draw while they prerender, and a build against a dead API has no buttons for 5 minutes;
#   - ports 3000 and 3001 were free, so what answers on them afterwards is this.
#
# Anything else the caller exports reaches the API — placeholder GOOGLE_OAUTH_* values to
# see the buttons, for instance. Never real secrets on a command line.

set -u

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../../../.." && pwd)
dir="${PROBE_DIR:-${TMPDIR:-/tmp}/nutria-probe}"
api='http://localhost:3001/api/v1'
web='http://localhost:3000'

listener() { ss -ltnpH "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | head -n 1 | cut -d= -f2; }

wait_for() {
  tries=0
  while [ "$tries" -lt "$2" ]; do
    [ "$(curl -s -o /dev/null -w '%{http_code}' "$1")" = "200" ] && return 0
    tries=$((tries + 1))
    sleep 1
  done
  return 1
}

stop() {
  for port in 3000 3001; do
    pid=$(listener "$port")
    [ -z "$pid" ] && continue
    # The name only: a full command line can carry a key, and this output is read by others.
    name=$(ps -o comm= -p "$pid")
    case "$name" in
      node* | next* | MainThread) kill "$pid" && echo "[probe] stopped :$port ($name, pid $pid)" ;;
      *) echo "[probe] :$port is held by '$name' (pid $pid), which this did not start — left alone" ;;
    esac
  done
}

status() {
  for port in 3000 3001; do
    pid=$(listener "$port")
    if [ -n "$pid" ]; then echo "[probe] :$port listening (pid $pid)"; else echo "[probe] :$port free"; fi
  done
  echo "[probe] api health: $(curl -s -o /dev/null -w '%{http_code}' "$api/health")"
}

start() {
  mkdir -p "$dir"

  for port in 3000 3001; do
    if [ -n "$(listener "$port")" ]; then
      echo "[probe] :$port is already in use — run '$0 stop', or free it, first"
      exit 1
    fi
  done

  node "$here/guard.mjs" || exit 1

  cd "$root" || exit 1

  if [ "${1:-}" != "--no-build" ]; then
    echo '[probe] building the API…'
    pnpm turbo build --filter=api >"$dir/build-api.log" 2>&1 || { tail -n 30 "$dir/build-api.log"; exit 1; }
  fi

  (
    cd "$root/apps/api" || exit 1
    SMTP_HOST='' SMTP_PORT='' SMTP_USER='' SMTP_PASS='' EMAIL_FROM='' OWNER_EMAIL='' SENTRY_DSN='' \
      AI_REWRITE_STEPS=false AI_PROVIDER="${AI_PROVIDER:-stub}" \
      setsid nohup node dist/main >"$dir/api.log" 2>&1 </dev/null &
  )

  if ! wait_for "$api/health" 60; then
    echo '[probe] the API did not come up:'
    tail -n 30 "$dir/api.log"
    stop
    exit 1
  fi
  echo "[probe] API up on :3001 — mail off, AI_PROVIDER=${AI_PROVIDER:-stub}"

  if [ "${1:-}" != "--no-build" ]; then
    echo '[probe] building the web app against it…'
    NEXT_PUBLIC_API_URL="$api" pnpm --filter web build >"$dir/build-web.log" 2>&1 || { tail -n 30 "$dir/build-web.log"; stop; exit 1; }
  fi

  (
    cd "$root/apps/web" || exit 1
    NEXT_PUBLIC_API_URL="$api" setsid nohup pnpm exec next start -p 3000 >"$dir/web.log" 2>&1 </dev/null &
  )

  if ! wait_for "$web/" 60; then
    echo '[probe] the web app did not come up:'
    tail -n 30 "$dir/web.log"
    stop
    exit 1
  fi
  echo "[probe] web up on :3000 — logs in $dir"
}

case "${1:-}" in
  start) start "${2:-}" ;;
  stop) stop ;;
  status) status ;;
  *) echo "usage: $0 start [--no-build] | stop | status"; exit 2 ;;
esac
