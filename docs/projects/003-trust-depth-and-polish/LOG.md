# LOG — Project 003: Trust, depth and polish

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

## Phase 1 — Targets that say what they are (2026-09-07)

- **Executor**: opus @ high, per the plan's dispatch line.
- **Result**: done, except the migration, which needs the owner's database.
- **Evidence**:
  - `pnpm --filter database generate` → `0004_far_rhodey.sql`, creating `target_overrides`
    with the UNIQUE on `user_id` that `ON CONFLICT` needs and the cascading FK.
  - `pnpm turbo lint ts:check test` → 21/21 tasks green. `core` 130 tests (was 111),
    `api` 140 (was 134).
  - The new domain cover is in `packages/core/src/domain/Nutrition/Nutrition.test.ts`:
    the derivation, `targetViolations`, `macrosForKcal` summing across five body masses ×
    four calorie figures, `resolveTargets` across applied/stale/cleared, and a sweep of
    3,600 profiles asserting `nutritionTargets` never throws `TargetsUnreachableError`.
  - `apps/api/src/modules/profiles/profiles.controller.spec.ts` covers `PATCH
    /profile/targets` through the real pipeline, including that `null` survives to the
    controller — a body schema that dropped nulls would make "clear my override"
    indistinguishable from "leave it alone".

- **Deviations from plan**: three, all recorded here rather than improvised silently.

  1. **`wasClamped` is gone**, replaced by `derivation.clampedBy: 'ceiling' | 'floor' |
     null`. The plan asked for a derivation alongside the result; keeping a boolean that
     restates one field of it would have been the second copy of a rule this phase exists
     to remove. The screens now say *which* bound moved the figure and to what.

  2. **Protein is capped at a share of energy** (`MAX_PROTEIN_KCAL_SHARE`) inside
     `macrosForKcal`. Not in the plan, and it turned out to be the actual mechanism behind
     step 5. Carbohydrate was `max(remaining, 0)`: when protein and fat exceeded the
     calorie figure the shortfall vanished into the clamp, and the macros stopped summing
     to the kcal without anything reporting it. Capping protein first makes the remainder
     non-negative by construction, so nothing needs clamping and the assertion in step 5
     is satisfiable rather than aspirational.

  3. **A stale override is set aside, not refused or deleted.** The plan covers writing an
     override and validating it; it does not say what happens when the profile later moves
     under one. Deleting loses a deliberate choice and applying honours a number we no
     longer stand behind, so `resolveTargets` returns `overrideStatus: 'stale'` with the
     violations, falls back to the computed set, and the profile says so.

- **Decisions**: none new. `PROTEIN_CEILING_G_PER_KG` moved from
  `domain/PlanValidation` to `entities/Nutrition` so the target gate and the finished-plan
  gate share one constant rather than two that agree today.

- **Notes for the next phase**:
  - **The migration has not been applied.** Before this phase's work does anything on the
    owner's machine: `pnpm --filter database migrate`. Until then `PATCH /profile/targets`
    and every `GET /profile` will fail on a missing table.
  - `FullProfileView.targets` changed shape — it is a `ResolvedTargets` now, not a flat
    `NutritionTargets`. Anything reading `targets.kcal` wants `targets.effective.kcal`.
    Three call sites were updated; a fourth added in a later phase would fail to compile,
    which is the intent.
  - `PlanGenerationService.targetsFor` no longer computes anything. Phase 2's server-side
    onboarding guard should refuse *before* generation reaches it, so
    `GENERATION_PROFILE_INCOMPLETE` becomes the second line of defence rather than the
    first.
  - The `TargetsPanel` copy is Spanish and hardcoded, like the rest of `apps/web`. Phase 5
    extracts it; do not special-case it now.

## Phase 2 — Onboarding that resumes, and is enforced (2026-09-07)

- **Executor**: opus @ medium, per the plan's dispatch line.
- **Result**: complete and green, **awaiting the phase's `human-verify` step** — the plan
  requires leaving onboarding at each of the eight steps, returning, and confirming both
  the resume point and the retained answers. Nothing here substitutes for that.
