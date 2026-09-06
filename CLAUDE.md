Strictly follow the rules in [`./AGENTS.md`](./AGENTS.md).

The closest `AGENTS.md` to the file being edited always wins. Sub-docs:

- [`packages/core/AGENTS.md`](./packages/core/AGENTS.md) — business logic (entities, repositories, controllers)
- [`packages/database/AGENTS.md`](./packages/database/AGENTS.md) — Drizzle client, schemas, migrations
- [`packages/auth/AGENTS.md`](./packages/auth/AGENTS.md) — Supabase auth helpers
- [`packages/ui/AGENTS.md`](./packages/ui/AGENTS.md) — component library
- [`apps/web/AGENTS.md`](./apps/web/AGENTS.md) — web app
- [`apps/docs/AGENTS.md`](./apps/docs/AGENTS.md) — docs app
- [`apps/cli/AGENTS.md`](./apps/cli/AGENTS.md) — developer CLI

Workspace documentation (product definition, architecture, projects, decisions) lives in [`docs/`](./docs) — see [`AGENTS.md § Documentation`](./AGENTS.md#documentation) for the read/write map.

---

## CLAUDE.md Usage Rules (for Future Agents)

**CRITICAL:** This file is ONLY a navigation hub. **NEVER add information here.**

### DO:

- Add links to detailed AGENTS.md docs
- Update this file to point to new AGENTS.md sections

### NEVER:

- Add implementation details (put in AGENTS.md)
- Document features (put in AGENTS.md)
