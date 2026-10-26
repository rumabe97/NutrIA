# Plan — Project 022: A plan that leans on your cupboard

> **Purpose**: the phased technical execution plan — the engineering half of the contract.
> `/execute-project` follows this literally; executors implement phases, they do not redesign
> them. If implementation must diverge, the plan is amended in the same change and the
> deviation is recorded in `LOG.md`.
> **Audience**: agents primarily, humans review. **Committed**: yes. **Written by**: the
> planner via `/plan-project`, 2026-10-23; approved by the owner before execution starts.

- **Status**: **approved** — by the owner on **2026-10-23**, who said he had read the six
  phases (*«si, lo he leído y lo apruebo»*). The PRD it executes was approved the same day.
  Execution starts at phase 0, which writes no product code.
- **Type**: standard
- **PRD**: [`./PRD.md`](./PRD.md). Criterion coverage: 1 → phase 0; 2 → phases 0 and 4; 3 →
  phases 0 and 4; 4 → phase 4; 5 → phases 2 and 3; 6 → phases 1 and 2; 7 → phases 1 and 3;
  8 → phases 1, 3 and 4; 9 → phase 3; 10 → phase 3; 11 → phases 0 and 1; 12 → phase 5.
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

### Phase 3 — The screen, and the sentence it is allowed to say

- **Step 0, added 2026-10-26 from phase 2's finding**: close the `wholeMeals` undercount **before
  any sentence is written**. A plate carries a cooked slug and no cupboard holds one, so a rice,
  pasta or dry-pulse meal is never counted as cooked from the house — while the list, which buys a
  cooked grain dry (`0078`), *is* pre-bought correctly, so `coveredRows` is unaffected. Map with
  `toDry(item.slug, 0)?.drySlug ?? item.slug` in `pantryPlates`, in
  `apps/api/scripts/evaluate-plans.mjs`'s `pantryPlateMetrics.whole` and in the e2e case
  **together**, then **re-run phase 0's cohort** so the figure the screen quotes is measured. Phase
  0's own *≈9 of 54* was measured with the same gap and is replaced by whatever the re-run says.
  **The `??` is load-bearing**: `drySlug` is `string | null` (`domain/Yield/Yield.ts:42`), because a
  cooked food whose dry counterpart the catalogue does not hold goes on a row of its own
  *"(en seco)"* — so a bare `toDry(...)?.drySlug` would drop exactly those plates instead of
  counting them.
  See `LOG.md`, phase 2, § *The finding phase 2 leaves open*.

- [ ] pending
- **Dispatch**: `frontend` — `/execute-project 022 phase 3`. `legal` reviews **before** it ships
  (**owner-approves**: its findings), `accessibility` reviews the picker, and
  **human-verify**: the owner opens it on his iPhone.
- **Goal**: somebody can say what is in the house, is told the truth before committing, and is
  told afterwards what actually happened.
- **Scope**: `apps/web/src/app/(app)/plan/**`, `apps/web/src/components/**`,
  `apps/web/src/i18n/dictionaries/**`, `packages/ui` if a control is missing.
- **Steps**:
  1. The picker over the catalogue on the generation path (`GenerationProgress.tsx:114` is where
     a fortnight is asked for today) — **never a free-text box**: `/privacidad` allows exactly
     one hand-written exception and `0100` is it.
  2. The honest sentence before anybody commits, with the ~100-ingredient fact in it, and the
     verb **`aprovechar`** — never *«a partir de»*. No count promised before generation.
  3. Per entry, when nothing in the library cooks it: *«Todavía no cocinamos nada con esto»*, and
     it **stays** in the list.
  4. After the plan exists, the one measured sentence, read from phase 2's stored figures.
  5. `legal`'s four questions answered in `docs/legal/` before this ships: the picker against
     `/privacidad`, retention and the DSAR export of a spent draft, that sending only slugs
     leaves `0100`'s boundary intact so no consent version moves, and that a pantry entry can
     never be read as an intolerance or a diet.
- **Acceptance criteria**: PRD 9 (legal reviewed and answered), PRD 10 (the screen says the
  honest thing, reviewed with `apple-web-design`, P0 and P1 fixed, looked at with
  `/local-probe` at 320/390/1280 in both appearances and **both languages**), PRD 7 and 8 again
  at the surface: nothing typed is sent anywhere, and no wording invites somebody to declare a
  restriction here.
- **Verification**:
  ```bash
  pnpm turbo lint ts:check test --filter=web --filter=ui
  # /local-probe: the generation screen and the shopping list, 320/390/1280, light and dark, es and en
  sh .claude/skills/ship/scripts/gate.sh --full "<scratchpad>"
  ```

### Phase 4 — The rank, measured, behind a flag

- [ ] **struck 2026-10-23 — the owner's decision at phase 0's `owner-approves` gate**
  ([`docs/decisions/LOG.md`](../../decisions/LOG.md)), and **not** because the stop signal fired:
  it did not. Deferred, not cancelled. The reason is worth, not safety: at the one share that
  costs nothing the rank buys one meal in forty-two, and the shares that buy a visible gain break
  the fortnight's egg cap in three plans of four (`LOG.md`, phase 0, § 4 and § 5).
  **Do not start this phase.** It reopens on real usage — people filling sixty-item cupboards who
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

- [ ] pending
- **Dispatch**: `frontend-low` — `/execute-project 022 phase 5`.
- **Goal**: the entries nobody could resolve, and the ones resolved to an ingredient no recipe
  uses, become the library's own to-do list.
- **Scope**: `apps/web/src/app/(admin)/admin/catalogo/**`, the read behind it in
  `apps/api/src/modules/admin/**`.
- **Steps**:
  1. Aggregate counts only — how many accounts named a thing, never which account named it.
  2. Two groups, because the answer differs: *not in the catalogue* (add an ingredient) and *in
     the catalogue but in no recipe* (513 of 930 today — write dishes).
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
