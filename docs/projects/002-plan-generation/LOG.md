# LOG — Project 002: Plan generation

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

## Phase 1 — Catalogue expansion and schema corrections (2026-09-07)

- **Executor**: dispatched to sonnet @ medium per the plan. The subagent hit a model
  session limit partway through verification; opus completed the phase directly. Recorded
  as a routing deviation below.
- **Result**: done.
- **Evidence**:
  - `INGREDIENT_SEED` grew 56 → **200**: 45 produce, 35 protein, 15 dairy, 45 pantry,
    12 bakery, 8 frozen, 5 beverages, 35 other. **81** entries carry allergen links, of
    which **11** use `may_contain`. **67** carry `gramsPerUnit`.
  - `source` added to `IngredientSeed` and wired through `seed/index.ts`, so
    `ingredients.source` records provenance per row instead of a hardcoded constant:
    71 `bedca`, 73 `usda`, the rest `manual`.
  - `plan_generation_jobs.started_at` / `finished_at` changed to
    `timestamp with time zone`. Migration `0001_sharp_terror.sql`, two `ALTER COLUMN`
    statements, generated not hand-edited.
  - `packages/database` gained vitest; `src/seed/seed.test.ts` — 4 tests, passing.
  - `pnpm turbo lint ts:check test` → **20/20 tasks**, 490 tests.
