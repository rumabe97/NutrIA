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

## Phase 5 — Offline quality, and production (2026-09-25)

- **Executor**: the lead (Opus 5.5) directly — measurement and documentation, no code.
- **Result**: done.
- **Evidence**:
  - `evaluate-plans.mjs --compare` on `main` at `2cdf4d8` (phases 3 and 4) against the run
    on `40899e1` (before any narrowing), dev seeded with the lists: 11 profiles, none worse,
    `objetivo-bajo-3-comidas` better (worst deviation 5.1% → 5.0%, 13/14 days as before),
    the other ten the same, 14/14 where they were; no plate carried a declared allergen
    (exit 0). PRD 6.
  - Library dishes servable per slot (`catalogue-by-meal.mjs`), omnivore: breakfast
    228 → 155, morning snack 143 → 119, lunch 342 → 339, afternoon snack 208 → 178, dinner
    348 → 251, supper 58 → 42 — every slot ≥ 19. Vegan: every slot ≥ 19 except supper,
    9 → 8, short before the project too; generation asks the model for the gap.
  - Prompt size, 3.4.0 → 4.1.0 characters, omnivore (`--seed phase5`): January — lunch
    23,185 → 12,528 (54.0%), dinner 52.1%, breakfast 63.0%, snacks 68.8%, supper 68.5%;
    July — lunch 54.0%, dinner 52.1%. September (phase 4 run) lunch 53.5%. Vegan lunch
    ~64.6%, dinner ~64.5%. PRD 2 met for the standard lunch.
  - No allergy check changed: `dishSafety`, `isSafeIngredient` and the preference
    exclusions are untouched since phase 3's review.
  - owner-gated, done: the owner re-ran `pnpm --filter database seed` against production
    after phase 2 deployed (confirmed by the owner, 2026-09-25).
  - Docs: `ARCHITECTURE.md` (the exception-list columns; each meal sees its own foods),
    `reference/ai-gateway.md` § 5 (what a request weighs; no prompt caching measured),
    `ROADMAP.md` § 7 (phases 1–5 in production). The script's row in `apps/api/AGENTS.md`
    landed in phase 2.
- **Deviations from plan**: the comparison baseline is the run before phase 3 on dev with
  the lists seeded, which covers phases 3 and 4 together.
- **Decisions**: none new.
- **Notes for the next phase**:
  - The lunch request is ~4,100 tokens of input; four dishes of output were ~2,500–3,500
    tokens on the models measured in the audit. One request fits Groq's 8,000 tokens a
    minute; several at once do not.
  - `bench-models.mjs` can reuse `catalogue-by-meal.mjs`'s prompt builder from the built
    api and `MealFit.mealCatalogue` for the cut.

## Phase 6 — The free models, measured (2026-09-25)

