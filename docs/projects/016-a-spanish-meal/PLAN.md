# Plan — Project 016: A Spanish meal — a normal plate, with bread and dessert beside it

> **Purpose**: the technical execution plan — the engineering half of the contract.
> `/execute-project` follows this literally; executors implement, they do not redesign.
> If implementation must diverge, the plan is amended in the same change and the
> deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes. **Written by**: a
> planner agent via `/plan-project`; approved by the owner before execution starts.
> Write repo-relative: no absolute paths, no references to other private repos.

- **Status**: approved
- **Type**: standard
- **PRD**: ./PRD.md
- **Routing profile**: tiered, routed inside each `/team` run. Phases 3–5 touch the allergy layer or AI output, so they sit at the `quality-max` floor, with the reviewers at opus · high.

## Design summary

The design is `0008` ([architect report](../../reference/architecture/0008-una-comida-a-la-espanola-2026-10-02.md)), followed literally. In short:

- **A** is a child table `meal_accompaniments` and a fixed list in code (`core/domain/Accompaniment`, shaped like `Yield`).
  - Sets are chosen inside `balancedDay`, at K = 6 per main slot ("none" included), only when the slot's share is over 700 kcal.
  - `ScheduledMeal.macros` and `meals.kcal` become the whole meal, and the accompaniments enter `meal.ingredients`, so `dishSafety`, `unresolvedSlugs` and the shopping list see them.
  - Swaps and rebuilds delete and reinsert the accompaniments in their own transaction.
  - It sits behind a global flag.
- **B** is the prompt: remove the "bread, fruit or dairy beside it" line (`PoolPrompt.ts` ~524), and set `SERVING_KCAL_CAP` lunch and dinner to 650 (moving `oversized` with it). Prompt 4.6.0.
- **C** is `mealShareKcal(shape, targets)` in core, plus the note and the choice on `/plan/generando` and `/perfil`.
- **D** is `PLATE_FOOD_MAX` in `withinPlateLimit`, scaled by share ÷ 1,100 above 1,100 kcal.

## Phases

### Phase 0 — Measure 014, and the instrument for everything after it

- [ ] pending
- **Dispatch**: sonnet @ medium — `/execute-project 016 phase 0`. `plan-evaluator` reads the numbers. **owner-gated:** the production simulation (read-only, run by the owner with `!`).
- **Goal**: PRD criterion 1.
- **Steps**:
  1. Once 014 is merged and deployed, extend `apps/api/scripts/evaluate-plans.mjs` with:
     - a servings histogram per slot;
     - plate and meal grams;
     - grams per food group (the D groups);
     - time per profile;
     - a `--flag accompaniments` switch, ready for phase 3.
  2. Run it on `main` and write `docs/local/016-base.json`.
  3. Rewrite the read-only `simulate-pro.mjs` (outside the repository). The owner runs it for their own profile, and the numbers go to LOG.md.
- **Stop if**: 014 alone already gives the owner's profile at least 13/14 days with servings ≤ 1.5 and no food above D. Then report, and let the owner reorder.

### Phase 1 — The choice: few meals means big meals, said before generating (C)

- [ ] pending
- **Dispatch**: `/team` — `backend` (sonnet · medium) for `mealShareKcal` and its view; `frontend` (sonnet · medium) for the note on `/plan/generando` and `/perfil`; `accessibility` (sonnet · low). `/execute-project 016 phase 1`.
- **Goal**: PRD criterion 2.
- **Steps**:
  1. Core: `mealShareKcal`, and the allowance or generation view exposes each main slot's kcal and a `largeMeals` boolean (any main slot over 850).
  2. Web:
     - the note and its two actions on `/plan/generando`, before the POST;
     - "Añadir una comida" opens the meal-shape step and returns to generation;
     - the choice is remembered (local storage, keyed by shape and targets), so it reappears when either changes;
     - a dismissible note on `/perfil`;
     - copy in both dictionaries.
  3. Run the design review and `/local-probe`.

### Phase 2 — No plate holds more than two servings of one food (D)

- [ ] pending
- **Dispatch**: `backend` (opus · medium) and `plan-evaluator`. `/execute-project 016 phase 2`.
- **Goal**: PRD criterion 3.
- **Steps**:
  1. Add `PLATE_FOOD_MAX` and the group test, with groups recognised as `0008` § D says.
  2. Plug it into `withinPlateLimit`: scaled above 1,100 kcal of share, with the floor exception.
  3. Unit tests.
  4. Run the evaluator against the phase 0 base.
- **Stop if**: a profile loses more than one day in band.

### Phase 3 — Accompaniments in the domain, behind a flag (A)

- [ ] pending
- **Dispatch**: `backend-high` (opus · high), `plan-evaluator`, `invariant-reviewer` (opus · high). `/execute-project 016 phase 3`.
- **Goal**: PRD criterion 4, domain half, with the flag off in production.
- **Steps**:
  1. Add `core/domain/Accompaniment`, with the list, the discrete portions and the per-person filter (safety, exclusions, season, meal, kosher on the whole meal).
  2. Scheduler: sets in `balancedDay`, the soft serving cost, and `ScheduledMeal.accompaniments`, with macros and ingredients covering the whole meal.
  3. `pickReplacement` composes sets too.
  4. Tests, including the risks named in `0008`:
     - milk, tree nuts, gluten, sesame traces in seeded bread;
     - kosher on the whole meal;
     - `traditional_spanish`;
     - the flag off giving byte-identical plans.
  5. Run the evaluator with `--flag accompaniments`.
- **Stop if**: any profile loses a day in band, a fortnight takes more than ~60 s, or any allergen reaches a plate.

### Phase 4 — Accompaniments end to end, and the flag on (A)

- [ ] pending
- **Dispatch**: `/team` — `backend-high`, `frontend`, `tests`, `migration-reviewer`, `invariant-reviewer`, `accessibility`. `/execute-project 016 phase 4`. **human-verify:** the owner sees it on the iPhone.
- **Goal**: PRD criterion 4, end to end.
- **Steps**:
  1. Add the `meal_accompaniments` migration (additive) and the repository.
  2. Generation, swap and rebuild delete and reinsert in their own transaction. The views gain accompaniments, and `composition` and the shopping list include them.
  3. Web: `MealRow` reads "Plato + pan (60 g) + una naranja", the meal page gets an "Acompaña con" section, and the offline copy carries the new field.
  4. e2e: a meal with accompaniments, a swap, a rebuild, a professional review, and allergies and patterns respected.
  5. Turn the flag on after deploy.

### Phase 5 — Dishes designed for one person (B)

- [ ] pending
- **Dispatch**: `backend-high` (opus · high), `invariant-reviewer`, `plan-evaluator`. `/execute-project 016 phase 5`.
- **Goal**: PRD criterion 5.
- **Steps**:
  1. Change the prompt as in `0008` § B, with a spec that the person-dependent text is unchanged.
  2. Lower `SERVING_KCAL_CAP` lunch and dinner to 650, and move `oversized`.
  3. PROMPT_VERSION 4.6.0.
  4. In the console, watch the `oversized` and `unwanted` rates for two weeks.

## Hand-off

- **Order.** C and D ship alone. A gives value only after phase 4. B never goes before A.
- **Zero euros.** Measuring B with `bench-models.mjs` costs model calls: ask the owner for the number first.
- **Production** is read-only, and only by the owner's command.
- **No `fable` for agents.**

## Out of scope

- Oil as an accompaniment.
- Primero and segundo as two dishes.
- Regional menus.
- Forcing a meal count.
