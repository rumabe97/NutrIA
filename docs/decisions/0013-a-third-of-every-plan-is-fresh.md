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
