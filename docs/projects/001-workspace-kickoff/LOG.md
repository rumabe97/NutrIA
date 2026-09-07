# LOG — Project 001: Workspace kickoff

> **Purpose**: append-only execution record. One entry per phase (plus one per
> deviation): what happened, evidence it works, what changed against the plan.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: the executing
> agent, appending only.

## Phases 1–6 — Kickoff (2026-09-06)

- **Executor**: opus, high effort. Run as a single kickoff session rather than
  phase-by-phase; the phase breakdown in `PLAN.md` is a record of the work's shape, written
  alongside it.
- **Result**: done.
- **Evidence**:
  - `pnpm turbo lint ts:check test` — **17/17 tasks successful**. 24 tests in
    `packages/core`, 35 in `apps/api`, 368 in `packages/ui`.
  - `pnpm turbo build` — 6/6 successful. `apps/web` renders 10 routes.
  - `pnpm --filter database generate` — one migration: 37 tables, 21 enums, 39 indexes,
    48 foreign keys, 41 `ON DELETE CASCADE`, and the partial unique index enforcing one
    active plan per user.
  - API boot smoke test against `dist/main.js`: `/health/liveness` → 200;
    `/profile` with no session → **404** (not 401/403); a database error → a generic 500
    with no driver detail; `/health/readiness` with the database down → 503; `helmet`
    headers and `Cache-Control: no-store` present; no `x-powered-by`.
- **Deviations from plan**: three, all forced by discovery and all recorded as decisions.
  1. NestJS 12 is **ESM-only**. `apps/api` became `"type": "module"` with `nodenext`
     resolution and `.js` extensions on relative imports; `packages/core` and
     `packages/database` gained a CommonJS build step
     ([`0002`](../../decisions/0002-drizzle-on-neon.md)).
  2. The template's `pnpm lint` and `pnpm format` were **broken on arrival** —
     `configurations/eslint` declared its plugins as devDependencies, so no consumer got
     the `eslint` binary. Fixed here and reported in
     [`docs/upstream/0001`](../../upstream/0001-eslint-configuration-devdependencies.md).
  3. CSS Modules resolved to `any` in both Next apps, silently disabling type-aware lint
     rules. Fixed in the same upstream report.
- **Decisions**: [`0001`](../../decisions/0001-nestjs-as-the-backend.md),
  [`0002`](../../decisions/0002-drizzle-on-neon.md),
  [`0003`](../../decisions/0003-better-auth.md),
  [`0004`](../../decisions/0004-deterministic-safety-layer.md), plus seven lines in
  [`decisions/LOG.md`](../../decisions/LOG.md).
- **Not verified, and why**: anything requiring a live database or an AI key. The
  user-isolation e2e suite (`apps/api/test/isolation.e2e-spec.ts`) is written and typechecks
  but has never been executed — it needs `DATABASE_URL`. Email delivery is stubbed to the
  log. Plan generation does not exist; the dashboard says so rather than offering a button.
