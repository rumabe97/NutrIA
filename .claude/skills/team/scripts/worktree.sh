#!/bin/sh
# An agent's first command: a checkout of its own, on the feature's commit, that can build.
#
# Usage: sh .claude/skills/team/scripts/worktree.sh <agent> <feature-slug> <base-sha> [--no-install]
#
# Why each step exists (every one was learnt by an agent losing an hour to it):
#   - Claude Code makes an agent's worktree from origin/main (`worktree.baseRef: fresh`),
#     NOT from the feature branch, so the first thing is to move onto the commit the lead named.
#   - A teammate in an agent team may not be given a worktree at all. Then one is made here.
#   - A fresh worktree has no node_modules, no dist/ and no .env. `.worktreeinclude` copies the
#     .env files into worktrees Claude Code creates; the ones made here are copied by hand.
#   - apps/api imports the BUILT core and database packages, and the e2e harness imports
#     `database` directly: both are built, not core alone.
#
# It ends by printing WORKTREE=<path>. A script cannot change its caller's directory:
# every later command of yours starts with `cd "<that path>" &&`.

set -eu

agent="${1:?agent name}"
feature="${2:?feature slug}"
base="${3:?base commit the lead named}"
install="${4:-}"

branch="agent/$feature/$agent"
main=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
top=$(git rev-parse --show-toplevel)

git cat-file -e "$base^{commit}" 2>/dev/null || { echo "[team] $base is not a commit in this repository — ask the lead for the right one"; exit 1; }

if [ "$top" = "$main" ]; then
  dir="$main/.claude/worktrees/$agent-$feature"

  if [ -d "$dir" ]; then
    echo "[team] reusing $dir — read 'git status' and 'git log' there before redoing anything"
  else
    git worktree add "$dir" -b "$branch" "$base" >/dev/null
    echo "[team] made a worktree at $dir on $branch"
  fi
else
  dir="$top"

  if [ -n "$(git status --porcelain)" ]; then
    echo "[team] this worktree already has uncommitted work — not moving it. Read 'git status' first."
  elif [ "$(git rev-parse --abbrev-ref HEAD)" != "$branch" ]; then
    git switch -q -C "$branch" "$base"
    echo "[team] moved this worktree onto $branch at $(git rev-parse --short "$base")"
  fi
fi

# The .env files: names come from .worktreeinclude, values never leave the machine or the log.
if [ -f "$main/.worktreeinclude" ]; then
  grep -v '^\s*#' "$main/.worktreeinclude" | grep -v '^\s*$' | while IFS= read -r path; do
    if [ -f "$main/$path" ] && [ ! -f "$dir/$path" ]; then
      mkdir -p "$(dirname "$dir/$path")"
      cp "$main/$path" "$dir/$path"
      echo "[team] copied $path"
    fi
  done
fi

if [ "$install" != "--no-install" ]; then
  cd "$dir"
  echo '[team] installing and building core and database…'
  pnpm install --frozen-lockfile >/dev/null 2>&1 || { echo '[team] pnpm install failed — run it by hand to read why'; exit 1; }
  pnpm --filter core build >/dev/null 2>&1 || { echo '[team] core did not build'; exit 1; }
  pnpm --filter database build >/dev/null 2>&1 || { echo '[team] database did not build'; exit 1; }
fi

echo "WORKTREE=$dir"
echo "BRANCH=$branch"
