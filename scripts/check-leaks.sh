#!/bin/sh
# Guards committed content against leaks (AGENTS.md § Documentation):
#   1. Absolute local paths (/Users/...) never belong in tracked files.
#   2. Workspace-specific patterns from docs/local/leak-patterns.txt (one extended
#      regex per line, # comments allowed). The list lives in docs/local/ DELIBERATELY:
#      a committed denylist naming employers or private repos would itself be the leak.
#      Consequence: CI and unseeded clones degrade to the built-in checks — a green run
#      is full coverage only on a machine where the pattern file has been seeded.
#   3. Stray docs (warning only): uncommitted, non-gitignored *.md files outside
#      docs/local/ are the forbidden middle state — commit them or move them to
#      docs/local/. A warning, not a failure: freshly authored docs legitimately sit
#      untracked until the owner's next commit.
# docs/upstream/ is excluded from the custom patterns: those files may name their
# destination repo (that is their function); the destination's rules re-check them.
# Scans tracked files only otherwise — docs/local/ and gitignored paths are never scanned.

fail=0

if git grep -nE '/Users/[A-Za-z]' -- ':!pnpm-lock.yaml' ':!scripts/check-leaks.sh'; then
  fail=1
fi

if [ -f docs/local/leak-patterns.txt ]; then
  while IFS= read -r pattern; do
    case "$pattern" in
      '' | \#*) continue ;;
    esac

    if git grep -inE "$pattern" -- ':!pnpm-lock.yaml' ':!scripts/check-leaks.sh' ':!docs/upstream'; then
      fail=1
    fi
  done <docs/local/leak-patterns.txt
else
  echo 'warning: docs/local/leak-patterns.txt not found — running built-in checks only (see AGENTS.md § Documentation).' >&2
fi

stray=$(git ls-files --others --exclude-standard -- '*.md')

if [ -n "$stray" ]; then
  echo "$stray"
  echo 'warning: stray uncommitted .md files — commit them or move them to docs/local/.' >&2
fi

if [ "$fail" -ne 0 ]; then
  echo 'Leaks found in tracked files — see AGENTS.md § Documentation.' >&2
  exit 1
fi
