# Plan — Project 021: Cooked with what you have

- **Status**: **done — every phase shipped and merged, 2026-10-19.** Phases 1–11 and 5b, 5c
  are in `main`; the owner confirmed the screens on his iPhone on 2026-10-18 and loaded the
  second batch into production himself the same day. What the project leaves open is written
  in the PRD against criteria 7 and 8 and in `0102` — not work, but a reading: criterion 8 is
  met over a cohort and is not a promise about one generation, and its re-wording waits on the
  owner. (Approved by the owner, 2026-10-15.)
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

- [x] done — commit `21a3d3d0` ("A kitchen is a row per appliance, and a dish carries what
  it cannot be cooked without", #282)
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

- [x] done — commit `7d67c055` ("Every dish in the library says what it cannot be cooked
  without", #283)
- **Dispatch**: opus @ medium — `/execute-project 021 phase 2`
- **Goal**: the 1128 dishes already in a library declare their equipment, inferred from the
  prose of their steps, auditably.
- **Scope**: `packages/database/src/migrations/**`, `apps/api/scripts/**` (a measuring
  script only if the phase needs one), `scripts/export-reference-library.mjs`
  (added 2026-10-16, `migration-reviewer` on phase 1 — see step 4) and
  `scripts/local-pg.mjs` (added 2026-10-16, `migration-reviewer` on this phase — see
  step 5), plus `packages/database/AGENTS.md` for what the column means.
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
  5. **Replay this migration in `pnpm db:local reset`.** `scripts/local-pg.mjs` re-runs the
     data-only migration `0056` after each library load, because a data migration that runs
     before the library exists has nothing to work on. This one is the second of those: left
     out, every reset from now on produces a library where **no dish needs anything**, which
     is the opposite of production and fails nothing out loud — and phases 3 and 6 measure
     the evaluator on exactly that library (`migration-reviewer`, 2026-10-16).
  6. **Read production before this merges.** The development library is 871 of production's
     962 rows by slug, so ~91 have never had their prose read by these patterns — and a
     wrong claim on any of the seven appliances the default kitchen marks `missing` removes
     that dish from **every** account. One read-only `SELECT` computing what the migration
     would write, with the slug and a snippet of every row that would claim one of those
     seven, is the evidence (standing approval for production reads, 2026-10-15).
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

- [x] done — commit `2a04effb` ("A dish nobody can cook is never served, and a kitchen
  somebody prefers is asked for", #284)
- **Dispatch**: opus @ high — `/execute-project 021 phase 3` · *deviation*: the profile's
  own exception, since this changes the gate on what a model returns.
- **Goal**: a missing appliance is a constraint in the three places the cooking time is
  one, and a preference is asked of the model without ever removing a dish.
- **Scope**: `packages/core/src/domain/Preference/**`,
  `packages/core/src/domain/FixableReason/**`,
  `packages/core/src/controllers/Recipe/**`, `apps/api/src/modules/ai/**`,
  `apps/api/src/modules/fixed-meals/**`, `apps/api/src/modules/meal-plans/**` — and five
  more the first version of this line did not name, each unavoidable rather than chosen
  (amended during execution, 2026-10-16): `packages/core/src/entities/Plan/**` (the pool and
  `whyNotFixable` need the dish's declaration, and `AiCall`'s union is the only place a
  rejection reason can be recorded), `packages/core/src/domain/Variety/**` (`rotatePool`
  shuffles by seed *before* it partitions, so a preference can only order inside
  `isPreferredDish` — which is also what makes it provably unable to remove a dish),
  `packages/core/src/repositories/Plan/**` and
  `packages/core/src/repositories/DishRequest/**` (PRD 2 asks that a dish the model writes
  carries its own declaration, and these two are the inserts), and
  `apps/api/src/modules/events/**` (the plan rebuild is the second place a pin is restored
  from a filtered pool, so it owes the same line the generation does),
  `packages/core/src/entities/Kitchen/**`, `packages/database/src/schemas/kitchen.schema.ts`
  and `packages/database/AGENTS.md` (the owner's blender decision, and the comments that
  enumerate the normal kitchen), and
  **`apps/web/src/i18n/dictionaries/**` for four keys only** — widening `NotFixable` and
  `DishRejection` breaks `pnpm --filter web ts:check` where the dictionaries index by the
  reason, so the words must land in the same change or the repository is red between
  phases. The screens, their design review and the wording on them stay phase 5's.
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

- [x] done — commit `58a4971b` ("A person can say what their kitchen has, and skipping the
  question costs nothing", #285)
- **Dispatch**: sonnet @ medium — `/execute-project 021 phase 4` · mechanical from a
  complete contract.
- **Goal**: the kitchen can be read and written by a person, through the profile and
  through an onboarding step neither of which may be required.
- **Scope**: `apps/api/src/modules/profiles/**`, `apps/api/src/modules/onboarding/**`,
  `packages/core/src/entities/Onboarding/**` — and three more the first version of this line
  did not name (amended during execution, 2026-10-16):
  `packages/core/src/controllers/Onboarding/**`, because without a `case 'kitchen'` in
  `saveStep` the step would fall through the switch, write nothing and still be marked
  complete; and `packages/core/src/controllers/Kitchen/**` with
  `packages/core/src/entities/Kitchen/**`, because a **list** of changes needs one place that
  knows the order to write it in, and that place is the controller that owns the bound on
  `prefers` rather than the step a list first arrived in.
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

- [x] done — commit `6efb2a5b` (#286). **Confirmed by human on 2026-10-18**: the owner
  checked the kitchen screens on his own iPhone, on his own account, after the deploy —
  *"todas las pantallas que me has comentado salen bien"* — which closes PRD criterion 1's
  `human-verify` gate and the iPhone check this line had owed since the merge. **The check was
  owed after the merge, not before**: this
  repository has no preview deployments on purpose (`ignoreCommand` skips every branch but
  `main`, and a preview URL is in neither `ALLOWED_ORIGINS` nor `BETTER_AUTH_URL`), and the
  one screen most needing a device — the dish detail with its icons — cannot be reached
  locally at all, because a probe account has no plan. The gate is therefore met where it
  can be met: in production, on his own account, straight after the deploy.
  **Confirmed by the owner on 2026-10-16**, with a photograph of his iPhone: the equipment
  line renders on the dish detail, icon and name, on his own plan in production.
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
  4. **`wayForward` owes the new reason a route.** `FixedMealPlanner.tsx`'s `wayForward` has
     no `missing_equipment` case, so the dictionary's *"Revisar tu cocina"* is unreachable
     and a reason marked `actionable` sorts to the top with nothing to do
     (`invariant-reviewer`, 2026-10-16). The route is this phase's kitchen section, which is
     why the gap was left rather than closed in phase 3.
  5. The dish detail shows the appliances the dish declares: **one inline SVG per
     appliance, sized to the text, with its name beside it** — never an emoji, never an icon
     alone (`apple-web-design`, and the name is what an assistive technology reads). A dish
     that declares only a stovetop shows nothing: a chip on every dish is noise.
  6. **`/privacidad` has to name the kitchen, and the `legal` agent has decided how**
     (2026-10-16; the wording, its sources and the publish conditions are in
     `docs/legal/textos/02-politica-privacidad.md`, marked `⟦cocina⟧`, with
     `analysis.md` § 9 P2-16, the processing record's row 2 and the DPIA § 1.2 updated
     beside it). Four text changes, both dictionaries together:
     - a **new bullet of its own** in *"Qué datos recogemos y para qué"*, after *"Tu forma
       de comer"*. Not folded into that entry, and the reason is worth keeping: that entry
       is quoted by the special-category section **and** by the art. 9.2.a consent
       paragraph, so putting the appliances inside it would tell a reader they sit under the
       health consent — which the code does not do (`setStance` checks no consent, and the
       kitchen is written through the ordinary preferences endpoint).
     - an insertion in *"Lo que recibe el modelo"*, naming the appliances they do not have
       and the ones they would rather use. **This half is already late**: prompt 4.9.0 has
       been sending both lines for every account since #284, so the page's enumeration of
       what travels to a processor falls short today. If this phase slips, that insertion
       ships with whatever goes out first.
     - a P3 in Spanish only: *"la cocina que te gusta o no"* → *"las cocinas…"*, now that
       *"Tu cocina"* sits beside it and would otherwise be read as the room.
     - the bullet also closes `cookingTimeMinutes`, which — correcting what the first
       version of this line said — **is** named in the model paragraph (since prompt 4.4.0)
       and was missing only from the collection list.
     The policy's own words for the default kitchen (*"fuegos, horno, microondas y
     batidora"*) must match the labels step 2 gives those four appliances; if the screen
     says *placa*, so does the policy. **No consent version is bumped and no notice mail is
     sent**, deliberately: a bump would send every existing account back through the
     blocking health-consent screen for a datum that is not health, and nothing in the
     "nunca" list changes. Legal basis 6.1.b, not art. 9, not art. 22.
  7. `/local-probe` at 320, 390 and 1280 px, light and dark, signed in, both languages —
     the kitchen screens and a dish detail with an oven dish in it.
- **Acceptance criteria**: PRD 1 and 5. No sideways scroll at any width, every control
  reachable by keyboard, the empty state saying that silence means a normal kitchen, and the
  dish detail legible at 320 px with its icons carrying no meaning of their own.
- **Verification**: `pnpm turbo lint ts:check test --filter=web --filter=ui`; the probe's
  lines and screenshots in the LOG entry; the `accessibility` agent on the new screen.

### Phase 5b — A rule that is not being honoured says so

- [x] done — commit `35d6b439` ("A fixed meal the next plan cannot honour says so, on its own
  row, with what changed", #291), refined by `1bed4cc7` ("Fixing a meal takes 82 ms instead of
  four seconds, and a day you overrule says so", #292). **This line said `in progress` for
  three days after the work was in `main`** — the latency question the phase was waiting on
  was answered inside it and measured (`GET /fixed-meals/honourability` on its own route,
  fetched lazily by `IntersectionObserver` when the planner scrolls into view: 75–90 ms there
  against 2 ms on the screen's own payload, which is why it is not on it), and the status was
  never moved. Phase status lives here and nowhere else, so a stale line here is the plan
  lying about the code.
- **Dispatch**: opus @ medium — `/execute-project 021 phase 5b` · *added during execution,
  2026-10-16*: this was step 4 of phase 5 until the lead read what it costs.
- **Goal**: a standing fixed meal the generator can no longer honour says so, with the
  reason, instead of quietly serving something else.

  **Amended 2026-10-16, during execution: this said "for all four reasons" and the four
  were wrong.** The season is **not** one of them — measured by `backend`, read in the
  scheduler and verified by the lead: `honouredPin` is consulted at the top of the slot
  loop and nothing below it runs, the season predicate lives in the day search under it,
  and neither `servable` nor `pinnable` filters by month, so **a June dish fixed to a
  December Monday is still served**. There is nothing to tell anybody about it. The
  sentence in `FixedMealsService`'s own header that claimed otherwise had been wrong since
  before this project and is now corrected there. **Five causes produce a sentence**: a
  cooking time lowered under the dish (`too_slow`), a kitchen that lost an appliance
  (`missing_equipment`), a dish dropped from the catalogue or an account that switched
  language (`unknown_dish`, new), a meal the person stopped eating (`wrong_slot`), and two
  rules one day cannot hold together (`clashes_with_fixed`). The season reaches that last
  one when another rule shares the day, where it is a **mislabel** — recorded rather than
  machined around, because naming it costs a second mechanism.
- **Why it is its own phase.** **Say when a standing fixed meal is not being honoured — for all four reasons, not
     only the kitchen** (`invariant-reviewer` and `backend-high` agreed on this, 2026-10-16;
     the lead moved it here from phase 4 because the sentence needs the screen that says it).
     A rule whose dish the person's own filters now refuse is not in the pool the generation
     restores pins from, so `honouredPin` builds the day as though the rule did not exist —
     correctly (`0097`: the pool is a bound, and safety outranks a rule) and **silently**.
     Four things were believed to cause it — the season, a dish dropped from the catalogue,
     a cooking time lowered under the dish, and now a kitchen — and **the season turned out
     not to be one of them**; see the amended goal above. Phase 3 made it audible — both the generation
     and the event rebuild log every pin they could not honour — and `FixedMealsService`'s own
     header promises **one** mechanism for all of them, so an equipment-only flag would be the
     wrong shape. What this phase owes: `FixedMealsView` marking a rule as not currently
     honourable and one sentence on the screen saying why (`0011` § 2: a list that silently
     gets shorter explains nothing). It costs a generation context inside `standing()`, which
     is why it is a phase of its own and not a line.
     **Never restore such a pin from the unfiltered library**: that library still holds what
     the allergy gate, a dislike and their way of eating removed, and a pin is a forced
     candidate — the reviewer proposed it, checked `fitted` and withdrew it.
     Measured the day phase 3 was written: **1 standing rule in all of production**, and the
     default kitchen drops none of it; one production dish of 962 needs an appliance the
     default lacks.

  The cost is the reason it was taken out of phase 5 rather than squeezed into it:
  `FixedMealController.standing` is today **three cheap parallel reads** (the rules, the
  limits, the month's dish requests) on a screen people open to look at their rules, and
  answering honourability means assembling a generation context — the catalogue, the safety
  profile, the kitchen and the library pool — per call. That is a latency decision about the
  profile screen, not a sentence, and it wants measuring: either the context is built once
  and cached for the request, or the answer is computed where a generation already builds
  one and stored, or the screen asks for it separately when somebody opens that section.
  Phase 3 already made the drop **audible** in the logs, so nothing is silent for the owner
  in the meantime — only for the person.
- **Scope**: `packages/core/src/controllers/FixedMeal/**`, `apps/api/src/modules/fixed-meals/**`,
  `apps/web/src/components/FixedMealPlanner/**`, `apps/web/src/i18n/**`, and — **added
  2026-10-16, during execution** — `packages/core/src/domain/FixableReason/**` and
  `packages/core/src/domain/Scheduler/**`. Both crossings are the plan's own rules being
  obeyed rather than bent: the new `unknown_dish` reason belongs where the nine others
  live, because a second mechanism is what this phase forbids; and `dayHoldsPin` belongs
  beside `pinnable`, because it is `pinnable`'s own last filter asked of one dish instead
  of a whole pool — **6 ms against 2.7 s**, with a test asserting the two agree dish by
  dish.
- **Acceptance criteria**: a rule whose dish the person's filters now refuse is listed as
  not being honoured, with the reason, **for every cause that has one** (five, not the four
  this plan assumed — the amended goal says which, and why the season is not among them) —
  and opening the profile is no slower than it is today, measured rather than assumed.

  **How the second half was met, and it is not the way this plan guessed.** It said "either
  the context is built once and cached for the request, or the answer is computed where a
  generation already builds one and stored, or the screen asks for it separately", and the
  numbers chose the third: `standing()` is **2 ms** and folding honourability into it makes
  it **76 ms**, forty times slower, on a screen people open to look at their rules and for
  an answer that is empty for almost every account (one standing rule in all of
  production). So honourability is its own route, `GET /fixed-meals/honourability`, and
  `FixedMealsView` is untouched. Storing it at generation time was refused on correctness
  rather than on cost: every cause can change *after* a generation, so a stored answer
  would be right about the last plan and wrong about the person.
- **Verification**: `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web`;
  the `accessibility` agent on the changed list; and a before-and-after of what `standing()`
  costs.

### Phase 5c — The onboarding card at 200%

- [x] done — commit `0f9aed45` ("The onboarding flow is readable at the browser's largest
  font size", #287)
- **Dispatch**: opus @ medium · *added 2026-10-16, measured by `accessibility` and
  `frontend` during phase 5 and declined by both as not that phase's.*
- **Goal**: the onboarding flow is readable at the browser's largest font size, which is the
  size the owner reads at.
- **The measurement, so nobody has to take it again**: at font size 32px, `/onboarding/8`
  reaches x=403 in a 390px viewport and x=399 in a 320px one **with the document's
  horizontal overflow at 0** — so the last 13px (390) or 79px (320) is cut off and cannot be
  scrolled to, which is the silent kind. **Steps 2, 5, 6 and 7 reach exactly the same
  numbers and step 4 reaches 497**, so it is the card's floor and not the kitchen's;
  `/onboarding/9` and `/perfil` are clean, and 150% is clean everywhere.
- **The cause**: the outer `fieldset` in `OnboardingFlow.tsx` and the row fieldsets carry the
  UA's `min-inline-size: min-content`, which no `width` can lower. Phase 5 put
  `min-inline-size: 0` on the kitchen's own rows so they can never be what sets the floor;
  the card itself is untouched.
- **Scope**: `apps/web/src/components/OnboardingFlow/**` and whatever a fix needs beside it.
- **Why its own phase**: it is seven screens, it wants its own probe at 200% and 320px, and
  it is older than this project — fixing it inside phase 5 would have shipped a change to
  six screens nobody had looked at under cover of a seventh.
- **Verification**: the probe at 320 and 390 with the browser's font size at 32px, every
  onboarding step, before and after.

### Phase 6 — What it costs, measured

- [x] done — steps 1, 2 and 4 by commit `97af568d` (#288); **step 3 by the owner on
  2026-10-16**, on production, with the air fryer preferred. **Its answer is zero**: the
  prompt asked and `google/gemma-4-31b-it` wrote no air-fryer dish, which is a result and
  not a failure — the library has none to prefer, so the line is being asked to invent what
  the catalogue cannot show it. Re-measured after phase 8. Everything is in
  [`0102`](../../decisions/0102-a-kitchen-is-what-it-has-and-what-it-would-rather-use.md)
  § *What it costs, measured* and in this project's `LOG.md`.
- **Dispatch**: opus @ high — `/execute-project 021 phase 6` — owner-gated: one real
  generation from the owner's dev account, with an air fryer preferred, against the
  production provider (one model call; a stub cannot say whether a prompt works).
- **Goal**: the price of a missing appliance is a number per profile, and the preference
  half is proved by a count rather than by reading the prompt.
- **Scope**: `apps/api/scripts/evaluate-plans.mjs`, `docs/decisions/0102-*.md`, this
  project's `LOG.md`, and — **added 2026-10-16** — the evaluator's row in
  `apps/api/AGENTS.md`, which named five profiles when there are fourteen and could not
  mention a flag that did not exist. A documented command whose flags grow and whose doc
  does not is a doc a future agent is misled by.
- **Steps**:
  1. The evaluator gains a flag naming a kitchen (`--without oven`, `--without
     oven,microwave,blender`). It already resolves preferences through `resolvePreferences`
     and reads `reusablePool`, so no second idea of the rule is introduced.

     **Amended 2026-10-16, after the work: there is no stance list to build.** This step
     asked for one "for the harder cases", and nothing it could measure would change:
     `prefers` may never remove a dish (`0102`), and this evaluator calls no model, so the
     only observable stance is `missing`. The preference half is step 3 by construction.
     Done: the flag validates against `APPLIANCES`, and the run names its kitchen in both
     the printed header and the JSON (`without: [...]`) — a kept file that cannot say what
     it lacked makes a later `--compare` read a smaller pool as a regression.
  2. Run the fourteen profiles on the real local library: the share of the library each
     missing appliance removes, and the days still inside 5% on all four macros (`0045`),
     for the hardest kitchen — no oven, no microwave, no blender. **Price the default
     kitchen too, not only the hardest one** (phase 1's note).

     **The sentence that was here was wrong, and is now measured** (`invariant-reviewer`
     and the owner's decision, both 2026-10-16). It said the default costs nothing because
     no dish requires any of the seven appliances it lacks — but the blender was one of
     those seven and 20 production dishes require it. The owner's answer was to **put the
     blender into the default kitchen**, so the default is now a hob, an oven, a microwave
     and a blender, and against production it refuses exactly **one dish of 962** (the
     pressure-cooker beans). The two numbers this phase owes are therefore not the
     default's: they are what **saying** "no oven" costs (65 production dishes) and what
     saying "no blender" costs (20, mostly breakfasts and snacks).

     One warning for whoever runs it: the evaluator already prices the default without
     being told to — `nobodysContext` reads a random id, so `kitchenOf([])` hands it
     `DEFAULT_KITCHEN` — so **its numbers move with phase 3's merge**, and a baseline taken
     before that merge is not comparable with one taken after.
  3. The owner-gated generation: with the air fryer preferred, count the air-fryer dishes
     in the fortnight that comes back, against the 1 in 1128 the library holds today.

     **Amended 2026-10-16: that 1 was counted from prose, and the declared count is 0.**
     Neither library has a single dish whose `equipment` names an air fryer — the backfill
     left the one dish out because its steps offer the air fryer as one choice among
     several — so **nothing can be reused** and every air-fryer dish in that fortnight is
     one the model wrote because the prompt asked. A cleaner test than the plan expected,
     with no filter able to produce a false positive. The read-only query that counts it is
     written and syntax-checked: it is in this phase's `LOG.md` entry.
  4. Write every number into `0102` and this project's LOG; a day that cannot be built is
     reported as `0101` reported its own, not hidden.
- **Acceptance criteria**: PRD 6 and 8. The `plan-evaluator` agent owns steps 1–2 and
  reports numbers; it never edits code outside the script.
- **Verification**: `NUTRIA_LOCAL_PG=1 node apps/api/scripts/evaluate-plans.mjs …` with the
  new flag, before and after, with `--json` kept for the next run to compare against; the
  core build first (`pnpm turbo build --filter=core`), since the evaluator loads `dist`.

### Phase 7 — End to end

- [x] done — commit `6e03d886` ("A kitchen with no oven is served a fortnight with no oven in
  it, proved on real rows", #289)
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

- [x] done — commit `2bf5873a` (#293). The file is drafted, validated and measured;
  **the owner's load is the gate** — rehearsed on the local library on 2026-10-17
  (1,130 → 1,299 es-ES dishes, 0 collisions, `EXIT=0`, 30 air-fryer dishes where there
  were none) and **still owed on production**, which held 0 air-fryer dishes of 972 when
  this was written: an agent's write there is refused by the permission classifier, by
  design, so the load stays the owner's own command.
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

     **The table below counted words, and phase 2 measured requirements — they are not the
     same number** (amended 2026-10-16, after phase 2 ran). Phase 2's inference reads the
     rule `0102` actually states, *the appliances a dish cannot be cooked without*, so an
     appliance offered as a choice (*"al vapor o en el microondas"*, *"una parrilla o
     plancha estriada"*, *"el horno o la freidora de aire"*) is no longer counted. On the
     development library of 1128 dishes the requirement counts are: **oven 8/34/42/7,
     blender 10/0/0/17, microwave 4/0/0/0, and zero for the steamer, the grill, the air
     fryer, the pressure cooker, the slow cooker and the rice cooker.** The oven and the
     blender survive the stricter reading; the steamer's 21 and 23 and the grill's 18 and 36
     do not survive it at all — every one of those dishes can be cooked in a pot or a pan.
     So **this phase's first step is to re-read the table from `recipes.equipment` on
     production**, which phase 2's migration populates, instead of from the words below; and
     the shortfall for the steamer and the grill is not "none", it is everything.
     **That reaches `0102`'s own supply rule**: an appliance belongs in the catalogue once
     the library can serve a fortnight with it. On this reading six of the ten cannot serve
     a single dish, which is the owner's decision to take at this phase — grow the supply,
     or shrink the catalogue — and not one to settle by sizing a batch.

     Read against production on 2026-10-15 **by the words in the steps** (dish-slot pairs; a
     dish serving lunch and dinner counts in both), which is what the first batch was sized
     against before phase 2 measured requirements instead:

     **Amended 2026-10-17, during execution: "none" was about lunch and dinner.** Read on
     the six real slots rather than four, the oven has 34 lunches and 43 dinners — past the
     cap, as this row says — and **1 mid-morning snack and 3 afternoon snacks** in a
     1,130-dish library, which is the same emptiness the air fryer has with the difference
     that people already own the appliance. Those cells are drafted. The executor was right
     that this **necessarily worsens phase 6's headline**: what a missing oven costs is a
     ratio, and oven dishes raise only its denominator. Taken anyway, and the reasoning is
     the record's own — those figures are *"a fact about today's library, not a promise"*
     (`0102`), so a number that describes reality should follow reality rather than be kept
     small. And the oven is in the **default** kitchen: refusing to fill the snacks protects
     a percentage for the minority who said "no oven" by keeping a hole in front of the
     majority who did not. The LOG carries the before and after **with the oven in and with
     it out**, so a reader can tell a growing library from a regression.

     **Amended again the same day, after the oven ran: breakfast yes, the snacks no — and
     the snacks are not a hole in the library, they are a hole in the premise.** Of the
     three cells above, breakfast filled 4 of 4 (baked oats, baked toasts). The snacks
     filled **0 of 9 and 0 of 11** in ten passes and 25 calls, and the reason is in what the
     drafts declared instead: **53 of the 54 off-target snacks declared `none` — no
     appliance at all.** Asked as hard as the prompt can ask for an oven snack, the model
     writes yogurt, fruit, nuts and toast, because that is what a mid-morning snack is. A
     snack that needs somebody to heat an oven is a bad snack, and the model's refusal to
     write one is better product judgement than this row's. So the oven's snack figure in
     phase 6's ratio is **not** a shortfall to be drafted away: `0102`'s own words, *"a fact
     about today's library, not a promise"*, are the right reading of it, and the fact is
     that an oven is not a snack appliance. The deliberate worsening of the ratio reasoned
     about above therefore does not arise — 4 breakfasts move it barely at all — and the
     paired measurement is kept anyway, because it is what shows that.

     | appliance | breakfast | lunch | dinner | other | first batch |
     | --- | --- | --- | --- | --- | --- |
     | oven | 7 | 35 | 44 | 8 | **the snacks and breakfast — see the amendment above** |
     | steamer | 3 | 21 | 23 | 5 | **none** |
     | grill or griddle | 17 | 18 | 36 | 15 | ~6 lunches |
     | blender or processor | 10 | 0 | 0 | 17 | ~12 (soups and creams, lunch and dinner) |
     | microwave | 5 | 3 | 3 | 0 | ~8 (breakfast and snacks, where it is actually used) |
     | **pressure cooker** | 0 | 2 | 0 | 0 | **~24** (12 lunches, 12 dinners) |
     | **air fryer** | 0 | 0 | 1 | 0 | **~30** (12 lunches, 12 dinners, 6 snacks) |
     | slow cooker | — | 0 | 0 | — | ~24, if it stays in the catalogue |

     **Amended 2026-10-17, during execution: the slow cooker's batch is zero, and not for
     want of asking.** Sixty calls drafted slow-cooker dishes and the strict schema refused
     every one: `generatedDishSchema` bounds `cookMinutes` at 180 and a step's `minutes` at
     240 (`apps/api/src/modules/ai/prompts/pool.schema.ts:38`, `:94`), and
     `PoolBuilder.validate` parses it **before** anything reads `equipment`
     (`PoolBuilder.service.ts:541`) — so a four-hour braise is dropped as `schema` and never
     reaches the point where its `slow_cooker` declaration could be read. Sixty of the run's
     sixty-nine `schema` drops are that one bound. What survives it is the model's fallback,
     a stew that fits inside 180 minutes, which is a pot on the hob and declares `stovetop`:
     38 of the batch's off-target dishes, every one a good dish answering a question nobody
     asked. **No number of calls fixes this**, and the cooking-time *preference* never fired
     — the script passed none. The way out is the question `0102` already carves out
     (*"the time question is measured separately"*, the owner, 2026-10-15): a long unattended
     cook is not the same quantity as time at the stove, and until that is answered the slow
     cooker's supply is zero. Recorded here as a shortfall with its reason, which is what
     `0102` § *Adding an appliance to the catalogue is adding a promise* permits; **whether
     the catalogue keeps the appliance is the owner's call**, and it is cheap either way
     today — production held no slow-cooker stance at all when this was written, the whole
     `kitchen_equipment` table being two rows (2026-10-17).

     About a hundred dishes in total, against the six hundred that fifty per appliance would
     mean — and the two the owner's instinct named are exactly the two that need the batch.
  2. **The batch is drafted for macro spread, not only for a count.** Thirty air-fryer
     dishes that are all chicken breast leave a day unable to reach four macros (`0045`), so
     each appliance's dishes are drafted across the profile the scheduler needs to balance
     with — the same reason the pool asks for nineteen a slot rather than five.
  3. The batch script drafts dishes **through the machinery that already exists** — the pool
     builder's own prompt and schema, so each dish declares its `equipment` natively and no
     inference is involved — and every draft passes the gates the five hundred went
     through: ingredient slugs from the catalogue, the serving ceiling `0070`, two
     documented steps, the allergen resolution.

     **Amended 2026-10-17: there is no "tuner".** This step said "the validator and the
     tuner", inherited from the seed project's prose, and the executor looked for it rather
     than claiming to have run it — no such script exists in the tree, under
     `apps/api/scripts` or anywhere else. The four checks above are real and are gates
     inside `PoolBuilder.judge`, which every draft goes through. Said plainly here so the
     next reader does not go looking for a script that was never written.
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

- [x] done — `0102` carries both halves' measurements, core's `AGENTS.md` carries the
  preference rule, the roadmap carries the project this one left alone, and the PRD is read
  against its criteria rather than closed: **7 and 8 wait on the owner's load**, and 8 is
  measured at zero until it happens.
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

### Phase 10 — A preference nobody can see

- [x] done — commit `83d1f0d9` ("A preferred appliance holds a share of every slot's pick, so
  the one you asked for reaches the plate", #295), after `e35d1a86` ("A preference is worth
  what the library holds for it, and the record says by how much", #294) carried its
  measurement. The load happened (2026-10-18, 02:53 UTC) and the fortnight after it still
  served **0 air-fryer plates of 56**. The cause was not the prompt and not the library:
  `isPreferredDish` is one bucket for four leanings, so four liked cuisines held 548 of 672
  servable dishes and the appliance was one in 22.8 of what the cap took. A preferred
  appliance now holds a third of every slot's cap (`APPLIANCE_DISHES_PER_SLOT`), after the
  food groups and never from them.
- **Dispatch**: the lead directly, at this session's effort — the owner authorised the fix
  and the measurement overnight (2026-10-18, *"haz todo lo posible para solucionar esto"*).
- **Goal**: the preference half reaches a plate, or the record says what stands in the way
  with a number beside it.
- **Scope**: `packages/core/src/domain/Variety/**`, `apps/api/scripts/evaluate-plans.mjs`,
  `packages/core/AGENTS.md`, `apps/api/AGENTS.md`, `docs/decisions/0102-*`,
  `docs/ROADMAP.md`, this project's `PRD.md` and `LOG.md`.
- **Steps**:
  1. Diagnose on production's own rows, read-only, ruling each gate out rather than
     reasoning about it: the stored method, `fitSlots`, the season, the free-from
     substitutes, the country scope, the time limit, the missing blender, a cache.
  2. Reproduce the pick with the real code, his real context and the seed his plan used —
     the proof being that the reproduction's pool is the `reused: 68` his plan recorded.
  3. The share, sized from a measured curve rather than chosen, and asserted to change
     nothing for a kitchen nobody filled in.
  4. The instrument: `evaluate-plans.mjs` could not measure a preference at all (its
     rotation never carried `preferAppliances`), so `--prefer` and a per-profile line.
  5. The record: `0102`, both `AGENTS.md`, the roadmap, the PRD read against criteria 7
     and 8 with the load behind them.
- **Acceptance criteria**: PRD 8 measured on a real fortnight after the load; the bands
  unchanged (the product's own validator, not a hand-rolled band test); a stated kitchen
  shows the appliance on plates, an unstated one rotates exactly as before.
- **Verification**: `pnpm --filter core test`; `gate.sh --full`; the owner's own fortnight
  re-scheduled read-only against production; `NUTRIA_LOCAL_PG=1 node
  apps/api/scripts/evaluate-plans.mjs --rotate 3 --prefer air_fryer --flag accompaniments`
  over the local library, which holds the same batch.

### Phase 11 — A kitchen that gives way by degrees, and a library that can serve one

- [x] done — commit `21a9ae5b` ("A kitchen gives way by degrees before the rotation does, and
  280 dishes mean it rarely has to", #296), with the share's size measured in `b1f094e2`
  (#297) and raised to three quarters of the cap in `e631bd15` (#298). **The owner loaded the
  batch himself on 2026-10-18** (280 of 280 rows, es-ES 1,146 → 1,426), and the figure #298
  was raised on was corrected on 2026-10-19 over eight seeds — the constant stands, the claim
  about his own fortnight did not (`0102` § *One seed is not a measurement*).
- **Dispatch**: the lead directly, at this session's effort — *added during execution,
  2026-10-18*, when the plan the owner generated **with phase 10 live** still served 0
  air-fryer plates of 56 and he asked for the batch ("mete tantos platos como necesitemos,
  mínimo 50-100 por cada utensilio") and for the third point to be the planner's call.
- **Goal**: two things, because the measurement said the first alone is not enough.
  1. A preferred appliance that costs the macros gives up **part** of its share, and only
     then the rotation — never the other way round, which is what phase 10 shipped by
     omission and what made asking for an air fryer return fewer air-fryer plates than not
     asking.
  2. The library holds enough dishes per appliance that a rotation can keep its bands with
     the share in place: **50 to 100 per appliance**, the owner's number.
- **Scope**: `packages/core/src/domain/Variety/**`, `packages/core/src/controllers/Recipe/**`,
  `apps/api/src/modules/meal-plans/services/PlanGeneration.*`,
  `apps/api/scripts/draft-equipment-batch.mjs`, `apps/api/scripts/evaluate-plans.mjs`, both
  `AGENTS.md`, `docs/decisions/0102-*`, `docs/ROADMAP.md`, this project's `PRD.md` and
  `LOG.md`. The batch's dishes go to `docs/local/`, never to a migration.
- **Steps**:
  1. Read the owner's new plan in production, read-only, and explain the zero with his own
     rows rather than with a theory — including discarding the first explanation (two fixed
     meals on one weekday) by re-running his fortnight five ways.
  2. Name the cause: the share displaces the dishes that were holding the bands, the band
     miss buys the `wider_rotation` rescue, and the rescue replaces the pool the share
     lives in. Measure it with the kitchen read and unread, nothing else moved.
  3. The ladder: `narrowerShares` and `withApplianceShare`, walked by `PlanGeneration`
     before the whole library, the rung stored as `kitchenShare`, mirrored in the evaluator
     so the instrument measures the chain the service runs.
  4. The second batch, with the held table **counted** rather than remembered, the slow
     cooker left out (its schema bound, phase 8's finding) and the oven left out (96 dishes
     already, and 6% declare rate at snacks).
  5. Review every drafted name and method by the rules phase 8's review used, as a script
     whose verdicts are printed: an invented word, a near-twin, an over-declaration, fish
     that reaches the blender uncooked. A word that is Spanish but not Spain's (*estufa*)
     joins the emitter's rewrite rather than the strike list.
  6. The record, and the owner's three open questions answered by the planner since he
     asked for that: the slow cooker, the raw-cod creams, phase 5b.
- **Acceptance criteria**: a fortnight whose rotation can hold its bands keeps part of the
  kitchen it asked for; a fortnight that cannot is still delivered in band, and says which
  rung it ended on; no plan comes back worse on the bands than before (the product's own
  validator); every appliance in the catalogue bar the slow cooker holds **at least 50**
  dishes; nothing reaches production except through the owner's own load.
- **Verification**: `pnpm --filter core test`, `pnpm --filter api test`, `gate.sh --full`;
  the owner's fortnight re-run read-only against production, before and after the ladder;
  `--prefer air_fryer --rotate 3 --flag accompaniments` over the local library before and
  after the batch is loaded; `--check` over the emitted SQL file.

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
