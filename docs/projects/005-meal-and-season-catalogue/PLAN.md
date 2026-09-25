# Plan — Project 005: Each meal sees its own foods, in season

> **Purpose**: the phased technical execution plan — the engineering half of the
> contract. `/execute-project` follows this literally; executors implement phases, they
> do not redesign them. If implementation must diverge, the plan is amended in the same
> change and the deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes.

- **Status**: approved — by the owner, 2026-09-25
- **Type**: standard
- **PRD**: [./PRD.md](./PRD.md) — every acceptance criterion is mapped at the end of this file.
- **Routing profile**: `tiered`. Phase 3 narrows which meals a model's dish may be served
  at, which is AI output validation, and runs at `quality-max` as `AGENTS.md` § Model
  routing requires. Phase 4 rewrites the generation prompt and runs at `opus @ high`: the
  prompt is where plan quality is won or lost, and it cannot be measured live on Gemini
  (PRD § Out).

## Design summary

Recorded in [`0062`](../../decisions/0062-each-meal-sees-its-own-foods-and-the-season.md):

- **Two catalogue columns, both exception lists.** `ingredients.meal_slots` (text[]) and
  `ingredients.season_months` (smallint[]). Empty means every meal, every month — the
  `countries` pattern (`0034`). The seed fills them from two overlays beside
  `seed/ingredients/countries.ts`: `meals.ts` and `seasons.ts`, naming exceptions only.