- **Evidence**:
  - Phase 1's migration `0004_far_rhodey.sql` was applied by the owner before this phase
    began. Verified directly against the live database: `target_overrides` exists with
    `UNIQUE (user_id)`, the cascading FK to `user`, and all four target columns nullable.
  - `pnpm turbo lint ts:check test` → 21/21 tasks green. `core` 137 tests (was 130),
    `api` 149 across 15 suites (was 140 across 14).
  - `pnpm check:leaks` → clean.
  - `packages/core/src/controllers/Onboarding/OnboardingController.test.ts` is new and
    covers the resume target across the shapes that made the old client-side guess wrong:
    never started, mid-flow, holes left by editing out of order, every answer in but the
    flow not closed, and closed. It also asserts the target never exceeds the last screen
    the web flow renders — a resume step of 10 would 404.
  - `apps/api/src/shared/guards/RequiresOnboarding.guard.spec.ts` covers the rule;
    `meal-plans.controller.spec.ts` gained a pipeline suite that covers the *application*
    of it. A `@RequiresOnboarding()` written but never attached passes a guard unit test
    and a controller unit test both, so the gate is exercised through a real request:
    409 `ONBOARDING_INCOMPLETE`, and `PlanJobRunner.start` never called.

- **Deviations from plan**: two, plus one defect found while verifying step 4.

  1. **The refusal is a 409, not a 404.** Every other denial in this API is a 404 by
     invariant. This one cannot be: the denial rule exists so a caller learns nothing about
     a resource they should not know of, and here the caller owns the account and the only
     useful answer is *which step they left*. A 404 would have satisfied the letter of the
     rule and defeated PRD 5, whose whole point is that the app redirects rather than
     showing an empty screen. Recorded as an explicit exception in `apps/api/AGENTS.md`
     and `docs/ARCHITECTURE.md` rather than left as a silent inconsistency.

  2. **The web gate is per page, not in the layout.** The obvious home for "entering the
     signed-in area redirects" is `(app)/layout.tsx`. It does not work: Next reuses a
     shared layout across navigations between the pages under it, so a layout check runs
     when the section is entered and not again. `redirectIfOnboardingIncomplete()` is one
     function called at the top of each signed-in page — six call sites, one rule. It also
     only acts on a state it positively read, because `serverApi` returns null when the API
     is unreachable and treating "we could not ask" as "incomplete" would loop a signed-in
     user through onboarding every time the backend hiccups.

  3. **A time-of-day answer saved once and then refused.** Found while verifying that each
     of the eight steps repopulates. Postgres returns a `time` column as `HH:MM:SS`;
     `updatePreferencesSchema` accepts `HH:MM` and nothing else. The lifestyle step handed
     the browser back exactly what the API gave it, so re-saving that step without changing
     anything was rejected as invalid input. Fixed in `presentPreferences` — the API now
     reads a time of day in the same shape it writes one — rather than in the form, so the
     read and write contracts agree for every future consumer too.

- **Decisions**: none new. The 409 above is an exception to an existing invariant, recorded
  in place with the reasoning rather than as a separate ADR.

- **Notes for the next phase**:
  - `OnboardingView` gained `resumeStep`. Anything that computes where onboarding resumes
    is now wrong by construction; two clients did, both the same wrong way, and both are
    gone. `/onboarding` with no step is the resume target — link there.
  - Every meal-plan route is behind `@RequiresOnboarding()`. A new route on that controller
    inherits the gate; a new controller that needs it must opt in. The guard costs one
    indexed row read per gated request, including the job-status poll during generation.
  - The dead "termina tu perfil" empty states on `/inicio` and `/plan` are gone: an
    unfinished profile is redirected before either renders. Do not reintroduce a branch for
    a state the page cannot be in.
  - Phase 3 adds free-text allergens to the allergies step. That step already round-trips
    its answers; the new field must too, and `severity` is still hardcoded to `moderate` by
    the form — not a repopulation defect today, because nothing else writes it, but it will
    become one the moment anything does.

## Phase 3 — Allergens outside the list (2026-09-07)

- **Executor**: opus @ high, per the plan's dispatch line and the standing fable→opus
  substitution.
- **Result**: done in code and green. **The migration is not applied** — see the note
  below; until it is, every `GET /profile` fails on a missing table.
