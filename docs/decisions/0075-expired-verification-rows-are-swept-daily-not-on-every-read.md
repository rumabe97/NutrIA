# 0075 — Expired verification rows are swept daily, not on every read

- **Status**: accepted
- **Date**: 2026-10-01
- **Project**: [docs/projects/011-accounts-are-harder-to-take](../projects/011-accounts-are-harder-to-take/), phase 1
- Extends [`0074`](./0074-accounts-are-guarded-by-a-server-password-rule-and-an-optional-second-factor.md)
  (the reset must not tell by its timing whether an address has an account).

## Context

Phase 1 sent the reset mail after the response (`advanced.backgroundTasks`). That removed
the SMTP wait, which was the large leak (0.3–2 s). A local measure still showed the reset
for a missing address about 220 ms slower than for an existing one (medians 1594 ms and
1374 ms, 20 runs each), against a bar of 100 ms.

The cause is in Better Auth 1.7.6. For a missing address, `/request-password-reset`
simulates its work with `findVerificationValue('dummy-verification-token')`. That
function also runs an awaited `deleteMany` of every expired verification row
(`db/internal-adapter.mjs:753`). So the missing-address branch makes two database round
trips where the existing one makes one insert. From the owner's machine to Neon a round
trip costs ~138 ms. In `fra1` it costs a few ms, but that was never measured.

## Decision

- Better Auth's cleanup on read is turned off: `verification: { disableCleanup: true }`.
  Both branches then make the same number of round trips.
- Expired verification rows are deleted by a daily cron,
  `/api/v1/cron/sweep-verifications` at 08:05 UTC. It runs five minutes after the reminders
  cron, so Neon is usually already awake. It is guarded by `CRON_SECRET` like the other
  crons, spends nothing from the AI provider, and deletes only rows whose `expires_at` is
  in the past.
- No validity rule changes. Every caller of `findVerificationValue` checks `expiresAt`
  itself: the reset link, the OAuth state, two-factor, email OTP, phone number and our
  password hook. This was read in the installed source on 2026-10-01. An expired row
  that waits for the sweep is refused exactly as before.

## Consequences

- An expired row (an unused reset token, an abandoned OAuth state) stays in the table for
  up to a day instead of until the next lookup. These rows are already invalid, and the
  table stays small.
- One more scheduled function call a day. No new environment variable and no spend.
- If a Better Auth upgrade adds a caller that trusts the cleanup instead of checking
  `expiresAt`, this decision must be revisited. The upgrade checklist should look for it.

## Who decided

The owner, on 2026-10-01 ("corrige lo del tiempo ese"), after the lead set out the three
options: accept the gap, re-measure on a preview, or this. The cause was traced by
`backend` and confirmed by `invariant-reviewer`.
