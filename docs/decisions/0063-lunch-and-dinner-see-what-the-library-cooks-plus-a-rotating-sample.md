# 0063 — Lunch and dinner see what the library cooks, plus a rotating sample

- **Status**: accepted
- **Date**: 2026-09-25
- **Project**: docs/projects/005-meal-and-season-catalogue
- **Extends**: [`0062`](./0062-each-meal-sees-its-own-foods-and-the-season.md)

## Context

`0062` narrows each meal's catalogue by per-ingredient exception lists. Drafted and
reviewed in phase 2 of project 005, the lists cut breakfast's catalogue by 49% and the
snacks' by 41%, but lunch's by 13% and dinner's by 16%: nearly every food belongs at lunch,
and no honest meal rule removes five hundred rows from it. The lunch prompt stays near
7,200 tokens — still refused by Groq's free tier, and short of the PRD's −45%.

The library in development cooks lunch from 284 distinct ingredients and dinner from 281,
out of 930. The owner chose, on 2026-09-25, to cut lunch and dinner further by what the
library uses, keeping novelty with a rotating sample.

The same review asked for two things the lists could not say: the energy drink in no meal
at all, and red lentils and textured soy covered by the plant-based exception (`0062` § 4),
which reads the protein aisle while both rows sat in the pantry.

## Decision

1. **Lunch and dinner get a second cut, after `0062`'s.** Their catalogue for one request
   is the union of:
   - the ingredients the library's recipes in the person's locale use at that meal;
   - the produce in season in the fortnight's month that belongs to that meal;
   - a sample of the meal's remaining catalogue, drawn afresh for each generation so that
     every fortnight offers foods the library has never used. Its size is one constant,
     starting at 60 rows and tuned in phase 4 of project 005 against the PRD's size target.
   Everything else about `0062` applies first: only rows that belong to the meal, for this
   person, safe and wanted, are candidates for any of the three.
2. **Breakfast and the snacks keep `0062`'s cut alone.** Their catalogues are already half
   the size, and they are where new ideas are easiest to lose.
3. **A row can belong to no meal.** `ingredients.meal_slots` holds `['none']` for it,
   because an empty list already means every meal. It stays in the catalogue, so a recipe
   or a shopping list that names it still resolves; it is offered and served nowhere. The
   energy drink is the first.
4. **The seed owns the aisle.** Red lentils and textured soy move to the protein aisle, so
   the plant-based exception covers them, and the seed now overwrites `category` on a
   database that already has a row.

## Alternatives considered

- **Accept 13–16% for lunch and dinner**: honest, but leaves the largest two prompts
  outside the free tier the project exists to reach.
- **Stricter lists for lunch and dinner**: subjective, and unlikely below ~600 rows.
- **The library's usage alone, with no sample**: freezes the seed library's choices; a
  food no recipe uses yet could never appear.
- **Delete the energy drink from the catalogue**: the seed never deletes, and a recipe that
  names it would stop resolving.

## Consequences

- The model's lunch and dinner choices lean on what the library already cooks. The sample
  is the only way a new ingredient enters those meals; if variety drops, the sample grows.
- Generation reads one more query: the library's ingredients per meal and locale.
- A reader of `meal_slots` must treat `none` as "no meal", not as a slot name. `MealFit`
  (phase 3) is the one place that reads it.
