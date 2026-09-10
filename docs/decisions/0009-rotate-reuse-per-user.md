# 0009 — Rotate reuse per user, and never serve last fortnight again

- **Status**: accepted — amends [`0006`](./0006-reuse-before-generating.md)
- **Date**: 2026-09-07
- **Project**: none (task, at the owner's report)

## Context

Reuse first still holds. But the pool builder handed every user the *whole* safe
library, and the scheduler — deterministic, ranking by usage, fit and slug — turned
the same library into the same plan for everyone with a similar profile, and into the
same plan again the following fortnight. The owner's report was "each user should
have their own plan, with many varieties"; the cause was not the model, it was this
step not existing.

## Decision

`rotatePool` (`core/domain/Variety`) decides which library dishes a user is handed:
last fortnight's are excluded, the rest are shuffled with a seed from the user and
the plan version, and up to `DISHES_NEEDED_PER_SLOT` are taken per slot — the same
number a generation asks for. Reproducible per user and version; different per user
and per fortnight. Prompt 2.3.0 is told what was served last time and asked to spread
the set it returns, with the counts stated. The seed and the count held back are
recorded in the plan's metadata.

## Alternatives considered

- **Seed the scheduler instead.** Its ranking is order-independent; a seeded tie-break
  would only matter when two dishes fit identically, which is rare. The *set* had to
  differ, not the order.
- **Ask the prompt for variety and leave reuse alone.** The prompt never saw the reused
  dishes; it could not vary what it was not choosing.
- **Drop reuse for returning users.** Throws away the cost lever entirely, where
  excluding one fortnight's dishes keeps most of it.

## Consequences

**The cost claim in 0006 bends.** Excluding last fortnight means a returning user's
second plan needs dishes the library may not yet hold, so generation is called where
it would not have been. That cost falls as the library grows — every generated dish is
reusable by everyone else — and it is the price of the two things the owner asked for
twice. Cost still does not scale with *users*; it scales, for a while, with how often
the same user comes back.

## Amendment — 2026-09-10 — the shuffle only counts if the scheduler reads it

This decision shuffled the library per user and stopped there. It was half a
mechanism: `rotatePool` handed each person a different subset, and then
`pickBest` sorted that subset again — by usage, by fit, and finally **by slug**.
Two dishes that fit a budget equally well were decided by the alphabet, which is
the same alphabet for everybody.

So the rotation chose *which* dishes each person could be served, and the
scheduler chose *which of them came first* using a rule with no person in it.
Day one went to the best-fitting dish on the shelf, for everyone on that shelf.
Two users noticed and said so.

The tie is now the pool's own order, which is this user's shuffle. Fit still
decides whenever it has anything to say — the tie only applies within five points
of relative error, a difference nobody can taste. Reproducibility is unchanged:
the same person and the same plan version still yield the same plan.

The lesson is narrower than "shuffle harder". A randomisation that a later,
deterministic step re-sorts is not a randomisation; it is a comment. The step
that makes the final choice has to be the one that knows whose plan this is.
