# NutrIA

Nutrición que se adapta a ti — personalised nutrition plans built around a person's goals,
preferences and life, and re-planned every fortnight from what actually worked.

The product loop: **sign up → onboarding → a 14-day meal plan → cook and track → shopping
list → progress → biweekly check-in → an improved next plan → repeat.**

## Stack

| Layer | What |
| --- | --- |
| Web | Next.js 16, React 19, CSS Modules over a shared token system |
| API | NestJS 12 (ESM), Better Auth, Swagger, Terminus, pino |
| Domain | `packages/core` — Zod entities, pure domain logic, Drizzle repositories |
| Database | Neon PostgreSQL via Drizzle ORM |
| Tooling | pnpm 11, Turborepo, TypeScript 6, Vitest + Jest, ESLint 9, Prettier |

`apps/api` is the only process that opens a database connection, holds an auth secret, or
calls an AI provider. The browser never touches any of them.

## Layout

```
apps/web    — web client (:3000)
apps/api    — backend (:3001)
apps/docs   — design-system docs + the docs/ viewer at /workspace (:3002)
apps/cli    — developer CLI
packages/core, packages/database, packages/ui
configurations/eslint, typescript, prettier
```

## Getting started

```bash
pnpm install
pnpm hooks:install   # refuses a push the gate has not agreed to
```

Then fill in the environment. Copy each `.env.example` next to it as `.env`:

```bash
cp apps/api/.env.example      apps/api/.env
cp apps/web/.env.example      apps/web/.env
cp packages/database/.env.example packages/database/.env
```

You need:

1. **A Neon project.** From *Connection Details*, take the **pooled** string (host contains
   `-pooler`) as `DATABASE_URL`, and the **direct** one as `DIRECT_DATABASE_URL`. Both go in
   `apps/api/.env`; `DIRECT_DATABASE_URL` also goes in `packages/database/.env`.
2. **An auth secret**: `openssl rand -base64 48` → `BETTER_AUTH_SECRET`.
3. Optionally `ANTHROPIC_API_KEY` (nothing uses it yet) and SMTP credentials. Without SMTP,
   verification and password-reset links are written to the API log so local development
   still works end to end.

Then create the schema and load reference data:

```bash
pnpm --filter database migrate
pnpm --filter database seed     # allergen catalogue + ingredients — NOT optional:
                                # the allergy layer has nothing to enforce without it
pnpm dev
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | All apps in watch mode, plus the package build watchers |
| `pnpm build` | Build everything |
| `pnpm lint` / `pnpm lint:fix` | Lint |
| `pnpm ts:check` | Type-check |
| `pnpm test` / `pnpm test:coverage` | Tests |
| `pnpm check:leaks` | Scan tracked files for absolute paths and private patterns |
| `pnpm hooks:install` | Point git at `.githooks`, so a push runs the gate first |
| `pnpm --filter database generate` | Generate a migration from the schemas |
| `pnpm --filter api test:e2e` | End-to-end suite — needs a real database |

> After editing `packages/core` or `packages/database`, run `pnpm --filter core build`.
> They compile to CommonJS for `apps/api`; `pnpm dev` watches them for you.

## Documentation

- [`AGENTS.md`](./AGENTS.md) — how to work in this repo. Start here.
- [`docs/PRODUCT.md`](./docs/PRODUCT.md) — what it is and who it is for.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — the design and its invariants.
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — what is built and what comes next.
- [`docs/decisions/`](./docs/decisions) — why the structural choices were made.

With `pnpm dev` running, `docs/**` renders at http://localhost:3002/workspace.

## Status

The foundation and one vertical slice are complete: authentication, the ten-step
onboarding, the profile, computed daily targets, the allergy validator, the full schema.
**Plan generation and everything downstream of it are not built yet** — the dashboard says
so rather than offering a button that does nothing. See
[`docs/ROADMAP.md`](./docs/ROADMAP.md).

## Safety

NutrIA produces general meal plans. It does not diagnose, prescribe, or replace a doctor or
a registered dietitian. Allergies, intolerances and the minimum daily calorie floor are
enforced by deterministic code before anything reaches a user — never by asking a language
model to comply.
