# 0008 — A Spanish-style meal: an ordinary plate and what goes beside it

> **Purpose**: the `architect` agent's answer to the owner's proposal of 2026-10-02 for
> project 016. Four pieces:
> - **A**: a plate at an ordinary serving, with bread, fruit, yoghurt or nuts beside it;
> - **B**: the prompt designs plates for one person;
> - **C**: the profile suggests adding a meal;
> - **D**: a per-food ceiling on every plate.
>
> The report says whether it can be done, how, in what order and what it risks. It is the
> basis of the PRD.
> **Audience**: the owner and the agents. **Committed**: yes. **Maintained by**: the
> `architect` agent; once merged it is not edited — a later review is a new report.
>
> **Base**: branch `docs/014-a-plate-that-weighs-what-it-should` at `bd4d018b`. That is `main`
> with 012 and 013 merged (#186, #187), plus 014's unmerged code.
>
> **Numbers**: each carries its label, **measured** (where), **estimated** (with the
> hypothesis) or **unknown**.
>
> **Measurement**: no model call was made. The evaluator could not be run. Its guard against
> production reads the worktree's own `.env`, which it does not have, and I did not go around
> it.

## Verdict

**Yes, on conditions.** A is the piece that matters. B, C and D are each answered in a
paragraph.

1. **014 ships and is measured first.** The 0.8–1.4 kg plates come from production, which
   does not yet have 014. With 014 no plate passes 750 g except for the energy floor.
2. **A is stored in a child table, `meal_accompaniments`**, not as extra rows in `meals`. The
   plate and what goes beside it remain one meal with one macro snapshot.
3. **Accompaniments are chosen in code**, inside the day's portion search and under the
   combination ceiling that already exists. They pass through `dishSafety` like any other
   ingredient of the plate.
4. **`SERVING_BOUNDS` is not narrowed to 0.75–1.5 as a hard limit.** It would break anyone who
   eats a lot (`0070`). It goes in as a preference with a cost. Making it hard is the owner's
   decision.
5. **B comes after A, never before.** With nothing beside it, a 600 kcal plate would be served
   at 1.5–2 servings and the problem would be back.

## Premises checked

- **"Plates of 0.8–1.4 kg and 800–925 g of potato come out today": wrong, because it is out
  of date.**
  - Those are production plans, made with the code before 014.
  - With 014, `withinPlateLimit` requires grams × servings ≤ `PLATE_GRAMS_MAX`
    (`Scheduler.ts:668`).
  - What is left is fitting ~1,000 kcal into 750 g. That asks for ≥1.33 kcal/g, and a stew is
    around 0.9–1.3 (**estimated**).
  - So the scheduler will lean towards dense plates or towards days out of band. That gap is
    what A closes.
- **"Lunch and dinner are around 1,000 kcal": confirmed.** The weights in `MealShape.ts` are
  0.045 / 0.33 / 0.30. At 2,150 kcal that is ≈1,050 for lunch and ≈955 for dinner
  (**estimated**, arithmetic).
- **"Servings run from 0.5 to 4, bounded by 012 and 014": confirmed.**
  - `SERVING_BOUNDS` (`Scheduler.ts:19`);
  - `PLATE_LIMIT` (`:125`);
  - `PLATE_GRAMS_MAX` (`:139`).
- **"Narrowing to 0.75–1.5": collides with `0070`.** A 1,400 kcal meal does not fit in 1.5 ×
  650 plus accompaniments.
- **"The accompaniments are in the catalogue": confirmed** (**measured** in the seed).
  - `pan-blanco`: 290 kcal/100 g, a 30 g slice;
  - `pan-sin-gluten`;
  - `naranja`: 47 kcal, a 130 g piece, only from November to May (`seasons.ts:56`);
  - `yogur-natural-desnatado`: 56;
  - `nueces`: 654;
  - `queso-de-burgos`: 132.
- **"It fits inside the search": confirmed, in the shape below.**

## What is there today

- **One meal per slot.** `unique('meals_slot_unique')` over `(planDayId, slot)`
  (`packages/database/src/schemas/plan.schema.ts:144`). Completing, swapping, feedback and
  pictures all go by meal. Putting accompaniments in as extra rows is a **no**.
- **The meal holds its macros.** They live in `meals.kcal…`, and out of them come:
  - the day's totals;
  - `validatePlan`;
  - adherence;
  - the console.
- **A meal's ingredients are not stored.** They are read off the scaled recipe
  (`PlanController.ts:204`).
- **The scheduler** picks one plate per slot (`Scheduler.ts:392-407`). It then sizes the day
  by trying every combination (`balancedDay`, `:1039`), under two limits:
  - `BALANCE_MAX_COMBOS` = 59,049 (`:46`);
  - the split `windowsFor` makes (`:928`).
- **The allergen check reads `meal.ingredients`.** It is read by:
  - `assertPlanIsSafe` (`PlanGeneration.service.ts:528`);
  - the rebuild (`PlanLoadRebuild.service.ts:172`);
  - `buildShoppingList` and `unresolvedSlugs`.
- **`breaksDishRule` looks at a plate, not at a meal** (`Preference.ts:727`, meat with dairy
  for kosher).
- **Swapping a plate, and rebuilding.**
  - A swap budgets against the whole meal (`MealSwap.service.ts:127`).
  - Both update the row in place (`PlanRepository.ts:1005` and `:785`).
- **The prompt already asks for bread beside it**: "a plate with bread, fruit or dairy beside
  it" (`PoolPrompt.ts:524`).

## Proposal

### A — A plate and what goes beside it

**Data: one new table, purely additive.**

```
meal_accompaniments(id, meal_id → meals ON DELETE CASCADE,
                    ingredient_id → ingredients ON DELETE RESTRICT,
                    grams, kcal, sort_order, unique(meal_id, ingredient_id))
```

- `meals.kcal` and the macros become those of the whole meal. The totals, the validation, the
  progress and the console do not change.
- The per-row `kcal` keeps the snapshot invariant.
- Deleting an account still cascades.

**Alternatives rejected:**
- **Extra rows in `meals`**: they break the unique and everything hanging off a meal.
- **Recipes marked as an accompaniment**: they would enter reuse, pictures and the picture
  judge.
- **Folding them into the recipe**: the recipe is shared and the accompaniment is the
  person's.

**Domain.** A fixed `ACCOMPANIMENTS` table, like `Yield`, with discrete portions:
- bread, white or wholemeal: 30, 60 or 90 g;
- gluten-free bread, only where `freeFromExclusions` allows it;
- one piece of fruit in season;
- yoghurt: 125 g;
- nuts: 15 or 30 g;
- queso de Burgos: 60 g.

Oil is left out: it is invisible energy and nobody eats it as an accompaniment.

**One filter per person**, which every accompaniment passes through:
- `dishSafety`;
- `excludedIngredientIds`, which already covers `traditional_spanish` and the foods they do
  not like;
- the unresolved labels;
- `MealFit`, by season and meal.

**Rules at the level of the meal:**
- `breaksDishRule` is checked over the plate and its accompaniments together.
- Nothing from a group the plate already carries.

**Integration.** `ScheduledMeal` gains `accompaniments`, and their grams also enter
`meal.ingredients`. That is how these see them, with no second loop:
- safety;
- `unresolvedSlugs`;
- the shopping list.

`ScheduledMeal.macros` is the whole meal too. Today it is the plate alone
(`Scheduler.ts:434`), and out of it come:
- the day's totals (`:439`);
- `validatePlan`;
- the `MealDraft` (`PlanGeneration.service.ts:567`).

If it did not include them, a day the person does not eat would be validated and the snapshot
would be false. That is where the ±5% seam is.

**Search cost.**

| Case | Combinations per day |
|---|---|
| Today, 3 meals (window ±4) | 9³ = **729** |
| Every possible set (~70 per slot) | (9 × 70)² × 9 ≈ **3.6 million**: does not fit |
| Trimmed sets (K = 6 per main slot, "none" included) | (9 × 6)² × 9 = **26,244** |

How the chosen shape works:
- The sets are ordered by how well they close their slot's gap and enter the day's search as
  one more variable.
- At 4 meals or more, `windowsFor` narrows the light meals first.
- The 59,049 ceiling does not move, so today's worst case (5–6 meals) does not rise. Three-meal
  days may take up to ~36× longer (**estimated**). The evaluator measures it.
- They only switch on when the main slot passes ~700 kcal. Below that K = 1, and somebody who
  eats five times against an ordinary target pays nothing.
- A high target with five meals does cross the threshold, and then `windowsFor` narrows the
  other slots. The `objetivo-alto-5-comidas` profile is the one to watch in phase 3.
- **Alternative rejected**: choosing them in a second pass, with the servings already fixed.
  That fixes servings without knowing which bread is coming and loses days inside band. It is
  the lesson of the greedy pass in `0045`.

**Servings.** They stay at 0.5–4, with a soft cost outside 0.75–1.5. The hard limit remains
014's. Bread gives 2.9 kcal/g and a stew ~1.2, so the search will prefer bread to half a
serving more.

An example for 1,050 kcal (**estimated**):

| Part | Weight | Energy |
|---|---|---|
| A 650 kcal plate at 1.25 servings | ~690 g | 812 kcal |
| Bread | 60 g | 174 kcal |
| Orange | 130 g | 61 kcal |

The 750 g ceiling applies to the plate. Accompaniments have fixed portions and do not count
towards it.

**Swapping a plate.**
- The budget is still the whole meal.
- `pickReplacement` picks the plate, and the scheduler's own function composes its
  accompaniments (9 × 6 combinations).
- `swapMeal` and `rebuildLoadedDays` delete and re-insert the rows inside their transaction.
- `composition` includes them, so a rebuilt shopping list counts them.

**The professional's review.** `pendingPlan` returns a `PlanView` and `swapPendingMeal` uses
the same service. It inherits this; only the screen changes.

**Web.**
- In `MealRow` (home and `PlanBrowser`): "Lentejas estofadas + pan (60 g) + una naranja".
- On the meal's own page, a "Goes with" section.
- Keys in both dictionaries and a pass by `accessibility`.
- The offline copy carries the new field.

**Switch.** A global `accompaniments` flag. Off, K = 1 and the plan comes out identical. A
test pins that.

### B — The prompt designs a plate for one person

**Yes, behind A.**
- The line at `PoolPrompt.ts:524` goes, and the prompt says the plan adds the bread and the
  fruit.
- `SERVING_KCAL_CAP` for lunch and dinner drops from 900 to ~650, and the `oversized` limit
  with it (975, `0070`). Prompt 4.6.0.
- The plate method goes in as a preference, never above the macro split: a high-protein diet
  does not fit in a quarter of a plate.
- No migration. The 700–900 kcal library is served at 0.75 servings.
- It only changes new dishes, so its effect is measured weeks later.

### C — Suggesting one more meal

**Yes, cheap.**
- `mealShareKcal(shape, targets.effective)` in core.
- A notice in onboarding and on `/perfil` when a main slot passes ~850 kcal. It says how much
  it carries, can be dismissed and never forces anything (a heavy meal is deliberate, `0036`).
- No model, no data, no migration.

### D — A per-food ceiling

**Yes, no migration.** A table in code:

| Food | How it is recognised | Ceiling per plate |
|---|---|---|
| Meat | classes `meat` and `pork` | 250 g |
| Fish and shellfish | classes `fish` and `shellfish` | 300 g |
| Cooked legume | `isLegumeSlug` | 400 g |
| Grain | `0078`'s yield | 160 g dry |
| Potato and sweet potato | a list of slugs | 400 g |

- It is checked inside `withinPlateLimit`, with the floor's exception.
- Even with 014 it still cuts: a 700 g plate can carry 550 g of potato.
- **It collides with `0070`**: two servings with 200 g of meat stop fitting. Somebody who eats
  a lot will depend on A.

## Requirements

- **Code.**
  - Core: the table, the filter, `Scheduler`, `ScheduledMeal`, `MealDraft` and the views.
  - API: generation, swapping a plate and the rebuild.
  - Web: two screens.
  - The evaluator.
- **Data.** One additive migration (`CREATE TABLE`), filling nothing. Old plans have zero rows.
- **Money.** Zero euros. Neon: ≤56 rows per plan (**estimated**). Measuring B with
  `bench-models.mjs` costs calls, at whatever number the owner decides.
- **The owner's decisions.**
  - The list: cheese yes, oil no?
  - The thresholds: ~700 for A and ~850 for C.
  - Servings as a preference (recommended) or as a hard limit.
  - D's ceilings.

## Risks

1. **An allergy.** Mitigation: the accompaniments sit inside `meal.ingredients`, and the same
   `dishSafety` stops them before anything is stored.
   - Tests: milk, tree nuts, gluten and traces of sesame in a seeded loaf.
   - A pass by `invariant-reviewer`.
2. **Kosher per meal.** `breaksDishRule` over the whole, with its test.
3. **Privacy.** A is code only. B changes the prompt's fixed text, not what the prompt carries
   of the person. The consent stays true.
4. **±5%.** More levers should help (**estimated**), but:
   - the portions are discrete (30 g of walnuts is 196 kcal and 20 g of fat);
   - the serving preference takes sizes away.

   It stops if a profile loses more than one day inside band against the baseline
   (`--compare`).
5. **Function time.** If a fortnight passes ~60 s, K comes down.
6. **Deployment.** The old API writes meals with no accompaniments, and they stay coherent.
   The way back: turn the flag off.

## Cost and effort

Agent-days (**estimated**). What moves them most are the evaluator's rounds.

| Piece | Effort |
|---|---|
| Phase 0 | 0.5 days, plus 15 minutes of the owner's |
| C | 1 day |
| D | 1 day |
| A, domain | 2–3 days |
| A, persistence, API and web (`/team`) | 3–4 days |
| B | 0.5–1 day |

## Plan

| Phase | Delivers | Success | Stop if |
|---|---|---|---|
| 0 | Merge 014. The evaluator measures: servings per slot (a histogram); grams of the plate and of the meal; grams per group; time per profile. Run `simulate-pro.mjs` | A measured baseline for `imc-alto-2-comidas` | 014 already gives ≥13/14 days and servings ≤1.5: A drops down the list |
| 1 | C | The notice seen at 320, 390 and 1280 px | — |
| 2 | D | No food passes its ceiling | More than one day is lost |
| 3 | A in the domain, flag off | With the flag on in the evaluator: days ≥ baseline; ≥80% of main servings in 0.75–1.5; plate ≤750 g; the share of meals with 0, 1 or 2 accompaniments and their share of kcal; zero allergens | A day is lost, or a fortnight passes ~60 s |
| 4 | A in full, and the flag goes on | The owner sees it on his iPhone | Any allergy or kosher failure |
| 5 | B | New plates of 500–650 kcal a serving | `oversized` or `unwanted` rise |

C and D stand on their own. A only pays off after phase 4.

## What I do not know

- **014 on the two-meal profile**: **unknown**. Step 5 of 014 and `simulate-pro.mjs` have it,
  in the lead's hands.
- **Kilocalories per serving in production**: **unknown**. In dev, 95% of meals are below ~870
  (`0070`).
- **The time at K = 6**: arithmetic only.
- **Whether the person wants bread and fruit every day** or would rather have "no bread": the
  owner will say once he is using it.
