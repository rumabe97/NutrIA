# 0019 — The reset link travels by mail; the verification link still does not

- **Status**: accepted
- **Date**: 2026-09-09
- **Project**: none (task, at the owner's decision)

## Context

Since the kickoff, every link Better Auth issued was written to the log: no
mail provider was configured. That is fine for verification, which `0017`
turned into a switch the owner throws by hand. It is not fine for password
reset: the form says *"if that account exists, we have sent you a link"*, and
in production nobody received one. A person who forgot their password was
locked out with a screen that said the opposite.

The owner has no domain yet. The candidates for a sender were a Gmail account
and a Proton account; Proton offers SMTP only on paid plans, Gmail on any
account with two-step verification, through an *app password*.

## Decision

**Password-reset mail is real, over SMTP; verification mail is deliberately
not sent.**

- One `EmailService`, SMTP through nodemailer, configured by four variables
  (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`; `SMTP_PORT` defaults
  to 587, 465 means implicit TLS). SMTP rather than a provider SDK because
  every provider worth using speaks it: Gmail today, a transactional service
  on the product's own domain when there is one, with no code change.
- The environment contract refuses a partial configuration. A host without
  credentials or a sender would boot, accept every reset request and deliver
  none — the exact failure this replaces.
- The reset hook never throws. Better Auth calls it only for accounts that
  exist, so an error escaping it would make the response differ between
  registered and unregistered addresses. A refused mail is logged for the
  owner, never shown to the requester. Addresses never reach the log.
- The mail is in the request's language (the tag the web app sends, Spanish by
  default), says the link lasts an hour, and tells a person who did not ask
  that nothing has changed.
- Verification stays unsent even with mail configured, and `sendOnSignUp` is
  off: `email_verified` is the owner's switch (`0017`), and a link the person
  can click themselves would hand them the switch. When access opens to
  everyone, the hook is the one place to write.

## Consequences

- Password recovery works in production once the four variables are set; the
  runbook says how with Gmail and how to move to a provider on a domain.
- Gmail's sending limits (a few hundred messages a day) are far above what a
  hand-activated user base can request; the day they matter is the day there
  is a domain.
- Local development is unchanged: with no `SMTP_HOST`, the link is logged.
