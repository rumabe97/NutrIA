# Plan — Project 022: A plan that leans on your cupboard

> **Purpose**: the phased technical execution plan — the engineering half of the contract.
> `/execute-project` follows this literally; executors implement phases, they do not redesign
> them. If implementation must diverge, the plan is amended in the same change and the
> deviation is recorded in `LOG.md`.
> **Audience**: agents primarily, humans review. **Committed**: yes. **Written by**: the
> planner via `/plan-project`, 2026-10-23; approved by the owner before execution starts.

- **Status**: **done and live — every phase shipped and merged, and the steering switched on,
  2026-11-05.** Phases 0, 1, 2, 3a, 3b (`4a537739`, #319) and 4 and 5 (`a142e8ad`, #321) are in
  production. The owner threw `pantry_rank` on his own account the same day
  (*«Encendido el interruptor»*), so what people get now is the cupboard
  both shortening the shopping list and leaning the pick, inside the bands; the proofs
  [`docs/legal/pantry.md`](../../legal/pantry.md) § 9.6 asked for are written and green
  (`1b776580`, #326), three of them after the click, and § 9.6 marks which. **Three things this
  does not mean.** The screen carries (g1) and not (g2), so it is true about the shop and silent
  about the pick — a copy decision the owner delegated on 2026-11-05 and the close-out **parked**
  with its price written down ([`docs/decisions/LOG.md`](../../decisions/LOG.md)): it is not a
  copy change, because a sentence chosen by the flag needs a signed-in screen to read
  owner-audience state. The residual at share 5 was accepted *while the flag was off* and is now
  live behaviour, re-accepted the same day and still unmeasured since. And phase 3b's
  `human-verify` was closed by instruction rather than met,
  so two accessibility behaviours are unverified on a real device; the phase's own line says which.
  Approved by the owner on **2026-10-23** (*«si, lo he leído y lo apruebo»*), PRD the same day.
- **Type**: standard
- **PRD**: [`./PRD.md`](./PRD.md). Criterion coverage: 1 → phase 0; 2 → phases 0 and 4; 3 →
  phases 0 and 4; 4 → phase 4; 5 → phases 2 and 3b; 6 → phases 1 and 2; 7 → phases 1, 3a and
  3b; 8 → phases 1, 3a, 3b and 4; 9 → phase 3b; 10 → phase 3b; 11 → phases 0 and 1; 12 → phases
  3a and 5 (3a makes the two halves distinguishable, 5 aggregates them).
- **Routing profile**: `tiered` (`AGENTS.md` § Model routing) — planning and review opus @
  high, implementation opus @ medium, mechanical sonnet. **Two deviations, each justified in
  its phase**: phase 1's migration review is opus @ high (the standing floor for a migration,
  which runs against production during the API's build), and phase 4 implements at opus @ high
  because it re-opens `applianceShare`, a constant 021 measured twice.

## Design summary

**Three pieces, in the order their risk falls.** The measurement first, because it can kill a
third of the project before anybody writes product code. Then the half that is already true in
code — the shopping list reading what somebody already has. Then the screen, and only then the
steering, behind a flag and behind its own numbers.

**Where the pantry lives, and why not in the request body.** The obvious shape — post the
slugs with `POST /meal-plans/generate` — does not survive the code. Generation is a **job**
(`MealPlans.controller.ts:38`, then `GET jobs/:id`), the shopping list is built **inside** it
(`PlanGeneration.service.ts:624`), and a re-roll has to pre-fill from the last ask, which is
the whole of what premium gains here (PRD § *The owner's two decisions*). A body-only pantry
has nowhere to live between the screen and the job, and nothing for a redo to read. So:

1. a **user-owned draft table** holds what somebody is typing — `architecture/0012` § 6's
   `pantry_items`, with the **two partial unique indexes** a nullable `ingredientId` forces,
   because Postgres counts NULLs as distinct and one plain `unique(userId, ingredientId)` lets
   every unresolved label in twice over;
2. the **generation spends it**: the job resolves the draft, seeds the list, and records what it
   was asked with in `generationMetadata` beside `kitchenShare` and `fixedMeals` — the field
   whose own comment states the contract, *"a plan already generated keeps what it was
   generated with"* (`PlanGeneration.service.ts:851`);
3. the **draft is cleared** on success. No standing larder, no dates, no freshness model.

**Where the steering goes, if it goes anywhere.** `rotatePool` (`Rotation.ts:362`) already
partitions a slot's dishes into what somebody leans towards and the rest, and `applianceShare`
(`:282`) reserves part of each slot's cap for a preferred appliance. A pantry *rank* is a third
ordering inside that pick — not a fifth reason in `isPreferredDish` (`:247`), whose single
bucket is the measured dilution `0102` paid for and which a 15-item pantry would fill with 86%
of the library. Which composition it is — a sort key with no quota, its own quota out of the
five the appliance leaves, or composed with it — is phase 0's to decide and nobody else's.
**Phase 0 decided, and the owner then struck the phase**: the composition is the rank with its own
rung on `narrowerShares` at a small share, and it is not being built (2026-10-23). What follows in
this paragraph is the shape the steering would take, not anything the product does.

**No prompt change in this project.** The rank is computed from `CandidateDish.ingredients`,
which the pool already holds, so nothing reaches `promptPreferences` and
`health-boundary.spec.ts:295`'s allowed-keys list does not change. Marking pantry rows in the
catalogue listing the way in-season produce is marked (`PoolPrompt.ts:492`) is deliberately out:
it reaches only `FRESH_DISHES_PER_SLOT`, 7 of 19, `0102` bounded that kind of steering at 34%,
and it would re-open a published privacy boundary for it.

## Phases

### Phase 0 — Price it before building it

- [x] done — commit `fd041f50` ("A cupboard is priced before it is built, and the shop it
  shortens turns out to be the declaring and not the steering") — measured 2026-10-23,
  `LOG.md` phase 0. The **stop signal did not fire**: no slot
  under 19 in `rank`, and the rung brings rescues *below* the no-pantry baseline (14 → 10–12 of
  112 fortnights) with every day still in band. Phase 4 therefore stands by its own criterion —
  and whether it is worth building is the owner's at this gate, because what the steering buys
  is +2.5% meals-from-the-cupboard at the one share that costs nothing, while the shares that
  buy a visible gain break the fortnight's egg cap in most plans.
- **Dispatch**: ~~`plan-evaluator`~~ → **executed directly, opus @ medium** (the profile's
  implementation row) — `/execute-project 022 phase 0` — **owner-approves**: whether the
  steering half exists at all, and what the bound on pantry items is.
  **Answered by the owner on 2026-10-23**, on this phase's figures and recorded in
  [`docs/decisions/LOG.md`](../../decisions/LOG.md): the steering half is **not** built — phase 4
  is struck below — and the bound is **60**. The gate is closed.
  **Amended 2026-10-23, during execution**, for two reasons that are facts about the tools and
  not about the design: `plan-evaluator` holds no `Write` or `Edit` and its own brief says *"You
  edit nothing"*, while steps 1–4 below are edits to `evaluate-plans.mjs`; and the role agents
  work in their own worktree, which has no `.env` and cannot reach `pnpm db:local`, so the one
  thing this phase must do — run the evaluator against the local Postgres — can only be done
  from the main checkout. The measurement is still what `plan-evaluator` would have reported,
  and the standing rule holds: numbers, with their spread, and no estimate where a figure is
  missing.
- **Goal**: measure what a realistic pantry does to a fortnight, before a line of product code
  exists.
- **Scope**: `apps/api/scripts/evaluate-plans.mjs` only. No schema, no migration, no route, no
  screen, no change to `packages/core`.
- **Steps**:
  1. Add `--pantry <slugs>` to the argument parser, beside `--prefer` (`:564`) and validated the
     same way: every slug must exist in the catalogue, an unknown one exits 2 naming it.
  2. Add `--pantry-mode filter|rank`, default `rank`. `filter` is measured **only** to confirm
     the PRD's refusal with this cohort's own numbers; it is never a shippable mode.
  3. ~~Thread it the way `withPreferredAppliances` (`:662`) threads a stance — through the
     profile's resolved preferences~~ → **amended 2026-10-23, during execution**: a pantry has
     no field on `Rotation` to be threaded into, and giving it one is phase 4's work, which this
     phase's own scope forbids ("no change to `packages/core`"). The one lever on the pick that
     `packages/core` already exports is `rotatePool`'s `reserve`, which is what
     `RecipeController.rotateFor` passes `reserveGroups` through — so the rank is measured as
     **the cupboard's reserve appended to the food groups' own**, after them and never instead
     of them, with everything else on the path still the real code's: the shuffle, the appliance
     share, the cap, the ladder and the rescues. It is phase 4's shape mirrored in the
     instrument, not a parallel scheduler, and the mirroring is proven: on `main`'s own
     arguments the edited script writes byte-identical figures to the script at `HEAD`
     (`LOG.md`, phase 0, *evidence*).
     The composition's one free parameter is the quota, `--pantry-share`, and its second is
     which preference gives way first when a band is missed, `--pantry-yields` — both measured
     rather than assumed.
  4. Write **three or four hand-written larders** as named fixtures at 15, 30 and 60 items — the
     kind of cupboard a person actually has, not the library's top-K, which flatters the
     feature. Name what each one assumes.
  5. Report, per profile and as a cohort: servable pool **per slot against 19**, days in band
     **against 588/588**, rescues **against the 8–9 baseline**, plates using a pantry item, and
     **shopping-list rows against the no-pantry run** — the no-pantry baseline produced in the
     same run, so the comparison is a measurement and not a recollection.
  6. Report every figure with its **spread across seeds**, never a single number.
- **Acceptance criteria**: PRD 1 (the sweep exists, with its stop signal evaluated and stated),
  PRD 2 (nothing quoted without its spread), PRD 3 (the kitchen's 14-of-19 and 021's median
  20-of-56 re-measured as the baseline this project must not move), PRD 11 (what the larders say
  the bound should be).
  **The stop signal fires** if any slot falls under 19 or rescues rise above baseline: then
  phases 1, 2, 3 and 5 are the project, phase 4 is struck, `LOG.md` records it and the PRD is
  amended. That is a delivered project, not a failed one.
- **Verification**:
  ```bash
  pnpm db:local status                 # not running? pnpm db:local start
  pnpm --filter core build             # an unbuilt core measures nothing and returns identical numbers
  NUTRIA_LOCAL_PG=1 node apps/api/scripts/evaluate-plans.mjs --rotate 3 --flag accompaniments --json "<scratchpad>/pantry-baseline.json"
  NUTRIA_LOCAL_PG=1 node apps/api/scripts/evaluate-plans.mjs --rotate 3 --flag accompaniments --pantry-mode rank --pantry "<larder-15>" --json "<scratchpad>/pantry-15.json"
  # the same for the 30- and 60-item larders, and once with --pantry-mode filter
  pnpm turbo lint ts:check --filter=api
  ```

### Phase 1 — The pantry a person types exists, and resolves

- [x] done — commit `6fe0bd91` ("A cupboard a person types exists, resolves to the catalogue, and
  is bounded at sixty") — built 2026-10-23, finished and verified 2026-10-26, `LOG.md` phase 1. The migration
  is `0068_a_cupboard_a_person_types.sql`, reviewed at opus @ high and safe as written; the four
  defects that review found in the TypeScript around it are fixed with a test each. The commit
  reference is backfilled by the next run, after the owner commits.
- **Dispatch**: `backend` — `/execute-project 022 phase 1`. The migration is reviewed by
  `migration-reviewer` before the phase closes: **opus @ high**, above the profile's row,
  because a migration runs against production during the API's build with no staging in between.
  **Amended 2026-10-23, during execution**: the e2e suite below is **not `backend`'s to write** —
  `ownership.json` excludes `apps/api/test/` from that role, and `tests` is the only agent that
  may write or run those suites. So this phase is two dispatches, `backend` then `tests`, and a
  phase whose scope names a suite in `apps/api/test/` always will be.
- **Goal**: the draft table, the resolver that turns a cupboard word into a catalogue row, and
  the routes that write it — with no screen and no generation change.
- **Scope**: `packages/database/src/schemas/`, `packages/database/src/migrations/`,
  `packages/core/src/entities/Pantry/**` (amended 2026-10-23: the repository parses its rows with
  a Zod schema and `packages/core/AGENTS.md` keeps Zod schemas in `entities/`),
  `packages/core/src/domain/Pantry/**`, `packages/core/src/repositories/Pantry/**`,
  `packages/core/src/controllers/Pantry/**` (or the profiles controller if that is where the
  kitchen's sibling sits), `apps/api/src/modules/profiles/**`, one e2e suite in
  `apps/api/test/`.
- **Steps**:
  1. `userOwned('pantry_items', …)` with `label`, nullable `ingredientId`, nullable `grams`,
     nullable `unit` — the shape and the comment style of `kitchen.schema.ts` — **and a fifth
     column, `normalisedLabel`** (amended 2026-10-23, during execution): step 2's second index is
     on the normalised word, and Postgres cannot reproduce `normaliseForMatching` — NFD, Unicode
     diacritics stripped, punctuation flattened — in an immutable index expression. A SQL
     normaliser that nearly agreed with the resolver's would be a second normaliser, which is the
     one thing this feature may not have, so the value is written by the repository and read by
     the index alone.
  2. The uniqueness as **two partial unique indexes**: `(user_id, ingredient_id) where
     ingredient_id is not null`, and `(user_id, <normalised label>)` for the rows with none.
     Written in the database for the reason `kitchen_equipment_one_per_appliance` is: a double
     tap has both requests reading "no row yet" under READ COMMITTED.
  3. The resolver over `ingredient_names` (1,860 rows), following `matchCustomAllergen`
     (`Safety/CustomAllergen.ts:131`) and `isEnforceableDislike` (`Preference.ts:491`) rather
     than inventing a matcher. **A coarse word resolves to the coarse thing**: *arroz* must not
     force a choice between 16 rice rows, and the raw/cooked distinction (`0078`) stays the
     product's problem. An entry that resolves to nothing is **kept, with its label, unresolved**
     — never dropped, never guessed.
  4. The bound checked where it is written, refused as **422 naming the field**, the same on both
     tiers, with the number the owner settled on 2026-10-23 — **60** — and not as something still
     provisional ([`docs/decisions/LOG.md`](../../decisions/LOG.md)). Not a `tier_allowances` row.
  5. Routes to list, add, remove and clear, user-scoped, denials as 404 the way every other
     user-owned resource answers.
- **Acceptance criteria**: PRD 6 (a draft, user-owned, that nothing outlives), PRD 7 (only slugs
  ever leave; the typed label is stored for the person and never put in a prompt, a log or an
  error), PRD 8 (nothing here is read as a restriction — the pantry never reaches
  `SafetyProfile` and never removes a dish), PRD 11 (the bound as a limit, not a price).
- **Verification**:
  ```bash
  node scripts/check-migrations.mjs --drift
  pnpm --filter core build
  pnpm turbo lint ts:check test --filter=core --filter=database --filter=api
  pnpm --filter api test:e2e test/pantry.e2e-spec.ts
  ```

### Phase 2 — The fortnight's list comes back with what you already have

- [x] done — 2026-10-26, `LOG.md` phase 2. Verified from the main checkout: 11 tasks green and
  **33 e2e tests across the two suites the verification names**, eleven of them new. Three
  amendments, all decided before execution and recorded in step 1; one finding left open on
  purpose and carried into phase 3's step 0 (the `wholeMeals` undercount); one debt written down
  (`spendPantry` runs after `persist`, not after `markSucceeded`). The commit reference is
  backfilled by the next run, after the owner commits.
- **Dispatch**: `backend` — `/execute-project 022 phase 2`, **then `tests` for the e2e suite**:
  `ownership.json` excludes `apps/api/test/` from `backend`, which phase 1 found the hard way
  (`LOG.md`, phase 1, deviation 3). Two dispatches, not one.
- **Goal**: a generation spends the draft: the list is seeded, the ask is recorded on the plan,
  the draft is cleared. No steering yet, and no screen yet.
- **Scope**: `apps/api/src/modules/meal-plans/services/PlanGeneration.service.ts`,
  `packages/core/src/repositories/Plan/PlanRepository.ts`,
  `packages/core/src/domain/ShoppingList/**`, their specs, one e2e.
- **Steps**:
  1. At list build (`PlanGeneration.service.ts:624`), seed `boughtGrams` from the resolved draft
     through `carriedBought` (`PlanRepository.ts:1417`) ~~inside `replaceGeneratedItems`
     (`:1454`)~~ → **amended 2026-10-26, before execution: at the first insert
     (`PlanRepository.ts:361-383`) and not in the rebuild.** `replaceGeneratedItems` is the
     *rebuild* path — swaps, the mid-plan rebuild, project 015's cut — while a plan's first list is
     inserted by a plain `insert(shoppingListItems)` that never mentions `boughtGrams`, so the
     column takes its `'0'` default. Seeding at that first insert is also the smaller change:
     every later rebuild carries the seed for free, because `replaceGeneratedItems` already reads
     `existing.boughtGrams` and passes it through `carriedBought`. One seeding path, not two.
     ~~An entry with no amount means *"I have some"*, not *"I have all of it"*~~ → **amended
     2026-10-26: an entry with no amount seeds the whole row, ticked.** The sentence cannot be
     implemented as written: `0091` gives a tick exactly two meanings, the whole plan's need or
     none of it, so there is no *"some"* state in the list's data model and inventing one is a
     schema change this phase's scope forbids. What settles it is that **phase 0 priced this
     feature with no amounts at all** — its larders were slug lists, and the 17.7% of a
     fortnight's rows it measured counted a row as held because the cupboard named the
     ingredient. The unit of the promise is rows, and criterion 4's own sentence is *«la compra
     baja de 38 a 27 cosas»*. So an amount is capped at the row's need by `carriedBought`, and no
     amount is `carriedBought(totalGrams, totalGrams)`. The owner can reverse this cheaply while
     phase 3 is unbuilt, and the comment in the code names phase 0 so the next reader can.
     A third amendment follows from the first: `ShoppingItemDraft`
     (`packages/core/src/entities/Plan/Plan.ts:227`) carries neither `boughtGrams` nor `checked`,
     so it gains them, optional, and the first insert writes both columns.
  2. Record the ask in `generationMetadata` beside `kitchenShare` and `fixedMeals`, with the
     comment saying what it is for: a re-roll pre-fills from it, and the plan says what it was
     asked with.
  3. Clear the draft when the job succeeds, and **only** then — a failed generation leaves what
     somebody typed where they left it.
  4. Compute the two figures the screen will show — meals using only pantry items, and rows the
     list dropped — and store them with the metadata, so the sentence in phase 3 is read and not
     recomputed.
- **Acceptance criteria**: PRD 5 (no provider call is spent that is not already counted — this
  phase adds none), PRD 6 (the draft dies with the generation, the record dies with the plan).
  A real fortnight's list comes back with the pantry's rows pre-bought and the remainder correct
  **under every range filter** (`0091`).
- **Verification**:
  ```bash
  pnpm --filter core build
  pnpm turbo lint ts:check test --filter=core --filter=api
  pnpm --filter api test:e2e test/generation.e2e-spec.ts test/pantry.e2e-spec.ts
  ```

### Phase 3a — The seams the screen needs

**Amended 2026-11-03, before execution.** Phase 3 was one phase dispatched to `frontend` over
`apps/web` alone. Three of its four steps turned out to have nothing to read: `generationMetadata`
reaches no DTO the web calls (`kitchenShare` is stored and never surfaced, and `fixedMealsOf` is
the only reader of that column anywhere), `PantryEntryView` carries no *"the library cooks nothing
with this"* field — `slug: null` says something else, and PRD 12 counts the two separately — and
there is no route that lists the catalogue, so a picker has nothing to pick from. So the phase is
two: the seams, then the screen. One phase, one pull request, twice.

- **Step 0, added 2026-10-26 from phase 2's finding, DONE 2026-11-03**: the `wholeMeals` undercount
  is closed in `pantryPlates` (`held`, which matches the plate's own slug **or** its dry
  counterpart) and in `apps/api/scripts/evaluate-plans.mjs` (`pantryPlateMetrics`, both `uses` and
  `whole`). The third location, the e2e case, is step 4 below, because it is `apps/api/test` and
  `tests` owns it. **Phase 0's figures stand and are not replaced**: the re-run over `despensa-30`
  came back byte-identical, and the reason is structural, not a cohort accident — see `LOG.md`,
  phase 3a, § *Step 0*. The `??` was load-bearing exactly as written: `drySlug` is nullable.

- [x] done — commit `c1624d1d` ("A cupboard is picked from the catalogue, an entry says whether we
  cook anything with it, and the plan carries what the cupboard did", #317, merged 2026-11-03), with
  `f5ffc5cf` on the same pull request for a suite precondition CI's smaller library could not hold
- **Dispatch**: `backend` for steps 1–3, `tests` for step 4. Neither ships without the other:
  the screen is phase 3b and reads all three.
- **Goal**: the three facts the screen must say are readable on routes the web already calls, and
  nothing about what a cupboard *does* changes.
- **Scope**: `packages/core/src/controllers/{Pantry,Plan}/**`, `packages/core/src/domain/Pantry/**`,
  `packages/core/src/repositories/{Pantry,Recipe,Safety}/**`,
  `apps/api/src/modules/profiles/**`, `apps/api/src/modules/meal-plans/dto/out/**`,
  `apps/api/test/{generation,pantry}.e2e-spec.ts`.
- **Steps**:
  1. **`POST /pantry/catalogue`, the word in the body** — what the picker offers, so that a
     screen never has to invent a food's name. **Not a `GET` with `?q=`**, which was this step's
     first shape: *Search Params* is a recorded field of every Vercel runtime log entry, the live
     `/privacidad` promises *«Los registros del servidor y de errores no guardan lo que escribes»*,
     and `0100` chose a `POST` for `/fixed-meals/not-offered` in exactly those words. `legal`'s
     P1-1 of 2026-11-03 (`docs/legal/pantry.md`), relayed to the implementer before the route
     existed. At most **50** rows, each `{ cookedWith, name, slug }`, ordered by how
     many of the library's plates cook it and then by name; with no `q`, the top 50. Matching is
     `resolvePantryLabel`'s own index (`toMatchIndex` over `ingredient_names` plus the slug), so
     **what the picker finds is exactly what an add resolves to** — a picker that offers a word
     the resolver then misses is the one failure this route exists to prevent, and a spec pins it.
     The whole catalogue is offered and not only what the library cooks with: a cupboard holds
     what it holds, and an entry we cook nothing with is the honest answer PRD 12 aggregates.
  2. **`cookedWith` on `PantryEntryView`** — whether the library plates this entry's food,
     **through the same dual mapping as `held`**: a cupboard's *«arroz»* resolves to
     `arroz-largo-crudo`, which no plate carries and 28 plates reach through
     `arroz-blanco-cocido`, so asking only about the resolved slug would tell somebody
     *«todavía no cocinamos nada con esto»* about the rice we cook most. One repository read of
     the ingredient ids the library uses, mapped through `COOKED_YIELDS`, shared with step 1's
     ordering.
     **But `arroz-largo-crudo` is a trap as the example to build a test on** (`tests`, 2026-11-03):
     it is an ingredient of the `arroz-blanco` and `arroz-rojo` accompaniments
     (`Accompaniment.ts:457`, `:495`), so the side floor answers `cookedWith: true` for it whatever
     the plate counts say, and a case built on it passes with the mapping reverted — green for the
     wrong reason. The food that pins the mapping is one plated **only** under its cooked name and
     **not** a side; the suite picks it at run time. Do not reinstate the weaker case.
  3. **The measured figures, on the plan the web reads.** `PlanController.pantryOf(userId, planId)`
     in `fixedMealsOf`'s shape — parsed defensively out of `generationMetadata`, `null` for a plan
     that recorded none — surfaced as `pantry: { coveredRows, meals, rows, wholeMeals } | null` on
     the DTO behind `/meal-plans/active`. **No label and no slug**: counts only, so criterion 7
     needs no new exception and `health-boundary.spec.ts` is untouched.
  4. **The e2e case, step 0's third location** (`tests`): `generation.e2e-spec.ts`'s recomputation
     of `whole` compares raw plate slugs, which is the rule the fix replaced, so it must recompute
     the same way `pantryPlates` now does — and gains a case where a plate is reached **only**
     through the mapping, so the fix is pinned by a test that fails without it. Cases for 1–3 in
     `pantry.e2e-spec.ts`: the picker's answer resolves on add, an entry nothing is cooked with
     comes back `cookedWith: false` and stays, and the figures are on the plan after a generation.
- **Acceptance criteria**: PRD 7 (only slugs and counts leave the product; nothing hand-written),
  PRD 8 (nothing here is a restriction, and `cookedWith` removes no dish), and PRD 12's two halves
  stay distinguishable — unresolved is `slug: null`, uncooked-with is `cookedWith: false`.
- **Verification**:
  ```bash
  pnpm --filter core build
  pnpm turbo lint ts:check test --filter=core --filter=api
  pnpm --filter api test:e2e test/generation.e2e-spec.ts test/pantry.e2e-spec.ts
  ```

### Phase 3b — The screen, and the sentence it is allowed to say

- [x] done — commit `4a537739` ("You can say what is already in the house before a fortnight is
  asked for, and afterwards the plan says what it did with it", #319). Built, reviewed and probed on
  2026-11-04 (`LOG.md`, phase 3b). **Its `human-verify` gate was closed by the owner on 2026-11-05
  — *«La 3B ciérralo»* — and not met**: he did not report having opened it on his iPhone, and a
  record may not turn an instruction to close into a verification that happened. So the two things
  no probe on this machine can answer are **still unverified on a device**, and they are named here
  rather than lost: VoiceOver's reading of the add and remove announcements, and whether the amount
  field brings up a decimal keypad. Everything a probe *can* answer was answered — `accessibility`'s
  review, 12 probe cases at 320/390/1280 in both schemes and both languages, and the design review
  at PASS with no P0 and no P1
- **Dispatch**: `frontend`. `legal` answers its four questions **before** this ships
  (**owner-approves**: its findings), `accessibility` reviews the picker, and
  **human-verify**: the owner opens it on his iPhone.
- **Goal**: somebody can say what is in the house, is told the truth before committing, and is
  told afterwards what actually happened.
- **Scope**: `apps/web/src/app/(app)/plan/**`, `apps/web/src/components/**`,
  `apps/web/src/i18n/dictionaries/**`, `packages/ui` if a control is missing.
- **Steps**:
  1. The picker over the catalogue on the generation path (`GenerationProgress.tsx:114` is where
     a fortnight is asked for today) — **never a free-text box**: what somebody types filters
     phase 3a's `POST /pantry/catalogue`, and what is sent is a row the catalogue answered —
     **the `name` it was given, unmodified**, which is the string the resolver re-answers.
     `/privacidad` allows exactly one hand-written exception and `0100` is it.
  2. The honest sentence before anybody commits, with the ~100-ingredient fact in it (a
     fortnight needs **90–120 distinct ingredients**, PRD § *Problem*), and the verb
     **`aprovechar`** — never *«a partir de»*. No count promised before generation.
  3. Per entry, when nothing in the library cooks it — `slug: null` or `cookedWith: false`:
     *«Todavía no cocinamos nada con esto»*, and it **stays** in the list.
  4. After the plan exists, the one measured sentence, read from `pantry` on the plan and never
     recomputed. `null` means nobody was told anything and the sentence is not said at all.
  5. `legal`'s four questions answered in `docs/legal/` before this ships: the picker against
     `/privacidad`, retention and the DSAR export of a spent draft, that sending only slugs
     leaves `0100`'s boundary intact so no consent version moves, and that a pantry entry can
     never be read as an intolerance or a diet.
- **Acceptance criteria**: PRD 9 (legal reviewed and answered), PRD 10 (the screen says the
  honest thing, **exactly one number** and only after the plan exists, reviewed with
  `apple-web-design`, P0 and P1 fixed, looked at with `/local-probe` at 320/390/1280 in both
  appearances and **both languages**), PRD 7 and 8 again at the surface: nothing typed is sent
  anywhere, and no wording invites somebody to declare a restriction here.
- **Verification**:
  ```bash
  pnpm turbo lint ts:check test --filter=web --filter=ui
  # /local-probe: the generation screen and the shopping list, 320/390/1280, light and dark, es and en
  sh .claude/skills/ship/scripts/gate.sh --full "<scratchpad>"
  ```

### Phase 4 — The rank, measured, behind a flag

- [x] **done — commit `a142e8ad` (#321). `owner-approves` answered by the owner on 2026-11-05**, after the
  report that put this phase's three open questions and the executor's recommendation in front of
  him: *«haz pr, merge, lo que haga falta tu solo, termina ambas fases bien y completas»*. What
  that answer covers, written out so it can be contradicted: the **share at 5**, the **cupboard
  yielding before the appliance**, and the **residual accepted while the flag is off** — which is
  how it shipped. What it does **not** cover, and what no instruction to ship can: flipping
  `pantry_rank`. That still needs [`docs/legal/pantry.md`](../../legal/pantry.md) § 9.6 worked
  through, the on-state proofs green and the two `[lawyer]` lines read. **He flipped it later
  that day**, with § 9.6's two texts live and the rest of it not: § 9.6 records which boxes
  were ticked after the click, and the `[lawyer]` lines are on his list and stay open. Built and
  measured
  2026-11-04 ([`LOG.md`](./LOG.md) § Phase 4). **Reopened 2026-11-04 by the owner** —
  *«haz la 4 también»*, which reverses the deferral
  below and nothing else about it. What still stands, because it was never the deferral's doing:
  the **`owner-approves` gate on the cohort numbers before the flag flips**, the flag shipping
  **off**, and the stop conditions in *Acceptance criteria*. The first thing measured is the
  repair in phase 0's notes — never let the cupboard's reserve take a dish that would break a
  per-fortnight cap — because the shares that bought a visible gain broke the egg cap in three
  plans of four, and that is what deferred this in the first place. Queued behind phase 5's read:
  this is an evaluator phase and this machine runs one heavy job at a time.

  The deferral it reverses, kept as written:

  **struck 2026-10-23 — the owner's decision at phase 0's `owner-approves` gate**
  ([`docs/decisions/LOG.md`](../../decisions/LOG.md)), and **not** because the stop signal fired:
  it did not. Deferred, not cancelled. The reason is worth, not safety: at the one share that
  costs nothing the rank buys one meal in forty-two, and the shares that buy a visible gain break
  the fortnight's egg cap in three plans of four (`LOG.md`, phase 0, § 4 and § 5).
  **Do not start this phase** *(superseded by the line above, 2026-11-04)*. It reopens on real usage — people filling sixty-item cupboards who
  still report the shop as long — and the first thing to measure then is the repair in `LOG.md`'s
  notes for the next phase: never let the cupboard's reserve take a dish that would break a
  per-fortnight cap. Everything below is kept as the shape the steering would take, not as work
  that is pending.
- **Dispatch**: `backend-high` — `/execute-project 022 phase 4` — **owner-approves**: the cohort
  numbers before the flag flips. Above the profile's implementation row on purpose: this re-opens
  `applianceShare`, a constant 021 measured twice and saturated at 14 of 19.
- **Goal**: the fortnight leans on what is in the house, by the composition phase 0 chose, with
  the promise still outranking it.
- **Scope**: `packages/core/src/domain/Variety/Rotation.ts`,
  `apps/api/src/modules/meal-plans/services/PlanGeneration.service.ts`, their specs.
  **Amended 2026-11-04, after the work and recorded in [`LOG.md`](./LOG.md) § Deviations**: the
  repair needed `cappedKinds` (`packages/core/src/domain/Balance/Balance.ts`) and the kinds reach
  the rank through `RecipeController.rotateFor`; the flag needs
  `packages/core/src/domain/Flag/Flag.ts` and `SettingsController`; one `FlagSet` literal in
  `apps/api/src/modules/billing/services/Billing.spec.ts` had to grow with the new key; the
  evaluator (`apps/api/scripts/evaluate-plans.mjs`) now calls the real code path instead of a
  mirror of it; and the flag reaches `apps/web` — a new `FlagName` leaves the
  `Record<FlagName, string>` of `admin/ajustes/registro/page.tsx` incomplete and reddens the
  web's `ts:check` by itself, so the label, its three strings in both dictionaries and a
  `FlagSwitch` on `/admin/ajustes` ship with this phase: an `owner-approves` gate on a switch
  the owner cannot throw is not a gate.
- **Steps**:
  1. The rank — ordered by **how many items somebody would have to buy**, never a boolean — in
     the ordering `rotatePool` already does (`Rotation.ts:376`), in the composition phase 0 chose
     and not another.
  2. Its **rung on `narrowerShares`** (`:156`, `withApplianceShare` at `:174`), so the share is
     taken away before the bands are missed and the pantry is not lost in `wider_rotation`
     together with the rotation's variety, its avoid list and its food-group reserves.
     **Phase 0 measured this rung and it is the whole of why the steering is viable**: without
     it the quota pushed rescues from 14 of 112 fortnights to 23 and cost days in band; with it
     every day stayed in band and rescues *fell* to 10–12. **What phase 0 did not settle** is
     which preference yields first when somebody has both a cupboard and a preferred appliance:
     its figures for criterion 3 were taken with the cupboard yielding first
     (`--pantry-yields first`), and the other order is priced in `LOG.md` but is this phase's to
     choose.
  3. `pantryShare` recorded on the plan beside `kitchenShare` (`:541`, nulled at `:575`), so what
     the bands cost the pantry is countable rather than invisible.
  4. Behind a scheduler flag, off, until the owner has the numbers.
- **Acceptance criteria**: PRD 3 (the kitchen does not regress: `APPLIANCE_DISHES_PER_SLOT` = 14
  of 19 and 021's median 20 air-fryer plates of 56 hold on the same cohort), PRD 4 (the rung and
  the stored figure), PRD 2 (every figure with its spread over at least eight seeds), PRD 8 (a
  preference may never remove a dish). **Stop** if rescues rise or if plates using a pantry item
  are no better than the no-pantry run: that is the `0102` failure repeated, a defect and not a
  trade, and the shape goes back to order-only.
- **Verification**:
  ```bash
  pnpm --filter core build
  pnpm turbo lint ts:check test --filter=core --filter=api
  NUTRIA_LOCAL_PG=1 node apps/api/scripts/evaluate-plans.mjs --rotate 8 --flag accompaniments --pantry "<larder-30>" --json "<scratchpad>/pantry-rank.json"
  NUTRIA_LOCAL_PG=1 node apps/api/scripts/evaluate-plans.mjs --rotate 8 --flag accompaniments --prefer air_fryer --json "<scratchpad>/kitchen-regression.json"
  ```

### Phase 5 — What the catalogue could not cook

- [x] done — commit `a142e8ad` (#321), built 2026-11-04, [`LOG.md`](./LOG.md) § Phase 5. The read, the page, the floor in both
  the `SELECT` and the `ORDER BY`, the eight end-to-end cases (the floor's proved by breaking it),
  the probe at three widths in both languages, and `legal`'s review with P2-6 and P2-10 closed.
  The commit reference is backfilled by the next run, after the owner commits.
- **Dispatch**: **amended 2026-11-04, before execution** — `backend` for the read, then
  `frontend-low` for the page, then `tests` for the route's end-to-end case. The original line
  named `frontend-low` alone, which does not survive its own **Scope**: the read behind the page
  lives in `apps/api/src/modules/admin/**` and in `packages/core` (a repository aggregate and an
  `Admin*Controller`), neither of which `frontend` owns — phase 1 learned the same lesson about
  `apps/api/test/` the hard way. The pricing stands: each half is small.
- **Goal**: the entries nobody could resolve, and the ones resolved to an ingredient no recipe
  uses, become the library's own to-do list.
- **Scope**: `apps/web/src/app/(admin)/admin/catalogo/**`, the read behind it in
  `apps/api/src/modules/admin/**`.
- **Steps**:
  1. Aggregate counts only — how many accounts named a thing, never which account named it.
     **`legal`'s P2-6 (2026-11-03) adds two conditions**: a word the catalogue could not answer is
     shown only above a **threshold of two accounts** and never verbatim from one, which is
     `0028`'s *"a screen that cannot read anyone"* held to; and if any such word is ever shown,
     `/privacidad`'s *«Lo que nos escribes»* bullet gains it, because the owner reading words
     people typed is a disclosure of a different kind from a model never seeing them.
  2. Two groups, because the answer differs: *not in the catalogue* (add an ingredient) and *in
     the catalogue but in no recipe* (**513 of 930, confirmed on 2026-11-04** against the local
     library — write dishes). **The first group may be
     empty, and that is the picker working**: phase 3b picks from the catalogue, so from the
     screen every entry resolves and `slug: null` cannot arise — the group survives for entries
     that reached the route another way, and this phase reports it at whatever size it has rather
     than inventing a free-text box to fill it (`legal`'s P2-6, same date).
- **Acceptance criteria**: PRD 12. The page shows no personal data and no label traceable to one
  person.
- **Verification**:
  ```bash
  pnpm turbo lint ts:check test --filter=web --filter=api
  # /local-probe: /admin/catalogo with an admin account that has a second factor (0074)
  ```

## Hand-off

Standing constraints for every phase of this project:

- **No prompt change, in any phase.** The rank is computed from `CandidateDish.ingredients`.
  Nothing this project adds reaches `promptPreferences`, so `health-boundary.spec.ts:295`'s
  allowed-keys list does not change. Marking pantry rows in the catalogue listing is out of scope
  and may not be added "while we are here": it reaches 7 of 19 dishes a slot, `0102` bounded that
  kind of steering at 34%, and it re-opens a published privacy boundary for it.
- **The hard filter is not reopened.** `--pantry-mode filter` exists in phase 0 to confirm the
  refusal with this cohort's numbers and nowhere else. It is not a product mode, not a switch and
  not a "strict" option.
- **`pnpm --filter core build` before anything is measured.** The evaluator and the API load
  `packages/core` from `dist/`; an unbuilt edit measures nothing and returns identical numbers,
  and an interrupted build leaves zero-byte files both caches call done.
- **One heavy job at a time.** Phases 0 and 4 are evaluator runs; they never overlap a gate, an
  e2e suite or another agent's run — this machine has 15 GB and dies under load.
- **Local Postgres only** (`pnpm db:local`, `NUTRIA_LOCAL_PG=1`). Never Neon, never production,
  and never a test generation on the owner's production account.
- **A number is a cohort number.** A constant priced on one seed is not priced
  (`packages/core/AGENTS.md`, the rotation row, and 021's criterion 8).
- **Agents never stage, commit or push.** Each phase stops at its boundary, logs, and hands the
  owner a proposed commit message.

## Out of scope

- **One meal from what you have** — the per-meal filter through the swap path, where a filter
  needs one dish and not nineteen (`architecture/0012` § 9, phase 3). The honest follow-on to
  this project and a project of its own.
- **A hard filter on a fortnight's pool**, in any tier, mode or switch: PRD § *Scope* Out.
- **Depletion of amounts across the fortnight**: PRD § *Scope* Out.
- **A standing larder** with dates, expiry or reminders: PRD § *Scope* Out.
- **A typed pantry field**: PRD § *Scope* Out; it would need a second exception to
  `/privacidad`'s one, and `0100` is the precedent for what that conversation costs.
- **Any new allowance row, counter or tier-varying size**: PRD § *Scope* Out.
