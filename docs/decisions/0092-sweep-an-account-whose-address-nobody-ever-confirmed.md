# 0092 — Sweep an account whose address nobody ever confirmed, after thirty days

- **Status**: accepted
- **Date**: 2026-10-09
- **Project**: [docs/projects/011-accounts-are-harder-to-take](../projects/011-accounts-are-harder-to-take/) (follow-up, `legal` P2-15)

## Context

Phase 8 (`0074` amended) lets anybody sign a password up against any address — sign-up
answers identically whether or not an account already exists there, which is the point.
Nothing before this deleted the ones nobody ever confirmed: an address somebody typed by
mistake, or a stranger's attempt at an account-squatting attack that the real owner never
followed up on, sits in `user` forever, unconfirmed, holding a credential nobody but the
signer-upper knows.

## Decision

- **"No data" is four explicit checks, not a scan of every user-owned table.** An account
  is a candidate only while it is unconfirmed (`emailVerified = false`), older than thirty
  days (`UNCONFIRMED_ACCOUNT_RETENTION_DAYS`, `core/entities/Audit`), and has none of: a
  session, a `profiles` row, a `meal_plans` row, or an `audit_logs` row naming it as actor
  or subject. Every one of those four is reachable only from a session
  (`VerifiedEmailGuard` gates every route that would write one), and an unconfirmed
  account has never held a session — `requireEmailVerification` (phase 8) blocks
  `/sign-in/email` while unconfirmed, Google and Apple cannot link into it
  (`disableImplicitLinking`), and the confirmation link itself mints no session
  (`autoSignInAfterVerification: false`, hotfix #218). The four checks are
  belt-and-braces on that invariant, not the only thing standing in the way; widening them
  to every user-owned table would guard a path that does not exist.
- **One `DELETE … WHERE … RETURNING`.** `UserRepository.deleteStaleUnconfirmed` builds the
  four conditions as correlated `NOT EXISTS` sub-selects against the outer `user` row
  (`staleUnconfirmedWhere`, the same shape as the account screen's `professional` and
  `onboarded` filters), inside one statement — so the check and the removal are the same
  moment; nothing can create a session or a profile for a row in the gap between a read and
  a write, because there is no such gap.
- **Audited like any other admin mutation, inside the same transaction — one row per
  deleted account.** A new action, `auth.unconfirmed_account_swept`, with no actor (the
  cron, not a person) and empty metadata. `audit_logs.actorId`/`subjectUserId` are
  `onDelete: 'set null'`, not `cascade` — the row is written with `subjectUserId` naming
  the account, in the same transaction that deletes it, and survives with that column set
  to `null` the instant the delete runs. No address and no IP ever reach it, so the row
  that is left says only that a sweep happened.
- **Carried by the existing `/api/v1/cron/sweep-verifications`, not a new cron.**
  `AuthRetentionService.forget` gains a third step — `UserController.sweepUnconfirmedAccounts`
  — beside the sign-in brake's quiet rows and the twelve-month audit purge; its count joins
  theirs in `AuthRetentionRun` / `VerificationSweepDto`. No new route, no new `vercel.json`
  entry, no migration.

## Alternatives considered

- **Checking every user-owned table** (vacations, goals, dietary patterns, favourites, …)
  — rejected: every one of them needs a session to write, which an unconfirmed account
  never has; the four explicit checks are the invariant's witnesses, not an exhaustive
  defence against a path that does not exist, and a join per table the sweep does not need.
- **A separate daily cron route** — rejected: `/cron/sweep-verifications` already runs
  daily, five minutes after the reminders, and already owns Better Auth's and the brake's
  cleanup; a second cron for one more kind of stale row is a second thing to miss if it
  ever fails silently.
- **No audit row, relying on the run's own count** (as the sign-in brake's and the
  audit purge's own deletions do, which write no per-row audit entry) — rejected: those
  delete rows with no FK to a person; this deletes an account, and the admin screen's
  audit trail is where "an account was removed, and why" belongs, the same as every other
  admin mutation. `onDelete: 'set null'` is what makes a per-account row survivable at all.

## Consequences

- An address typed by mistake, or left by an abandoned account-squatting attempt, stops
  existing in `user` after thirty days with nothing else to show for it — closing the tail
  end of the attack phase 8 and the "reset does not clear a second factor" follow-up both
  narrow but do not fully foreclose: a squatter's account that nobody ever confirms, and
  that the real owner never even notices, no longer lives forever.
- `/privacidad` needs a line: an account whose address is never confirmed is deleted after
  thirty days, together with its sign-up record, provided it holds no profile, plan or
  session and generated no account activity beyond the sign-up itself (`legal`, routed by
  the lead).
- A real person who signs up and simply never confirms for over a month loses the account
  silently — no warning mail is sent before the sweep (out of scope here; a reminder before
  deletion is a future follow-up if this surprises anybody in practice).
