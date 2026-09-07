# Plan — Project 001: Workspace kickoff

> **Purpose**: the phased technical execution plan — the engineering half of the
> contract. `/execute-project` follows this literally; executors implement phases, they
> do not redesign them. If implementation must diverge, the plan is amended in the same
> change and the deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes.

- **Status**: done
- **Type**: chore — this project has no PRD because it delivers no user-facing feature of
  its own. It converts the `trc-template` clone into this workspace: rename, prune the
  Supabase layer, stand up the NestJS backend, design the schema, rebrand the tokens, and
  build one real vertical slice (sign-up → onboarding → profile) to prove the stack. The
  product itself starts at project 002.
- **Routing profile**: `tiered`

## Design summary

Four architectural decisions were taken before any code moved, and each has a record:
[`0001`](../../decisions/0001-nestjs-as-the-backend.md) NestJS as the backend,
[`0002`](../../decisions/0002-drizzle-on-neon.md) Drizzle on Neon with Supabase removed,
[`0003`](../../decisions/0003-better-auth.md) Better Auth,
[`0004`](../../decisions/0004-deterministic-safety-layer.md) the deterministic safety layer.

The shape they produce is in [`ARCHITECTURE.md`](../../ARCHITECTURE.md). The
one-sentence version: `apps/web` is a browser client, `apps/api` is the only process with
secrets, `packages/core` holds framework-free domain logic, and the parts of this product
that can hurt someone are decided by code rather than by a model.

Scope boundary: this project ends at a complete, editable, validated profile with computed
daily targets. It deliberately does **not** ship a plan-generation button that calls
nothing — the dashboard states plainly that no plan exists yet.

## Phases

### Phase 1 — Prune, rename, rewire the data layer

- [x] done
- Remove `packages/auth` and the Supabase RLS wiring; rewrite `packages/database` around a
  single Neon client; rename every `trc-template` / `mini-template` reference; bump pnpm to
  11 and allowlist dependency build scripts.

### Phase 2 — Schema and reference data

- [x] done
- 37 tables across ten schema files, one generated migration, and the seed: the EU-14
  allergen catalogue plus a Spanish/Mediterranean ingredient set with real per-100 g macros.

### Phase 3 — Domain layer

- [x] done
- `packages/core`: entities (Zod), repositories (Drizzle, ownership-scoped), controllers,
  and `domain/` — Mifflin-St Jeor targets with a hard calorie floor, and the allergy
  validator. Compiled to CommonJS so Node can load it.

### Phase 4 — NestJS API

- [x] done
- `apps/api`: boot-time env validation, global deny-by-default `SessionGuard`, `AdminGuard`,
  `AllExceptionsFilter`, `NoStoreCacheInterceptor`, `ZodValidationPipe`, Terminus health,
  Swagger (dev only), pino with redaction, helmet/hpp/compression/CORS/throttling, and the
  auth, users, profile, onboarding and safety modules.

### Phase 5 — Design system and web app

- [x] done
- NutrIA token layer over `packages/ui`; landing page; the five auth screens; the ten-step
  onboarding with per-step persistence; the profile; the honest dashboard empty state.

### Phase 6 — Verification

- [x] done
- Unit and integration suites green, full build green, API boot smoke-tested. The
  user-isolation e2e suite is written but needs a live database — see `apps/api/test/README.md`.

## Owner-gated follow-up

Nothing in this project can run against a real database until the owner provides Neon
credentials. See [`ROADMAP.md`](../../ROADMAP.md) § Now.
