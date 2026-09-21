---
name: production-database
enabled: true
event: bash
action: warn
pattern: DATABASE_URL_PRO
---

**This command names the production database.** The owner's rule: production is **read-only**, always.

- Open it inside `sql.begin('read only', …)` — a write must be impossible, not merely unintended
- Assert the host before the first query, and print neither the host nor the URL
- Never a migration, a seed, an `INSERT`, an `UPDATE` or a `DELETE`. Try it on dev first; production data changes are run by the owner
