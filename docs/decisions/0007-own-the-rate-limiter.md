# 0007 — Own the rate limiter rather than run an unsupported dependency

- **Status**: accepted
- **Date**: 2026-09-07
- **Project**: docs/projects/002-plan-generation

## Context

`@nestjs/throttler` provided rate limiting from the workspace's first phase. Its latest
release, 6.5.0, declares a peer range of `@nestjs/common` `^7 || ^8 || ^9 || ^10 || ^11`.
This API runs NestJS **12** ([`0001`](./0001-nestjs-as-the-backend.md)), which is outside
that range — the package has no release supporting it.

It appeared to work: `pnpm install` warned about the peer conflict and the application
booted, because Node's interop tolerates the CommonJS package importing an ESM one. The
breakage surfaced only when a Jest suite imported a controller using `@Throttle`, which
fails with a `require(esm)` cycle error.

The runtime tolerance is the dangerous part. Rate limiting is a security control, and it
was silently running on a library that does not claim to support this framework version —
so its behaviour under Nest 12 was untested and unwarranted rather than merely unverified.

## Decision

Remove `@nestjs/throttler`. A `RateLimitGuard` in `apps/api/src/shared/guards/` implements
a fixed-window counter keyed on the authenticated user, falling back to the request IP for
unauthenticated routes. `@RateLimit({ limit, ttlSeconds })` overrides the default per
route; `@SkipRateLimit()` exempts health checks.

This is deliberately narrow. [`0003`](./0003-better-auth.md) argued *against* hand-rolling
authentication, because password hashing and session rotation hide subtle failures. A
fixed-window counter is not that: it is a map, a timestamp and a comparison, it is fully
testable, and its failure mode is visible rather than silent.

## Alternatives considered

- **Keep `@nestjs/throttler` and avoid importing it in tested files.** Rejected: it
  constrains where a decorator may be used based on a dependency defect, and leaves a
  security control running outside its supported range.
- **Downgrade to NestJS 11.** Rejected: it discards
  [`0001`](./0001-nestjs-as-the-backend.md)'s reasoning and the whole ESM migration to
  accommodate one package.
- **Wait for a compatible release.** Rejected as a decision, though it remains the exit:
  when throttler supports Nest 12, replacing the guard is a contained change because
  nothing outside it knows how limiting is implemented.

## Consequences

- **Counters are per-instance and in memory.** With several instances the effective limit
  multiplies by instance count. Acceptable while the job runner is in-process too
  ([`0006`](./0006-reuse-before-generating.md)); both want a shared store at the same
  moment, and that is one change, not two.
- Counters are lost on restart, which briefly resets limits. For abuse prevention on this
  API that is a fair trade against a Redis dependency.
- The guard is keyed on user id where a session exists, so one aggressive network does not
  throttle everyone behind it.
- Being ours, the limiter is unit-tested — which the throttler integration never was.
