# LOG — 000-workspace (standing)

> **Purpose**: the standing log for **tasks** — work too small for a project (fix
> batches, config syncs, polish rounds, exploratory sessions) that serves no specific
> project but still deserves a committed record. Append-only, newest first. If a task
> grows into real scoped work, promote it: create a proper project and write its
> PRD/plan retroactively as record, not contract.
> **Audience**: humans and agents. **Committed**: yes — the owner commits alongside the
> task's changes. **Written by**: the executing agent, appending only.
> Write repo-relative: no absolute paths, no references to other private repos.

<!-- Entry format — copy per task:

## Task — title (YYYY-MM-DD)

- **Executor**: model actually used.
- **What**: one or two sentences — what was done and why.
- **Evidence**: verification commands run and their outcomes.
- **Decisions**: links to docs/decisions/ entries created, if any.
-->

## Auth client posted to the wrong URL (2026-09-07)

Post-ship fix to [`001-workspace-kickoff`](../001-workspace-kickoff/), found when the owner
first ran the app against a real database.

- **Symptom**: `POST http://localhost:3001/api/sign-up/email` → **404**. Sign-up was
  impossible; nothing in the server logs indicated a client fault.
- **Cause**: `apps/web/src/lib/auth-client.ts` passed
  `baseURL: 'http://localhost:3001/api'` together with `basePath: '/api/v1/auth'`. Better
  Auth's `withPath` (`dist/utils/url.mjs`) returns the base URL **untouched** when it
  already carries a path, so `basePath` was silently discarded and the endpoint was
  appended to `/api`. The failure surfaced as a 404 from the server, which points at the
  wrong side of the wire.
- **Fix**: `authTargets()` in `apps/web/src/lib/env.ts` splits `NEXT_PUBLIC_API_URL` into a
  path-less **origin** and a **base path** derived from the API prefix, so the base path is
  always applied and follows the server's `API_PREFIX` rather than being hardcoded.
- **Evidence**: reproduced against a booted API — the old path returns 404 and the fixed
  path `/api/v1/auth/sign-up/email` reaches Better Auth. `apps/web` gained a vitest setup
  and seven regression assertions pinning the split.
- **Note**: this is the first defect found by running the product rather than by a test,
  and it was invisible to the whole suite because both sides were internally consistent —
  the server mounted the route correctly and the client composed a URL correctly; they
  simply disagreed about which one. Worth remembering when the remaining gates are closed.

## Body validation was applied to the session user (2026-09-07)

Post-ship fix to [`001-workspace-kickoff`](../001-workspace-kickoff/), found by the owner
on the first onboarding step.

- **Symptom**: `PATCH /api/v1/onboarding` with a correct body returned **422** —
  `"step": ["Invalid discriminator value. Expected 'about-you' | …"]` — despite the client
  sending `step: 'about-you'`. The error named the one field that was right.
- **Cause**: the routes used handler-level `@UsePipes(new ZodValidationPipe(schema))`.
  Nest binds those pipes to **every** route parameter, so the body schema was also run
  over `@CurrentUser()`. A `SessionUser` has no `step`, so the discriminated union
  reported an invalid discriminator — pointing at the body, which was fine.
- **Scope**: all four routes that validate a body — onboarding, and the three profile and
  safety updates. Every one of them was rejecting valid requests.
- **Fix**: bind the pipe to the parameter — `@Body(new ZodValidationPipe(schema))`. No
  `@UsePipes` remains in the API.
- **Evidence**: reproduced with a spec that goes through a real Nest application via
  supertest; it failed before the change and passes after. Eleven assertions now cover
  these routes end to end, including that unknown body keys are still stripped and that
  out-of-range values are still rejected. `apps/api` tests 85 → **94**.
- **Why the suite missed it**: every existing controller test called the handler *method*
  directly, which bypasses the pipeline where pipes are applied. The controllers were
  correct in isolation and broken in composition — the same shape as the auth-URL defect
  logged above. Recorded as a trap in `apps/api/AGENTS.md`.

## Profile upsert failed with 500 — no unique constraint to conflict on (2026-09-07)

Post-ship fix to [`001-workspace-kickoff`](../001-workspace-kickoff/), found by the owner
completing the first onboarding step (immediately after the `@UsePipes` fix above let a
valid request through for the first time).

- **Symptom**: `PATCH /api/v1/onboarding` with a valid body returned **500** with the
  generic error envelope.
