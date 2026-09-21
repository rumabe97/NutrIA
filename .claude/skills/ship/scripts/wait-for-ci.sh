#!/bin/sh
# Waits for a pull request's required checks, and answers in one line.
#
# Usage: sh .claude/skills/ship/scripts/wait-for-ci.sh <pr-number>
#   exit 0 — every required check passed;  exit 1 — one failed, with how to read why;
#   exit 2 — they never appeared, or never finished.
#
# Waiting is a machine's job. A model that polls spends a turn per look and learns nothing
# between them; this spends none, and is run in the background so the session is told when
# it ends. It exists as a script, rather than `gh pr checks --watch`, for two things that
# happened here the day it was written:
#   - started right after `gh pr create`, `--watch` saw only the host's checks, all green,
#     and returned before Actions had registered its own — a false green one step from a merge;
#   - a connection reset half-way through ended `--watch` with an error that says nothing
#     about the checks.
#
# The required checks are named here because the ruleset on `main` matches them by name
# (.github/workflows/ci.yml says the same from the other side).

pr="${1:?pull request number}"
REQUIRED="${REQUIRED:-lint · types · tests|end-to-end}"
ATTEMPTS="${ATTEMPTS:-120}"
PAUSE="${PAUSE:-20}"

attempt=0
while [ "$attempt" -lt "$ATTEMPTS" ]; do
  attempt=$((attempt + 1))

  # name<TAB>state, one per line. A failed call is a lost connection: look again.
  checks=$(gh pr checks "$pr" --json name,state --jq '.[] | "\(.name)\t\(.state)"' 2>/dev/null) || { sleep "$PAUSE"; continue; }

  missing=0
  pending=0
  failed=''
  old_ifs=$IFS
  IFS='|'
  for name in $REQUIRED; do
    state=$(printf '%s\n' "$checks" | awk -F'\t' -v n="$name" '$1 == n { print $2; exit }')
    case "$state" in
      '') missing=$((missing + 1)) ;;
      SUCCESS) ;;
      FAILURE | ERROR | CANCELLED | TIMED_OUT | ACTION_REQUIRED | STARTUP_FAILURE) failed="$failed $name($state)" ;;
      *) pending=$((pending + 1)) ;;
    esac
  done
  IFS=$old_ifs

  if [ -n "$failed" ]; then
    echo "[ci] #$pr FAILED:$failed — read why with: gh run view --log-failed \$(gh pr checks $pr --json link --jq '.[0].link' | sed 's#.*/runs/\\([0-9]*\\).*#\\1#')"
    exit 1
  fi

  if [ "$missing" -eq 0 ] && [ "$pending" -eq 0 ]; then
    echo "[ci] #$pr green: every required check passed"
    exit 0
  fi

  sleep "$PAUSE"
done

echo "[ci] #$pr gave up after $ATTEMPTS looks: $missing required check(s) never appeared, $pending still running"
exit 2
