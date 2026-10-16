# Plan — Project 021: Cooked with what you have

- **Status**: approved — the owner, 2026-10-15
- **Type**: standard
- **PRD**: ./PRD.md (every acceptance criterion maps to at least one phase; the map is at
  the end of each phase block)
- **Routing profile**: `tiered` (AGENTS.md § Model routing) — planning and review opus @
  high, implementation opus @ medium, mechanical sonnet. Phase 3 deviates upward to
  `quality-max`: it changes the gate on what a model returns, which the profile's own
  exception names.

## Design summary

A kitchen is three states per appliance — not there, there, or what they would rather use —
and the shape of all of it is recorded in
[`0102`](../../decisions/0102-a-kitchen-is-what-it-has-and-what-it-would-rather-use.md).
The catalogue is an enum in `packages/core` with its names in the dictionaries; what a
person said is one `userOwned('kitchen_equipment', …)` row per appliance they spoke about,
two Postgres enums wide, exactly as a cuisine preference is stored; a dish's requirement is
`recipes.equipment`, `text[]`, exactly as `recipes.mealSlots` is.

The enforcement is not new machinery. **Missing equipment travels the three places the
cooking time already travels** — the prompt line, the gate on what the model returns
(`PoolBuilder`, beside `withinTime`), and the filter on what the library may reuse
(`RecipeController`) — so the model, the plan and the fixed-meal offer cannot disagree
(`0052`'s rule). **A preference travels two of them and may never remove a dish**: a prompt
line and the order the library is read in.

That split is why the phases below are ordered as they are: the data first and inert
(phase 1), every existing dish classified (phase 2), then one phase that turns the
constraint on everywhere at once (phase 3) rather than three that each half-enforce it.

And it is why the library grows **last** (phase 8) rather than first: a batch of air-fryer
dishes written before phase 1 would have to be classified by inference like every other
dish, and sized by a guess instead of by what phase 6 measures missing. A preference with
nothing behind it is a hint, which is the one thing `marketing` refused to let this project
sell — so the supply is part of the promise, not an afterthought.

## Phases

### Phase 1 — The kitchen as data, and inert

- [x] done
- **Dispatch**: opus @ medium — `/execute-project 021 phase 1`
- **Goal**: a person's kitchen and a dish's requirement exist in the database and in the
  domain, and nothing behaves differently yet.
- **Scope**: `packages/core/src/entities/**`, `packages/core/src/controllers/Kitchen/**`,
  `packages/core/src/repositories/Kitchen/**`, `packages/database/src/schemas/**`,
  `packages/database/src/migrations/**` — and, for step 4 alone, which the first version of
  this line forgot to name: `packages/core/src/repositories/Recipe/**`,
  `packages/core/src/controllers/Plan/**` and `packages/core/src/test/fixtures.ts`
  (amended during execution, 2026-10-16: a dish cannot carry `equipment` out without the
  repository that reads it and the presenter that answers it).
- **Steps**:
  1. `APPLIANCES` in core as the catalogue — `stovetop`, `oven`, `microwave`, `air_fryer`,
     `pressure_cooker`, `blender`, `grill`, `steamer`, `slow_cooker`, `rice_cooker` — with
     `EQUIPMENT_STANCES` (`missing`, `has`, `prefers`) and the zod schemas beside the other
     entities. **Ten, not twelve**: a toaster and a kettle were dropped because no dish in
     either library needs one — a toast is a breakfast and an infusion is not a dish — and a
     catalogue entry is a promise (`0102`). `DEFAULT_KITCHEN` is stovetop, oven, microwave
     (`0102`), expressed once and read everywhere.
  2. Migration: two Postgres enums, `kitchen_equipment` through the `userOwned` helper
     (unique per user and appliance), and `recipes.equipment text[] NOT NULL DEFAULT '{}'`.
     No statement that rewrites a row — the backfill is phase 2, on purpose, so this one is
     provably safe on production's rows.
  3. `KitchenController`: read a person's kitchen (rows folded onto the default), write one
     appliance's stance, remove a stance. Ownership by session, denials as 404, as every
     other controller does it.
  4. The recipe repository and `PlanController` carry `equipment` out with a dish, so the
     screens and the offer can read it later.
- **Acceptance criteria**: PRD 1 (the data half). A kitchen nobody described reads as the
  default, from one place. `pnpm --filter database migrate` applies on an empty database
  **and** on a copy of the local library.
- **Verification**: `pnpm turbo lint ts:check test --filter=core --filter=database`;
  `node scripts/check-migrations.mjs --drift`; `NUTRIA_LOCAL_PG=1 pnpm --filter database
  migrate`; then the `migration-reviewer` agent on the migration (opus @ high, the floor in
  AGENTS.md — a migration runs against production during the API's build), its P0 and P1
  applied before the phase is called done.

### Phase 2 — Every dish says what it needs

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 021 phase 2`
- **Goal**: the 1128 dishes already in a library declare their equipment, inferred from the
  prose of their steps, auditably.
- **Scope**: `packages/database/src/migrations/**`, `apps/api/scripts/**` (a measuring
  script only if the phase needs one), and `scripts/export-reference-library.mjs`
  (added 2026-10-16, `migration-reviewer` on phase 1 — see step 4).
- **Steps**:
  1. Write the pattern list — Spanish and English, since the library holds both — for
     oven (`horno`, `hornea`, `gratin`, `asar`), microwave, air fryer (`freidora de aire`,
     `air fry`), pressure cooker (`olla a presión`, `olla rápida`, `exprés`), blender
     (`batidora`, `licuadora`, `robot`, `procesador`), steamer, slow cooker, grill
     (`plancha`, `parrilla`, `barbacoa`).
  2. The data migration sets `recipes.equipment` from those patterns, and **leaves a dish
     that matches nothing as stovetop** (`0102`). Its header carries the pattern list, the
     measured hit rate, and a `-- reviewed-destructive:` line, because it rewrites rows.
  3. Measure before and after on the local library and write both counts into the header:
     today's reading is 824 stovetop, 68 oven, 20 microwave, 20 blender, 1 pressure cooker,
     1 air fryer, of 1128.
  4. **Teach `scripts/export-reference-library.mjs` about the column** — `RECIPE_COLUMNS`
     and the read's `select`, both of which name every other recipe column and not this one
     (`migration-reviewer` on phase 1, 2026-10-16). It is lossless only while every row is
     `'{}'`: the moment this phase backfills, that script exports a classified library as an
     unclassified one. It bites hardest at **phase 8**, where the plan has the owner loading
     the new air-fryer batch to production through this path — every dish written precisely
     to declare an air fryer would arrive declaring nothing, which `0102` reads as a pan.
- **Acceptance criteria**: PRD 4. Every row has a non-empty `equipment`. The counts in the
  header match a fresh query. Running the migration twice changes nothing the second time.
  **The verification is a count by appliance that sums to the row count**, not only that the
  migration applied: `recipes.equipment` is `text[]` and not `appliance[]` — the right call,
  it is what `mealSlots` is — so nothing in the database refuses a mis-spelled appliance and
  `appliancesOf` drops an unknown string in silence, which reads as "needs nothing", the
  same answer as unclassified (`migration-reviewer`, 2026-10-16).
- **Verification**: `NUTRIA_LOCAL_PG=1 pnpm --filter database migrate` on a copy of the
  local library, then the counts by appliance; `node scripts/check-migrations.mjs --drift`;
  `migration-reviewer` (opus @ high) on this migration specifically — it is the one that
  touches production's own rows.

### Phase 3 — A dish nobody can cook is never served

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 021 phase 3` · *deviation*: the profile's
  own exception, since this changes the gate on what a model returns.
- **Goal**: a missing appliance is a constraint in the three places the cooking time is
  one, and a preference is asked of the model without ever removing a dish.
- **Scope**: `packages/core/src/domain/Preference/**`,
  `packages/core/src/domain/FixableReason/**`,
  `packages/core/src/controllers/Recipe/**`, `apps/api/src/modules/ai/**`,
  `apps/api/src/modules/fixed-meals/**`, `apps/api/src/modules/meal-plans/**`.
- **Steps**:
  1. `resolvePreferences` takes the kitchen and resolves it once, beside
     `maxMinutesPerDish`, so no call site rebuilds the rule (`0052`).
  2. `withinEquipment(dish, kitchen)` beside `withinTime`, in the same file, with the same
     shape: a dish is out when it needs an appliance whose stance is `missing`.
  3. The three places: the prompt gains two lines — what they do not have (never use it)
     and what they would rather use (prefer it) — `generatedDishSchema` gains
     `equipment`, the `PoolBuilder` gate rejects a dish needing a missing appliance with
     its reason recorded in the metadata a generation already writes, and
     `RecipeController`'s library read filters the same way.
  4. `whyNotFixable` gains a ninth reason, actionable, said apart from `too_slow` and
     `clashes_with_fixed` (`0101`); the fixed-meal DTO carries it; the offer and the
     add-time gate stay the same gate.
  5. The preference orders the library read and nothing else — asserted by a unit test that
     a preferred appliance removes no dish.
- **Acceptance criteria**: PRD 2 and 3. A dish requiring a missing appliance cannot reach a
  plan, an offer, or the model's accepted output. A preferred appliance changes order only.
- **Verification**: `pnpm turbo lint ts:check test --filter=core --filter=api`; then the
  `invariant-reviewer` agent on the whole diff (a new field reaches the model and a new
  reason reaches a screen), its P0 fixed before the phase is done.

### Phase 4 — The API asks, stores and answers

- [ ] pending
- **Dispatch**: sonnet @ medium — `/execute-project 021 phase 4` · mechanical from a
  complete contract.
- **Goal**: the kitchen can be read and written by a person, through the profile and
  through an onboarding step neither of which may be required.
- **Scope**: `apps/api/src/modules/profiles/**`, `apps/api/src/modules/onboarding/**`,
  `packages/core/src/entities/Onboarding/**`.
- **Steps**:
  1. The preferences DTO gains the kitchen; `PATCH` accepts a stance per appliance and
     refuses an appliance the catalogue does not hold (422, the field named), and a **fourth
     `prefers`** the same way — the bound is three, the same on both tiers, and it is a
     product bound rather than a tier row (`marketing`, 2026-10-15).
  2. A `kitchen` onboarding step, **added to the optional steps and not to the required
     list** — `onboarding/complete` must still succeed for somebody who never opened it.
  3. The profile answers the kitchen, defaulted, so one read tells a screen everything.
- **Acceptance criteria**: PRD 1 (the route half). An account that skips the step can
  finish onboarding and generate a plan; its kitchen reads as the default.
- **Verification**: `pnpm turbo lint ts:check test --filter=api`; the onboarding spec
  covering the skipped step.

### Phase 5 — The screen somebody describes a kitchen on

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 021 phase 5` — human-verify: the kitchen
  section on the owner's iPhone.
- **Goal**: a person ticks what they have and marks what they would rather use, in both
  languages, can ignore the whole thing — and sees on a dish what it is cooked with.
- **Scope**: `apps/web/src/components/OnboardingFlow/**`, `apps/web/src/app/(app)/perfil/**`,
  the dish detail under `apps/web/src/app/(app)/**`, `apps/web/src/i18n/**`,
  `packages/ui/**` only if a control is genuinely missing.
- **Steps**:
  1. One row per appliance, three states, the default state visible as the default rather
     than as a choice already made; the step skippable and the profile section editable. The
     three-preference bound is **said before it is hit**, never discovered by a refusal.
  2. Both dictionaries, with the names the catalogue's keys stand for.
  3. The design review the repository requires (`apps/web/AGENTS.md` § Design review) with
     the owner's `apple-web-design` skill, P0 and P1 fixed.
  4. The dish detail shows the appliances the dish declares: **one inline SVG per
     appliance, sized to the text, with its name beside it** — never an emoji, never an icon
     alone (`apple-web-design`, and the name is what an assistive technology reads). A dish
     that declares only a stovetop shows nothing: a chip on every dish is noise.
  5. `/local-probe` at 320, 390 and 1280 px, light and dark, signed in, both languages —
     the kitchen screens and a dish detail with an oven dish in it.
- **Acceptance criteria**: PRD 1 and 5. No sideways scroll at any width, every control
  reachable by keyboard, the empty state saying that silence means a normal kitchen, and the
  dish detail legible at 320 px with its icons carrying no meaning of their own.
- **Verification**: `pnpm turbo lint ts:check test --filter=web --filter=ui`; the probe's
  lines and screenshots in the LOG entry; the `accessibility` agent on the new screen.

### Phase 6 — What it costs, measured

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 021 phase 6` — owner-gated: one real
  generation from the owner's dev account, with an air fryer preferred, against the
  production provider (one model call; a stub cannot say whether a prompt works).
- **Goal**: the price of a missing appliance is a number per profile, and the preference
  half is proved by a count rather than by reading the prompt.
- **Scope**: `apps/api/scripts/evaluate-plans.mjs`, `docs/decisions/0102-*.md`, this
  project's `LOG.md`.
- **Steps**:
  1. The evaluator gains a flag naming a kitchen (`--without oven`, and a stance list for
     the harder cases). It already resolves preferences through `resolvePreferences` and
     reads `reusablePool`, so no second idea of the rule is introduced.
  2. Run the fourteen profiles on the real local library: the share of the library each
     missing appliance removes, and the days still inside 5% on all four macros (`0045`),
     for the hardest kitchen — no oven, no microwave, no blender.
  3. The owner-gated generation: with the air fryer preferred, count the air-fryer dishes
     in the fortnight that comes back, against the 1 in 1128 the library holds today.
  4. Write every number into `0102` and this project's LOG; a day that cannot be built is
     reported as `0101` reported its own, not hidden.
- **Acceptance criteria**: PRD 6 and 8. The `plan-evaluator` agent owns steps 1–2 and
  reports numbers; it never edits code outside the script.
- **Verification**: `NUTRIA_LOCAL_PG=1 node apps/api/scripts/evaluate-plans.mjs …` with the
  new flag, before and after, with `--json` kept for the next run to compare against; the
  core build first (`pnpm turbo build --filter=core`), since the evaluator loads `dist`.

### Phase 7 — End to end

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 021 phase 7`
- **Goal**: the claims nobody can make from a unit test, made on real rows.
- **Scope**: `apps/api/test/**` only (the `tests` agent owns it and is the only agent that
  runs those suites).
- **Steps**:
  1. A person with no oven generates a fortnight with no oven dish in it.
  2. The fixed-meal offer refuses an oven dish to them with the new reason, actionable, and
     offers the same dish to an account that has an oven.
  3. Another account's kitchen narrows nothing of theirs (`0019`).
  4. The suite brings dishes that declare their own equipment: the shared pool is tuned for
     the variety rules and cannot be leaned on here — see `apps/api/test/README.md` §
     *The shared pool cannot reach the macro bands*, which is the trap this project would
     otherwise walk into next.
- **Acceptance criteria**: PRD 9. Green on a database built the way CI builds it, not only
  on a developer's library — the suite runs against both before the phase is done.
- **Verification**: `pnpm --filter api test:e2e -- --runTestsByPath test/<suite>.e2e-spec.ts`
  (never a bare suite name, never `--testPathPatterns`), on the local library and on a
  CI-shaped database.

### Phase 8 — A library that cooks with more than a pan

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 021 phase 8` — owner-gated: the owner runs
  the reviewed load on `develop` first and on production after, as he ran the five hundred.
- **Goal**: the appliances a person can now prefer have dishes to offer them — sized by what
  phase 6 found missing, not by a round number.
- **Scope**: `apps/api/scripts/**` (the batch script), `docs/local/**` (the generated SQL,
  never committed), this project's `LOG.md`. **No application code.**
- **Steps**:
  1. **The target is twelve dishes per appliance per slot it plausibly serves**, not a round
     number per appliance. Twelve because that was the library's own rotation cap before
     `0065` raised it to nineteen: it lets the rotation hand over a meaningful share of a
     slot without repeating, and the model's seven steered fresh dishes sit on top of it.
     Nineteen — a whole slot from the library alone — is the *second* batch, and only where
     phase 6 measures a fortnight repeating itself.

     Read against production on 2026-10-15 (dish-slot pairs; a dish serving lunch and dinner
     counts in both), what exists and what the first batch therefore owes:

     | appliance | breakfast | lunch | dinner | other | first batch |
     | --- | --- | --- | --- | --- | --- |
     | oven | 7 | 35 | 44 | 8 | **none — already past the cap** |
     | steamer | 3 | 21 | 23 | 5 | **none** |
     | grill or griddle | 17 | 18 | 36 | 15 | ~6 lunches |
     | blender or processor | 10 | 0 | 0 | 17 | ~12 (soups and creams, lunch and dinner) |
     | microwave | 5 | 3 | 3 | 0 | ~8 (breakfast and snacks, where it is actually used) |
     | **pressure cooker** | 0 | 2 | 0 | 0 | **~24** (12 lunches, 12 dinners) |
     | **air fryer** | 0 | 0 | 1 | 0 | **~30** (12 lunches, 12 dinners, 6 snacks) |
     | slow cooker | — | 0 | 0 | — | ~24, if it stays in the catalogue |

     About a hundred dishes in total, against the six hundred that fifty per appliance would
     mean — and the two the owner's instinct named are exactly the two that need the batch.
  2. **The batch is drafted for macro spread, not only for a count.** Thirty air-fryer
     dishes that are all chicken breast leave a day unable to reach four macros (`0045`), so
     each appliance's dishes are drafted across the profile the scheduler needs to balance
     with — the same reason the pool asks for nineteen a slot rather than five.
  3. The batch script drafts dishes **through the machinery that already exists** — the pool
     builder's own prompt and schema, so each dish declares its `equipment` natively and no
     inference is involved — and every draft passes the validator and the tuner the five
     hundred went through (ingredient slugs from the catalogue, the serving ceiling `0070`,
     two documented steps, the allergen resolution).
  4. A dish is written to a SQL file under `docs/local/`, **not** to a migration: hundreds
     of inserts do not belong in the API's build, and the five hundred set the precedent
     that the owner runs the load himself. The file is reviewed before he runs it — a sample
     read by a person, and the whole of it by the validator.
  5. Load on `develop`, measure again (the gap should close), then production.
  6. **If this phase adds an appliance to the catalogue**, the Postgres enum grows by
     `ALTER TYPE … ADD VALUE` — cheap and append-only, and nothing like the rebuild that
     *removing* a value would need. The trap: a value added and **used in the same
     transaction** fails, and drizzle gives a deploy one transaction per migration file, so
     the value and the rows that name it are two deploys (`migration-reviewer`, 2026-10-16).
- **Acceptance criteria**: PRD 7. Every dish in the file declares its equipment and passes
  the validator; the gap for each appliance the catalogue holds is closed to the rotation's
  need, or the shortfall is stated per appliance with its reason. The model's spend for the
  batch is reported in the LOG against `AI_TEXT_MONTHLY_CAP_USD`.
- **Verification**: the validator over the file; `NUTRIA_LOCAL_PG=1` load into the local
  library and the evaluator run from phase 6 repeated, before and after; a read-only count
  against production after the owner's load, reported with the query that produced it.

### Phase 9 — The record and the rule

- [ ] pending
- **Dispatch**: general-purpose, inheriting the session's effort — `/execute-project 021
  phase 9`
- **Goal**: what a future agent must not break is written where it will be read, and the
  tier question is closed.
- **Scope**: `docs/decisions/**`, `packages/core/AGENTS.md`, `apps/api/AGENTS.md`,
  `apps/web/AGENTS.md`, `docs/ROADMAP.md`, this project's `PRD.md` and `LOG.md`.
- **Steps**:
  1. `0102` carries the measured numbers from phase 6 and its status moves off "structural
     choices only".
  2. The nearest `AGENTS.md` gains the two rules that outlive this project: a dish declares
     the appliances it **cannot** be cooked without, and an unclassified dish is stovetop;
     a preference may never remove a dish. **The first of the two landed in phase 1**
     (`packages/database/AGENTS.md` § A dish's equipment, 2026-10-16): the column ships in
     that phase and phases 2 and 8 write to it long before this one, and `/ship` § 2 asks
     for the rule in the same change as the code it governs. What is left here is the
     preference half — which does not exist until phase 3 — and checking that the first half
     still says what the code does.
  3. `marketing`'s verdict is already in: free, both halves, **no row in `Allowance.ts`**
     ([the report](../../reference/marketing/the-kitchen-a-person-has.md), 2026-10-15). This
     phase only checks that nothing shipped quietly gated it, and that the three-preference
     bound reads as a product bound everywhere it is written.
  4. A `docs/ROADMAP.md` line for the time and elaboration project this one deliberately
     left alone.
- **Acceptance criteria**: PRD 10. No number in `0102` is one nobody measured.
- **Verification**: `sh .claude/skills/ship/scripts/gate.sh --full "<scratchpad>"`.

## Hand-off

Standing constraints for every executor of this project:

- **Local Postgres, never Neon**: `pnpm db:local`, `NUTRIA_LOCAL_PG=1` for tests, the
  evaluator and any script. Neon's allowance is shared with production.
- **Rebuild `packages/core` before measuring anything**: the evaluator and the API load it
  from `dist`, so an unbuilt edit measures the previous answer.
- **No test, suite or script calls a model.** The one model call this project makes is
  phase 6's owner-gated generation.
- **A migration is reviewed by `migration-reviewer` at opus @ high** before its phase is
  done — both of them, phase 1's and phase 2's.
- **One heavy job at a time** on the owner's machine: a gate, an e2e run and an evaluator
  run do not overlap.
- **Agents never commit.** Each phase stops at the boundary, proposes a message, and the
  owner commits.

## Out of scope

- **The cooking time and how elaborate a dish is** — its own project, measured, next: a
  budget that can differ between a weekday and a Sunday, and whether `difficulty` should
  mean anything at all, given that it is stored on 1128 dishes and read by none of them.
  A `docs/ROADMAP.md` line goes in at phase 8.
- **Converting a dish to another appliance** ("hazme esto en airfryer") — a different
  feature, with a model call per request.
- **The hob itself** (gas or induction, how many rings), pans and pots, knives, boards,
  scales and mortars: utensils everybody has are noise on that screen.
- **Equipment in the shopping list**, and buying advice of any kind.