- **Evidence**:
  - `pnpm --filter database generate` → `0005_lonely_professor_monster.sql`, creating
    `custom_allergens` with a cascading FK to `user` (account deletion takes it) and
    `on delete set null` to `ingredients`.
  - `pnpm turbo lint ts:check test` → 21/21 tasks green. `core` 161 tests (was 137),
    `api` 153 (was 149).
  - `pnpm check:leaks` → clean.
  - `packages/core/src/domain/Safety/CustomAllergen.test.ts` is new: normalisation,
    name and slug matching, curated synonyms, and — the ones that matter — a near miss,
    a substring, and a group word each resolving to **nothing**.
  - `AllergySafety.test.ts` gained the gate-level half: an excluded ingredient carrying
    *no allergen link at all* is blocked by `findSafetyViolations`, rejected by
    `dishSafety`, and an unmatched label can never reach `excludedIngredientIds`.
  - `PoolBuilder.spec.ts` covers both directions at the boundary: an ingredient excluded
    by free text is never offered to the model and a dish using it is rejected; an
    unresolved label is named in the prompt; and when everything resolved, the prompt
    contains no allergy line at all.
  - Step 4's second half needed no new code and is covered by the existing
    "rejects a dish referencing an ingredient outside the catalogue" test: an unknown
    slug is a `dishSafety` resolution failure and the dish is discarded. That already
    applied to every generation, which is why it is the deterministic half of the
    best-effort case.

- **Deviations from plan**: three.

  1. **No `matched` column.** The plan asks for the flag; `ingredient_id is not null` is
     the flag. A stored boolean can outlive what it describes — with
     `on delete set null`, an ingredient leaving the catalogue downgrades the entry to
     best-effort, which is true, while a boolean would go on claiming an enforcement that
     no longer exists. The failure direction decided it.

  2. **The prompt now names an allergy, in exactly one case.** `PoolPrompt` documented
     that it never mentions a user's allergens — restrictions are enforced by *removing*
     unsafe ingredients from the catalogue listing, so the model cannot pick what it was
     never offered. That rule is intact for everything that resolves. It cannot apply to
     an unmatched label, because there is no row to remove, so `forbiddenLabels` is
     rendered as a line. The comment on `buildPoolPrompt` now says why, and says plainly
     that it is a mitigation and not a guarantee.

  3. **Scope reached two controllers the phase did not list.**
     `RecipeController.generationContext` had to load custom allergens or a matched entry
     would have been enforced everywhere *except* during generation, which is the one
     place it matters. `ProfileController.getFullProfile` had to return them or the
     onboarding step could not repopulate or show per-entry status.

- **Decisions**: none new. The matcher's admission rules are recorded where they are
  enforced, in `core/domain/Safety/CustomAllergen.ts`, and summarised in
  `docs/ARCHITECTURE.md`.

