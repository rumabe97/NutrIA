# 0061 — A subscription grants what its price says: premium, or a practice of N clients

- **Status**: accepted
- **Date**: 2026-09-23
- **Project**: docs/projects/004-dietitian-workspace
- **Amends**: [`0056`](./0056-premium-is-paid-through-stripe.md)

## Context

`0056` pays for one thing, personal premium, through one `subscriptions` row per account;
the signed webhook re-fetches the subscription from Stripe and writes `user.tier` from its
status. Project 004 adds a second thing to pay for: a professional's practice, sold as
plans that each include a number of active clients (the first 30, a larger one more), with
a 14-day trial, and moving between plans through Stripe's customer portal. A linked client
pays nothing and has the paid allowances while the link lasts.

## Decision

**One row, and the price decides what it grants.** The webhook keeps re-fetching the
subscription and now also reads its price. A premium price writes `user.tier` as today. A
practice price writes, on the professional's row, whether the practice is open
(`paysForPremium(status)`, the same rule) and how many active clients it includes, taken
from configuration that maps each practice price to its number. A price the configuration
does not know grants nothing. The number is never taken from a request.

**Configuration, all or none.** `STRIPE_PRACTICE_PRICES` lists `price_…=N` pairs; like the
other `STRIPE_*` variables it requires the core three, and the trial for practices is 14
days, once per account, as `0056` does for premium.

**A linked client is premium while the link is active and the practice open.**
`PlanController.tierOf` answers `premium` for such a client before it reads the column,
behind a new `professional` flag that fails **off**; the `premium` flag still governs
personal premium alone.

**A lapse pauses, never deletes.** A practice that stops paying pauses its links — the
professional's routes answer 404 for those clients, the clients return to the free
allowances and keep everything — and a resumed subscription reactivates them.

**The limit is counted at the invitation.** Active links plus unexpired invitations may not
exceed the included number; the refusal names the way up (the larger plan through the
portal, or ending a link).

## Alternatives considered

- **A second subscriptions table for practices.** Lost because an account holds one
  subscription at a time here, the webhook already resolves one account per customer, and a
  second table would give a professional two sources of truth for what they pay.
- **Charging per client beyond the included number.** Left for later by the owner: it
  makes every link change a billing event and the bill different every month.

## Consequences

- A professional's own personal premium and their practice cannot both be subscribed from
  one account; v1 accepts it.
- The payments runbook gains the practice prices, the portal's plan-switching setting and
  the new variable.

*Amended 2026-09-24 (project 004 Phase 7):*

- **Any price that is not a listed practice price is premium**, including a subscription
  with no price to read. This replaces "a price the configuration does not know grants
  nothing". Before practices existed every subscription was premium, and a subscriber left
  on a premium price the owner has since replaced keeps it until the owner decides
  otherwise.
- **The consequence:** a practice price removed from `STRIPE_PRACTICE_PRICES` turns its
  subscribers into premium at their next event. Their practice closes and their links
  pause. The payments runbook must say never to remove a practice price that still has
  subscribers.
- **An invitation accepted while the practice is closed** makes the link `paused`, as a
  lapse leaves the others. Paying again reactivates it with them. The acceptance takes
  the practice's row `FOR SHARE` before the invitation, so it cannot slip between the
  counts behind `PRACTICE_FULL`.
