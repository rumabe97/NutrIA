#!/bin/sh
# The whole gate, in the order that fails fastest, saying only what matters.
#
# CI runs lint, types, tests, format and dead code. It cannot run the leak check: the
# pattern list is gitignored (docs/local/), so this machine is the only place it runs —
# and the one time it was skipped, a name and an address reached a public repository.
#
# Usage: sh .claude/skills/ship/scripts/gate.sh [log-dir]
# Each step's full output goes to <log-dir>/gate-<step>.log; a failure prints its tail.

dir="${1:-${TMPDIR:-/tmp}/nutria-gate}"
mkdir -p "$dir"

step() {
  name="$1"
  shift
  printf '[gate] %-10s ' "$name"

  if "$@" >"$dir/gate-$name.log" 2>&1; then
    echo 'ok'
  else
    echo 'FAILED'
    echo "------ last lines of $dir/gate-$name.log ------"
    tail -n 40 "$dir/gate-$name.log"
    exit 1
  fi
}

step checks pnpm turbo lint ts:check test
step format pnpm format
step deadcode pnpm -w run deadcode
step leaks pnpm check:leaks

# A warning, not a failure, in check-leaks.sh — but never something to ship past unread.
if grep -q 'stray uncommitted' "$dir/gate-leaks.log"; then
  echo '[gate] note: uncommitted .md files outside docs/local/ —'
  grep '\.md$' "$dir/gate-leaks.log" | sed 's/^/         /'
fi

echo '[gate] green'
