# 0029 — The owner is told an account is waiting

- **Status**: accepted
- **Date**: 2026-09-09
- **Project**: none (task, at the owner's decision)

## Context

Access opens account by account (`0017`): a sign-up succeeds, the person lands
on `/pendiente`, and there they stay until the owner sets a column by hand. The
owner had no way to learn that had happened except by running a query, so the
wait was as long as the gap between somebody signing up and the owner thinking
to look.

## Decision

**Every sign-up sends one mail to `OWNER_EMAIL`, naming the account and
carrying the statement that opens it.**

- A Better Auth `user.create.after` hook. The helper swallows its own failures
  and is not allowed to propagate: a sign-up that failed because the owner's
  mailbox was unreachable would punish a user for an operator's problem.
- Unset `OWNER_EMAIL`, or no SMTP, and nothing is sent — the same shape as
  every other mail here.
- **This is the one mail that carries somebody's address**, and it does so
  because activation *is* an email: the runbook's SQL matches on it, so a notice
  without it would send the owner back to the query it replaces. Nothing else
  about the person travels — no name, no answers, no profile — because none of
  it is needed to decide whether to open an account.

## Consequences

- The wait becomes minutes rather than however long until the owner next
  looked.
- One mail per sign-up: a burst of registrations is a burst of mail. Better
  Auth's own limiter now counts sign-ups in the database (`0007`, amended),
  which is what bounds it; if that ever stops being enough, the answer is a
  digest, not silence.
- The address is configuration, not a constant in the repository — a personal
  inbox does not belong in a public git history.
