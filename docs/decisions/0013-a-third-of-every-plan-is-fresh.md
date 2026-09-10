# 0013 — A third of every plan is written fresh, however full the library

- **Status**: accepted
- **Date**: 2026-09-08
- **Project**: none (task, at the owner's decision)

## Context

The owner, looking at five users' plans: *they all look very much alike.*

They do, and the catalogue is not why. [`0006`](./0006-reuse-before-generating.md)
fills a plan from the library first and asks the model only for the shortfall;
[`0009`](./0009-rotate-reuse-per-user.md) rotates that library per user and keeps a
person from repeating their own fortnight. With 119 recipes on the shelf and
twelve needed per slot, the shortfall for most users is zero — so nothing new is
written, the library stops growing, and every user is served a permutation of the
same hundred dishes. Rotation makes two people's plans *differ in order*; it cannot
make them differ in content when both are drawn from the same shelf.

A second, smaller cause is the size of the shelf the model may pick from: 200
catalogue rows is a thin Spanish supermarket (no black pepper, no coconut milk, no
lamb, no mango). That is addressed by the same change, as data — the catalogue
grows to about a thousand rows in per-category seed files, each carrying its
allergens, its English name and its food class.

## Decision

**Every slot's pool is at least a third fresh.** `FRESH_SHARE = 1/3` in
`core/domain/Variety`; `rotatePool` hands the library at most
`REUSED_DISHES_PER_SLOT` dishes per slot, so the builder's shortfall is never below
`FRESH_DISHES_PER_SLOT` and the model is always asked for that many. The
scheduler spreads a pool evenly, so a third of the pool is close to a third of the
fortnight. Every fresh dish joins the library, which now grows with every plan.

Chosen over "at least half": half doubles the model's work per plan, and the free
tier the product runs on today has already shown what its daily cap does when a
sweep meets it. A third is one call per plan.

It is a **preference**, like every variety rule ([`0011`](./0011-nutrition-targets-are-advisory.md)
and the full-library fallback that followed it): when the provider is out or over
quota, the library fills the whole pool and the plan is delivered, with
`fallback: full_library` on it.

## Consequences

- Every plan costs one model call, including a new user's first plan on a full
  library. That is the price of plans that differ; the owner accepted it.
- The library grows by roughly a third of a plan per plan, so reuse gets *more*
  varied over time rather than staying put.
- `0006`'s cost claim — most plans cost nothing — no longer holds; its
  reuse-first mechanism does, for the other two thirds.
- The fraction is one constant. Raising it is a one-line change and a quota
  decision, in that order.

## Amendment — 2026-09-10 — a fortnight is fourteen dishes, not seven served twice

Two users reported getting "the same plan". They had not: 56 meals against 42,
different targets, different seeds, and one meal of forty-two was the same dish
on the same day. But six recipes were shared, and all three of one person's day
one appeared in the other's fortnight — so what they compared, they were right
about.

Two causes. The scheduler discarding the per-user shuffle belongs to `0009`.
This one is the pool.

The target was `ceil(14 / maxOccurrencesPerPlan) + 5` — twelve dishes for
fourteen days, on the reasoning that the rules *allow* a dish twice. What the
rules allow is not what anybody wants: twelve against fourteen made two repeats
per slot an arithmetic certainty, every plan, for everyone. The target is now
`14 + 5`, so a slot can be fourteen different dinners and the repeat rule goes
back to being a ceiling nobody reaches rather than a schedule.

The third holds, and it had to: **the pool builder asks the model only for the
shortfall**, so the library's share is the whole mechanism behind this decision.
The first attempt at this amendment raised the library's contribution instead of
the target — the shortfall went to zero, the model was never called, and the
end-to-end suites caught it as "no prompt was ever sent". A shelf that stops
growing is the exact failure this ADR exists to prevent, and it was one constant
away.

What it costs: the model now writes seven dishes per slot instead of four. The
same one call per plan — which is what the free tier counts hardest — with more
asked of it.
