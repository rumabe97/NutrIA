# 0012 — Alternatives are catalogue pairs, filtered per person in code

- **Status**: accepted
- **Date**: 2026-09-08
- **Project**: none (task, at the owner's request)

## Context

The owner's town has one supermarket. A recipe that calls for seitan, or for a
fish the shop does not stock, is a recipe that cannot be cooked as written — and
the plan offers no way out except skipping the meal. The request: *each recipe
should carry alternatives — lentils to chickpeas, that sort of thing; staples
need none.*

Two ways to get them. Ask the model for an "or instead" per ingredient when it
writes the dish, and store that on the recipe. Or curate pairs between catalogue
rows and show them on every dish that uses the row.

The first sounds richer and is worse on every axis that matters here:

- **Safety.** A substitute the model names is free text. It carries no allergen
  links, so the one deterministic gate the product has — `isSafe` against
  `ingredient_allergens` ([`0004`](./0004-ai-provider-and-deterministic-safety.md))
  — cannot see it. A swap is exactly where a prompt-only rule leaks: the dish was
  checked, the "or instead" was not.
- **Coverage.** It would exist only on dishes generated after the change. The
  library, and every plan already on someone's phone, would have none until a
  sweep rewrote them — a sweep that costs model budget the free tier does not have
  (see the quota incident under [`0010`](./0010-illustrate-recipes-not-photograph-them.md)).
- **Consistency.** Lentils would get chickpeas on one dish and beans on the next,
  depending on the model's mood that call.

Recipes are already composed only of catalogue slugs (the model "never invents an
ingredient"), and `ingredient_substitutions` has existed since the kickoff,
empty.

## Decision

**Alternatives are pairs between catalogue rows, seeded by hand, filtered per
person in code, shown on the meal screen.**

- `packages/database/src/seed/substitutions.ts` holds **groups** (families whose
  members stand in for each other at the same weight) and one-way **extras** with
  a ratio. The seed writes every ordered pair to `ingredient_substitutions`.
- One rule, enforced by `seed.test.ts`: **a swap never introduces a class of food
  the dish did not already have** — no meat, fish, shellfish, pork, dairy, egg or
  any animal product into a dish that had none. Butter may become olive oil; olive
  oil never becomes butter. Dietary patterns are enforced only in the prompt, so
  this is the one place a substitute could otherwise undo a vegetarian's or a
  halal plan — and it holds without the code knowing the person's pattern.
- `core/domain/Substitution.alternativesFor` gates every candidate with the same
  `isSafe` that gated the dish, orders the survivors by nutritional distance to
  the original, keeps three, and scales the weight to the planned portion. An
  alternative the person is allergic to is not shown with a warning; it is not
  shown.
- **Staples get none**, on purpose: salt, olive oil, onion, garlic, tomato, eggs,
  the spices. Every shop has them, and a line under each would bury the swaps
  that matter.
- The shopping list is unchanged. It is built from the recipe as written; the swap
  is a decision made standing in the shop, and the list is what says what the
  recipe wanted.

## Consequences

- Every dish, in every plan already generated, shows alternatives the moment the
  seed runs. No model call, no sweep, no quota.
- The seed must be **re-run against the deployed database** when the file
  changes; a deploy only migrates. The runbook says so.
- Adding a catalogue row means deciding its family, or deciding it is a staple.
- Nutritional distance is the order, not a curated rank: deterministic, and the
  first suggestion is the one that changes the day's numbers least. A column for
  rank would be a migration for an order nobody has asked for.
- The pairs are the agent's culinary judgement, reviewed by the owner. They will
  be wrong somewhere; the fix is a line in the seed and a re-run, not a prompt.
