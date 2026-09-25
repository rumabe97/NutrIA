# 0062 — Each meal sees its own foods, and the season, through catalogue exceptions

- **Status**: accepted
- **Date**: 2026-09-25
- **Project**: docs/projects/005-meal-and-season-catalogue

## Context

The pool prompt lists every ingredient a person may eat for every meal it asks about: 930
rows, ~5,600 of a lunch request's ~8,000 tokens. The library in development uses 413 of
them; 517 appear in no recipe. That size is refused outright by Groq's free tier (8,000
tokens a minute) and doubles the cost and reading time everywhere else. Nothing on the
catalogue says which meal a food belongs to: 98 of 372 library dinners carry a pulse. Nothing
says what is in season.

The owner decided the shape on 2026-09-25: a per-ingredient statement of which meals it
belongs to, drafted by an agent and reviewed by the owner; pulses kept at dinner for vegans
and vegetarians, in light forms; season as a preference, never a prohibition.

## Decision

1. **Two catalogue columns, both exception lists.** `ingredients.meal_slots` (text[]) and
   `ingredients.season_months` (smallint[], 1–12). Empty means every meal and every month,
   the way `countries` means every country (`0034`). The seed fills them from two committed
   overlays, `seed/ingredients/meals.ts` and `seed/ingredients/seasons.ts`, which name only
   the exceptions — a pulse that is not a dinner, a tomato that is a summer.
2. **Months are Spain's.** One calendar for every locale until a second shelf exists.
3. **A meal's catalogue is the ingredients whose `meal_slots` is empty or contains it.**
   The pool prompt for one slot lists only those.
4. **Plant-based exception.** For somebody whose way of eating is vegan or vegetarian, a
   plant protein — the protein aisle with no animal class — belongs to every meal whatever
   its list says, and the prompt asks for light forms at dinner. Without it their dinner
   protein would rest on tofu, tempeh and seitan alone.
5. **Dishes are narrowed, not rejected.** A dish — from the library or from the model — is
   served only at the meals every one of its ingredients belongs to: the intersection of its
   own `slots` with its ingredients'. A lentil stew stays a lunch and stops being a dinner.
   A dish whose intersection is empty is dropped. Nothing is deleted from the library.
6. **Season orders and marks, and forbids nothing.** Produce in season in the month the
   fortnight starts is listed first in its aisle and marked; the rest follows. Empty
   `season_months` counts as in season.

## Alternatives considered

- **Rules by food group in code** (pulses out of dinner, meat out of snacks): less data to
  review, but coarse and a smaller cut; the owner chose per-ingredient.
- **The library's usage per slot as the catalogue**: automatic, but it would freeze the seed
  library's choices and hide every ingredient no recipe has used yet.
- **Rejecting a dish that names a meal its ingredients do not belong to**: throws away a
  valid lunch because the model also called it a dinner.
- **Excluding out-of-season produce**: a tomato is on every shelf in January; the owner
  asked to prefer, not forbid.

## Consequences

- The seed must be re-run against production after the migration for any of it to take
  effect there (`docs/reference/deployment.md`, step 6). Until then both columns are empty
  and behaviour is exactly as before.
- Any new ingredient belongs to every meal and month unless an overlay names it — the
  honest default, and the one reviewers must remember.
- An English account gets Spanish seasons.
