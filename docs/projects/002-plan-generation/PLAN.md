# Plan — Project 002: Plan generation

> **Purpose**: the phased technical execution plan — the engineering half of the
> contract. `/execute-project` follows this literally; executors implement phases, they
> do not redesign them. If implementation must diverge, the plan is amended in the same
> change and the deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes.

- **Status**: in progress
- **Type**: standard
- **PRD**: [./PRD.md](./PRD.md) — every acceptance criterion maps to at least one phase; the map is at the end of this file.
- **Routing profile**: `tiered`. Phase 3 deviates to `quality-max` (fable) because it is AI
  output validation, which `AGENTS.md § Model routing` names explicitly.

## Design summary

Generation is **two stages**, split along the line
[`0004`](../../decisions/0004-deterministic-safety-layer.md) draws and formalised in
[`0005`](../../decisions/0005-generate-a-pool-schedule-in-code.md): *the model chooses what
food, code decides when and how much.*

```
  profile + goal + preferences + restrictions
                 │
                 ▼
  nutritionTargets()                          ← already exists (project 001)
                 │
      ┌──────────┴───────────┐
      ▼                      ▼
  STAGE A — pool          catalogue: ~200 ingredients, allergen-linked
  2–3 model calls  ──────▶ each dish validated independently:
  ~24–30 dishes            schema → slug allowlist → ALLERGY GATE
      │                    a failure discards that dish and re-requests the slot
      ▼
  STAGE B — schedule (pure code, no model)
    assign dishes to 14 days × slots
    enforce variety rules
    scale servings to bring each day into band
    compute every macro from recipe_ingredients × ingredients
      │
      ▼
  validate whole plan → build shopping list → validate it
      │
      ▼
  ONE transaction: recipes, plan, days, meals, shopping list, status = active
```

Everything in Stage B is a pure function in `packages/core/domain/`, so the properties the
PRD calls acceptance criteria 5 and 6 are unit-testable rather than statistical.

Execution is an **in-process background job**. `plan_generation_jobs` is the source of
truth: the runner writes `step` as it advances, the client polls it, and the labels the user
sees are stages the pipeline actually reached. The row is shaped so an external runner can
replace the in-process one later without a schema change.

## Phases

### Phase 1 — Catalogue expansion and schema corrections