- **Cause**: `ProfileRepository.upsert` uses `onConflictDoUpdate({ target: profiles.userId })`,
  which needs a UNIQUE constraint on `user_id`. The `userOwned()` helper emits a plain
  **index**. Postgres rejects the statement with 42P10, the repository correctly refuses to
  leak the driver message, and the user sees an opaque 500.
- **Scope**: `profiles` and `user_preferences` were both upserted this way;
  `onboarding_state` had the same 1:1 cardinality without the constraint to enforce it.
- **Fix**: `userOwnedSingleton()` in `_utils.ts` — a UNIQUE constraint on `userId` instead
  of an index — applied to those three tables. Migration `0002_cold_blacklash.sql`.
- **Evidence**: `src/schemas/schema.test.ts` asserts the constraint on every singleton
  table, that every `user_id` column is indexed or unique, and that every `user_id` foreign
  key cascades on delete. **Verified it genuinely catches the defect** by reverting
  `profiles` to `userOwned` and confirming the suite fails.
- **Why the suite missed it**: the repositories were never exercised against Postgres, and
  a schema/query mismatch is invisible to both TypeScript and to unit tests that mock the
  database. This is the third seam defect in a row — after the auth URL and the pipe
  binding — and the pattern is consistent: each side correct alone, wrong in composition.
  The new schema test is the first one that checks a contract *between* layers rather than
  within one.

## "Not enough recipes" reported for four different causes (2026-09-07)

Post-ship fix to [`002-plan-generation`](../002-plan-generation/), found by the owner after
configuring an AI provider and still being told to configure one.

- **Symptom**: generation failed with `GENERATION_POOL_TOO_SMALL`, whose copy says to set
  `AI_PROVIDER` — which the owner had already done.
- **Causes, two of them**:
  1. **`AI_MODEL` defaulted to `claude-sonnet-5` regardless of provider.** Setting
     `AI_PROVIDER=google` and leaving `AI_MODEL` at its default asks Google for a Claude
     model. The call fails, `PoolBuilder` degrades to reuse, and the resulting thin pool is
     reported as "not enough recipes". A provider-specific default belonged there from the
     start; a single global one is a trap.
  2. **A failed provider was indistinguishable from an absent one.** `PoolBuilder` caught
     the error, logged it and broke out of the retry loop without recording *that a
     provider had failed*, so the caller could only report a shortfall.
- **Fix**: `AI_MODEL` now defaults per provider and is empty in `.env.example`; a
  mismatched pairing (a Claude model on Google, or the reverse) is **rejected at boot**
  with a message naming the provider's default. `PoolBuilder` records `providerUsed` and
  `providerError`, and the pipeline raises the new `GENERATION_AI_UNAVAILABLE` when a
  configured provider failed — with copy pointing at the key, the model name and the quota
  rather than at `AI_PROVIDER`. The shortfall log line now reports reused, generated,
  rejected and provider counts.
- **Evidence**: boot rejects `AI_PROVIDER=google` with `AI_MODEL=claude-sonnet-5`, quoting
  the correct default. Eight new assertions cover the pairing and the provider-error
  distinction. `apps/api` tests 94 → **102**.
- **Reflection**: this is a diagnosability failure rather than a logic one. The pipeline
  behaved correctly at every step; the *reporting* collapsed four distinct situations into
  one message that asserted a specific cause. An error that confidently names the wrong
  fix is worse than a vague one.

## Provider failures said "AI_UNAVAILABLE" and nothing else (2026-09-07)

Follow-up to the entry above, from the owner hitting the new
`GENERATION_AI_UNAVAILABLE` state and still not knowing what to change.

- **Symptom**: the failure screen correctly said the provider had rejected the request, and
  then listed three possible causes without saying which. The actual reason existed only in
  the server log, interleaved with everything else `turbo dev` prints.
- **Cause**: `StructuredAiClient` logged the provider's message and then threw
  `new Error('AI_UNAVAILABLE')`, discarding it. `providerError` therefore carried a
  constant, and the job row had nowhere to put a detail anyway.
- **Fix**: the provider's own message is redacted and carried instead of replaced.
  `plan_generation_jobs` gained an `error_detail` column (migration `0003`), threaded
  through the repository, controller, runner and `JobView`, and rendered on the failure
  screen in a quiet monospace line. `error` stays a stable code the client switches on;
  `errorDetail` is diagnosis.
