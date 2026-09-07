# PRD — Project 002: Plan generation

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project` — approved by the owner before the plan is written.

- **Status**: approved
- **Roadmap item**: [`ROADMAP.md`](../../ROADMAP.md) § Next, item 1 — "A user receives a real 14-day plan."

## Problem

The workspace can take someone from sign-up to a complete, validated profile with computed
daily targets — and then stops. The dashboard says a plan is coming, which is honest but is
not the product.

Everything the product promises sits downstream of a plan existing. There is nothing to
shop for, nothing to track adherence against, nothing for a check-in to review, and nothing
for the next fortnight to adapt. Project 001 built the foundation; until this project ships,
that foundation holds up an empty state.

The hard part is not asking a model for meals. It is producing fourteen days that are
**safe** (no declared allergen ever reaches a plate), **honest** (every calorie figure
traceable to a composition table rather than to a model's guess), and **complete or absent**
(a failure must not leave someone with six days of food and a half-written shopping list).

## Outcome

When this ships:

- A user who has finished onboarding can ask for a plan and, a minute or two later, have an
  **active 14-day plan** they can read day by day.
- Every macro shown to them was **computed from the ingredient catalogue**, not produced by
  a language model.
- No meal in any stored plan contains an allergen or intolerance they declared. This is
  enforced by code that runs before anything is stored *and* before anything is returned,
  and it is covered by tests that fail loudly.
- Their daily totals land close to the targets project 001 already computes, and the
  fortnight does not serve them the same dish six times.
- While it generates, they see **what is actually happening** — the real pipeline stage,
  read from a job row — not a spinner on a timer.
- If generation fails, they are told, nothing partial is left behind, and they can retry.
- A shopping list for the whole fortnight is generated and stored alongside the plan,
  consolidated per ingredient and grouped the way a supermarket is walked.

## Scope

**In:**

- Growing the ingredient catalogue to roughly 200 entries with allergen links, so fourteen
  days of varied food is expressible. This is reference data, not sample data.
- The generation pipeline: load profile → derive nutritional strategy → generate candidate
  meals → validate hard constraints → check nutritional consistency → check variety →
  assemble the 14-day plan → validate the whole plan → build the shopping list → validate it
  → save atomically → mark active.
- Structured model output validated against Zod schemas, with controlled retry. Invalid
  output is never stored and never shown.
- Persisting AI-composed dishes as reusable `recipes` (`source: 'ai'`), with macros
  computed from `recipe_ingredients` against the catalogue.
- Background execution backed by `plan_generation_jobs`, and the API to start a generation
  and poll its progress.
- Web: a generation screen with real progress, and a plan surface — day navigation across
  all 14 days, each day's meals, and meal detail (ingredients, quantities, instructions,
  times, macros). The dashboard's empty state is replaced by today's meals.
- The shopping list generated and stored inside the same transaction.

**Out** — each is a later roadmap milestone, and the plan must not quietly absorb them:

- Meal interaction: complete, skip, favourite, dislike, feedback. *(003)*
- Meal replacement and its re-validation. *(003)*
- The interactive shopping list — checking off, editing quantities, adding, regenerating.
  This project **stores** the list and may display it read-only; it does not make it usable. *(004)*
- Progress tracking, check-ins, and next-plan adaptation from feedback. *(005)*
- The AI assistant. *(006)*
- Notifications and emails, including "your plan is ready". *(007)*
- Plan history browsing. Historical plans are preserved correctly by this project; the
  screen to browse them is later.

## Acceptance criteria

1. **A plan gets generated.** A user with all required onboarding steps complete can start a
   generation and end with exactly one `active` plan of 14 `plan_days`, each carrying the
   number of meals their preferences specify.
2. **Macros are looked up, never invented.** Every `meals` row's kcal and macros are computed
   from its `recipe_ingredients` against `ingredients`, and equal that sum within rounding.
   No value in the model's response is written to a nutrition column.
3. **Allergies are absolute.** No stored meal contains an ingredient linked `contains` to a
   declared allergy or intolerance; nor one linked `may_contain` when the user is
   trace-sensitive. Verified by a test that seeds a restricted profile, generates against a
   stubbed model that deliberately proposes an unsafe dish, and asserts it never reaches the
   database.
4. **Unknown ingredients are rejected, not guessed.** A model response referencing a slug
   outside the catalogue fails that candidate and triggers a bounded retry; it never causes
   an invented ingredient row or a silently dropped one.
5. **Nutrition lands in band.** Each day's totals are within ±10% of the user's `kcal`
   target and ±15% on protein; no day falls below `MINIMUM_DAILY_KCAL`.
6. **Variety holds.** Within one 14-day plan no recipe appears more than three times, and no
   recipe appears in the same slot on consecutive days.
7. **Generation is atomic.** A failure at any stage leaves no `meal_plans` row in a
   non-terminal state, no orphan `plan_days`, `meals` or shopping list, and the user's
   previous plan untouched. Verified by a test that forces a failure after partial work.
8. **Progress is real.** The generation screen shows the stage read from
   `plan_generation_jobs.step`. No stage label is displayed that the pipeline did not
   actually reach, and no artificial delay is added.
9. **Failure is honest.** A failed job surfaces as a clear state with a retry action, the
   `error` recorded for the admin view, and no user-facing stack trace or model output.
10. **The plan is readable.** All 14 days are navigable; each meal opens to a detail view with
    ingredients and quantities, preparation steps, prep and cook time, difficulty, servings
    and full macros. Works on a phone.
11. **The shopping list exists and is correct.** One list per plan, every ingredient
    consolidated to a single row with summed grams and a sensible display unit, grouped by
    category. Its contents reconcile exactly with the plan's `recipe_ingredients`.
12. **One active plan.** Generating again while a plan is active completes or archives the old
    one; the database's partial unique index is never violated, including under a double
    submit.
13. **History is preserved.** A superseded plan keeps its days, meals, recipes, shopping list
    and metadata, and remains readable through the API.
14. **The catalogue supports it.** Roughly 200 ingredients with correct per-100 g macros and
    allergen links, seeded idempotently, with provenance recorded.
15. **Costs are bounded and observable.** Token usage and model, prompt version, retry count
    and duration are recorded in `meal_plans.generation_metadata`; no user PII beyond what
    the plan needs is sent to the provider.

## Resolved at approval

*(2026-09-07, owner)*

1. **Catalogue target is ~200 ingredients**, authored within this project as a batch phase.
   Acceptance criterion 14 stands as written.
2. **Model is `claude-sonnet-5`**, the current `AI_MODEL` default. Code-side validation and
   bounded retry absorb occasional slips; escalating to a stronger model on repeated failure
   is a later optimisation, not part of this project.
3. **Snacks are a lighter class.** `breakfast`, `lunch`, `dinner` and `supper` get full
   recipes with preparation steps. `morning_snack` and `afternoon_snack` are assembled from
   one to three catalogue ingredients with no cooking steps. This shapes both the prompt and
   the validation: a snack with instructions is not an error, but a snack requiring a pan is
   a signal the prompt drifted.

## Open questions

None. Resolved above.
