---
name: production-by-hand
enabled: true
event: bash
action: block
pattern: (^|[;&|(\n])\s*(sudo\s+)?(npx\s+|pnpm\s+(exec|dlx)\s+)?vercel\b[^|;&\n]*(--prod\b|\benv\s+(pull|add|rm|ls)\b|\bpromote\b|\brollback\b|\bredeploy\b)
---

**Production is reached one way: a green pull request merged into `main`.** Vercel builds what lands there; nothing is deployed, promoted or rolled back from a terminal, and production's environment variables are the owner's to read and change.

`vercel env pull` would write every production secret to disk. If production needs a variable, say which and why, and the owner sets it (`docs/reference/deployment.md`).
