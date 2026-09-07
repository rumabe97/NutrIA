# 0001 — Use NestJS as the backend, not Next.js route handlers

- **Status**: accepted
- **Date**: 2026-09-06
- **Project**: docs/projects/001-workspace-kickoff

## Context

The template is Next.js-centric: `apps/web` reaches Postgres through `packages/core`, and
authorisation is delegated to Supabase row-level security. That works for a workspace whose
server logic is thin.

This product's server logic is not thin. It owns a nutrition engine, an AI orchestration
pipeline with structured-output validation, a deterministic allergy gate, long-running plan
generation, and a scheduled check-in cycle. It also has a hard requirement that the browser
never hold a database connection or an AI key.

The reference workspace this project is engineered alongside is a standalone NestJS 11
service with the same shape — feature modules, `shared/` cross-cutting concerns, boot-time
env validation, Swagger, Terminus health, Winston logging. A developer moving between the
two should recognise the architecture immediately.

## Decision

`apps/api` is a dedicated **NestJS 12** application and the only process that opens a
database connection, holds an auth secret, or calls an AI provider. `apps/web` is a browser
client that talks to it over HTTPS and imports from `packages/core` for **types and Zod
schemas only**.

Business rules live in `packages/core` (controllers → repositories → entities, plus a pure
`domain/` layer). Nest controllers are presentation: take `@CurrentUser()`, validate the
body, call one core controller, return.

## Alternatives considered

- **Next.js route handlers and server actions.** Rejected: it puts the AI key and the
  database credential in the same deployable as the UI, and there is no natural home for
  DI-scoped services like the AI client or the mail transport.
- **NestJS 11**, matching the reference workspace exactly. Rejected: 12 is current, and the
  reference's version-specific workarounds (a Prisma `Proxy` bug, a CommonJS runtime guard)
  are precisely the parts not worth inheriting. The cost is that 12 is ESM-only, which
  forced the module-system split recorded in [`0002`](./0002-drizzle-on-neon.md).

## Consequences

- Two dev servers (`:3000` web, `:3001` api) and CORS as a real authentication control —
  `ALLOWED_ORIGINS` is required in production and may not contain localhost.
- `packages/core` must be loadable by Node, not just by a bundler, which is what forces the
  compile step in [`0002`](./0002-drizzle-on-neon.md).
- Authorisation moves entirely into application code. There is no RLS behind the API, so a
  repository query missing its `userId` filter is a data leak — hence the ownership
  invariant in `ARCHITECTURE.md` and the isolation e2e suite.
