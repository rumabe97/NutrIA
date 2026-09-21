---
name: no-git-stash
enabled: true
event: bash
action: block
pattern: (^|[;&|(\n])\s*(sudo\s+)?git\s+(-C\s+\S+\s+)?stash\b(?!\s+(list|show)\b)
---

**No `git stash` in this repository** — the owner's rule. The stash is shared by every worktree, so another agent can pop what you pushed, and a stash nobody remembers is lost work.

Work that is not going out lives on a branch or in a worktree: `git switch -c wip/<what>` and commit it, or `sh .claude/skills/team/scripts/worktree.sh`.