- **Notes for the next phase**:
  - **Apply the migration**: `pnpm --filter database migrate`. Nothing in this phase works
    until then, and `GET /profile` fails outright.
  - **A known gap, and it is the sharp one.** Typing an allergen the *catalogue already
    has as an allergen* — `gluten`, `soja`, `lactosa` — resolves to nothing, because
    matching is against ingredient **names** as the plan specifies. The user is told it is
    best-effort, which is honest but worse than we could do: those have allergen rows and
    are fully enforceable via the checkbox above the field. Matching free text against
    `allergens.labelEs`/`key` as well is a small change and a real improvement; it is
    deliberately not smuggled in here. Raise it with the owner before phase 8.
  - **A match is one ingredient, not a family.** `Brócoli` and `Brócoli congelado` are
    separate rows, so matching the first does not exclude the second. The interface does
    not paper over this — it names the exact ingredient it will withhold ("«Brócoli» no
    aparecerá en ningún plato") rather than claiming the allergy is handled. Ingredient
    families are a later project.
  - `SafetyViolation.allergenId` is `string | null` now — null on a `custom_allergen`
    violation. Nothing outside the domain read it, but a new consumer must handle the null.
  - The profile screen (`/perfil`) does not yet list free-text allergies; only the
    onboarding step does. `FullProfileView.customAllergens` is already there for it.

## Phase 4 — Conditions, medications and supplements (2026-09-07)

- **Executor**: opus @ high, per the plan's dispatch line and the standing fable→opus
  substitution.
- **Result**: done. Built to the `owner-approves` gate, stopped, put the evidence to the
  owner, and completed on their approval of all three recommendations the same day.
  Decision recorded as [`0008`](../../decisions/0008-condition-exclusions.md); the
  assembled evidence stays in [`condition-exclusions.md`](./condition-exclusions.md).
- **Evidence**:
  - `pnpm --filter database generate` → `0006_outgoing_nebula.sql`: `health_conditions`,
    `medications`, `supplements` and the `health_data_consents` singleton, all cascading
    from `user.id`.
  - `pnpm turbo lint ts:check test` → 21/21 tasks green. `core` 175 tests (was 161),
    `api` 158 across 16 suites (was 153 across 15).
  - `pnpm check:leaks` → clean, with one expected warning: `condition-exclusions.md` is a
    stray uncommitted `.md`. It is meant to be committed and the warning clears when it is.
  - `packages/core/src/domain/Health/Health.test.ts` covers the mechanism against an
    *injected* map, so the rule is proven without pre-empting the decision — plus an
    explicit assertion that the shipped map is empty, which will fail the day someone adds
    a mapping without the owner's sign-off passing through this LOG.
  - `apps/api/src/modules/ai/health-boundary.spec.ts` makes the boundary mechanical: every
    non-spec source under `modules/ai` is read and asserted to import nothing from the
    Health controller, entities or repository, and `PromptContext` is asserted to have no
    key matching `condition|medication|health|supplement|diagnos`. It also guards itself —
    if the file glob ever finds fewer than five sources the suite fails rather than
    passing vacuously.

- **The gate — what I need from the owner.** Full reasoning and sources in
  `condition-exclusions.md`; the short version:
  1. `coeliac` → `gluten`. High confidence: the treatment *is* a gluten-free diet, so this
     is definitional rather than therapeutic.
  2. `lactose_intolerance` → `lactose`. High confidence in direction, but most people
     tolerate some lactose, so a hard exclusion is stricter than most clinicians advise.
     My recommendation is to approve it as a **suggestion the user confirms**, not an
     automatic exclusion — which needs a small UI addition that is not built.
  3. `pregnancy`. Not proposed as a mapping: the established advice is ingredient- and
     preparation-level food safety, not allergens, and the mechanism cannot express
     "undercooked". My recommendation is to leave it to the supervision notice.

  Everything I ruled out and why — diabetes, hypertension, kidney disease, gout,
  cholesterol, IBS — is tabulated in the document. The rule I applied: a mapping is
  proposed only where avoiding the substance *is* the definition of managing the
  condition, never where it is one therapeutic strategy among several.

- **Deviations from plan**: three.

  1. **Capture lives on `/perfil`, not in the onboarding flow.** The plan's scope named
     `components/OnboardingFlow`. Adding a ninth data step would have changed
     `REQUIRED_ONBOARDING_STEPS` and every step index the profile screen deep-links to —
     and, worse, would have made health data a condition of finishing onboarding. Data
     given in order to use the product is not consent. It is an optional panel with its
     own consent checkbox and its own delete button.

  2. **Supplement protein is displayed, not deducted.** The plan says "counted toward
     daily totals", which admits two readings: show it, or lower the protein the plan must
     supply by it. I took the first. Quietly reducing a target on the strength of a number
     the user typed and nothing verifies changes a figure they read as theirs, invisibly,
     and could push the plan under the validator's protein floor — the exact class of
     failure phase 1 existed to remove. It is labelled "además de lo que aporta el plan".
     **If you meant the second reading, say so and it is a small change.**

  3. **No dose column on `medications`.** The plan says medications are stored and shown
     back. Dosing is permanently out of scope by `0004`, so a dose field would be health
     data whose only possible use is one we have ruled out. The form says why we do not
     ask.

- **Decisions**: none new. `condition-exclusions.md` is a decision *request*, not a record;
  it becomes one when you answer it.

- **Notes for the next phase**:
  - **Apply the migrations**: `pnpm --filter database migrate` covers `0005` and `0006`
    together. `GET /health-data` and `GET /profile` both fail until then.
  - `HEALTH_CONSENT_VERSION` is `'1.0.0'` in `core/entities/Health` and duplicated as
    `CONSENT_VERSION` in `components/HealthPanel` — the web app cannot import a value from
    a core *entity* module at runtime, only types. Phase 5 is extracting strings anyway;
    if it makes a shared constants path, this belongs in it. A mismatch fails loudly (the
    schema is `z.literal`), which is why the duplication is survivable.
  - The health panel's condition list is duplicated the same way and for the same reason.
  - On approval, turning the map on is: fill `CONDITION_EXCLUSIONS`, then feed
    `allergenKeysForConditions` into `SafetyController.getSafetyProfile` and
    `RecipeController.generationContext`, mapping allergen keys to ids. The safety gate
    itself needs no change — approved exclusions enter through the existing allergen set.

### Phase 4, after the gate — the approved map, wired (2026-09-07)

The owner approved all three recommendations. What that turned into:

- **`coeliac` → `gluten`, automatic**, at `contains` level; trace sensitivity stays the
  user's explicit choice in the allergy step, because *how strictly* to avoid
  cross-contamination varies by individual and grading that is the reasoning this layer
  refuses to do.
- **`lactose_intolerance` → `lactose`, offered** via a second map, `CONDITION_SUGGESTIONS`.
  Same shape, different force. Accepting a suggestion means adding an ordinary intolerance
  in the allergy step, so it lands in the list the user already manages and can remove —
  nothing becomes a restriction they cannot see or undo. A suggestion already acted on
  stops being shown, so the panel does not nag about a decision already made.
- **Pregnancy unmapped**, carried by the supervision notice.

- **The unplanned improvement this forced, and it is the good kind.**
  `SafetyController.getSafetyProfile` is now the **only** place a `SafetyProfile` is
  assembled. `RecipeController.generationContext` had been building its own from
  repositories — so "what may this user eat" had two implementations that happened to
  agree, right up until phase 3 added free-text allergies and only one of them knew.
  Wiring condition exclusions would have made that two-way split three-way. Instead
  generation now calls the same named method everything else does, and the four sources
  (declared allergies, declared intolerances, resolved free text, signed-off conditions)
  merge in one place.

- **Evidence**: `pnpm turbo lint ts:check test` → 21/21. `core` 180 tests (was 175),
  `api` 158. Both maps are pinned by exact-contents assertions in `Health.test.ts`, and a
  further test asserts the ruled-out conditions — diabetes, hypertension, kidney disease,
  gout — infer nothing under **either** map.

- **Notes**: an automatic exclusion is shown on the profile with its cause ("Por tu
  celiaquía excluimos cereales con gluten…"). The suggestion links to `/onboarding/6`,
  which is a hardcoded step index; phase 5 or a later tidy should give the allergy step a
  named route rather than a number.

## Phase 5 — Locale plumbing and the interface in English (2026-09-07)

- **Executor**: opus @ high, per the plan's dispatch line.
- **Result**: complete and green, **awaiting the phase's `human-verify` step** — switch to
  English and walk every screen looking for Spanish.
- **Evidence**:
  - `pnpm turbo lint ts:check test` → 21/21 green. `web` 20 tests across 2 files (was 4
    across 1); `core` 180, `api` 158 unchanged.
  - `NEXT_PUBLIC_API_URL=… pnpm turbo build` → compiled, 15 routes, no type errors.
  - `pnpm check:leaks` → clean apart from the expected "stray uncommitted .md" warning for
    the two documents phase 4 added, which clears when they are committed.
  - Roughly 450 strings moved out of 30-odd components and pages into two dictionaries.
  - `src/i18n/i18n.test.ts` is new. Beyond the negotiation cases it does the thing the type
    system cannot: asserts both dictionaries keep the **same placeholders** in every string,
    that no value is empty, and that list-shaped entries are the same length. A dropped
    `{count}` reads perfectly and silently loses a number from a sentence.

- **How it fits together**:
  - `activeLocale()` is the one resolution: cookie → `Accept-Language` → default. Reading
    the header in the render rather than in middleware means a first-time visitor gets their
    own language on the *first* response, with no redirect and no flash of Spanish.
  - `profiles.locale` is the durable preference and the cookie is a cache of it. The
    switcher writes both in one action; sign-in copies the column into the cookie, which is
    what makes a language chosen on one device survive signing in on another.
  - Every API call now carries `Accept-Language`. Nothing reads it yet — that is phase 6 —
    but the plumbing belongs with the locale decision rather than with the first feature to
    need it.
  - `en-GB.ts` is typed as the Spanish dictionary's shape, so a forgotten key fails
    `ts:check`. Values are plain strings with `{name}` placeholders because functions do not
    survive the server/client boundary.

- **Deviations from plan**: two, plus one deliberate non-translation.

  1. **The pipeline's stage labels became codes.** `PlanGeneration.STEPS` held Spanish
     sentences, written to the job row and rendered verbatim on the progress screen — a
     Spanish line in the middle of an otherwise English page. They are stable codes now
     (`CHOOSING_RECIPES` and so on) and the client turns them into words, exactly as it
     already did for failure codes. `apps/api/src/modules/meal-plans` was not in the phase's
     scope; the acceptance criterion is "walk every screen looking for Spanish", and this
     was on one.

  2. **Three presentational components became client components.** `MacroSummary`,
     `MealRow` and `ProfileSection` are rendered from both server and client parents, so
     they cannot be `async` and cannot take `await getDictionary()`. Making them read the
     provider is the smaller cost — they are a few lines each, and the alternative was
     threading a dictionary prop through every caller.

  3. **Cuisine names are not translated, on purpose.** "Mediterránea" is a value stored on
     the profile and matched against recipe metadata; it is data, not copy. The section
     anchors (`#como-funciona`) stay Spanish for the same class of reason — they are URLs
     someone may have saved. Both are commented where they appear.

- **Decisions**: none new.

- **Notes for the next phase**:
  - **Phase 6 has its hook already**: `Accept-Language` arrives on every request, and
    `activeLocale()` is the only thing that decides what it says.
  - `HEALTH_CONSENT_VERSION` and the condition list are still duplicated between
    `core/entities/Health` and the web — the note from phase 4 stands, and the dictionary
    now holds the condition *labels* while core holds the keys, which is the right split.
  - `dictionary.slots`, `dictionary.categories` and `dictionary.meal.difficulty` are keyed
    by the API's machine tokens and fall back to the token itself, so an untranslated value
    looks like a missing translation rather than an empty row. Phase 6 adds ingredient and
    dish names, which are **content** and belong in the database, not here.
  - The onboarding review and the profile screen both render `SummaryRow`, whose em-dash
    fallback is hardcoded. It is punctuation, not copy; leave it.

## Phase 6 — The catalogue and generated content in English (2026-09-07)

- **Executor**: opus @ high, per the plan's dispatch line.
- **Result**: done in code and green. **Owner-gated on the migration and the seed** — this
  one rewrites the catalogue, so it needs applying against the live database and the seed
  re-running. Commands below.
- **Evidence**:
  - `pnpm --filter database generate` → `0007_thankful_matthew_murdock.sql`: creates
    `ingredient_names`, adds `recipes.locale`, drops `ingredients.name` and
    `ingredients.locale`.
  - `pnpm turbo lint ts:check test` → 21/21 green. `api` 160 tests (was 158), `database` 16,
    `core` 180, `web` 20.
  - `pnpm check:leaks` → clean apart from the standing "stray uncommitted .md" warning.
  - 200 English ingredient names in `seed/ingredient-names.ts`, with `seed.test.ts`
    asserting every seeded slug has one, that none is orphaned, and that none is a
    copy-paste of the Spanish (with an explicit allow-list for the nine words that are
    genuinely identical — bagel, chorizo, croissant, guacamole, hummus, kiwi, muesli,
    tahini, tempeh).
  - `PoolBuilder.spec.ts` covers both directions of the prompt: English instructions with
    `BRITISH ENGLISH` requested, and `SPANISH (SPAIN)` for a Spanish user.

- **The hand-edited migration, and why.** `drizzle-kit` generated `DROP COLUMN "name"`
  with nothing moving the data first. `0007` carries an `INSERT … SELECT` between the
  create and the drop, copying every existing name in as `es-ES`. Without it the migration
  is silently destructive on a populated database; with it, the migration alone is
  sufficient and the seed re-run only *adds* English. Recorded in
  `packages/database/AGENTS.md` as a standing rule for text-moving migrations.

- **Deviations from plan**: three, all scope rather than design.

  1. **`repositories/Plan` and `controllers/Plan` were not in scope and had to change.**
     `findMealDetail` read `ingredients.name` directly — the ingredient list on a meal
     screen. Leaving it would have given an English user an English shopping list and a
     Spanish ingredient list on the dish it came from.

  2. **`repositories/Safety` too, and this one turned into an improvement.**
     `listMatchableIngredients` fed the free-text allergy matcher from `ingredients.name`.
     It now returns **one row per name across every locale**, so "broccoli" and "brócoli"
     both resolve to the same ingredient. Matching only the user's own language would have
     meant an allergy going unenforced for want of a translation nobody thought about — a
     safety consequence of a translation decision, which is exactly the kind of link worth
     stating out loud.

  3. **The shopping list is collated in its own language.** `localeCompare(name, 'es')` was
     hardcoded. On a list you read while walking a supermarket, accented words in the wrong
     place are in exactly the spot you will not look.

- **Decisions**: none new.

- **Notes for the next phase**:
  - **Owner-gated, in this order**:
    ```
    pnpm --filter database migrate     # applies 0005, 0006 and 0007
    pnpm --filter database seed        # adds the en-GB names; safe to re-run
    ```
    The migration preserves existing Spanish names on its own; the seed is what makes
    English work. Running the migration without the seed leaves an English user reading
    Spanish ingredient names — degraded, not broken, and logged at warn during generation.
  - **Existing recipes all default to `es-ES`.** That is correct for everything generated
    so far, and it means an English user starts with an empty reuse pool and pays for a
    full generation. Expected, and it fills as English users generate.
  - `CatalogueIngredient.nameLocale` says which locale a name actually came from.
    `PlanGenerationService.reportUntranslatedIngredients` is the only consumer; anything
    else that wants to surface the gap has what it needs.
  - `PROMPT_VERSION` is `2.0.0`, and it is recorded on every job's
    `generation_metadata` along with the locale — so a plan built before this change is
    distinguishable from one built after it.
  - Phase 7 is the design pass. Nothing here blocks it.

## Phase 7 — The design pass (2026-09-07)

- **Executor**: opus @ high, per the plan's dispatch line.
- **Result**: complete and green, **awaiting the phase's `human-verify` step** — the owner
  reviews every screen at phone and desktop width, and with reduced motion enabled. This
  phase's acceptance is a judgement and it is his.
- **Evidence**:
  - `pnpm turbo lint ts:check test` → 21/21 green. `ui` 371 tests (was 368).
  - `NEXT_PUBLIC_API_URL=… pnpm turbo build` → compiled.
  - `pnpm check:leaks` → clean apart from the standing `.md` warning.
  - Every `var(--…)` in every `apps/web` module stylesheet was checked against the two
    token files; the only unresolved one is `--reveal-delay`, which `Reveal` sets inline
    with a fallback.

- **What the three words turned into.**
  - **"Bunched up" was never a shortage of space** — it was every component deciding its
    own gaps, so nothing lined up and no gap meant anything. Three tokens now:
    `--gap-heading` (a heading to its content), `--gap-block` (block to block within a
    region), `--gap-region` (region to region). Applied across every app stylesheet, with
    `--card-padding` replacing the per-component `--space-0N` pairs and `--label-column`
    making the profile screen and the targets panel agree on where their values start.
  - **"Empty" was a single centred column on a canvas wide enough for two.** Above
    `--breakpoint-wide` the dashboard splits into a main column and a rail — the targets go
    in the rail because they are reference, consulted rather than acted on, and they belong
    *beside* today rather than below it. The plan screen does the same with the day picker:
    fourteen chips in a horizontal scroller is right on a phone and wrong on a desktop,
    where there is room to show the fortnight at once and no reason to make someone push a
    row along to find Thursday.
  - **"Bland" is partly motion.** `ui/styles/motion` adds four utilities and no more:
    `.motion-enter`, `.motion-list` (stagger on the children, capped at eight because
    beyond that a stagger is a queue), and `.motion-forward` / `.motion-back` for a
    shared-axis change. Used on card and list entrances, the onboarding step change, and
    the plan's day change.

- **The constraint that shaped the motion work.** "None may delay interaction." Nothing in
  `motion.css` touches `pointer-events` or `visibility`, and nothing waits on
  `animationend` — an element mid-entrance is a working element that happens to be moving.
  Reduced motion needed no new code: `ui/styles/base` already collapses every animation and
  transition, so these inherit it, and adding a second guard would have been a second place
  for the rule to be wrong.

- **Deviations from plan**: two, both scope.

  1. **`packages/ui/src/components/Button` was not in the listed scope and had to change.**
     Every submitting control was inventing its own pending state — a text swap, sometimes
     a disable, never a spinner. `loading` now adds a spinner, sets `aria-busy` and
     disables, and a busy button stays at full opacity because it is working rather than
     unavailable. A design pass that left each button to improvise is the exact defect this
     phase names. Ten call sites adopted it; buttons *beside* the acting one stay merely
     disabled, since two spinners for one request says two things happened.

  2. **Two pages changed markup, not just CSS.** Density is a layout problem, and the
     dashboard and plan screens needed a main/rail split that CSS alone cannot express over
     a flat fragment.

- **Decisions**: none new.

- **Notes for the next phase**:
  - Phase 8 is verification and documentation, and it now has three human-verify steps
    outstanding to reconcile: phase 2's onboarding walkthrough, phase 5's English pass, and
    this one.
  - `--breakpoint-wide` (64rem) is where every rail appears. It is a token, but the media
    queries hardcode `64rem` because CSS custom properties cannot be used in a media query
    condition. If that ever moves, it moves in three files — `inicio`, `PlanBrowser`,
    `PlanDayNav` — and there is no way to make the compiler notice.
  - The landing page keeps `--section-gap` and its own much larger rhythm on purpose. A
    marketing page and a dashboard are not the same density problem, and collapsing them
    into one scale would flatten both.

## Phase 8 — Verification and documentation (2026-09-07)

- **Executor**: opus @ high, **not** the sonnet @ medium the plan's dispatch line names.
  The owner reported three defects in the same message that asked for this phase, two of
  them design decisions about where a language control belongs, and splitting those from
  the verification work would have meant handing a subagent a moving target. Logged rather
  than done quietly.
- **Result**: done in code and green. **The e2e suites remain `owner-gated`** — they need a
  throwaway database, and they have still never been executed. Commands in
  `apps/api/test/README.md`.

- **Evidence**:
  - `pnpm turbo lint ts:check test` → 21/21 green. `NEXT_PUBLIC_API_URL=… pnpm turbo build`
    → compiled. `pnpm check:leaks` → clean apart from the standing `.md` warning.
  - Four new e2e suites, taking the total from three to seven:
    `custom-allergens`, `health-data`, `target-overrides`, `localisation`. Each proves an
    outcome rather than an implementation — a name absent from a stored plan, a medication
    absent from a captured prompt, a corrected figure present in a plan's stored strategy.
  - `harness.ts` now records every prompt the scripted client was sent. "A medication never
    reaches a prompt" is only a checkable claim if the prompt is checkable.
  - `docs/PRODUCT.md` gained the scope paragraph the plan asked for: what collecting health
    data does and does not change about who this product is for.

- **The three defects the owner reported, and what each turned out to be.**

  1. **"Elements that aren't centered."** The landing page's lede sat against the left edge
     of a centred hero. `Text.module.css` had `.text { margin: 0 }` and the page had
     `.lede { margin: … auto 0 }` — both single-class selectors, so which one won came down
     to the order two CSS modules happened to land in the bundle. The fix is a deletion:
     `ui/styles/base` already zeroes every margin with `* { margin: 0 }`, so the component
     rule was redundant *and* was stealing layout from every consumer that passed a class
     to a `Text`. A reset belongs at reset specificity. This was a whole class of latent bug
     — a dozen call sites pass layout classes to `Text` — not one instance.

  2. **"The homepage isn't translated into English."** It was working as designed and the
     design was wrong. With no cookie set, `activeLocale()` negotiates from
     `Accept-Language`, so a Spanish browser gets Spanish — correct, and useless to someone
     who wants to read it in English and has nowhere to say so. (The English text in the
     report was the browser's own auto-translation, which is what a reader does when the
     product gives them no control.)

  3. **"There should be a language selector … throughout the app."** There was one, on the
     profile screen, behind a sign-in. It is now in all three shells — the marketing header,
     the app nav, and the auth layout — as a compact two-mark segmented control, each
     language named in itself.

- **What the global switcher forced, and it is the interesting part.** Signed out there is
  no profile to persist to, and `PATCH /profile` returns **404** to a caller with no session
  because that is what every protected route returns (the denial rule). So the cookie is
  written *first and unconditionally* — it is the half that works for everyone — and the
  profile write is attempted after, with a 404 swallowed deliberately and anything else
  surfaced. The visible change never waits on, or is lost to, a call a visitor had no
  business making.

- **Deviations from plan**: two.

  1. **The dispatch model** — see the executor line above.
  2. **`packages/ui/src/components/Text` and three app shells changed**, which phase 8's
     scope (`apps/api/test/`, `docs/`) does not include. They are the owner's reported
     defects, delivered in the phase that was open.

- **Decisions**: none new.

- **Notes for whoever picks this up**:
  - **Three human-verify gates are still open**: phase 2 (leave and resume onboarding at
    each of the eight steps), phase 5 (switch to English and walk every screen), phase 7
    (every screen at phone and desktop width, and with reduced motion on). Phases 2, 5 and 7
    stay `in progress` in the plan until those are confirmed.
  - **The owner-gated work, in order**: `pnpm --filter database migrate` (0004–0007),
    `pnpm --filter database seed`, then the e2e suites against a **throwaway** database.
    The suites register and delete accounts and write scripted dishes into the shared recipe
    library, so they must never point at real data.
  - The e2e suites are **written but unrun**. Everything in them typechecks and lints, and
    the fixtures use slugs the seed guarantees, but no assertion in them has ever been
    executed. Treat the first run as part of the work, not as a formality.
