---
name: no-skipping-checks
enabled: true
event: bash
action: block
pattern: (^|[;&|(\n])\s*(sudo\s+)?git\s[^;&|\n]*--no-verify\b|(^|[;&|(\n])\s*(sudo\s+)?git\s+push\b[^|;&\n]*\s(--force(?!-with-lease)|-f)(\s|$)|(^|[;&|(\n])\s*(sudo\s+)?gh\s+pr\s+merge\b[^|;&\n]*--admin\b|(^|[;&|(\n])\s*(sudo\s+)?HUSKY=0\b
---

**A check is fixed, not skipped.** `--no-verify` walks past the pre-push gate, a force push rewrites what others have, and `--admin` merges over a red run — each is how a broken commit reaches production.

Read why it failed (`gh run view <id> --log-failed`, or the gate's log), fix it on the branch, and push again. If the check itself is wrong, that is the owner's decision: stop and say so.