- **Deviations from plan**:
  1. **The Atwater check as specified was wrong**, and the plan is amended. `kcal` within
     20% of `4·protein + 4·carbs + 9·fat` rejects correct tabulated values for high-fibre
     foods — spinach's real 23 kcal fails it, and passing required inflating the figure to
     25. Replaced with a ratio band against a fibre-adjusted estimate. The measured spread
     across 105 checkable entries is `[0.84, 1.43]`, so a band of `[0.6, 1.6]` still
     catches a misplaced decimal (10×) or a wrong-row copy while leaving the data alone.
  2. **Six pre-existing rows were modified.** Reviewed individually against USDA. Three
     were genuine corrections to errors made in project 001 — broccoli (25 → 35 kcal, my
     original used boiled energy with net carbs), strawberry (carbs 4.9 → 7.7, net vs
     total), and firm tofu (76 → 144 kcal, my original was silken tofu's figures). Kept.
     Two drifted the wrong way and were reverted: champiñón 24 → 22, espinaca 25 → 23.
     Honey was corrected 329 → 304: 329 is its Atwater estimate, 304 its tabulated energy.
  3. **Routing**: the phase was dispatched to sonnet as planned but finished on opus after
     the session limit. No scope change.
- **Decisions**: none new.
- **Notes for the next phase**: the catalogue's `other` category holds 35 entries — spices,
  condiments and sauces. A shopping list grouping them all under "Otros" will be long; if
  that reads badly in phase 6, the fix is a category split, not a re-seed.

## Phase 2 — The deterministic core (2026-09-07)

- **Executor**: opus @ high, as dispatched.
- **Result**: done.
- **Evidence**:
  - New pure modules under `packages/core/src/domain/`: `Composition`, `Variety`,
    `Scheduler`, `PlanValidation`, `ShoppingList`, plus the shapes in `entities/Plan`.
  - `packages/core` tests 24 → **83**, all passing. Coverage thresholds on `src/domain/**`
    hold (verified they are genuinely enforced by raising them to 99% and confirming a
    failure, then restoring).
  - `domain/` imports nothing but `entities/` — no I/O, no NestJS, no network.
  - Criterion 5 is now a property: every one of the 14 days lands within 10% of the calorie
    target, asserted per day. Criterion 6 likewise: `varietyViolations` returns empty for a
    scheduled plan, because `canPlace` gates every placement rather than auditing afterwards.
  - `pnpm turbo lint ts:check test` → **20/20 tasks**, 490 tests.
- **Deviations from plan**:
  1. **The scheduler needed a day-balancing pass**, added and the plan amended. Ranking
     candidates on fit alone spends the best-fitting dishes in the first days and leaves
     day 14 at 1,500 kcal against a 2,000 target — a test caught it. Fixed by ranking
     least-used first, then fit. Quarter-serving quantisation then left days up to 11% out,
     so a correction pass walks each day into a 5% band before validation sees it.
  2. **Shopping-list display units stay within the enum**, and the plan is amended. The
     spec said kilograms above 1 kg; `measurement_unit` has no `kg`. Weights stay in grams;
     formatting kg is presentation, and it keeps the stored value comparable to `totalGrams`.
  3. **Phase order overlapped.** The owner asked for phase 2 while phase 1's agent was
     still running. The two phases touch disjoint packages, so phase 2 was written
     immediately with verification scoped to `packages/core`; the full workspace gate ran
     once, after phase 1 landed. No phase was reported green on an unverified tree.
- **Decisions**: [`0005`](../../decisions/0005-generate-a-pool-schedule-in-code.md) was
  recorded during planning and is unchanged by execution.
- **Notes for the next phase**: phase 3 builds the pool the scheduler consumes. Two
  contracts to honour — `CandidateDish` in `entities/Plan` is the shape (note it has no
  macro fields at all, deliberately), and a pool needs at least
  `VARIETY_RULES.maxOccurrencesPerPlan` distinct dishes per slot or the scheduler returns a
  shortfall rather than a thin plan. The shortfall names the slot, which is exactly what a
  bounded retry should re-request.

## Phase 3 — The model boundary (2026-09-07)

- **Executor**: opus @ high. The plan dispatches this phase to fable at `quality-max`;
  the owner does not have fable available, so it ran on opus. Recorded as a routing
  deviation — the phase's substance (AI output validation) is unchanged, and it remains
  the phase where a mistake is a safety failure rather than a bug.
- **Result**: done.
- **Evidence**:
  - `apps/api` tests 35 → **49**. `packages/core` 83 → **90**.
  - `pnpm turbo lint ts:check test` → **20/20 tasks**, 505 tests.
  - Zero model calls when reuse covers every slot, asserted directly — that is the
    mechanism [`0006`](../../decisions/0006-reuse-before-generating.md) rests on.
  - The allergy gate is asserted three ways: unsafe ingredients are never put in the
    prompt; a generated dish containing a declared allergen is rejected and never
    returned; trace-risk ingredients are withheld only from trace-sensitive users.
- **Deviations from plan**:
  1. **Reuse-first and a swappable provider** were added to the phase before execution,
     amended in the plan and recorded as
     [`0006`](../../decisions/0006-reuse-before-generating.md). The driver was cost: the
     owner requires that neither users nor the operator pay, and generation is the only
     part of this system that scales linearly with users. Measured at roughly $0.29 per
     plan on a mid-tier model, a thousand fortnightly users is $580/month. Reuse changes
     the scaling term from users to *distinct dietary profiles*.
  2. **One gate, not two.** Reuse and generation initially each resolved ingredients and
     called `findSafetyViolations` separately — precisely the duplication the invariant in
     `apps/api/AGENTS.md` warns about. Extracted into `dishSafety` in
     `core/domain/Safety`, now the single path for both, with a test asserting a reused
     dish is gated identically to a generated one.
  3. **An injectable `ENV` replaced per-module env reconstruction.** `AuthModule` rebuilt
     the `Env` object field by field from `ConfigService`, so adding `AI_PROVIDER` broke
     its type-check for reasons unrelated to auth. `envProvider` validates once and is
     injected. This touched `auth.module.ts`, outside the phase's declared scope — a
     necessary consequence of extending the env contract rather than new work.
  4. **A provider outage degrades to reuse** rather than failing the generation inside the
     pool builder. The scheduler then reports which slot it could not fill, which is a far
     more actionable failure than "the AI is down".
- **Decisions**: [`0006`](../../decisions/0006-reuse-before-generating.md).
- **Notes for the next phase**: phase 4 persists what this produces. Three things to carry:
  `PoolResult.metadata` is shaped for `meal_plans.generation_metadata` and includes
  `reused` and `calls`, which are the numbers that answer "is this affordable"; generated
  dishes must be written as `recipes` with `source: 'ai'` **inside the same transaction**,
  or reuse never grows and every user pays again; and `AI_PROVIDER=stub` is a supported
  production state, so phase 4's failure path must handle "pool too thin, no provider"
  as an expected outcome rather than an error.

## Phase 4 — The pipeline (2026-09-07)

- **Executor**: opus @ high, as dispatched.
- **Result**: done.
- **Evidence**:
  - `PlanRepository.createPlanAtomically` writes recipes, the plan, 14 days, every
    meal, the shopping list and its items **in one `database().transaction()`**, and
    completes the outgoing plan in the same transaction so the partial unique index is
    never transiently violated. A unique violation (double submit) becomes a
    `ConflictError` rather than a race.
  - `PlanGenerationService` runs the pipeline with nothing written until the final
    stage; every earlier stage is pure computation over data loaded up front, so a
    failure anywhere leaves the database untouched, previous plan included.
  - `apps/api` tests 49 → **69**. Asserted directly: no persist on incomplete
    onboarding, on an incomplete profile, on a thin pool, or on an unsafe meal caught by
    the **final** gate after scheduling; the stage labels emitted are exactly the six the
    pipeline enters, in order; failures are recorded as stable codes and a driver message
    containing a password never reaches the job row.
  - `pnpm turbo lint ts:check test` → **20/20 tasks**, 525 tests.
  - Boot-tested against a straight copy of `.env.example`: liveness 200, protected
    routes 404, no errors, no AI key.
- **Deviations from plan**:
  1. **The draft shapes moved to `entities/Plan`.** They were defined in the repository,
     which is private to `packages/core` (`#repositories`), so `apps/api` could not name
     the type it had to construct. They are data shapes, so entities is where they belong.
  2. **Write methods were split onto `PlanJobController`**, apart from the read-only
     `PlanController`. These are the only methods that mutate and the pipeline is their
     only caller; keeping them separate makes it obvious which surface a read-only screen
     may touch.
  3. **Two defects found and fixed, both from earlier phases.** The env contract rejected
     an empty string for any optional variable with a format check — so `cp .env.example
     .env`, the documented first step, produced `EMAIL_FROM=''` and the process refused
     to boot. Optional variables now treat empty as absent. Separately, the
     provider-key requirement added in phase 3 **had never actually applied**: the edit's
     anchor did not match and nothing asserted on it, so `AI_PROVIDER=anthropic` with no
     key would have passed validation and failed at the first call. Both are covered by
     tests, and the second insertion asserts on its anchor so a silent no-op cannot recur.
- **Decisions**: none new.
- **Notes for the next phase**: phase 5 exposes what exists — `PlanJobRunner.start`,
  `PlanController.getActivePlan / getPlan / listPlans / getShoppingList`, and
  `PlanController.getJob`. Three things to hold: every read is already owner-scoped at the
  repository, so routes must pass `@CurrentUser().id` and never an id from the path;
  `GENERATION_POOL_TOO_SMALL` is the **expected** failure with `AI_PROVIDER=stub` and a
  thin library, so it deserves its own user-facing copy rather than a generic error; and
  generation is the expensive route, so it needs a tighter throttle than the global default.

## Phase 5 — API surface (2026-09-07)

- **Executor**: opus @ medium, as dispatched.
- **Result**: done.
- **Evidence**:
  - Eight routes registered, confirmed against the running app's OpenAPI document:
    `POST /meal-plans/generate`, `GET /meal-plans/jobs/{id}`, `GET /meal-plans/active`,
    `GET /meal-plans`, `GET /meal-plans/{id}`, `GET /meal-plans/{id}/days/{dayIndex}`,
    `GET /meal-plans/meals/{id}`, `GET /shopping-lists/active`.
  - `apps/api` tests 69 → **85**. Asserted: every route passes `@CurrentUser().id` and
    never an id taken from the path or body; the history page size is capped however
    large a client asks; a negative offset is clamped rather than forwarded.
  - Boot-tested: every protected route answers **404** unauthenticated, `/active` is
    matched as its own route rather than captured by `:id`, and a malformed UUID is
    rejected by `ParseUUIDPipe`.
  - Meal detail scales ingredient quantities by `meal.servings / recipe.servings` — the
    recipe's base quantities would tell someone in a kitchen to cook the wrong amount.
  - `pnpm turbo lint ts:check test` → **20/20 tasks**, 541 tests.
- **Deviations from plan**:
  1. **`@nestjs/throttler` removed**, recorded as
     [`0007`](../../decisions/0007-own-the-rate-limiter.md). Its latest release (6.5.0)
     declares `@nestjs/common` peer support through 11; this API runs 12. It booted
     regardless — Node's interop tolerated the CommonJS/ESM mismatch — so **rate limiting,
     a security control, had been running on an unsupported dependency since project 001**
     and only broke when a Jest suite imported a controller using `@Throttle`. Replaced by
     `RateLimitGuard`: fixed-window, keyed on user id where a session exists so a shared
     network does not throttle everyone behind it, and covered by nine tests.
  2. **Meal detail sits at `/meal-plans/meals/{id}`**, not the top-level `/meals/{id}` the
     plan wrote. It lives in the meal-plans controller and inherits that prefix; the route
     is registered, documented and owner-scoped, so this is a path difference rather than
     a behavioural one. Phase 6 consumes the registered path.
- **Decisions**: [`0007`](../../decisions/0007-own-the-rate-limiter.md).
- **Notes for the next phase**: phase 6 builds the screens. The contract it needs:
  `POST /meal-plans/generate` returns a job immediately and the client polls
  `GET /meal-plans/jobs/{id}` for `step`, which carries a Spanish user-facing label
  straight from `STEPS` in `PlanGeneration.service.ts` — render it verbatim rather than
  mapping it again. `GET /meal-plans/active` returns **null**, not a 404, when there is no
  plan, so the empty state is a normal render. `GENERATION_POOL_TOO_SMALL` is the expected
  failure with `AI_PROVIDER=stub` and an empty library and needs its own copy explaining
  that, not a generic error. Generation is limited to three attempts an hour, so the
  retry button must surface a 429 as "espera un momento" rather than as a failure.

## Phase 6 — Web: generation, the plan, meal detail (2026-09-07)

- **Executor**: opus @ high, as dispatched.
- **Result**: **partial — stopped at the phase's `human-verify` gate.** Every step is
  implemented and everything a command can check is green; the visual confirmation the
  gate requires cannot happen until there is a database to generate a plan against.
- **Evidence**:
  - `pnpm turbo lint ts:check test` → **20/20 tasks**, 541 tests.
  - `pnpm turbo build` → 6/6. `apps/web` renders **14 routes**, four of them new:
    `/plan`, `/plan/generando`, `/plan/comida/[id]`, `/compra`.
  - Generation labels are rendered **verbatim** from `job.step`; the client contains no
    mapping of step text, so the screen cannot show a stage the pipeline did not reach
    (PRD criterion 8). Verified by grep: zero client-side label constants.
  - The progress bar is indeterminate rather than percentage-based, for the same reason —
    the pipeline reports stages, not progress. `prefers-reduced-motion` stops its
    animation.
  - `GENERATION_POOL_TOO_SMALL` has its own copy naming `AI_PROVIDER` as the cause,
    rather than a generic failure, because with the stub provider and an empty library it
    is the *expected* outcome and would otherwise read as a bug.
  - A 429 from the three-per-hour generation limit is surfaced as "espera un momento",
    distinct from a generation failure.
  - The shopping list states plainly that it is read-only for now instead of rendering
    checkboxes that do nothing.
- **Deviations from plan**: none in scope. Two notes:
  1. The dashboard gained a state the plan did not list: an **active plan whose fourteen
     days have already elapsed**. Without it the user would see "tu plan está activo" and
     no meals, with nothing to act on.
  2. Meal detail uses a neutral gradient band where the plan says "image slot". Generating
     or sourcing a photo of a dish nobody cooked would be the most convincing falsehood on
     the page; the band names the dish instead.
- **Decisions**: none new.
- **Blocker — `human-verify` outstanding**: the gate asks that a generated plan reads
  correctly at phone width and that the generation screen's labels match the pipeline
  stages. The second is settled structurally (labels pass through unmodified). The first
  needs a real plan on screen, which needs `DATABASE_URL`, migrations, the seed, and
  either a configured `AI_PROVIDER` or a populated recipe library. Until then this phase
  stays open rather than being reported done on an untested screen.

## Phase 7 — End-to-end verification and documentation (2026-09-07)

- **Executor**: opus @ high. The plan dispatches this phase to sonnet @ medium; the
  previous sonnet dispatch (phase 1) terminated on a model session limit partway through
  and had to be finished on opus anyway, and this phase depends heavily on accumulated
  context — the scripted-client shape, the seeded slugs, the exact view types. Run
  directly. Recorded as a routing deviation.
- **Result**: **partial — stopped at the phase's `owner-gated` step.** Both suites are
  written, type-checked and discoverable; neither has ever been executed, because there is
  no database to execute them against.
- **Evidence**:
  - `apps/api/test/harness.ts` — shared setup: a `ScriptedAiClient` bound over the
    `AiClient` DI token, registration, the eight onboarding steps, and `generateAndWait`,
    which polls the job endpoint exactly as the web client does.
  - `generation.e2e-spec.ts` — nine assertions over one real generation: fourteen days,
    every slot filled, every day within 10% of target, no dish repeated in the same slot on
    consecutive days, macros above zero, **the shopping list reconciled ingredient by
    ingredient against the plan's own meal-detail responses**, meal quantities scaled,
    one account's plan invisible to another, and a second generation leaving exactly one
    active plan with the previous one preserved as `completed`.
  - `allergy-safety.e2e-spec.ts` — a user declares a gluten allergy and the scripted model
    proposes bread and oat dishes **deliberately**, as a model ignoring its instructions
    would. Asserts no forbidden ingredient reaches any stored meal, that none reaches the
    shopping list either, and that the unsafe dishes were rejected rather than the plan
    coming up thin.
  - Verified discoverable under the e2e config (3 suites) and **excluded** from
    `pnpm test` (0 matches), so a green unit run can never be mistaken for these having run.
  - `apps/api/test/README.md` rewritten: what each suite proves, why the seed is required,
    and why the model is scripted rather than real.
  - `docs/ARCHITECTURE.md` § Current state and `docs/ROADMAP.md` § Now updated to state
    plainly what is built, what is untested against a live database, and the exact
    unblocking steps.
  - `pnpm turbo lint ts:check test` → **20/20 tasks**, 541 tests.
- **Deviations from plan**:
  1. **Routing**, as above.
  2. **The nutrition reconciliation is indirect.** PRD criterion 2 wants every stored macro
     traced to the catalogue, but the API exposes no ingredient-macro endpoint, so an e2e
     suite cannot recompute from source through HTTP alone. Instead the suite reconciles
     the **shopping list against the plan's own ingredient quantities** — an equally strong
     end-to-end property using only public routes — and the catalogue-derivation itself is
     covered where it belongs, by unit tests on `domain/Composition`.
- **Decisions**: none new.
- **Blocker — `owner-gated` outstanding**: these suites need `DATABASE_URL`,
  `DIRECT_DATABASE_URL`, `BETTER_AUTH_SECRET`, a `migrate` and a `seed` against a
  **throwaway** database. Commands are in `apps/api/test/README.md` and
  [`ROADMAP.md`](../../ROADMAP.md) § Now. Until they run, project 002 is implemented but
  unproven against real Postgres, and this log says so rather than implying otherwise.