- **Redaction**: `redactSecrets` strips Anthropic and Google key shapes, bearer tokens and
  `api_key=` assignments, and truncates at 300 characters — provider SDKs sometimes echo
  the failing request, and these messages are both displayed and stored.
- **Evidence**: six redaction assertions, two runner assertions covering the detail
  passthrough. `apps/api` tests 102 → **110**.
- **Reflection**: showing a raw provider message would be wrong in a hosted product. This
  one is self-hosted — whoever sees the failure screen is also whoever edits `.env` — so
  withholding the reason protects nobody and costs an entire debugging cycle. The judgement
  is about who the reader is, not about whether errors are "technical".

## Google's default model was retired for new keys (2026-09-07)

- **Cause**: `DEFAULT_MODEL.google` was `gemini-2.5-flash`. Google has retired it *for new
  API keys* — existing keys keep working, so the change is invisible to anyone who set up
  earlier and hits the first person to sign up fresh.
- **Fix**: default is now `gemini-3.6-flash`, per the provider's own message.
- **Note**: a hardcoded model default will drift again; that is the nature of the
  dependency, not a bug to design away. What matters is that it now fails *legibly* — the
  provider's message, carried through to the failure screen by the previous fix, named both
  the retired model and its replacement. The chain that made this diagnosable took three
  iterations to build; it paid for itself on the first use.
- **Evidence**: `apps/api` 110 tests green, defaults asserted in `Env.validation.spec.ts`.

## Gemini rejected the request schema (2026-09-07)

Post-ship fix to [`002-plan-generation`](../002-plan-generation/) phase 3, found by the
owner once the model name was accepted.

- **Symptom**: `GENERATION_AI_UNAVAILABLE`, detail `"Request contains an invalid
  argument."` — Gemini's generic 400, naming no field.
- **Cause**: the Zod schema was converted to JSON Schema and sent as-is. Gemini accepts
  only a subset of OpenAPI 3.0 and rejects the whole request if anything else appears.
  Probing the converted schema found **seven** offending keyword classes: `minimum`,
  `maximum`, `minLength`, `maxLength`, `exclusiveMinimum`, `additionalProperties` (added by
  the converter itself), and `anyOf` (from `.nullable()`).
- **Fix**: a hand-written `wirePoolSchema` — types, enums, descriptions and `required`
  only — is what goes over the wire; the strict Zod schema now re-parses each returned dish
  in `PoolBuilder`. The bounds are enforced on our side, which is where
  [`0004`](../../decisions/0004-deterministic-safety-layer.md) always said they belonged;
  loosening the wire contract loosens nothing that matters.
- **Also**: `StructuredAiClient` now includes the AI SDK's `responseBody` in the detail,
  since that is where a provider names the offending field when it names one at all.
- **Evidence**: the probe that found the problem now reports no unsupported keywords.
  `pool.schema.spec.ts` asserts nineteen forbidden keywords are absent from the wire
  schema and that the strict schema still rejects an absurd quantity, a negative time, an
  empty ingredient list and an unknown slot. `apps/api` tests 110 → **137**.
- **Reflection**: converting a validation schema into a wire contract conflates two
  different jobs — what a provider can parse, and what we are willing to trust. They were
  never the same thing, and only the second is ours to decide.

## The scheduler optimised calories; validation demanded protein too (2026-09-07)

Post-ship fix to [`002-plan-generation`](../002-plan-generation/) phase 2, found by the
owner on the first generation that reached the validation stage.

- **Symptom**: `GENERATION_INVALID_PLAN` — a plan was built and then discarded. The
  failure carried no detail, so which rule failed was invisible.
- **Cause, a real design gap**: `schedulePlan` optimised **energy only**, while
  `validatePlan` checks energy *and* protein (±10% / ±15%). Scaling a portion changes a
  dish's size, never its composition, so a carb-heavy pool could never pass — and the
  scheduler had no way to steer toward protein.
- **Why the tests missed it**: the fixture ingredient was built with macros in the target's
  exact ratio, so protein tracked calories perfectly and an energy-only scheduler looked
  correct. Real food does not behave that way. **The fixture was the bug's hiding place.**
- **Fix**, in three parts:
  1. Budgets and ranking now carry protein alongside energy (`fitCost` weights energy 1.5
     to 1, matching the tighter tolerance).
  2. A **day-level swap pass** (`improveDay`). Per-slot greedy selection optimises three
     fits independently and can still miss the day: with rice dishes and chicken dishes in
     the pool, every slot's individual best fit on energy is rice. The swap pass replaces
     whole dishes while re-checking variety, which is the only repair that can change a
     day's *composition*.
  3. The prompt now states per-slot energy **and** protein targets, and says plainly that a
     plan meeting calories but short on protein is discarded whole.
