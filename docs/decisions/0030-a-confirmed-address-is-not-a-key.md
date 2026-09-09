# 0030 — A confirmed address is not a key

- **Status**: accepted
- **Date**: 2026-09-09
- **Project**: none (task, at the owner's decision)

## Context

`0017` gave one column two jobs. `email_verified` meant "the owner opened this
account", which is why the verification mail could not be sent: a link the
person could click themselves would have handed them the key. So nobody ever
confirmed an address, and the owner activated accounts from a database client,
having first learned of them by running a query (`0029` fixed the learning).

Two facts were wearing one column. *The address is real* is something only the
person holding it can prove. *This account may use the product* is the owner's
decision. Neither is evidence of the other.

## Decision

**`activated_at` is the door; `email_verified` is the address.**

- A new nullable column on `user`, written only by the owner's act. The guard
  asks about it and no longer about `emailVerified`. Existing accounts are
  backfilled from `email_verified`, because until now that *was* the door — so
  nobody in loses access on the deploy.
- The error becomes `AccountNotActivatedError` / `ACCOUNT_NOT_ACTIVATED`. The
  old name would have kept saying "email unverified" for a state that has
  nothing to do with an email, which is how a codebase teaches its next reader
  something false.
- **The verification mail is sent.** It says what clicking does — confirms the
  address — and what still has to happen, because promising access and then
  showing a waiting screen would be worse than saying nothing.
- **The owner's notice carries a button.** A token naming one account, signed
  with the auth secret, expiring in a month, compared in constant time, able to
  do exactly one thing. The route is public because it is clicked from an inbox
  where there is no session; a bad or stale token is a 404, so it tells a
  stranger nothing. Its security is the owner's mailbox, which is already what
  can reset the owner's password — a deliberate trade for a button that works
  from a phone, and the reason the token can do nothing else.
- **The admin screen shows the queue**: who is waiting, when they signed up,
  whether they confirmed their address, and a button each. The same act from a
  screen, for when the mail is buried.

## Consequences

- Opening registration to everyone is now a one-line change — stop checking
  `activated_at` — instead of a redesign. That is the point of the split.
- A person can confirm their address and still wait, which is exactly the
  truth, and `/pendiente` says both things.
- The runbook's SQL changes to `set activated_at = now()`. The old statement
  now only confirms an address and opens nothing.
