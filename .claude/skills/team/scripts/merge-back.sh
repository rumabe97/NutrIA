#!/bin/sh
# The lead's check before an agent's branch comes back into the feature branch.
#
# Usage: sh .claude/skills/team/scripts/merge-back.sh <agent> <feature-slug> [--check]
#   Run from the main checkout, on the feature branch. --check reports and merges nothing.
#
# It refuses when the agent left uncommitted work behind, or when its branch touches a file
# it does not own (.claude/hooks/ownership.json — the same map the edit guard reads). That
# second refusal is the wall the guard only hints at: two agents that stayed in their own
# directories merge without a conflict, and that is what lets them run at the same time.
# A merge, never a rebase: the agents' commits are the record of who did what.

set -eu

agent="${1:?agent name}"
feature="${2:?feature slug}"
mode="${3:-}"
branch="agent/$feature/$agent"
root=$(git rev-parse --show-toplevel)

owns=$(node -e "const m=require('$root/.claude/hooks/ownership.json')['$agent']; process.stdout.write(m ? String(m.owns.length) : 'unknown')")

case "$owns" in
  unknown) echo "[team] $agent is not in .claude/hooks/ownership.json"; exit 1 ;;
  0) echo "[team] $agent reviews and reports: it owns nothing, so nothing of its is ever merged. Its worktree is thrown away."; exit 1 ;;
esac

git rev-parse --verify -q "$branch" >/dev/null || { echo "[team] no branch $branch"; exit 1; }

tree=$(git worktree list --porcelain | awk -v b="refs/heads/$branch" '/^worktree /{w=substr($0,10)} $0=="branch " b{print w}')

if [ -n "$tree" ] && [ -n "$(git -C "$tree" status --porcelain)" ]; then
  echo "[team] $agent has uncommitted work in $tree — message it to commit or explain, do not merge around it:"
  git -C "$tree" status --short | sed 's/^/         /'
  exit 1
fi

base=$(git merge-base HEAD "$branch")
files=$(git diff --name-only "$base" "$branch")

if [ -z "$files" ]; then
  echo "[team] $branch changed nothing"
  exit 0
fi

outside=''
for file in $files; do
  if ! printf '{"tool_input":{"file_path":"%s/%s"}}' "$root" "$file" | node "$root/.claude/hooks/agent-owns.mjs" "$agent" >/dev/null 2>&1; then
    outside="$outside $file"
  fi
done

echo "[team] $branch: $(printf '%s\n' "$files" | wc -l | tr -d ' ') files, $(git rev-list --count "$base..$branch") commits"

if [ -n "$outside" ]; then
  echo "[team] REFUSED — outside what $agent owns:"
  for file in $outside; do echo "         $file"; done
  echo "       Ask $agent why. If the change is right, its owner makes it; if it is yours (docs, root config), you do."
  exit 1
fi

[ "$mode" = "--check" ] && { echo '[team] inside its own directories — safe to merge'; exit 0; }

git merge --no-ff --no-edit "$branch"
echo "[team] merged $branch"