- **Also**: a validation rejection now carries a summary — which rules failed, how many
  days each affected, and an example miss — so `errorDetail` distinguishes "the pool was
  carb-heavy" from "one day came out short".
- **Evidence**: new scheduler tests build a pool from real rice, chicken and yoghurt
  figures and assert days land inside **both** tolerances, that protein-bearing dishes get
  chosen when available, and that a pool which genuinely cannot reach the target still
  yields a plan for validation to reject rather than failing silently. `packages/core`
  90 → **93**; workspace 605 → **608**.

## A plan was discarded for having too much protein (2026-09-07)

Post-ship fix to [`002-plan-generation`](../002-plan-generation/) phase 2, immediately
after the detail added above made the cause visible.

- **Symptom**: `GENERATION_INVALID_PLAN`, detail `protein_out_of_band (14 días, p. ej. 204
  frente a 171)`. Protein was **19% over** target, not under. The plan was nutritionally
  fine and was thrown away.
- **Cause**: `PLAN_TOLERANCE.proteinG` was a symmetric ±15%. The comment directly above it
  read *"protein has a floor that matters more than its ceiling, and overshooting it is
  harmless"* — the implementation contradicted its own stated reasoning. For a 4,100 kcal
  day, sizing dishes to the calories naturally carries protein well past its figure.
- **Fix**: `proteinUnder: 0.15`, `proteinOver: 0.35`. Energy stays symmetric, because a
  calorie goal really is missed in both directions. `docs/ARCHITECTURE.md` now records the
  asymmetry as an invariant instead of leaving it in a comment.
- **Evidence**: five assertions covering the floor, an accepted 19% surplus, a rejected
  implausible one, exact-on-target, and energy remaining symmetric. `packages/core`
  93 → **98**.
- **Reflection**: worth separating from the seam bugs above. This was not a wiring mistake
  — every layer did exactly what it was told. It was a **rule that was wrong**, written
  correctly in prose and then implemented as its simpler symmetric cousin. Tests could not
  have caught it: they asserted the behaviour the code intended. Only running it against a
  real person's numbers surfaced the disagreement between the comment and the code.

## A 4,100 kcal target exposed three scheduler limits (2026-09-07)

Post-ship fix to [`002-plan-generation`](../002-plan-generation/) phase 2. The owner's own
profile — 4,099 kcal and 171 g of protein over **three** meals, roughly 1,370 kcal a plate
— sat far outside anything the fixtures covered.

- **Symptom**: `protein_out_of_band (4 días, p. ej. 239 frente a 171); kcal_out_of_band
  (1 día, 2915 frente a 4099)` — simultaneously too much protein and too few calories.
- **Three causes, all real**:
  1. **Candidates were ranked at one serving**, comparing raw size against the slot
     budget. Size is the one thing scaling fixes for free, so the ranking preferred a
     wrong-ratio dish of the right size over a right-ratio dish of the wrong size —
     exactly backwards. Now scored *after* scaling to the slot, so composition decides.
  2. **Portions capped at 2.5×.** A model does not propose 1,370 kcal plates, so the cap
     amounted to refusing to plan for anyone who eats a lot. Raised to 4×.
  3. **The pool was too small to choose from.** `DISHES_NEEDED_PER_SLOT` was the bare
     minimum for the variety rules, meaning nearly every dish had to be used nearly the
     maximum number of times — one protein-dense outlier therefore landed on several days
     with nothing to swap in. Raised by four per slot.
- **The limit that is not a bug**: variety requires drawing on most of the pool, so **the
  pool's average macro ratio becomes the plan's**. A uniformly protein-dense pool cannot
  be rescued by scheduling — only traded, calories against protein, which is precisely the
  2,675 kcal day. Sizing the pool is the prompt's job, and the prompt now states per-slot
  energy *and* protein.
- **Evidence**: a new suite at the exact failing numbers — 4,099 kcal, 171 g, three slots,
  ordinary 450 kcal dishes — asserting days land inside both tolerances and that the result
  passes the same `validatePlan` the pipeline runs. `packages/core` 98 → **101**;
  workspace **616**.
