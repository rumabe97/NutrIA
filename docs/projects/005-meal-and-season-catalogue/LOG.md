# LOG — Project 005: Each meal sees its own foods, in season

> **Purpose**: append-only execution record. One entry per phase (plus one per
> deviation): what happened, evidence it works, what changed against the plan. This is
> the file future agents read to learn "what was decided in phase X and why".
> **Audience**: humans and agents. **Committed**: yes — one commit per phase, made by
> the owner at the phase boundary. **Written by**: the executing agent, appending only.
> Write repo-relative: no absolute paths, no references to other private repos.

<!-- Entry format — copy per phase:

## Phase N — Title (YYYY-MM-DD)

- **Executor**: model + effort actually used.
- **Result**: done | partial | blocked.
- **Evidence**: verification commands run and their outcomes (test counts, build
  results). Claims without evidence don't belong here.
- **Deviations from plan**: none, or what changed and why — with the plan amended in the
  same change.
- **Decisions**: links to any docs/decisions/ records created.
- **Notes for the next phase**: anything the next executor must know.
-->

## Phase 1 — The two columns, empty (2026-09-25)

- **Executor**: `backend` agent on opus (definition effort `medium`), in its own worktree;
  brought into the main checkout and the worktree removed. Migration reviewed by
  `migration-reviewer` (opus @ high).
- **Result**: done.
- **Evidence**:
  - Migration `0041_an_ingredient_names_its_meals_and_season.sql` is exactly two statements:
    `ALTER TABLE "ingredients" ADD COLUMN "meal_slots" text[] DEFAULT '{}' NOT NULL` and
    `… "season_months" smallint[] DEFAULT '{}' NOT NULL`. Re-running `generate` reports no
    schema changes; journal and snapshot chain intact (0041 points back to 0040).
  - `migration-reviewer`: no P0/P1/P2. No data lost; a metadata-only column add (constant
    default, no rewrite), lock held for milliseconds; the old API survives the deploy
    (it names its columns and never inserts ingredients); a code rollback needs no schema
    change. The seed against a 0040 database fails loudly at the first ingredient insert,
    before any partial write beyond the idempotent allergens upsert — `migrate` first.
  - `pnpm turbo lint ts:check test`: 21 of 21 tasks (core 717 tests, api 741, database 29).
  - `gate.sh --full`: migrations, checks, web-build, static, format, deadcode, leaks — green.
- **Deviations from plan**:
  - `PlanRepository` never builds a `CatalogueIngredient`; `RecipeRepository.loadCatalogue`
    is the only builder. The phase's Scope is amended to say so.
  - The seed types `MealSlot` from the database's own `meal_slot` pgEnum: `core` depends on
    `database`, so importing it from `core` would reverse the chain.
  - Fixtures in `apps/api/src` (five specs) needed the two fields too; the Scope now names
    them. `PoolPrompt.spec.ts:208` casts a partial `{ category, name, slug }` object and was
    left as it is — nothing reads the new fields there yet.
- **Decisions**: none new ([`0062`](../../decisions/0062-each-meal-sees-its-own-foods-and-the-season.md) stands).
- **Notes for the next phase**:
  - Both overlays are empty maps: `ONLY_AT` in `seed/ingredients/meals.ts`, `IN_SEASON` in
    `seed/ingredients/seasons.ts`. Phase 2 fills them.
  - Neither column is checked in the database (`text[]`, not the enum; no 1–12 check): only
    the seed writes them, through TypeScript types. Phase 2's tests are the check.
  - Phase 3 will make `PoolPrompt.spec.ts:208`'s partial fixture need both fields.
  - Owner-gated before phase 2 can be measured: `pnpm --filter database migrate`, then
    `pnpm --filter database seed`, against the dev database.

## Phase 2 — The lists, drafted and reviewed (2026-09-25)

- **Executor**: `backend` agent on opus (definition effort `medium`), in its own worktree;
  brought into the main checkout and the worktree removed. The lead wrote this entry: the
  agent's ownership hook does not let it write under `docs/`.
