---
name: catastrophic-rm
enabled: true
event: bash
action: block
pattern: (^|[;&|(\n])\s*(sudo\s+)?rm\s+-[a-z]*r[a-z]*\s+(-\S+\s+)*["']?(/|~|\$HOME|\.\.?|\*)["']?(\s|$|/\s|/$)
---

**This would delete a home directory, a filesystem root, or everything where it stands.** Name the exact directory, by a path that cannot expand to something else, and look at it first.