- **Note on fixtures**: three separate defects here were hidden by test pools whose macro
  ratios happened to suit the assertion. Each time, correcting the fixture to something
  realistic surfaced the next real limitation. A fixture chosen to make a test pass is a
  test that asserts nothing.

## The protein ceiling measured the wrong thing (2026-09-07)

Post-ship fix to [`002-plan-generation`](../002-plan-generation/) phase 2. Third rejection
of a nutritionally sound plan on the same rule.

- **Symptom**: `protein_out_of_band (2 días, p. ej. 233 frente a 171)` — 36% over, just
  past the 35% ceiling set in the previous fix.
- **Cause**: the ceiling was a percentage of the *target*, and the target itself varies
  with the goal — 1.6 g/kg for maintenance, 1.9 for muscle gain. So "+35% of target" was
  **stricter for someone maintaining than for someone bulking**, which is backwards, and
  bore no relation to the question the rule is actually asking: is this amount of protein
  plausible for this body?
- **Fix**: the floor stays at −15% of target, because that is what the goal depends on.
  The ceiling becomes `PROTEIN_CEILING_G_PER_KG = 3`, measured against body weight, which
  `validatePlan` now receives. Around 2 g/kg is ordinary for trained people and well above
  target by design; 3 g/kg is where a plan stops looking like food.
- **Evidence**: assertions that a 40% surplus is accepted, that the boundary sits at
  weight × 3 rather than at a multiple of the target, and that the ceiling moves with body
  mass — a 280 g day is rejected for a 75 kg person and accepted for a 100 kg one.
  `packages/core` 101 → **102**.
- **Reflection**: this rule has now been wrong three times — symmetric, then a percentage
  ceiling, then a percentage ceiling with a bigger number. The first two fixes moved the
  threshold; only this one changed what is being measured. Adjusting a constant until real
  data stops failing is fitting the rule to the sample, which is the same error as choosing
  a fixture that makes a test pass.

## A weight-loss goal was given a 1,100 kcal surplus (2026-09-07)

Post-ship fix to [`001-workspace-kickoff`](../001-workspace-kickoff/), found by the owner
reading his own review screen: 4,099 kcal a day, for losing weight.

- **Symptom**: profile 29 y, male, 180 cm, 95 kg, moderate activity, **weight loss**.
  Maintenance is 2,999 kcal and the correct target 2,449. The app showed **4,099**.
- **Cause**: `paceKgPerWeek` was signed, and `nutritionTargets` trusted that sign over the
  goal. The form's hint said "negative to lose"; a pace entered as `1` therefore *added*
  1,100 kcal to a weight-loss plan. The sign was redundant information that could
  contradict the goal, and the goal lost.
- **Fix**: pace is a magnitude and the goal is the only source of direction —
  `Math.abs` in the calculation, normalised again in the entity for older clients, and the
  form no longer offers a negative range.
- **Also**: a floor in absolute calories turned out to be insufficient on its own. 1,899
  kcal clears the 1,500 floor and is still a **37% deficit** for someone maintaining at
  3,000. Added a cap at 25% of maintenance, and a 20% ceiling on a surplus.
- **Evidence**: eight assertions covering direction from the goal, sign-independence, a
  non-directional goal ignoring pace entirely, and both bounds. `packages/core` 102 → **110**.
- **Reflection**: the value was displayed prominently on the review screen for every user
  and nobody noticed, because a number in a box looks authoritative. Worse, the whole
  generation pipeline was built on top of it and behaved *correctly* — it faithfully
  planned 4,099 kcal of food. The days of scheduler work that preceded this were spent
  fitting a plan to a target that was wrong. **Validating the inputs to a calculation is
  worth more than any amount of care downstream of it.**

## Every signed-in page looked frozen while it loaded (2026-09-07)

- **Symptom**: the owner reported the app "keeps loading and seems broken".
- **Cause**: there was not a single `loading.tsx` or `error.tsx` in `apps/web`. Every
  route in the signed-in group is `force-dynamic` — it fetches the user's own data per
  request — and Next.js holds the *previous* screen until the response lands unless a
  loading boundary exists. So navigation produced no feedback at all, and a server
  component that threw replaced the whole app with Next's default error page.
- **Fix**: a skeleton loading state for the signed-in group shaped like the dashboard and
  plan screens (so content does not jump when it arrives), a lighter one for the auth
  screens, and an error boundary offering `reset()` — which is usually all a transient API
  failure needs.
