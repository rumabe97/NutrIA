# 0003 — Use Better Auth for identity

- **Status**: accepted
- **Date**: 2026-09-06
- **Project**: docs/projects/001-workspace-kickoff

## Context

Removing Supabase ([`0002`](./0002-drizzle-on-neon.md)) removed the template's auth
provider with it. The product needs registration, sign-in, sign-out, email verification,
password recovery, session management and account deletion. The reference workspace
hand-rolls all of it on `passport-jwt` with its own token, 2FA and secret-rotation
machinery.

## Decision

**Better Auth**, running inside `apps/api`, against the same Neon database. Its handler is
mounted under `/{API_PREFIX}/auth/*`; `SessionGuard` validates every request through
`auth.api.getSession`. Better Auth owns the `user`, `session`, `account` and `verification`
tables — their column names are its contract, not ours. We add exactly one column, `role`.

`deleteUser` is enabled, because the `ON DELETE CASCADE` from `user.id` is what actually
removes a person's health data.

## Alternatives considered

- **Hand-rolled JWT**, matching the reference workspace. Rejected: password hashing, token
  expiry and session rotation are where a subtle mistake stays invisible until it is
  exploited. Parity is not worth owning that surface.
- **Neon Auth.** Rejected: at decision time it is a thinner offering, and its lifecycle is
  coupled to the database vendor — an awkward dependency for the one component that must
  keep working while the database is being migrated.
- **Keep Supabase Auth alongside Neon.** Rejected: two vendors, and NestJS would have to
  verify a third party's JWT on every request for no benefit.

## Consequences

- Sessions are httpOnly cookies; no token is ever readable from JavaScript.
- `main.ts` must mount `express.json()` **after** the auth path. Better Auth needs the raw
  request stream, and a consumed one arrives empty — a failure that presents as bad
  credentials.
- `apps/web/src/proxy.ts` only checks for a cookie's *presence* to redirect signed-out
  visitors. It is not an authorisation check and must never be mistaken for one.
- Email delivery is not yet wired: without `SMTP_HOST`, verification and reset links are
  written to the log so local development works end to end. Wiring SMTP is a notifications
  milestone.
