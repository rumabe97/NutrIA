---
name: look-before-deleting
enabled: true
event: bash
action: warn
pattern: (^|[;&|(\n])\s*(sudo\s+)?git\s+(-C\s+\S+\s+)?(reset\s+--hard|clean\s+-[a-z]*f|checkout\s+--\s|restore\s|worktree\s+remove|branch\s+(?-i:-D))\b|(^|[;&|(\n])\s*(sudo\s+)?rm\s+-[a-z]*r
---

**Look at the target before deleting or overwriting it.** `git status --short` (and `git log` for a branch) on exactly what this command touches — uncommitted files there are somebody's work.

A worktree or a branch you did not create in this session is the owner's to decide on: report it, do not remove it.
