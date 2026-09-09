# 0017 — Access opens account by account while the provider is free-tier

- **Status**: accepted
- **Date**: 2026-09-09
- **Project**: none (task, at the owner's decision)

## Context

The product runs on a free-tier model provider with a daily request cap that
has already been hit once. Every activated account is a plan a fortnight, a
third of it written fresh, plus swaps. The owner does not want many users yet,
and wants to choose who: *only accounts whose email is verified can use the
app; for now I will verify them directly in the database.*

Sign-up already set `email_verified = false` and sent a verification link the
product cannot deliver (no SMTP is configured; the link is logged). Nothing
read the flag except the profile screen, which showed "Pendiente" and let the
person carry on.

## Decision

**A signed-in account may use the product only once `email_verified` is true;
the owner sets it by hand for now.**

- `VerifiedEmailGuard` is global, right after `SessionGuard`. Public routes are
  not its business; `@AllowUnverified()` marks the small set an unactivated
  account needs — `GET /auth/me`, `GET /users/me`, `DELETE /users/me`. Everything
  else answers 409 `EMAIL_UNVERIFIED`. Not 404: the person is signed in and the
  state is their own, and the screen routes on the code.
- The app layout sends an unactivated account to `/pendiente`, which says what
  is happening in plain words — accounts are opened a few at a time — shows the
  email it will happen to, and offers "check again" and sign-out. Sign-up and
  sign-in are unchanged, so the account exists and is waiting.
- Activation is a row update, documented in the runbook. When a mail provider
  is configured, the same flag is what the verification link flips, and nothing
  here changes.

## Consequences

- The model's daily budget is spent only on people the owner chose.
- An existing account that was never verified is locked out until the owner
  flips it; the owner's own account is one of them and the runbook says how.
- The profile's "Correo verificado: Pendiente" line is now true to its meaning.