- **Executor**: `backend` agent on opus (definition effort `medium`), in its own worktree;
  brought into the main checkout and the worktree removed. The lead wrote the docs (the
  agent's ownership hook does not reach `docs/`).
- **Result**: done — the phase 7 choice waits on the owner (owner-approves).
- **Evidence**:
  - `apps/api/scripts/bench-models.mjs`: the real 4.1.0 prompt over the dev catalogue cut
    by `mealCatalogue` as `PoolBuilder` cuts it (read-only, refuses production), sent as
    `json_schema` non-strict; scores with `generatedDishSchema`, unknown and not-shown
    slugs, `fitSlots`, `methodMentions` and per-serving macros against the brief; records
    status, seconds, finish reason, tokens (in, out, cached, reasoning) and the
    `x-omniroute-*` headers. Refuses any id not ending `:free` or starting `groq/`, and any
    Gemini id; prints the call count and needs `--yes`; takes the key's variable name
    (`--key-env`), never a value, and scrubs it from anything written. `--summarise <dir>`
    rebuilds the table without calling anything.
  - The run: one free `GET /models`, then 42 calls (7 models × 6 briefs: 12 Groq, 30
    OpenRouter), key `OMI_ORACLE`, `--month 9 --seed phase6`. The dated table is in
    `docs/reference/ai-gateway.md` § 7. In short: `gpt-oss-120b` 0/6 (400
    `json_validate_failed`); Groq `qwen3.8-27b` 5/6 in ~5 s but 2 of 14 dishes valid,
    names and steps that do not match their ingredients; OpenRouter `qwen3.8-27b:free` 0/6
    (429); `dots-3-note:free` 1/6 in 195 s, good dishes, no cues; `nex-n2.5-pro:free` 0/6;
    `nemotron-3-super:free` 0/6 (502/504/timeouts); `nemotron-3-ultra:free` 2/6 in ~143 s,
    9 of 12 dishes valid, the best Spanish and steps. No answered call reused cached tokens.
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api` green;
    `pnpm deadcode` clean. The script, like the other `.mjs` scripts, is outside ESLint's
    project config; `node --check` passes.
- **Deviations from plan**: the standard day is the 2,400 kcal one the prompt spec and
  `catalogue-by-meal.mjs` use; six dishes asked per brief; the prompt is 4.1.0, not 3.5.0.
  Five timeouts fired late (276 s) because a unit-test run starved the machine; marked
  stalled.
- **Recommendation for phase 7** (the owner decides):
  - No free model carries generation alone. The only usable one is
    `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free`, answering 2 of 6 at ~143 s. The
    opencode models (`muse-spark`, `mimo`) are no longer reachable through the gateway (the
    owner, 2026-09-24), so they were not measured.
  - Lever 1, fewer dishes per request: supported — output is what costs time (4–8k output
    tokens for 6 dishes); a cap of 3 should roughly halve it (hypothesis).
  - Lever 2, pacing to `AI_TOKENS_PER_MINUTE`: not supported for this combo — OpenRouter's
    free limit is requests (20 a minute, 50 a day), not tokens; the only token limit
    measured is Groq's (8,000 a minute, and 1,000 output a minute on `qwen3.8-27b`), and no
    Groq model makes the combo.
  - Lever 3, size and rate refusals fall through: supported — 429 was the commonest error
    (10 of 42), then 502/504.
- **For the owner's gateway (hypotheses)**: Groq output appears capped at 2,048 tokens by
  the gateway; one OpenRouter model's rate limit appears to shut out the others.
- **Decisions**: none yet — phase 7 waits on the owner.

## Phase 7 — A fortnight on paid, no-training models (2026-09-26)

- **Executor**: `backend-high` (opus @ high) for the provider, the split and the review fixes;
  `backend-low` for provider sort/reasoning cap and the allowed list; `backend-high` for the
  output cap, slug repair, provider ignore and prompt 4.2.0; `frontend-low` for the privacy
  page (shipped separately, #116); `legal` for every legal text; `architect` for reports
  `0002`; `invariant-reviewer` twice. Paid measurements by the lead, with a temporary key the
  owner gave (2 € cap), `bench-models.mjs --allow-paid` and full fortnights through the local
  API on dev.
- **Result**: done in code; production stays on `AI_PROVIDER=stub` until the owner closes the
  legal checklist (human-verify pending).
- **Evidence**:
  - Model choice (`0064`), 8 briefs × 3 dishes, every request ZDR + `data_collection: deny`:
    `deepseek/deepseek-v4.1-flash` at low reasoning 1.5 points of split error (muse-spark ≈ 11),
    37 s median alone; MiniMax M3 8.7 points, 14 s. Mistral and paid Nemotron 429 on their ZDR
    endpoints; Qwen 3.8 Flash 404 (no ZDR endpoint).
  - Full fortnights (4 profiles: omnivore 3 meals, omnivore 5 meals, vegan 4, allergic to milk
    and tree nuts): **14/14 days inside 5% on all four macros in every run**. With reasoning
    `low` (and `minimal`, the same), parallel requests ran 109–128 s median and the 5-meal
    fortnight kept 1–2 fresh dishes (10–11 of 13 requests at the 170 s budget). With
    reasoning off + `sort: throughput` + output cap + slug repair: the 5-meal fortnight in
    67 s, 8 s median per request, 0 timeouts, 21 fresh dishes kept, 0.038 $. Restricted to the
    legal allowed list (`only: deepinfra, coreweave`): 89 s, 8 s median, 0 timeouts, 11 of 21
    kept, 3 invalid answers, 0.032 $.
  - Paid spend of the temporary key: ~1.47 $ of 2 $.
  - `invariant-reviewer`: no P0; a P1 (`AI_BASE_URL` could send the key elsewhere — boot now
    refuses any host but `https://openrouter.ai`), P2s (refusal bodies echoing the request —
    dropped; bench trusting the endpoint — refused; slug repair raw/cooked twins and
    uniqueness among shown slugs only — fixed), P3s fixed; missing tests added.
  - Gate: api 827 tests, core 769, database 43; `gate.sh --full` green (see the PR).
- **Deviations from plan**: reasoning off, not low (measured); additions beyond the plan —
  `AI_PROVIDER_SORT`, `AI_PROVIDER_IGNORE`, `AI_PROVIDER_ONLY` (required, legal P1-12),
  `AI_REASONING_MAX_TOKENS`, `AI_MAX_OUTPUT_TOKENS_PER_DISH`, a near-miss slug repair
  (`MealFit/SlugRepair.ts`, `repaired` on the call record), prompt 4.2.0 (produce in three
  season groups). Production switched to `stub` on 2026-09-26 (owner's word) because every
  step of the old combo trained on the data.
- **Decisions**: [`0064`](../../decisions/0064-generation-runs-on-paid-no-training-models-through-openrouter.md);
  `decisions/LOG.md` 2026-09-26.
- **Before the switch (owner)** — `docs/legal/checklist-activacion.md` § 0 bis: OpenRouter's
  DPA in hand and confirmed for a paid account (P1-11); allowed providers DeepInfra and
  CoreWeave in the account (P1-12); MiniMax either attributed ("Built with MiniMax M3" + notice)
  or removed as fallback (P1-13); the topic-tagging sample accepted or not (P2-12); publish
  `/privacidad` state 2 and send the e-mail in `textos/06` § G; then, the next day, in Vercel:
  `AI_PROVIDER=openrouter`, `OPENROUTER_API_KEY` (sensitive), `AI_MODEL=deepseek/deepseek-v4.1-flash`,
  `AI_FALLBACK_MODELS` (or empty), `AI_REASONING_EFFORT=none`, `AI_PROVIDER_SORT=throughput`,
  `AI_PROVIDER_ONLY=deepinfra,coreweave`, `AI_BASE_URL` empty, `AI_REWRITE_STEPS=false`.