- **Result**: done — both lists approved by the owner on 2026-09-25, with four changes, and
  lunch and dinner cut a second time (`0063`).
- **Evidence**:
  - `pnpm --filter database test`: 4 files, 42 tests (13 new in `meals.test.ts` and
    `seasons.test.ts`: every slug exists, each named once, only `meal_slot` values, months
    1–12 ascending, no list empty or complete, supper ⇔ afternoon snack, season rows are
    `produce` only).
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api`: 11 of 11.
    `pnpm deadcode` clean.
  - `catalogue-by-meal.mjs` against dev (migrated, not yet re-seeded with the lists): every
    list empty, "after" = "before". With the overlays applied in memory (nothing written)
    it gives the table below; the run after re-seeding must reproduce it.
- **Per slot** (rows; tokens at 6 per row; library dishes servable, before → after;
  `DISHES_NEEDED_PER_SLOT` = 19):

  | Slot | Omnivore rows | Omnivore tokens | Omnivore dishes | Vegan rows | Vegan tokens | Vegan dishes |
  | --- | --- | --- | --- | --- | --- | --- |
  | breakfast | 930 → 474 | 5,580 → 2,844 (−49.0%) | 228 → 155 | 606 → 382 | 3,636 → 2,292 (−37.0%) | 38 → 25 |
  | morning_snack | 930 → 546 | 5,580 → 3,276 (−41.3%) | 143 → 119 | 606 → 412 | 3,636 → 2,472 (−32.0%) | 52 → 43 |
  | lunch | 930 → 806 | 5,580 → 4,836 (−13.3%) | 342 → 339 | 606 → 532 | 3,636 → 3,192 (−12.2%) | 59 → 59 |
  | afternoon_snack | 930 → 546 | 5,580 → 3,276 (−41.3%) | 208 → 178 | 606 → 412 | 3,636 → 2,472 (−32.0%) | 61 → 53 |
  | dinner | 930 → 784 | 5,580 → 4,704 (−15.7%) | 348 → 240 | 606 → 531 | 3,636 → 3,186 (−12.4%) | 51 → 48 |
  | supper | 930 → 546 | 5,580 → 3,276 (−41.3%) | 58 → 42 | 606 → 412 | 3,636 → 2,472 (−32.0%) | 9 → 8 |

  Omnivore library 942 dishes, 154 left with no meal; vegan 186, 23 left with none. Largest
  dinner losses: `garbanzos-cocidos` 41, `alubias-blancas-cocidas` 16, `arroz-bomba-crudo`
  15, `lentejas-cocidas` 15, `alubias-negras-cocidas` 11. The vegan supper was short of 19
  before and after (9 → 8).
- **Lunch does not reach −45%.** Its catalogue shrinks 13.3% for an omnivore, 12.2% for a
  vegan; the whole lunch prompt about 9%. PRD 2 (≤ 55% of 3.4.0) would need the lunch
  catalogue near ~300 rows; nearly everything belongs at lunch, and the lists were not
  tagged to chase the number. Owner decision needed before phase 4.
- **Lists for review**: `packages/database/src/seed/ingredients/meals.ts` (551 rows, one
  commented group per rule) and `seasons.ts` (87 produce rows; MAPA "Frutas de temporada"
  and "Hortalizas de temporada", higher trade level only, the five greenhouse vegetables on
  open-field months, 31 rows from general market calendars). Pulses out of dinner, supper
  and breakfast (lunch only): dry and cooked lentils, chickpeas, beans, `habas-secas`,
  `judiones`, `soja-cocida`, `soja-en-grano`, `lentejas-rojas-cocidas` and the tinned pulse
  stews; light forms (hummus, roasted chickpeas, edamame, lupins, refried beans, chickpea
  flour) out of breakfast only; pulse pasta lunch and dinner. Raw meat and fish, stocks,
  meat and fish sauces and ready meals: lunch and dinner; tinned fish and cured sausages:
  every meal but breakfast; eggs, ham, cold cuts, smoked fish and tofu everywhere.
- **Unsure — for the owner**: (1) `bebida-energetica` has no plausible meal; left with no
  entry. (2) Supper = afternoon snack puts coffee and tea at supper. (3) `arroz-bomba-crudo`
  lunch only costs 15 library dinners. (4) Tender broad beans and peas are cooking
  vegetables (lunch, dinner), not lunch-only pulses. (5) Pulse pasta follows the pasta rule.
  (6) The vegan exception covers only the protein aisle: `lentejas-rojas-cocidas` (pantry)
  stays lunch-only for vegans, `soja-texturizada` lunch and dinner. (7) Library breakfasts
  lost to `atun-al-natural` (7), `pavo`/`pechuga-de-pavo` (5 each). (8) Left everywhere
  though arguable: `sobrasada`, packaged tortilla, cheeses, crackers, table sauces, fresh
  peppers, sweetcorn, `patata`. (9) `bacon` keeps breakfast. (10) Packaged ensaladilla and
  gazpacho lunch and dinner; `nachos` snacks only. (11) Protein powders breakfast and
  snacks. (12) `lichi` and `pitaya` are imported or barely grown in Spain.
- **Deviations from plan**: the lists do not meet PRD 2 for lunch (not forced). The script's
  row in `apps/api/AGENTS.md` lands now, not in phase 5. The script carries `0062`'s fit
  rule itself until phase 3's `MealFit` exists; phase 3 switches it over.
- **Owner's review (2026-09-25)**: both lists approved as drafted, with four changes —
  (1) `bebida-energetica` in no meal (`['none']`, `0063` § 3); (2) no coffee or tea at
  supper (`cafe-*`, `te-*`: breakfast and the day's snacks); (3) `arroz-bomba-crudo` lunch
  and dinner, `paella-congelada` stays lunch; (4) `lentejas-rojas-cocidas` and
  `soja-texturizada` moved to the protein aisle so the plant-based exception covers them,
  and the seed now overwrites `category` on an existing row. On PRD 2, the owner chose a
  second cut for lunch and dinner: what the library cooks there, the in-season produce and
  a rotating sample (`0063`), implemented in phase 4 (plan amended).
- **After the review** — dev re-seeded with the approved lists (`pnpm --filter database
  seed`: 930 ingredients), then `catalogue-by-meal.mjs` from `apps/api`, omnivore:
  breakfast 930 → 473 (−49.1%, dishes 228 → 155), morning snack 930 → 545 (−41.4%,
  143 → 119), lunch 930 → 805 (−13.4%, 342 → 339), afternoon snack 930 → 545 (−41.4%,
  208 → 178), dinner 930 → 784 (−15.7%, 348 → 251), supper 930 → 540 (−41.9%, 58 → 42);
  153 of 942 dishes left with no meal. Vegan: breakfast 606 → 383, morning snack 413,
  lunch 531, afternoon snack 413, dinner 532 (dishes 51 → 51), supper 408 (9 → 8, short of
  19 before and after); 20 of 186 with no meal. Every omnivore slot keeps ≥ 19 dishes.
- **Verification after the changes**: `pnpm --filter database test` 43 tests;
  `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api` 11/11;
  `gate.sh --full` green.
- **Decisions**: [`0063`](../../decisions/0063-lunch-and-dinner-see-what-the-library-cooks-plus-a-rotating-sample.md).
- **Notes for the next phase**: after approval, `pnpm --filter database seed` on dev and
  `node --env-file-if-exists=.env scripts/catalogue-by-meal.mjs` from `apps/api`, which must
  match the table.

## Phase 2 — production seed (2026-09-25)

- The owner re-ran `pnpm --filter database seed` against production after `40899e1` deployed
  (reported as running when phase 3 started); both lists take effect there once it ends.

## Phase 3 — Which meals a dish may be served at (2026-09-25)

- **Executor**: `backend-high` agent on opus (definition effort `high`, the phase's
  `quality-max`), in its own worktree; brought into the main checkout and the worktree
  removed. The two dictionary lines by the lead (frontend's files). Reviewed by
  `invariant-reviewer` (opus @ high).
- **Result**: done.
- **Evidence**:
  - `MealFit` (`packages/core/src/domain/MealFit/`): `belongsTo(ingredient, slot,
    dietaryPatterns)` — `['none']` first and false everywhere, then empty or naming the
    slot, then the plant-based exception (protein aisle, no `animal` class, for `vegan` or
    `vegetarian`); `fitSlots(dish, catalogue, dietaryPatterns)` — the dish's own slots, in
    order, where every ingredient belongs, a missing slug narrowing nothing;
    `inSeason(ingredient, month)`, unused until phase 4.
  - `reusablePool` narrows every library dish after the existing filters and before
    `rotatePool`, dropping a dish left with none. `PoolBuilder.validate` narrows a model
    dish last, after every existing gate, and rejects one left with none as `wrong_meal`.
  - Tests: core 739 (22 new: 18 in `MealFit.test.ts`, 4 in `RecipeController.test.ts`
    including one that fails if narrowing ran after rotation); api 748 (7 new in
    `PoolBuilder.spec.ts`, including "the allergy gate still counts first"); database 43.
  - `gate.sh --full`: green.
  - `plan-evaluator` (`evaluate-plans.mjs --compare` against `main`, dev seeded with phase
    2's lists): 11 profiles, none worse — `objetivo-bajo-3-comidas` better (worst deviation
    5.1% → 5.0%, days inside 13 → 13), the other ten the same (14/14 where they were);
    no plate carried a declared allergen. Pools shrink as expected (gluten-free 520 → 449,
    lactose-free 560 → 469 dishes).
  - `invariant-reviewer`: no P0/P1/P2. Allergy and preference gates unchanged in inputs and
    order (an unsafe dish is still `allergen` first); `MealFit` only removes slots; nothing
    new crosses the health boundary (the patterns reach no new prompt, log or analytics
    line); nothing about who may read what changed. Every path that places a dish —
    generation (rotated pool, backfill, whole-library rescue, both retries), swap (the
    professional's included), event rebuild — goes through one of the two changed places.
  - `catalogue-by-meal.mjs`, now on `MealFit`, reproduces phase 2's table.
- **Deviations from plan**:
  - `GenerationContext` gains `dietaryPatterns`: `reusablePool` had no way to read them;
    they come from the `ProfileRepository.findDietaryPatterns` read `buildContext` already
    made, and `PoolBuilder` uses the same source so library and model are narrowed alike.
  - `DishRejection` lives in `AiCall.ts`, outside the listed scope; the `/admin` label
    (`admin.rejection.wrong_meal`: "comida equivocada" / "wrong meal") in both dictionaries.
  - `catalogue-by-meal.mjs` switched to `MealFit` now rather than in phase 4;
    `evaluate-plans.mjs` passes the vegetarian profile's patterns so it is measured with the
    exception. Scope amended.
  - A generated dish is stored with its narrowed slots (`toRecipeDraft`): a stew the model
    claimed for lunch and dinner is stored lunch-only after an omnivore's generation. Safe —
    every read narrows again — but the stored `meal_slots` reflect the person who generated
    it. Recorded, not changed (reviewer P3).
- **Decisions**: none new.
- **Notes for the next phase**:
  - Per-slot `safeIngredients`: `belongsTo(ingredient, slot, context.dietaryPatterns)`.
  - `inSeason` orders produce, never filters it.
  - `0063`'s library-usage read must narrow each recipe with `fitSlots` for the person
    rather than trust the stored `recipes.meal_slots` (reviewer P3 above).
  - `PoolPrompt.spec.ts:208`'s partial fixture will need `mealSlots` and `seasonMonths`.
  - `catalogue-by-meal.mjs` already uses `MealFit`; phase 4 adds only the `0063` cut.
  - `wrong_meal` counts on `/admin` should fall near zero once 3.5.0 shows each slot only
    its own catalogue.
  - Tell `tests` when the e2e suites run: dev holds phase 2's lists, so a suite expecting a
    pulse dish at dinner, or a count per slot, may see fewer; dinner swaps may answer the
    409 "no dish fits" more often on a thin library. No route, view or error code changed.

## Phase 4 — Prompt 4.1.0 (2026-09-25)

- **Executor**: `backend-high` agent on opus (definition effort `high`), in its own
  worktree; brought into the main checkout and the worktree removed. No model or gateway
  call; dev read in read-only transactions only.
- **Result**: done.
- **Evidence**:
  - Each slot's request lists only its own catalogue (`belongsTo`, after the allergy and
    preference filters, which are unchanged); lunch and dinner are cut a second time by
    `MealFit.mealCatalogue` (`0063`): the ingredients the library uses at that meal
    (re-narrowed per person with `fitSlots`), the produce in season, and a sample of 30
    seeded by the job id (`swap:<mealId>` on a swap), combined with the slot. A meal with
    fewer than 19 fitting library dishes is not cut. In-season produce first under "In
    season now (prefer these):"; lunch and dinner character lines; supper takes the
    snack's; a vegan or vegetarian dinner asks for pulses in light forms; the spread rule
    names legumes only where the meal offers them. `PROMPT_VERSION` 4.1.0,
    `STEPS_VERSION` unchanged.
  - Usage read: one query over `recipe_ingredients` (≈6,000 rows, ≈0.6 s to Neon), run in
    parallel with the two existing library reads; a swap reads it only when it goes to
    the model.
  - `catalogue-by-meal.mjs --month 9 --seed job-check` on dev (lead's run), omnivore,
    prompt characters 3.4.0 → 4.1.0: breakfast 63.0%, snacks 68.8%, **lunch 23,185 →
    12,406 (53.5%)** with 930 → 805 → 346 rows, **dinner 51.9%** (784 → 320), supper
    68.5%. Vegan: lunch 64.4%, dinner 63.9% (their 3.4.0 baseline is already 606 rows;
    61.6% even with no sample). Agent's tuning, omnivore lunch worst case over 12 months ×
    8 seeds: sample 0 → 52.0%, 30 → 54.8%, 40 → 55.7%, 60 → 57.4%.
  - `PoolPrompt.spec.ts` (step 7) on a synthetic 930-row catalogue shaped like dev's:
    23,120 → 12,573 characters, 54.4% ≤ 55%; an omnivore's dinner has no lunch-only slug
    and does not name legumes; a vegan's dinner has the pulses; in-season rows precede
    the rest.
  - Seasonings survive the cut: all 16 checked at omnivore and vegan lunch and vegan
    dinner; omnivore dinner missed only `vinagre-de-manzana`, other vinegars present.
  - Tests: core 757 (+18), api 763 (+15), database 43. `gate.sh --full` green.
- **Deviations from plan**: version 4.1.0, not 3.5.0 (Legal A shipped 4.0.0); sample 30,
  not 60 (tuned to PRD 2); the usage read spans every language (`decisions/LOG.md`
  2026-09-25); the cut lives in core's `MealFit`, called by `PoolBuilder` and the script;
  "legumes" leaves the spread rule by a rule (every plant protein that belongs at lunch
  also belongs here), since the catalogue has no pulse class. Scope amended.
- **Decisions**: `decisions/LOG.md` 2026-09-25 (`0063` § 1 across languages; sample 30).
- **Notes for the next phase**:
  - `catalogue-by-meal.mjs --month N --seed S` already prints 3.4.0 vs 4.1.0 prompt
    characters per meal — phase 5 step 3 is a run of it (build core, database, api first).
  - The margin is thin (54.8% worst case). The library's usage grows as dishes are
    generated, pushing lunch up; re-measure before raising the sample.
  - `evaluate-plans.mjs` should not move: no scheduling or reuse changed here.
  - Vegan supper still short of 19 (9 → 8), as before.
