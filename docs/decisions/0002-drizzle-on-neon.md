# 0002 — Keep Drizzle, move to Neon, remove Supabase and its RLS layer

- **Status**: accepted
- **Date**: 2026-09-06
- **Project**: docs/projects/001-workspace-kickoff

## Context

The template's `packages/database` exposed two Drizzle clients — `admin` (bypasses RLS) and
`rls` (sets the JWT context so Postgres policies fire) — plus `drizzle-orm/supabase`
helpers on every schema. That design exists because the caller was browser-adjacent.

Once [`0001`](./0001-nestjs-as-the-backend.md) makes NestJS the only database client, that
premise is gone: there is no untrusted caller for a policy to constrain, and the JWT the
`rls` client needs would have to be synthesised by the server for itself.

Separately, the reference workspace uses Prisma 7, which would mean rewriting the package
from scratch.

## Decision

Keep **Drizzle** and point it at **Neon**. `packages/database` exposes one lazily-created
client over the pooled endpoint (`prepare: false`, because Neon's pooler is PgBouncer in
transaction mode); `DIRECT_DATABASE_URL` is used by `drizzle-kit` for DDL only. The
`admin`/`rls` split, `jwt.ts`, `drizzle.ts` and every `pgPolicy` are deleted. Authorisation
is a `WHERE userId = …` in `packages/core/repositories`.

`packages/core` and `packages/database` compile to **CommonJS** `dist/`, with `exports`
resolving `types` to source and `default` to `dist`.

## Alternatives considered

- **Prisma 7**, for parity with the reference workspace. Rejected: it discards a working
  package and the template's Drizzle conventions to gain familiarity in one file. The
  architectural philosophy — schema-first, generated migrations, transactions — is
  identical either way.
- **Keep RLS as defence in depth**, setting a session GUC from the API. Rejected as
  unearned complexity: it would mean maintaining a second, parallel authorisation model
  whose failure mode is silent. Ownership is tested directly instead
  (`apps/api/test/isolation.e2e-spec.ts`).
- **Publish the packages as ESM.** Rejected: valid Node ESM requires explicit `.js`
  extensions on every relative import, which the template's sources do not use. CommonJS
  output keeps them unchanged and is what `apps/api` interops with anyway.

## Consequences

- `packages/core` and `packages/database` now have a build step. `turbo build` orders it,
  `turbo dev` watches it, and `pnpm --filter core build` is required after editing them
  before `apps/api` sees the change at runtime.
- `packages/core`'s vitest config aliases `core/*` back to source, so tests never assert
  against a stale `dist`.
- Losing RLS means the ownership invariant is entirely on application code. The isolation
  e2e suite exists specifically to hold that line.
