# 0006 — Reuse recipes before generating, and keep the provider swappable

- **Status**: accepted
- **Date**: 2026-09-07
- **Project**: docs/projects/002-plan-generation

## Context

Generation cost is the one part of this product that scales linearly with users and
does not fall with volume. Measured against the design in
[`0005`](./0005-generate-a-pool-schedule-in-code.md) — two to three calls of roughly
7.5k input and 18k output tokens — a plan costs about $0.29 on a mid-tier model and
$0.10 on a small one. At a thousand users generating fortnightly that is $200–580 a
month, before anyone has paid anything.

The owner's constraint is that neither users nor the operator should pay. Taken
literally that is unachievable: inference has a marginal cost and someone bears it.
Taken as intent — *the running cost must not scale with users* — it is achievable, and
the existing architecture already contains the lever.

[`0005`](./0005-generate-a-pool-schedule-in-code.md) split generation so the model
chooses dishes and **code schedules the fortnight**. The scheduler is pure and fast. So
a plan assembled from dishes that already exist costs nothing at all: the expensive step
is producing a dish, not using one.

And dishes generalise. A user who is omnivorous, has no declared allergies, thirty
minutes to cook and a 2,000 kcal target is not distinctive. The dishes generated for
them fit thousands of others.

## Decision

**Reuse first, generate only the shortfall.**

Before any model call, the pool builder loads candidate dishes from the existing
`recipes` table — matched on slot, filtered through the *same* allergy gate that
validates generated dishes, and through the user's dietary patterns. Only the
per-slot shortfall goes to the model. Generated dishes persist as `recipes`, so they
are available to the next user with a compatible profile.

Cost therefore scales with **distinct dietary profiles**, not with users.

**The provider is swappable.** One `AiClient` interface over the Vercel AI SDK, with the
concrete model resolved from an `AI_PROVIDER` environment variable — Anthropic, Google,
a local Ollama, or a stub. No feature code imports a vendor SDK.

## Alternatives considered

- **Charge users.** The conventional answer and still available later; the owner ruled
  it out for now. Nothing here forecloses it.
- **Bring your own key.** Moves the cost to the user, which the owner also ruled out,
  and asking someone to paste an API key to get a meal plan is a product failure.
- **A single free-tier provider.** Works today and costs nothing, but ties the engine to
  one vendor's limits and terms. Free tiers commonly reserve the right to train on
  submitted data, and dietary restrictions are health-adjacent — a decision to accept
  that should be explicit and reversible, which a swappable provider makes it.
- **Hand-authored recipe library, no generation at all.** Genuinely free and genuinely
  limited: personalisation collapses to selection from a fixed set, which is the product
  `PRODUCT.md` explicitly says it is not.

## Consequences

- The first users of any given dietary profile pay for it; later ones mostly do not. Cost
  falls as the library grows, which is the opposite of the usual curve.
- **Free-tier rate limits become survivable.** Most generations make no call at all, so a
  low requests-per-minute ceiling stops being a wall.
- The allergy gate now runs over *reused* dishes too, not only generated ones. It is the
  same function ([`0004`](./0004-deterministic-safety-layer.md)) — a recipe being already
  in the database is not evidence that it is safe for *this* user.
- Reuse introduces a variety risk across users: everyone with the same profile could eat
  the same fortnight. The scheduler's variety rules act within a plan, not across users.
  Diversifying selection is deliberately left to a later project rather than guessed at now.
- A stub provider becomes a first-class citizen, which is what lets the whole pipeline be
  tested and demonstrated with no key and no spend.

## Amended by

- [`0009`](./0009-rotate-reuse-per-user.md) — reuse is rotated per user and per plan
  version, and a user is never served last fortnight's dishes again. The cost claim
  above bends for returning users; the reasoning is there, not here.
