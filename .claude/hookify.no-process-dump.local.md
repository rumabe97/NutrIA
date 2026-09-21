---
name: no-process-dump
enabled: true
event: bash
action: block
pattern: (^|[;&|(\n])\s*(sudo\s+)?ps\s+(-?[a-z]*aux[a-z]*|-ef\b|-eo\b|[^|;&\n]*\b(args|command|cmd)\b)|/proc/\d+/(cmdline|environ)|(^|[;&|(\n])\s*(sudo\s+)?pgrep\s+-[a-z]*[af]|(^|[;&|(\n])\s*(sudo\s+)?pkill\s+-[a-z]*f
---

**A process's command line can carry a key** — it happened here: a process dump once printed a gateway key into the transcript. And `pgrep -f` / `pkill -f` match this very shell's command line, so they kill or find themselves.

- Who listens on a port: `ss -ltnpH "sport = :3001"`
- What it is, by name only: `ps -o comm= -p <pid>`
- Stop the local servers: `sh .claude/skills/local-probe/scripts/servers.sh stop`
