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

- [x] done — the production simulation (LOG.md); the evaluator extension moved to phase 1
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

### Phase 1 — The choice before generating (C), and a scaled weight ceiling until accompaniments land

- [x] done
- **Dispatch**: `/team` — `backend` (opus · medium) for `mealShareKcal`, its view, the scaled ceiling and the evaluator extension; `plan-evaluator`; `frontend` (sonnet · medium) for the note on `/plan/generando` and `/perfil`; `accessibility` (sonnet · low). `/execute-project 016 phase 1`.
- **Goal**: PRD criterion 2, plus a temporary amendment to `0078` (owner, 2026-10-02, after phase 0 measured 3–11/14 days in band on the owner's two-meal profile under the flat 750 g ceiling).
- **Scaled ceiling.** For lunch, dinner and breakfast, `PLATE_GRAMS_MAX` stays 750 g up to a slot share of 950 kcal. Above that it scales by share ÷ 950, capped at 900 g; snacks stay 250 g. It reverts to the flat ceiling when the `accompaniments` flag turns on (phase 3). The evaluator extension from phase 0 lands here (servings histogram, plate and meal grams, grams per food group, time per profile, `--flag`).
- **Stop if** the owner's simulation on the whole library is below 12/14 days, or any evaluator profile loses a day against `016-base.json`.
- **Steps**:
  1. Core: `mealShareKcal`, and the allowance or generation view exposes each main slot's kcal and a `largeMeals` boolean (any main slot over 850).
  2. Web:
     - the note and its two actions on `/plan/generando`, before the POST;
     - "Añadir una comida" opens the meal-shape step and returns to generation;
     - the choice is remembered (local storage, keyed by shape and targets), so it reappears when either changes;
     - a dismissible note on `/perfil`;
     - copy in both dictionaries.
  3. Run the design review and `/local-probe`.

### Phase 2 — Design: cuisine families, what fits each meal, and accompaniments by cuisine (owner approves the tables)

- [x] done — decision [`0079`](../../decisions/0079-meals-fit-by-cuisine-and-accompaniments-by-cuisine.md), approved by the owner
- **Dispatch**: `architect` (opus · high) drafting with sources, and `plan-evaluator` checking coverage against the dev library. `/execute-project 016 phase 2`. **owner-approves:** the three tables before any code is built on them. Added 2026-10-02 (owner: "quiero que sea súper profesional").
- **Goal**: replace per-ingredient meal lists and a bread-only side list with the way a dietitian reasons about a tradition. The tables are data that later phases implement literally.
- **Deliverable**: a decision record with three tables and their sources (AESAN and SENC guidance, BEDCA for composition, each tradition's home cookery):
  1. **Cuisine families.** About 6–7: Spanish/Mediterranean, Italian, Asian, Mexican/Latin, Arab/Maghreb, other. Normalised from a recipe's free-text `cuisine` (the map started in `0077`), with a rule for null.
  2. **What fits each meal, by family.** Family × food group (rice, pasta, couscous and other grains, bread, potato or boniato, legume stews, fried, heavy sauces, raw salads…) × meal slot, with a one-line reason each. For example, rice at lunch in Spanish/Mediterranean but at any main meal in Asian. It supersedes the slot rule of the former phase 6 and drives `MealFit` for dishes by their family.
  3. **Accompaniments by family.**
     - Simple ones: bread, seasonal fruit, yoghurt, nuts, fresh cheese.
     - Composed ones, as small fixed recipes with ingredients and portions, so that safety and macros work: green salad, mixed salad, plain rice, sautéed vegetables, gazpacho in season, tortilla de maíz, pico de gallo…
     - Each family's typical set, and which slot each accompaniment fits.
     - All of them respect allergies, dietary patterns (`traditional_spanish` excludes its rows), season and dislikes.
- **Steps**:
  1. Draft the tables with sources.
  2. Measure them against the dev library: for each family and slot, how many dishes remain servable and which food groups thin dinner. Stop and flag any slot under `DISHES_NEEDED_PER_SLOT`.
  3. The owner reviews and approves, or edits.
  4. Write the decision record and amend phases 3–4 if the tables change their shape.

### Phase 3 — Accompaniments in the domain, behind a flag (A)

- [ ] pending
- **Dispatch**: `backend-high` (opus · high), `frontend` (sonnet · medium, for the note refinement only), `plan-evaluator`, `invariant-reviewer` (opus · high). `/execute-project 016 phase 3`. Starts after project 015 phase 2 merges, because both touch `/plan/generando` and the allowances view.
- **Goal**: PRD criterion 4, domain half, with the flag off in production.

- **Added 2026-10-02 (owner): a smarter large-meals note (C refinement).** The note told a person who already eats four times (two light snacks) to "add a meal". It should name the change that would work.
  - In core, add `mealSizeSuggestion(shape, targets)`. It tries, in order, adding a normal breakfast, turning a light snack normal, and adding an afternoon snack. It returns the first change that brings the largest main meal to 850 kcal or below, with the resulting kcal, or null when none does.
  - The note then says that change ("Si añades un desayuno, tu comida bajaría a unas 745 kcal").
  - With no suggestion, it offers only "Seguir así".
  - Owners: `backend-high` (core and view) and `frontend` (the copy). Unit tests cover the owner's four-meal shape.
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
  5. Turn the flag on after deploy, and with it return `PLATE_GRAMS_MAX` to the flat 750 g (phase 1's scaling ends).

### Phase 5 — No plate holds more than two servings of one food (D), after accompaniments

- [ ] pending
- **Dispatch**: `backend` (opus · medium) and `plan-evaluator`. `/execute-project 016 phase 5`.
- **Goal**: PRD criterion 3. Reordered after A (owner, 2026-10-02): before accompaniments exist, a per-food ceiling would cost more days in band. Run only if the evaluator still shows a food over its ceiling once A is on.
- **Steps**:
  1. Add `PLATE_FOOD_MAX` and the group test, with groups recognised as `0008` § D says.
  2. Plug it into `withinPlateLimit`: scaled above 1,100 kcal of share, with the floor exception.
  3. Unit tests.
  4. Run the evaluator against the phase 0 base.
- **Stop if**: a profile loses more than one day in band.

### Phase 6 — Dishes designed for one person (B)

- [ ] pending
- **Dispatch**: `backend-high` (opus · high), `invariant-reviewer`, `plan-evaluator`. `/execute-project 016 phase 6`.
- **Goal**: PRD criterion 5.
- **Steps**:
  1. Change the prompt as in `0008` § B, with a spec that the person-dependent text is unchanged.
  2. Lower `SERVING_KCAL_CAP` lunch and dinner to 650, and move `oversized`.
  3. PROMPT_VERSION 4.6.0.
  4. In the console, watch the `oversized` and `unwanted` rates for two weeks.

### Phase 7 — Starch-base variety (its lunch-only rule is superseded by phase 2's table)

- [ ] pending
- **Dispatch**: `backend` (opus · medium) and `plan-evaluator`. `/execute-project 016 phase 7`. Added 2026-10-02 (owner, from their own production plan).
- **Goal**: two complaints from the owner's production plan.
  - Pasta came back many times in one fortnight (different recipes, same base).
  - Pasta and rice landed at dinner, which in Spanish home eating belongs at lunch.
- **Amended by `0079`:** step 1 (lunch-only by data migration) is superseded. Meal fit is decided in code by cuisine family (`0079` table 2) and needs no catalogue migration. Steps 2–3 (starch-base variety) stand.
- **Steps**:
  1. **Lunch only.** Pasta, rice and couscous (raw and cooked, the "cooking bases" rows of `packages/database/src/seed/ingredients/meals.ts` rule 5 that are grains or pasta) become lunch only, where today they are lunch and dinner by `0062`.
     - Done through the seed's meal lists and a reviewed data migration for the catalogue rows. The `migration-reviewer` reviews it.
     - Existing recipes are narrowed by `MealFit` as today.
     - The evaluator is checked for dinner coverage: dinners lose those dishes, so watch `DISHES_NEEDED_PER_SLOT` and days in band.
  2. **Starch-base variety.** A rule beside `PROTEIN_RULES` (`core/domain/Variety`) recognises a dish's main starch base: pasta, rice, couscous or other grain, potato or boniato, legume, bread. It caps each base per fortnight (proposal: pasta ≤ 4 and rice ≤ 4 in 14 days) and keeps the same base off consecutive days, priced and enforced exactly like the protein rule.
  3. Evaluator: per profile, count each starch base and the number of dinner plates with pasta or rice.
- **Stop if** dinner coverage falls under `DISHES_NEEDED_PER_SLOT` for any profile, or a profile loses more than one day in band.
- **Owner to confirm at start**: the caps (4 pasta and 4 rice per fortnight), and whether couscous is lunch-only too.

## Hand-off

- **Order** (amended 2026-10-02):
  1. C with the scaled ceiling.
  2. The design tables, which the owner approves.
  3. A in the domain, then A end to end, built on the tables.
  4. D, if still needed.
  5. B, which never goes before A.
  6. Starch-base variety.
- **Zero euros.** Measuring B with `bench-models.mjs` costs model calls: ask the owner for the number first.
- **Production** is read-only, and only by the owner's command.
- **No `fable` for agents.**

## Out of scope

- Oil as an accompaniment.
- Primero and segundo as two dishes.
- Regional menus.
- Forcing a meal count.
