# 0065 — A fortnight is varied because it is built to be

- **Status**: accepted
- **Date**: 2026-09-26
- **Project**: none (a task, from the owner's report on a dev plan)
- **Amends**: [`0013`](./0013-a-third-of-every-plan-is-fresh.md) (how much of a slot the library may fill); builds on the repair passes of [`0045`](./0045-a-day-is-built-to-all-four-of-its-numbers.md) and [`0046`](./0046-a-plan-that-misses-its-macros-is-scheduled-again.md) without changing their weights

## Context

A dev plan for an account eating three meals a day, prompt 4.3.0, Gemma: 42 meal slots, 28
distinct dishes, every one served exactly twice, and two whole days serving the identical three
dishes (26/9 = 2/10, 27/9 = 6/10). Every day was inside 5% on all four macros. The owner: "no se
repitan días idénticos, tiene que ser súper variado".

Three causes, in `core/domain`:

1. **The repair passes did not price reuse.** `pickBest` ranks a slot's first pick least-used
   first, but `improveDay`'s swap search scored a candidate on day fit and protein repeats only.
   Three-meal days share almost the same target, so the best-fitting lunch for day 1 is nearly the
   best for day 3 and day 5; the exhaustive swap search kept spending the same dishes up to
   `canPlace`'s cap of two.
2. **No rule compared whole days.** `Variety.ts` checked one dish's placements; nothing noticed two
   days with the same set.
3. **The library's share was capped below one dish a day.** `REUSED_DISHES_PER_SLOT` was 12 of the
   19 a slot needs, so a slot of fourteen days held at least two repeats by arithmetic.

## Decision

1. **Reuse is priced in every pass that chooses a dish.** `DISH_REPEAT_WEIGHT` (the magnitude and
   idiom of `PROTEIN_REPEAT_WEIGHT`: another dish wins whenever it fits nearly as well, never
   enough to hold a day off its macros) in `pickBest` and `improveDay`, and a smaller
   `MAIN_GAP_SHORTFALL_WEIGHT` for lunch and dinner towards seven days between two servings of a
   main (`PREFERRED_MAIN_GAP`). A preference the scheduler pays to miss, not a wall a thin pool
   could not meet.
2. **No two days serve the same set of dishes.** `enforceDistinctDays` runs after every other pass
   (a mid-plan rebuild's untouched days included) and breaks a repeated day with the swap that
   costs least, under the band, meal-order and energy-floor guards `spreadAcrossDays` already
   uses. Where the pool leaves no alternative the day stays and `varietyViolations` records it as
   `identical_day`. Slot order does not matter: paella at lunch and lentils at dinner is the same
   day as the reverse.
3. **The library may fill a whole slot; the model still writes seven.** `REUSED_DISHES_PER_SLOT =
   DISHES_NEEDED_PER_SLOT` (19), and `PoolBuilder` floors a whole-plan generation's request at
   `FRESH_DISHES_PER_SLOT` (7) per slot, pinned once before the first round. The model is never
   asked for fewer than before, nor for more at any library size the old cap allowed; a meal swap
   passes no floor and costs what it did.
4. **Macros still win.** The band, order and floor weights dominate the new ones by orders of
   magnitude.

## Measurement

`apps/api/scripts/evaluate-plans.mjs` on the dev library (library only, no model call), eleven
fixed profiles, before and after:

| Profile | Days inside 5% | Distinct dishes | Identical days |
| --- | --- | --- | --- |
| Low target, 3 meals | 12 → 12 (worst 5.1% → 5.3%) | 40 → 41 of 42 | 0 → 0 |
| High target, 5 meals | 14 → 14 | 54 → **70 of 70** | 0 → 0 |
| Dairy allergy | 14 → 14 | 51 → **56 of 56** | 0 → 0 |
| Vegetarian | 14 → 14 | 51 → **56 of 56** | 0 → 0 |
| Fortnight with an event | 14 → 14 | 54 → **56 of 56** | 0 → 0 |
| Six more (custom allergy ×2, halal, kosher, gluten-free, lactose-free) | 14 → 14 | 47–49 → **56 of 56** each | 0 → 0 |

The low-target profile's two out-of-band days predate this change (the energy floor's trade-off);
its worst day moved 0.2 points. Unit cases: 19 dishes a slot give 14 distinct of 14 with no
violation; 8 dishes a slot (the `0048` fixture) still repeat, never past the cap.

## What was tried and reverted

- Raising `DISHES_NEEDED_PER_SLOT` itself: it is also `MealFit`'s `USAGE_MIN_DISHES` (`0063`), an
  unrelated prompt-size threshold. The fresh floor lives in `PoolBuilder` instead.
- Pricing `enforceDistinctDays` without the band guards: `0048`'s repair test caught a day brought
  to 1% on protein returning at 11%.

## Consequences

- Model cost per generation is unchanged: seven fresh dishes a slot.
- One more scheduling pass, bounded by the repeated days actually found.
- Plans already generated are not rescheduled (`0021`).
