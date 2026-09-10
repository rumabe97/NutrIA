# 0033 — Count the rows; log only what leaves none

**Status**: accepted · **Date**: 2026-09-10 · **Deciders**: owner, agent

## Context

`analytics_events` has been in the schema since the first migration and nothing
has ever written to it. Meanwhile the product has real accounts, registration is
open, and nobody can answer the question that decides whether any of the rest of
the roadmap matters: **is this working for the people using it?** Today, if
somebody abandons onboarding at step six, or never comes back for a second
fortnight, it leaves no mark anybody looks at.

The obvious build is an event per interesting moment — `account_created`,
`onboarding_completed`, `plan_generated` — and a screen that counts them. That
is how most analytics gets built and it is wrong here for two reasons.

The first is arithmetic: an event log that repeats state is a second answer
waiting to disagree with the first. `meal_plans` already knows how many plans
exist and who has one; a `plan_generated` event is that fact written twice, and
the day a transaction rolls back or a hook is forgotten, the screen and the
database say different things and the screen is the one being trusted.

The second is that events would start empty. Every account that exists today
predates the instrumentation, so a funnel built from events would say nobody has
ever finished onboarding until somebody does it again.

## Decision

**The funnel is counted from state. The event log holds only what leaves no row.**

Eight stages, each a count over the table that proves it — signed up, address
confirmed, account opened, profile finished, has a plan, marked a meal, did the
check-in, came back for a second plan. No instrumentation, correct retroactively
for every account that ever existed, and incapable of disagreeing with the data
it is counting.

Two things genuinely leave no row, and those are the whole event log:

- **`session_started`** — a session row is deleted when it expires, so "did
  anybody come back" is unanswerable a fortnight later unless it is written down
  as it happens.
- **`swap_requested`** — the axis somebody asked for (quicker, no cooking, more
  protein, vegetarian, or nothing in particular). The dish that came back is
  stored; the question that produced it was not, and the gap between what people
  ask for and what the catalogue can give them is the most useful thing the
  product does not currently know.

The set is closed, in code, in `ANALYTICS_EVENTS`. Adding to it means adding a
name to a union and arguing for it, which is the point.

## Constraints this inherits

- **An event records that something happened, never what it was about.** No
  dish, no weight, no allergen, no free text. `properties` carries the shape of
  the thing — an axis — and nothing that could be a fact about a person's body.
- **Nothing client-side may write one.** There is no route that records an
  event; every call site is server-side, at the moment the thing is true. A
  browser cannot invent activity that did not happen.
- **Recording never fails a request.** The repository swallows its own errors
  and returns nothing useful. A swap must not fail because a counter could not
  be written — the same rule the owner's notice follows (`0029`).
- **`user_id` cascades on delete.** Erasure stays real: deleting an account
  takes its events with it, like every other row that references it.
- **The screen shows counts, never people.** `/admin` gains a funnel and a
  fortnight of activity totals; it does not gain a way to see what any one
  person did, which is how an admin surface becomes a way to read health data
  (`0028`).

## Consequences

- The funnel works on the day it ships, over the accounts that already exist.
  The activity figures start empty and fill from now, and the screen says which
  is which so neither is mistaken for the other.
- A fixed bug found on the way: the admin screen's "waiting" count was reading
  `email_verified = false`, a definition that stopped meaning "waiting" when the
  two locks were split (`0030`). It counts `activated_at is null` now.
- What is deliberately not built: page views, funnels over time, cohorts, or
  anything needing a client-side beacon. They are the things a product with
  ten thousand users needs and a product with ten does not, and each would put a
  writer of health-adjacent data in the browser.
