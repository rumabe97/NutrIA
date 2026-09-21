---
name: no-env-contents
enabled: true
event: bash
action: block
pattern: (^|[;&|(\n])\s*(sudo\s+)?(cat|less|more|head|tail|bat|nl|tac|grep|egrep|rg|awk|sed|cut|sort|strings|xxd|od|source)\b[^|;&\n]*?(?<!process)(?<!meta)\.env(?!\.example)(\.\w+)?(?=$|[\s"'|;&)])
---

**A real `.env` is never printed.** Its contents would land in this transcript, and the owner's rule is that no secret is ever shown — not a key, not a connection string.

- Variable **names** only: `node .claude/hooks/env-names.mjs apps/api/.env`
- Whether the database is production: `node .claude/skills/local-probe/scripts/guard.mjs` (compares hosts, prints neither)
- A value a script needs: read it **inside** the script (`readEnv` in `guard.mjs`) and never log it
- The documented shape of every variable: `apps/api/.env.example`