- **Note**: this is the fix batch that made project 003's acceptance criterion 6 concrete;
  the rest of that criterion — per-mutation progress on every control — belongs to the
  project, not here.

### 2026-09-07 — Own plans per user, and compact time fields (task)

- **Executor**: agent, at the owner's report: "In onboarding, the hour inputs are made
  too large. In addition, optimise the prompt so that each user has their own totally
  different plan, with many varieties."
- **Time fields**: `Input` drops the native look for `type=time`/`date`, sizes them to
  their value (`max-inline-size: 11rem`) and left-aligns like every other field. iOS
  drew an oversized, centred picker stretched to the width of the phone.
- **Own plans**: the cause was never the prompt. The scheduler is deterministic and
  order-independent, and reuse handed every user the whole library — so similar
  profiles got the same plan, and the same user got it again next fortnight.
  `rotatePool` gives each user a seeded dozen per slot minus last fortnight's dishes;
  prompt 2.3.0 designs for the person (breakfast style, plate size, cooking frequency,
  their week — fields the profile held and the prompt never read), is told what they
  were served, and must spread the set with counts. `DISHES_NEEDED_PER_SLOT` moved to
  core so the model's ask and the user's hand are one number. ADR 0006 amended.
- **Verified**: unit — rotation determinism, difference across users and versions,
  history exclusion, per-slot cap; prompt content pinned; generation wiring pinned.
  Live — one real generation inspected (see the report in the conversation).

### 2026-09-08 — Documented steps, and an illustration per recipe (task)

- **Executor**: agent, at the owner's report: "the recipes are very simple, only three
  steps, each step has to be better documented. Also add photos of each meal."
- **Steps**: measured first — 29 of 39 dishes in the live plan had exactly three steps,
  median 97 characters, each sentence doing two or three actions. Prompt 2.4.0 asks one
  action per step with how, heat, time and a *cue*; steps carry `minutes` and `cue`; a
  15-minute cook needs four steps and a step needs twenty characters, enforced in
  `domain/Method` and `pool.schema`, not asked for. Existing recipes keep their steps —
  7 of 110 now fall under the floor and leave reuse; nothing already served changes.
- **Illustrations**: [`0010`](../../decisions/0010-illustrate-recipes-not-photograph-them.md).
  Per recipe, labelled as AI-drawn, stored in `recipe_images` (migration `0009`), served
  from one public immutable route, drawn after the plan and swept by a cron. Off by
  default: the provider's free tier allows zero image generations, which was found by
  trying one. Verified with a scripted image client end to end through sharp; the real
  model is one env switch away and unverified until billing exists.
- **Declined**: ingredient photos — a category icon would serve the shopping list better
  for nothing; offered, not built.
- **Hygiene**: yesterday's in-place amendment of 0006 moved into [`0009`](../../decisions/0009-rotate-reuse-per-user.md),
  as the template requires.

### 2026-09-08 — The existing library's steps, rewritten in place (task)

- **Executor**: agent, at the owner's "upgrade the existing recipes' steps".
- **Why it needed more than a prompt**: 2.4.0 only shapes new dishes, and every plan
  the owner can see is built from the hundred and ten already stored. `recipes` now
  records `steps_version`, so "written by a prompt we have since improved" is a
  stamp rather than a guess — which also closes the gap the 2026-09-07 review named
  ("a promptVersion column on recipes would let you retire a whole generation of
  dishes later, and there isn't one").
- **Only `instructions` changes.** Ingredients, grams and the macros every past plan
  computed are untouched; the allergy layer matches ingredient ids, never prose.
- **Two rounds of prompt correction, both found by running it, not by reading it**:
  - 2.4.1 — the first pass gave a bowl of cottage cheese and kiwi *five* steps, one a
    full minute spent spooning cheese into a cup, each with a cue. An uncooked dish now
    gets two or three real actions and no invented minutes.
  - 2.4.2 — a two-minute tostada then got the main-course treatment: seven steps, five
    of them `0 min`, ending "until it is plated and ready to eat". The guidance now
    scales in the same three bands `domain/Method` enforces. It came back at four.
  Bumping the version is what re-sweeps what an earlier one wrote.
- **Also**: a zero-minute step is not data — both write paths drop it, as they already
  dropped an empty cue. And an unconfigured `CRON_SECRET` is now logged, so a cron
  404ing every ten minutes is diagnosable from the logs rather than only from the code.