- **One domain module decides fit**, `packages/core/src/domain/MealFit/`: whether an
  ingredient belongs to a meal for this person (with the plant-based exception), which
  meals a dish may be served at (the intersection of its own slots and its ingredients'),
  and whether an ingredient is in season in a month.
- **Three places use it**: the pool prompt's catalogue per slot (`PoolBuilder`), the
  library's reusable pool (`RecipeController.reusablePool`), and the model's returned
  dishes (`PoolBuilder`'s gates). Dishes are narrowed, never rewritten; one whose meals
  narrow to nothing is dropped.
- **The prompt goes to 3.5.0**: one meal's catalogue, in-season produce first and marked
  for the fortnight's starting month, and a line saying what lunch and dinner are.
- **Lunch and dinner are cut a second time** ([`0063`](../../decisions/0063-lunch-and-dinner-see-what-the-library-cooks-plus-a-rotating-sample.md),
  amended after phase 2 measured −13% and −16% from the lists alone): what the library
  cooks at that meal, the in-season produce, and a sample drawn afresh per generation. A
  row may belong to no meal (`['none']`), and the seed owns the aisle.
- **Last, the free models**: a committed benchmark measures them on the new prompt with
  free calls only; then the pool builder is changed so a fortnight fits their limits.

Nothing takes effect in a database until its seed is re-run there
(`docs/reference/deployment.md`, step 6). Until then both columns are empty and every
path behaves exactly as on 3.4.0 — which is also what makes phases 1–4 safe to merge one
at a time.

## Phases

### Phase 1 — The two columns, empty

- [x] done — commit `f1946f9` ("Project 005 phase 1: an ingredient can name its meals and its season, still empty")
- **Dispatch**: opus @ medium — `/execute-project 005 phase 1`
- **Goal**: the catalogue can say which meals and months an ingredient belongs to, and
  every reader gets the lists, with nothing filled in yet.
- **Scope**: `packages/database/src/schemas/food.schema.ts`, a new migration under
  `packages/database/src/migrations/`, `packages/database/src/seed/` (types, `index.ts`,
  two new overlay files), `packages/core/src/entities/Plan/Plan.ts`
  (`CatalogueIngredient`), the repository that builds a `CatalogueIngredient`
  (`packages/core/src/repositories/Recipe/RecipeRepository.ts` — `loadCatalogue` is the
  only one; amended in phase 1, see LOG), their tests, and every test fixture that builds a
  `CatalogueIngredient` by hand, in `packages/core` and `apps/api/src`.
- **Steps**:
  1. Add to `ingredients`: `mealSlots: text().array().notNull().default([])` and
     `seasonMonths: smallint().array().notNull().default([])`, each with a doc comment
     that says *empty means every meal / every month* and points at `0062`.
  2. `pnpm --filter database generate`; keep the generated SQL to two
     `ADD COLUMN … DEFAULT '{}' NOT NULL` statements — no backfill, no lock beyond that.
  3. Add `seed/ingredients/meals.ts` exporting `mealSlotsFor(seed): readonly MealSlot[]`
     and `seed/ingredients/seasons.ts` exporting `seasonMonthsFor(seed): readonly number[]`,
     each returning `[]` for every slug for now, with a header comment in the style of
     `countries.ts` explaining the exception-list rule. Wire both into `seed/index.ts`
     beside `classes` and `countries`, in the insert and in `onConflictDoUpdate`.
  4. Add `mealSlots: readonly MealSlot[]` and `seasonMonths: readonly number[]` to
     `CatalogueIngredient`; select and map them wherever the repositories build one.
  5. Fix every fixture that constructs a `CatalogueIngredient` (`[]` for both).
- **Acceptance criteria**: PRD 1 (the columns and their default).
- **Verification**:
  - `pnpm turbo lint ts:check test`
  - `sh .claude/skills/ship/scripts/gate.sh --full <scratchpad>`
  - `migration-reviewer` reads the migration and reports no destructive or locking step.
  - owner-gated: `pnpm --filter database migrate` against the dev database (the
    classifier blocks agent writes to Neon), then `pnpm --filter database seed`.

### Phase 2 — The lists, drafted and reviewed

- [x] done
- **Dispatch**: opus @ medium — `/execute-project 005 phase 2` — owner-approves: the meal
  list and the season list, before the phase is committed
- **Goal**: the two overlays hold the real exceptions, and a committed script shows what
  each meal's catalogue becomes.
- **Scope**: `packages/database/src/seed/ingredients/meals.ts`, `seasons.ts`, their
  tests, and a new read-only script `apps/api/scripts/catalogue-by-meal.mjs` (and its row
  in `apps/api/AGENTS.md`). Amended at the owner's review (`0063`): `types.ts`
  (`MealEntry`, for `none`), `starter.ts` (two rows to the protein aisle), `seed/index.ts`
  (the seed overwrites `category`), and `CatalogueIngredient.mealSlots` in core, which now
  admits `none`.
- **Steps**:
  1. **Meals.** Name, per slug, the meals it belongs to, only where that is not all of
     them. Use `MEAL_SLOTS` values. Rules the draft follows, each stated in the file's
     header so a reviewer can check a row against them:
     - Stewed or dry pulses (dry and cooked lentils, chickpeas, beans, broad beans, tinned
       pulse stews): `lunch` only. Light pulse forms (hummus and its variants, roasted
       chickpeas, chickpea flour, pulse pasta): every meal but `breakfast`.
     - Raw meat and fish cuts, offal, whole stews and tinned stews: `lunch`, `dinner`.
     - `supper` gets the snacks' foods (PRD § Open questions): anything allowed in
       `afternoon_snack` is allowed in `supper`.
     - Drinks other than milks and plant drinks, and frozen ready meals: the meals they
       are actually drunk or eaten at. A row with no plausible meal is not given an empty
       list (that would mean every meal): name it in the LOG for the owner to decide.
     - Staples (salt, oil, spices, garlic, onion, lemon, vinegars, herbs): no entry.
  2. **Seasons.** For every `produce` slug that is fresh fruit or vegetable, the months
     it is in season in Spain (1–12). Year-round produce (onion, garlic, potato, carrot,
     lemon, banana, dried or tinned forms) gets no entry. Name the calendar used in the
     file header (e.g. the Spanish agriculture ministry's seasonal calendar), as a
     provenance note.
  3. Tests: every slug in either overlay exists in the catalogue seed; every meal is a
     `MEAL_SLOTS` value; every month is 1–12; no list is empty (an empty list would mean
     "everywhere", which is the default and should be no entry).
  4. `apps/api/scripts/catalogue-by-meal.mjs`, modelled on `evaluate-plans.mjs` (refuses
     production, one read-only transaction, calls no model): for each slot, the
     catalogue rows an omnivore and a vegan would be shown, the approximate prompt tokens
     that catalogue costs (6 per row, the ratio measured on 3.4.0), and the library
     dishes that stay servable at that slot once narrowed. `--json <file>` to keep a run.
  5. Write to LOG.md, for the owner's review: per slot, rows and estimated tokens before
     and after; the full list of pulse and meat rows moved out of dinner and breakfast;
     every produce row with its months; anything the draft was unsure of.
- **Acceptance criteria**: PRD 1 (lists filled and approved), 3 (the pulse rows), 4 (the
  months).
- **Verification**:
  - `pnpm --filter database test`
  - After the owner re-seeds dev: `node --env-file-if-exists=.env scripts/catalogue-by-meal.mjs`
    from `apps/api`, and its output pasted into LOG.md.
  - owner-approves: both lists, row by row where they want to.

### Phase 3 — Which meals a dish may be served at

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 005 phase 3` — `quality-max`: narrows AI
  output (see Routing profile)
- **Goal**: a dish is only ever placed at meals every one of its ingredients belongs to,
  for this person, from the library and from the model alike.
- **Scope**: new `packages/core/src/domain/MealFit/` (index, implementation, tests),
  `packages/core/src/controllers/Recipe/RecipeController.ts` (`reusablePool`),
  `apps/api/src/modules/ai/services/PoolBuilder.service.ts` (the gate on returned
  dishes) and their specs.
- **Steps**:
  1. `MealFit`:
     - `belongsTo(ingredient, slot, dietaryPatterns)`: true when `mealSlots` is empty or
       contains `slot`, or when the person's patterns include `vegan` or `vegetarian`
       and the ingredient is in the `protein` category with no animal class (`0062`,
       plant-based exception). `['none']` belongs nowhere, the exception included
       (`0063`).
     - `fitSlots(dish, catalogue, dietaryPatterns)`: the dish's own `slots` filtered to
       those every ingredient `belongsTo`. An ingredient missing from the catalogue does
       not narrow anything here — the existing unknown-ingredient gate handles it.
     - `inSeason(ingredient, month)`: true when `seasonMonths` is empty or contains
       `month`.
  2. `reusablePool`: replace each usable recipe's slots with `fitSlots`; drop a recipe
     whose result is empty. Do this before `rotatePool`, so rotation counts only what
     can be served.
  3. `PoolBuilder`: after the existing gates accept a returned dish, narrow its slots
     with `fitSlots`; a dish that narrows to nothing is rejected with a new
     `DishRejection` value `wrong_meal`, counted like the others and shown on `/admin`
     through the existing `rejected` record. Add the value to the `DishRejection` type
     and to wherever `/admin` labels the reasons (both dictionaries if it is shown).
  4. Tests, with fixtures that set `mealSlots`: a lentil stew tagged lunch-only served
     at lunch and not at dinner; the same for a vegan person served at both; a dish of
     staples untouched; a model dish that claims only `dinner` and uses a lunch-only
     ingredient rejected as `wrong_meal`; empty lists changing nothing.
- **Acceptance criteria**: PRD 3 (library and generated dishes), 6 (allergy gate
  untouched: no change to `dishSafety` or `isSafeIngredient`).
- **Verification**:
  - `pnpm turbo lint ts:check test`
  - `invariant-reviewer` confirms the allergy and preference gates run exactly as before
    and `MealFit` only removes slots.
  - `plan-evaluator`: `evaluate-plans.mjs --compare` against `main`, on dev re-seeded with
    phase 2's lists — no profile loses days inside 5%.

### Phase 4 — Prompt 3.5.0

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 005 phase 4` (see Routing profile)
- **Goal**: each request shows one meal's foods, with the season first, and tells lunch
  and dinner what they are.
- **Scope**: `apps/api/src/modules/ai/prompts/PoolPrompt.ts` and its spec,
  `apps/api/src/modules/ai/services/PoolBuilder.service.ts` and its spec,
  `apps/api/src/modules/meal-plans/services/GenerationShared.ts` (the prompt context),
  the callers that build it (generation, swap, event rebuild), and — for `0063` — a
  library-usage read in `packages/core/src/repositories/Recipe/RecipeRepository.ts` with
  its controller and tests, and `apps/api/scripts/catalogue-by-meal.mjs`.
- **Steps**:
  1. Add `month: number` (1–12) to `PromptContext`, set by `GenerationShared` from the
     fortnight's first day (a swap or an event rebuild: the day being replaced).
  2. In `PoolBuilder`, build `safeIngredients` per requested slot: the current filter
     plus `belongsTo(ingredient, slot, dietaryPatterns)`. One prompt per slot already
     exists (`0016`); only its catalogue changes.
  3. In `catalogueByAisle`, within `produce`, list in-season rows first under a
     sub-heading such as `In season now (prefer these):`, then the rest under
     `Also available:`; slug order within each, so the prompt stays stable.
  4. Add `LUNCH_CHARACTER` and `DINNER_CHARACTER` beside `BREAKFAST_CHARACTER`: lunch is
     the day's main cooked meal; dinner is lighter home cooking — eggs, fish, grilled
     meat, vegetable creams, salads, a toast or a sandwich — not a stew. For a vegan or
     vegetarian person, dinner adds: pulses in light forms, never stewed. Supper takes
     `SNACK_CHARACTER`.
  4b. **Lunch and dinner, second cut (`0063`).** A core read returns, per meal and
     locale, the ids of the ingredients the library's recipes use there. For a lunch or
     dinner request, `PoolBuilder` keeps from that meal's catalogue (after step 2) only:
     the used ids, the produce in season this month, and a sample of the rest drawn with
     a seed that changes per generation (the job id). The sample size is one constant,
     starting at 60; tune it so step 7's size check passes, and record the value and the
     resulting rows in LOG.md. Breakfast and snacks are untouched. `catalogue-by-meal.mjs`
     reports the second cut too.
  5. Remove the spread rule's mention of legumes as a main protein where the slot's
     catalogue has none (dinner for an omnivore), so the prompt never asks for what it
     does not offer.
  6. `PROMPT_VERSION` → `3.5.0`, with its history entry; `STEPS_VERSION` unchanged.
  7. Spec: for the standard lunch context of `PoolPrompt.spec.ts` over a catalogue with
     the phase 2 lists and the `0063` cut, the prompt's length is at most 55% of the
     same prompt built with every list empty and no cut (PRD 2); dinner for an omnivore contains no lunch-only slug;
     for a vegan it contains the pulses; in-season rows precede out-of-season ones.
- **Acceptance criteria**: PRD 2, 3 (prompt side), 4, 5, 7.
- **Verification**:
  - `pnpm turbo lint ts:check test`
  - `node --env-file-if-exists=.env scripts/catalogue-by-meal.mjs` shows the same
    per-slot rows the prompt now uses.

### Phase 5 — Offline quality, and production

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 005 phase 5` — owner-gated: migrate and
  re-seed production after the merge
- **Goal**: show, without a model call, that nothing got worse; put it in production.
- **Scope**: `docs/reference/ai-gateway.md`, `docs/ARCHITECTURE.md` (the catalogue and the
  generation sections), `docs/ROADMAP.md` § 7, `apps/api/AGENTS.md` (the new script's row
  in the scripts table), this project's LOG.
- **Steps**:
  1. `evaluate-plans.mjs` on `main` and on the branch, dev re-seeded: per profile, days
     inside 5% on all four macros, allergens on a plate (must be zero), violations.
  2. `catalogue-by-meal.mjs`: per slot, library dishes servable before and after; every
     slot keeps at least `DISHES_NEEDED_PER_SLOT` for every evaluator profile, or the
     shortfall is named in the LOG with what the generation will ask the model for
     instead.
  3. Prompt size: build the standard lunch, dinner, breakfast and snack prompts on 3.4.0
     and 3.5.0 and record characters and estimated tokens.
  4. Write the results in LOG.md and the new behaviour in the docs listed in Scope.
- **Acceptance criteria**: PRD 2 (measured), 6.
- **Verification**:
  - The numbers above, in LOG.md.
  - owner-gated: after the merge deploys (the deploy runs the migration), run
    `pnpm --filter database seed` against production, as `docs/reference/deployment.md`
    step 6 says.

### Phase 6 — The free models, measured

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 005 phase 6` — owner-approves: which of
  phase 7's changes to build, from the numbers
- **Goal**: know how each free model behaves on the new prompt, with a script anyone can
  run again.
- **Scope**: new `apps/api/scripts/bench-models.mjs`, `apps/api/AGENTS.md` (its row),
  `docs/reference/ai-gateway.md`.
- **Steps**:
  1. `bench-models.mjs`: builds the real 3.5.0 prompt for fixed briefs (breakfast, lunch,
     dinner, afternoon snack; one standard omnivore, one vegan) from the built `dist` and
     the dev catalogue (refuses production, read-only); sends each to the gateway named
     by `AI_BASE_URL` with the configured key and the wire schema, as `json_schema`
     non-strict; scores each answer with `generatedDishSchema`, the unknown-slug check,
     `fitSlots`, and each dish's per-serving macros against its brief; records status,
     seconds, tokens, cached tokens and the gateway's `x-omniroute-*` headers. It
     **refuses any model that is not free**: only ids ending in `:free` or starting with
     `groq/`, and never a `gemini` id — the owner declined spending Gemini's requests
     (2026-09-25). It prints the number of calls it will make and needs `--yes` to make
     them. It never prints a key.
  2. Run it on the free candidates the gateway exposes (at least Groq `gpt-oss-120b`,
     `qwen3.8-27b`, and the OpenRouter `:free` models with structured outputs), one pass,
     stating the call count before running.
  3. Record in `docs/reference/ai-gateway.md` a dated table: per model, answered or the
     error (413, 429, timeout), seconds, tokens in and out, dishes valid, slugs unknown,
     median macro deviation, and whether it reused cached tokens (which closes the prompt
     audit's H6 question for these models).
  4. In LOG.md, the recommendation for phase 7 from those numbers.
- **Acceptance criteria**: PRD 8.
- **Verification**: `node --env-file-if-exists=.env scripts/bench-models.mjs --yes …`
  output in LOG.md; `pnpm turbo lint` for the script.

### Phase 7 — A fortnight on the free models

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 005 phase 7` — human-verify: the owner
  generates a fortnight in production on the free combo
- **Goal**: generation fits the free models' limits and finishes inside its budget.
- **Scope**: `apps/api/src/modules/ai/services/PoolBuilder.service.ts` and its spec,
  `apps/api/src/modules/ai/ai.config.ts`, `apps/api/src/config/Env.validation.ts` and its
  spec, `turbo.json` `globalEnv`, `apps/api/.env.example`, `docs/reference/deployment.md`,
  `docs/reference/ai-gateway.md`.
- **Steps** — the default set; phase 6's owner-approved recommendation may amend it,
  and the plan is amended in the same change if so:
  1. **Ask the model for fewer dishes per request.** Cap the dishes one request asks for
     (a constant, e.g. six), since the library and the backfill cover the rest and the
     output is the other half of every per-minute limit. Keep the existing rounds for
     what is still short.
  2. **Pace requests to a per-minute token limit when one is configured.** New optional
     `AI_TOKENS_PER_MINUTE`: when set, `PoolBuilder` starts a slot's request only while
     the estimated tokens of the requests started in the last sixty seconds (prompt
     length × the measured ratio, plus the capped output) stay under it; the others
     wait, inside the same budget. Unset, requests start together as today. Add it to
     `Env.validation.ts`, `turbo.json` `globalEnv`, `apps/api/.env.example` and
     `docs/reference/deployment.md` — the spec fails otherwise.
  3. **Size and rate refusals fall through, not fail the job.** A 413 or 429 from the
     gateway is recorded like any provider failure on the job's log (it already is) and
     the round's slot is retried in the next round only if time remains.
  4. Specs with a fake clock: three slots under a limit that fits one request a minute
     start one, then the next when the window allows; a budget that ends first leaves
     the library to cover the rest; no limit starts them together.
  5. `docs/reference/ai-gateway.md`: the recommended combo order for the free models
     with the numbers from phase 6, and the value of `AI_TOKENS_PER_MINUTE` for it. The
     combo itself is the owner's to configure.
- **Acceptance criteria**: PRD 5, 9.
- **Verification**:
  - `pnpm turbo lint ts:check test`
  - `sh .claude/skills/ship/scripts/gate.sh --full <scratchpad>`
  - One fortnight generated on dev through the gateway's free combo, the call count stated
    first; the job's `ai_calls` show no 413 and no 429, and the job finishes inside the
    budget.
  - human-verify: the owner generates a fortnight in production after setting the combo
    and `AI_TOKENS_PER_MINUTE`; "confirmed by human on <date>" in LOG.md.

## Hand-off

- **No Gemini calls to measure anything** (owner, 2026-09-25). Live calls go to free
  models only, with the count stated before they are made.
- **Databases.** Agents read the dev database (`Nutria-E2E`) only, inside read-only
  transactions; migrations and seeds against any Neon database are run by the owner.
  Production is never read by a script from this project.
- **Worktrees, not stashes**: each phase runs on its own branch in its own worktree.
- A migration goes past `migration-reviewer` before it is committed; phase 3 goes past
  `invariant-reviewer`.
- Every phase ends green on `sh .claude/skills/ship/scripts/gate.sh --full <scratchpad>`.
- The gateway's configuration is the owner's: read it, never change it.

## Out of scope

- Seasons outside Spain, and a British shelf — the catalogue work `0034` left open
  (`docs/ROADMAP.md` § Later).
- Moving generation to a host without the function limit — `docs/ROADMAP.md` § 7, if phase
  7 shows the budget cannot hold the free models however they are paced.
- The prompt audit's H6 — superseded by phase 4 (PRD § Out); phase 6 records the caching
  evidence.

## PRD acceptance criteria → phases

| PRD | Phase |
| --- | --- |
| 1 | 1, 2 |
| 2 | 4, 5 |
| 3 | 2, 3, 4 |
| 4 | 2, 4 |
| 5 | 4 |
| 6 | 3, 5 |
| 7 | 4 |
| 8 | 6 |
| 9 | 7 |