- [x] done
- **Dispatch**: sonnet @ medium — `/execute-project 002 phase 1`
- **Goal**: give the generator a catalogue wide enough to build fourteen non-repetitive days from, and fix two column types that cannot record a job that runs in minutes.
- **Scope**: `packages/database/src/seed/`, `packages/database/src/schemas/plan.schema.ts`, `packages/database/src/migrations/`.
- **Steps**:
  1. Grow `INGREDIENT_SEED` from 56 to ~200 entries. Per-100 g macros from BEDCA or USDA composition tables; record which in `source`. Cover every category, weighted toward Spanish and Mediterranean staples, and toward ingredients that combine — not 40 varieties of fruit.
  2. Link allergens on every entry that carries one. `may_contain` only where cross-contamination is genuinely typical (oats, bulk nuts, some flours) — over-tagging empties the catalogue for trace-sensitive users.
  3. Add `gramsPerUnit` to everything a person counts rather than weighs.
  4. Change `planGenerationJobs.startedAt` and `finishedAt` from `date()` to `timestamp({ withTimezone: true })` — a fortnight's generation takes minutes and a date-only column cannot express its duration.
  5. Generate the migration. Do not hand-edit it.
  6. Add a seed integrity test: every `allergens` key referenced by `INGREDIENT_SEED` exists; no duplicate slugs; every macro non-negative; and a **sanity band** on kcal against its macros, to catch transcription errors.
     *(Amended during execution.* The original spec said "within 20% of `4·protein + 4·carbs + 9·fat`". That formula rejects correct tabulated values — spinach's real 23 kcal is 22% below it, because fibre contributes carbohydrate mass but little metabolisable energy, and the only way to pass is to inflate the data to fit the formula. Replaced with a ratio band of `[0.6, 1.6]` against a fibre-adjusted estimate, skipping entries under 15 kcal where the ratio is noise. Measured spread across the catalogue is `[0.84, 1.43]`, so the band still catches a misplaced decimal or a wrong-row copy — which is what the check is for.)*
- **Acceptance criteria**: PRD 14. Seed is idempotent — running it twice leaves the same row counts. The sanity band passes for every entry.
- **Verification**:
  ```
  pnpm --filter database generate     # emits exactly one new migration
  pnpm turbo lint ts:check test
  ```

### Phase 2 — The deterministic core: composition, scheduling, aggregation

- [x] done
- **Dispatch**: opus @ high — `/execute-project 002 phase 2`
- **Goal**: every rule that decides whether a plan is nutritionally sound, varied and shoppable, as pure functions with no model and no I/O.
- **Scope**: `packages/core/src/domain/` (new modules), `packages/core/src/entities/`. No repositories, no NestJS, no network.
- **Steps**:
  1. `domain/Composition` — `composeMacros(items, catalogue)` summing a dish's macros from ingredient grams; `scaleServings(dish, factor)`. All arithmetic on the catalogue's per-100 g figures.
  2. `domain/Variety` — `violatesVariety(assignment, rules)`: no recipe more than 3 times in 14 days; no recipe in the same slot on consecutive days. Rules as named constants, not literals.
  3. `domain/Scheduler` — `schedulePlan({ pool, targets, mealsPerDay, includesSnacks, days: 14 })`. Assigns dishes to day/slot, scales servings toward the day's targets, respects variety, and returns either a complete assignment or a structured shortfall naming the slot it could not fill. Deterministic: same input, same output — seed any randomness explicitly so tests are reproducible.
     *(Added during execution:* a day-level balancing pass. Each slot's serving is quantised to quarters against its own share of the day, so several slots rounding the same way can put a day 10% out — right at the tolerance validation rejects. The pass applies the single quarter-serving change that moves the day's total closest to target, repeatedly, until inside 5%. Without it, acceptance criterion 5 does not hold by construction; a test caught this.)*
  4. `domain/PlanValidation` — `validatePlan(assignment, targets)`: each day within ±10% kcal and ±15% protein, no day below `MINIMUM_DAILY_KCAL`, every slot filled, variety intact.
  5. `domain/ShoppingList` — `buildShoppingList(assignment, catalogue)`: consolidate to one row per ingredient with summed grams, choose a sensible display unit (units for countables, millilitres for liquids, grams otherwise), group by `ingredientCategory`.
     *(Amended during execution.* The original spec said "kilograms above 1 kg". The `measurement_unit` enum has no `kg` member, and adding one would be a schema change outside this phase's scope. Weights stay in grams in the stored row; rendering 2400 g as "2,4 kg" is presentation and belongs in the web layer, which also keeps the stored value directly comparable to `totalGrams`.)*
  6. Entities for the shapes these exchange (`CandidateDish`, `ScheduledMeal`, `PlanAssignment`, `ShoppingDraft`) in `entities/Plan`.
  7. Tests, thoroughly: a scheduler that cannot fill a slot, a pool too small, portion scaling that would breach the calorie floor, a shopping list consolidating three tomato entries into one row of 450 g, unit selection at the 1 kg boundary.
- **Acceptance criteria**: PRD 2, 5, 6, 11. `domain/` still imports nothing but `entities/`. Coverage floor in `packages/core/vitest.config.ts` holds.
- **Verification**:
  ```
  pnpm --filter core test:coverage    # domain/** thresholds must pass
  pnpm turbo lint ts:check test
  ```

### Phase 3 — The model boundary: prompt, schema, validation and repair

- [x] done
- **Dispatch**: fable @ high — `/execute-project 002 phase 3` *(quality-max deviation: this is AI output validation, named in `AGENTS.md § Model routing`)*
- **Goal**: assemble a validated pool of dishes — reusing what already exists, generating only the shortfall — and make invalid model output a non-event.
- **Scope**: `apps/api/src/modules/ai/`, `apps/api/.env.example`, `apps/api/package.json`, `packages/core/src/repositories/Recipe/`, `packages/core/src/controllers/Recipe/`.

*(Amended before execution, per [`0006`](../../decisions/0006-reuse-before-generating.md).
Two changes: the pool is assembled **reuse-first**, and the provider is swappable. The
driver is cost — generation is the only part of this product that scales linearly with
users, and since [`0005`](../../decisions/0005-generate-a-pool-schedule-in-code.md) makes
scheduling pure code, a plan built from dishes that already exist costs nothing. Steps 1a
and 3a below are new; the validation and repair steps are unchanged and now apply to reused
dishes as well as generated ones.)*
- **Steps**:
  1. Add `ai` plus the provider packages. `AI_PROVIDER` selects between `anthropic`, `google`, `ollama` and `stub`; `AI_MODEL` names the model within it. The key variable is per-provider and required only when that provider is selected — `stub` needs none, which is what lets the whole pipeline run with no account and no spend.
  1a. **Reuse before generating.** `RecipeRepository.findReusable({ slots, limit })` returns existing recipes with their ingredients and allergen links. `RecipeController.reusablePool(userId, slots)` filters them through **the same `findSafetyViolations` gate** used on generated dishes, plus the user's dietary patterns, and returns them as `CandidateDish[]`. A recipe already being in the database is not evidence that it is safe for *this* user.
  2. `AiClient` — a thin injectable wrapper over `generateObject`, returning the parsed object plus usage. It is the only place a provider SDK is imported, so tests stub one interface and no feature code names a vendor.
  3. `PoolPrompt` — builds the request from **structured, minimal context** (§29): targets, dietary patterns, cooking time and budget, liked and disliked labels, the allowed ingredient slug list, and the slots to fill. **Never send the user's name, email, birth date or weight** — the model needs the targets, not the person.
  4. Restrictions are expressed as *exclusion from the ingredient list itself*, not as an instruction to avoid them. The model cannot pick what it was never offered — the prompt is a second line of defence, and the gate in phase 4 is the first.
  5. Zod schema for the response: dishes with name, slot, ingredient slugs and grams, prep and cook minutes, difficulty, servings, and steps. Snacks carry one to three ingredients and no steps (PRD resolution 3).
  6. Per-dish validation: schema → every slug in the catalogue → **the allergy gate from `domain/Safety`**. Failures are collected, never thrown away silently.
  7. Bounded repair: at most two retries, each re-requesting only the shortfall with the rejected dishes named as exclusions. A dish rejected by the allergy gate is logged at error level — it means the prompt drifted.
  8. Return usage, model, prompt version, retry count for `generation_metadata`.
  3a. The builder computes the **per-slot shortfall** against what reuse supplied, and asks the model only for that. A pool already covered by reuse makes **no call at all** — the usage report must show it, because that is the number that decides whether this product is affordable.
  9. Tests against a stubbed `AiClient`: valid pool passes; a dish with an unknown slug is rejected and retried; **a dish containing a declared allergen is rejected and never returned**; malformed JSON exhausts retries and fails cleanly; usage is reported; **reuse covering every slot results in zero model calls**; **a reused recipe containing a declared allergen is filtered out**.
- **Acceptance criteria**: PRD 4, 15, and the model-facing half of 3. No test in this phase calls a real provider.
- **Verification**:
  ```
  pnpm --filter api test
  pnpm turbo lint ts:check test
  ```

### Phase 4 — The pipeline: orchestration, atomic persistence, job runner

- [x] done
- **Dispatch**: opus @ high — `/execute-project 002 phase 4`
- **Goal**: one function that takes a userId and leaves either a complete active plan or nothing at all.
- **Scope**: `apps/api/src/modules/meal-plans/`, `packages/core/src/repositories/Plan/`, `packages/core/src/controllers/Plan/`.
- **Steps**:
  1. `PlanRepository` — reads for the active plan, a plan by id (owner-scoped), plan history; and one `createPlanAtomically(userId, draft)` writing recipes, `meal_plans`, `plan_days`, `meals`, `shopping_lists` and `shopping_list_items` **inside a single `database().transaction()`**. Nothing is written outside it.
  2. Completing the previous plan and activating the new one happen in that same transaction, so the partial unique index on one active plan per user is never transiently violated — including under a double submit, which must fail the second request cleanly rather than deadlock.
  3. `PlanGenerationService` orchestrating: load context → `nutritionTargets` → pool (phase 3) → `schedulePlan` → `validatePlan` → `buildShoppingList` → validate → persist. Each stage writes its label to `plan_generation_jobs.step` before starting.
  4. **Re-run the allergy gate over the final assembled plan**, immediately before persisting. Phase 3 validated candidates; this validates what is actually about to be stored. Duplication here is deliberate — see PRD criterion 3.
  5. In-process runner: `POST` creates a `queued` job and returns immediately; a background task advances it. On failure the job goes `failed` with the error recorded and **no plan rows survive**. On success, `succeeded` with `planId`.
  6. A stale-job sweeper: a `running` job older than a threshold is marked `failed` on next read, so a restart mid-generation cannot leave a job spinning forever.
  7. Write `generation_metadata` from phase 3's usage report.
  8. Tests: happy path end to end with a stubbed pool; a forced failure after partial work leaves **no** `meal_plans`, `plan_days`, `meals` or shopping list, and the previous plan still `active`; a second concurrent generation does not produce two active plans; the final gate catches an unsafe meal that slipped past the candidate check.
- **Acceptance criteria**: PRD 1, 2, 3, 7, 8, 9, 12, 13, 15.
- **Verification**:
  ```
  pnpm --filter api test
  pnpm turbo lint ts:check test
  ```

### Phase 5 — API surface

- [x] done
- **Dispatch**: opus @ medium — `/execute-project 002 phase 5`
- **Goal**: the endpoints the web app needs, on the conventions `apps/api/AGENTS.md` already sets.
- **Scope**: `apps/api/src/modules/meal-plans/`, `apps/api/src/modules/shopping-lists/`.
- **Steps**:
  1. `POST /meal-plans/generate` — 409 if onboarding is incomplete or a generation is already running; otherwise a job id. `GET /meal-plans/jobs/:id` — status, step, error.
  2. `GET /meal-plans/active` — the active plan with days and meals. `GET /meal-plans/:id` — owner-scoped, so a plan id from another account is a 404, not a 403. `GET /meal-plans` — history, newest first, paginated.
  3. `GET /meal-plans/:id/days/:dayIndex` and `GET /meals/:id` — meal detail with scaled ingredient quantities, steps and macros. Scaled, not the recipe's base: `servings` carries real meaning after phase 2's portion scaling ([`0005`](../../decisions/0005-generate-a-pool-schedule-in-code.md)).
  4. `GET /shopping-lists/active` — read-only for this project. Interaction is 004.
  5. Rate-limit generation harder than the global default; it is the expensive endpoint.
     *(Amended during execution, per [`0007`](../../decisions/0007-own-the-rate-limiter.md).
     `@nestjs/throttler`'s latest release declares peer support up to NestJS 11 and this
     API runs 12 — the package has no release supporting it. It booted anyway, so a
     security control had been running outside its supported range since project 001;
     a Jest `require(esm)` cycle is what exposed it. Replaced with a `RateLimitGuard`
     of our own, which is now unit-tested, as the throttler integration never was.)*
  6. Swagger annotations on every route. Ownership tests for each: user A gets 404 on user B's plan, meal and list.
- **Acceptance criteria**: PRD 1, 9, 10, 11, 13. Every route resolves ownership from the session; none accepts a user id.
- **Verification**:
  ```
  pnpm --filter api test
  pnpm turbo lint ts:check test
  ```

### Phase 6 — Web: generation, the plan, meal detail

- [ ] in progress — code complete and command-verified; **blocked at the `human-verify` gate**, which needs a live database to have a plan to look at (see ROADMAP § Now)
- **Dispatch**: opus @ high — `/execute-project 002 phase 6`
- **Goal**: the screens that make a plan a product, replacing the dashboard's empty state.
- **Scope**: `apps/web/src/app/(app)/`, `apps/web/src/components/`.
- **Steps**:
  1. `/plan/generando` — starts generation, polls the job, shows the **real** `step` label. No artificial delay and no stage the pipeline did not reach (PRD 8). On failure: a clear message and retry, never a stack trace or raw model output.
  2. `/plan` — day navigation across all 14 days, defaulting to today when the plan is current. Week 1 / week 2 switching on mobile; a day's meals as a readable list with slot, name and kcal.
  3. `/plan/comida/[id]` — meal detail: image slot, macros, ingredients with **scaled** quantities, preparation steps, times, difficulty, servings.
  4. `/inicio` — replace the empty state with today's meals, the day counter, and the days remaining until the check-in. Keep an empty state for users with no plan, and add one for a failed generation.
  5. `/compra` — read-only shopping list grouped by category. State plainly that checking items off arrives next, rather than rendering dead checkboxes (PRD scope: "does not make it usable").
  6. Extend `AppNav` with Plan and Compra. Loading and error states for every fetch, following `lib/api`'s error codes.
  7. Spanish copy, `prefers-reduced-motion` respected, one component per file, `<Fragment>` not `<>` — the house rules in `apps/web/AGENTS.md`.
- **Acceptance criteria**: PRD 8, 9, 10, 11. — human-verify: a generated plan reads correctly on a phone-width viewport, and the generation screen's labels match the pipeline stages.
- **Verification**:
  ```
  pnpm turbo lint ts:check test
  NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1 pnpm turbo build
  ```

### Phase 7 — End-to-end verification and documentation

- [ ] in progress — specs written and type-checked; **blocked at the `owner-gated` step**, which needs a throwaway `DATABASE_URL` (see ROADMAP § Now)
- **Dispatch**: sonnet @ medium — `/execute-project 002 phase 7`
- **Goal**: prove the loop against a real database, and leave the docs true.
- **Scope**: `apps/api/test/`, `docs/`.
- **Steps**:
  1. `generation.e2e-spec.ts` — against a real database with a stubbed AI client: a user completes onboarding, generates, and ends with one active plan of 14 days whose meals reconcile with their recipes' ingredients; the shopping list reconciles with the plan; a second user's plan is invisible to the first.
  2. `allergy-safety.e2e-spec.ts` — a user with declared allergies generates against a stub that **deliberately proposes unsafe dishes**; assert no unsafe ingredient reaches any stored meal or shopping list row.
  3. Update `apps/api/test/README.md` with how to run these and the stub's shape.
  4. Update `docs/ARCHITECTURE.md` § Current state, and `docs/ROADMAP.md` — move item 1 out of Next.
  5. Append the phase entries to `LOG.md` with real evidence.
- **Acceptance criteria**: PRD 1, 3, 11, 13. — owner-gated: these need `DATABASE_URL` for a throwaway database; the executor writes and typechecks them and hands over the exact commands.
- **Verification**:
  ```
  pnpm turbo lint ts:check test
  pnpm --filter api test:e2e          # owner-gated: needs a live database
  pnpm check:leaks
  ```

## Hand-off

Standing constraints for every phase of this project:

- **The allergy gate is not optional and not deduplicated.** It runs on candidates (phase 3)
  *and* on the assembled plan before persistence (phase 4). If a phase makes one of those
  look redundant, that is the mistake — see PRD criterion 3.
- **No nutrition value from the model is ever written to a nutrition column.** Macros come
  from `recipe_ingredients` against `ingredients`, always.
- **Nothing partial reaches the database.** Every write in the generation path is inside the
  single transaction in `PlanRepository.createPlanAtomically`.
- **`packages/core/domain/` imports only `entities/`.** No I/O, no NestJS, no network. It is
  the layer that stays testable.
- **Rebuild the packages after touching them**: `pnpm --filter core build`, or leave
  `pnpm dev` running. `apps/api` loads their compiled output.
- **Never send user PII to the model.** Targets and preferences, not names, emails, birth
  dates or weights.
- The workspace must be green at every phase boundary: `pnpm turbo lint ts:check test`.

## Acceptance criteria → phases

| PRD | Phase |
| --- | --- |
| 1 — a plan gets generated | 4, 5, 7 |
| 2 — macros looked up, never invented | 2, 4 |
| 3 — allergies absolute | 3, 4, 7 |
| 4 — unknown ingredients rejected | 3 |
| 5 — nutrition in band | 2, 4 |
| 6 — variety holds | 2, 4 |
| 7 — generation is atomic | 4 |
| 8 — progress is real | 4, 6 |
| 9 — failure is honest | 4, 5, 6 |
| 10 — the plan is readable | 6 |
| 11 — shopping list correct | 2, 4, 5, 6, 7 |
| 12 — one active plan | 4 |
| 13 — history preserved | 4, 5, 7 |
| 14 — the catalogue supports it | 1 |
| 15 — costs bounded and observable | 3, 4 |

## Out of scope

- Meal interaction — complete, skip, favourite, dislike, feedback → project 003.
- Meal replacement and its re-validation → project 003.
- The interactive shopping list — check off, edit, add, regenerate → project 004.
- Progress tracking, check-ins, next-plan adaptation → project 005 ([`ROADMAP.md`](../../ROADMAP.md) § Next, item 4).
- The AI assistant → project 006.
- Notifications, including "your plan is ready" → project 007.
- Plan history browsing UI. This project preserves history correctly; the screen is later.
