# Plan — Project 003: Trust, depth and polish

> **Purpose**: the phased technical execution plan — the engineering half of the
> contract. `/execute-project` follows this literally; executors implement phases, they
> do not redesign them. If implementation must diverge, the plan is amended in the same
> change and the deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes.

- **Status**: approved
- **Type**: standard
- **PRD**: [./PRD.md](./PRD.md) — the criterion map is at the end of this file.
- **Routing profile**: `tiered`, with one standing substitution: **the owner has no access
  to fable**, so phases the profile would route there run on **opus** instead. Recorded in
  [`decisions/LOG.md`](../../decisions/LOG.md); noted per phase where it applies.

## Design summary

Sequenced so **every screen is styled once**: the numbers become trustworthy, then the
profile gains its new fields, then everything is translated, and only then is the surface
designed — in its final shape, in both languages. That defers the most visible work to
last, which the owner accepted deliberately.

Three principles carry through, each a response to something this codebase already got
wrong:

**Derived numbers are shown as derived.** The 4,099 kcal defect was not caught for days
because a number in a box looks like a fact. Every computed figure now says what it is,
shows its basis, and can be corrected.

**A guarantee is enforced in code or it is not offered.** Free-text allergens are matched
against the catalogue and enforced identically where they match; where they do not, the
product says so rather than passing the text to a model and calling that safety.

**Health data is collected as health data, or not at all.** Conditions and medications
become deterministic exclusions and a supervision prompt. They never enter a model
prompt, never reach a log, and leave with the account.

## Phases

### Phase 1 — Targets that say what they are

- [x] done
- **Dispatch**: opus @ high — `/execute-project 003 phase 1`
- **Goal**: make every derived nutrition figure legible, correctable and impossible to compute into an impossible state.
- **Scope**: `packages/core/src/{domain/Nutrition,entities/Nutrition,entities/Profile,controllers/Profile,repositories/Profile}`, `packages/database/src/schemas/profile.schema.ts`, `apps/api/src/modules/profiles/`, `apps/web/src/app/(app)/{inicio,perfil}`, `apps/web/src/components/MacroSummary/`.
- **Steps**:
  1. Add `target_overrides` to the profile schema (nullable kcal and macros, plus `overriddenAt`). A null column means "use the computed value" — do not copy the computed figure in, or a later change to the equation silently stops reaching that user.
  2. `nutritionTargets` returns its **derivation** alongside its result: equation name, BMR, activity factor, goal, pace, and which bound (if any) clamped it.
  3. `ProfileController.getFullProfile` returns computed targets, the override if set, and the effective targets, so no consumer has to decide which to use.
  4. `PATCH /profile/targets` accepts an override, validated against the *same* floor and the 25%/20% caps as the computed path — one shared function, not a second copy of the rules. A refusal names the bound it hit.
  5. **Validate at computation.** A profile that passes onboarding must yield targets a plan can satisfy; if the derivation produces something unreachable, that is an error at the point of computation, not a generation failure three stages later (PRD 15).
  6. Web: targets labelled indicative with a short "how we worked this out" disclosure, an edit form, and a visible marker when a target is the user's.
- **Acceptance criteria**: PRD 1, 2, 3, 15.
- **Verification**:
  ```
  pnpm --filter database generate
  pnpm turbo lint ts:check test
  ```

### Phase 2 — Onboarding that resumes, and is enforced

- [ ] in progress — code complete and green; awaiting the `human-verify` step below
- **Dispatch**: opus @ medium — `/execute-project 003 phase 2`
- **Goal**: leaving is fine; arriving anywhere else with a half-finished profile is not.
- **Scope**: `packages/core/src/controllers/Onboarding/`, `apps/api/src/{shared/guards,modules/meal-plans,modules/profiles}`, `apps/web/src/{proxy.ts,app/(app)}`.
- **Steps**:
  1. A `RequiresOnboarding` guard on every route that needs a complete profile — generation above all. **The check is the API's**; today only the web app looks, and the API will happily generate from a half-filled profile.
  2. `GET /onboarding` already reports `missingSteps`; use it to resolve a resume target, so the client never computes which step is next.
  3. Web: entering the signed-in area with an incomplete profile redirects to the resume step. Leaving stays possible and says progress is kept — people get interrupted, and a flow that traps them is worse than one they can return to.
  4. Every step's saved answers repopulate on return. This mostly works; verify each of the eight and fix what does not.
- **Acceptance criteria**: PRD 4, 5.
- **Verification**:
  ```
  pnpm turbo lint ts:check test
  ```
  — human-verify: leave onboarding at each of the eight steps, return, and confirm the resume point and the retained answers.

### Phase 3 — Allergens outside the list

- [x] done
- **Dispatch**: opus @ high — `/execute-project 003 phase 3` *(the routing profile would send this to fable as safety-critical; fable is unavailable, so opus at high effort — the substitution is the standing one in the plan header)*
- **Goal**: let someone name any allergy, and be honest about which we can enforce.
- **Scope**: `packages/database/src/schemas/safety.schema.ts`, `packages/core/src/{entities/Safety,domain/Safety,repositories/Safety,controllers/Safety}`, `apps/api/src/modules/{safety,ai}`, `apps/web/src/components/OnboardingFlow/`.
- **Steps**:
  1. `custom_allergens`: user id, the text as typed, the resolved `ingredientId` when matched, and a `matched` flag.
  2. Matching is deterministic and conservative — normalised exact and known-synonym matching against ingredient names, **never fuzzy**. A near-match that is wrong is more dangerous than no match, because it produces a guarantee we cannot keep.
  3. A matched entry enters the `SafetyProfile` and is enforced by the existing gate, identically to a listed allergen. `dishSafety` gains no second path.
  4. An unmatched entry constrains generation differently: it is named in the prompt as forbidden **and** any generated dish whose ingredients we cannot fully resolve is rejected. Belt and braces, because the prompt is not a guarantee.
  5. The UI states per entry whether it is enforced or best-effort. No aggregate reassurance.
  6. Tests: a matched custom allergen blocks exactly as a listed one; an unmatched one is stored, surfaced and never silently treated as enforced.
- **Acceptance criteria**: PRD 7.
- **Verification**:
  ```
  pnpm turbo lint ts:check test
  ```

### Phase 4 — Conditions, medications and supplements

- [x] done — the `owner-approves` gate was put and answered; see [`0008`](../../decisions/0008-condition-exclusions.md)
- **Dispatch**: opus @ high — `/execute-project 003 phase 4` *(same substitution: safety- and privacy-critical)*
- **Goal**: collect what changes a plan, use only what we can use responsibly, and say where the line is.
- **Scope**: `packages/database/src/schemas/{profile,platform}.schema.ts`, `packages/core/src/{entities,domain,repositories,controllers}`, `apps/api/src/modules/{profiles,ai,meal-plans}`, `apps/web/src/{components/OnboardingFlow,app/(app)/perfil}`.
- **Steps**:
  1. Schema: `health_conditions`, `medications`, `supplements`, and a consent record with timestamp and version. All cascade from `user.id`.
  2. A **curated** condition→exclusion map in `packages/core/domain`, covering only mappings that are well established (coeliac → gluten, lactose intolerance → lactose, and similar). Anything unmapped produces **no** dietary inference — only a supervision recommendation.
  3. Medications are stored and shown back, and are **never** mapped to a dietary rule and **never** placed in a prompt. Their presence raises the supervision recommendation and nothing else. This is the boundary [`0004`](../../decisions/0004-deterministic-safety-layer.md) draws, and the phase must not cross it however tempting an interaction lookup seems.
  4. Supplements carry an optional protein contribution counted toward daily totals, and are excluded from the shopping list, which is for food.
  5. Redaction: extend the pino redaction list and add a test asserting no condition or medication field appears in a built prompt.
  6. A persistent, non-dismissable note on the profile whenever a condition or medication is recorded, recommending professional supervision.
- **Acceptance criteria**: PRD 8, 9, 10.
- **Verification**:
  ```
  pnpm --filter database generate
  pnpm turbo lint ts:check test
  ```
  — owner-approves: the condition→exclusion map is a clinical judgement, not an engineering one. Assemble the proposed mappings with sources and stop for sign-off before wiring them.

### Phase 5 — Locale plumbing and the interface in English

- [ ] in progress — code complete and green; awaiting the `human-verify` step below
- **Dispatch**: opus @ high — `/execute-project 003 phase 5`
- **Goal**: one locale decision, honoured everywhere, with the interface fully translated.
- **Scope**: `apps/web/src/**`, `packages/core/src/entities/Profile`, `apps/api/src/shared/`.
- **Steps**:
  1. `profiles.locale` already exists and nothing reads it. Make it the source of truth: resolved server-side, passed to the API on every request, and used for `<html lang>`.
  2. A dictionary per locale (`es-ES`, `en-GB`) with a typed lookup, so a missing key is a type error rather than a blank space. **No runtime string interpolation of user data into keys.**
  3. Extract every literal in `apps/web`. This is the wide-and-shallow part of the phase — a batch, not a design exercise.
  4. A locale switch in settings; changing it changes the interface immediately and is persisted.
  5. Dates, numbers and quantities through `Intl` with the active locale — `formatQuantity` currently hardcodes Spanish decimal commas.
- **Acceptance criteria**: PRD 11 (interface half).
- **Verification**:
  ```
  pnpm turbo lint ts:check test
  NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1 pnpm turbo build
  ```
  — human-verify: switch to English and walk every screen looking for Spanish.

### Phase 6 — The catalogue and generated content in English

- [x] done — the `owner-gated` migration and seed are still to run; commands in [LOG.md](./LOG.md)
- **Dispatch**: opus @ high — `/execute-project 003 phase 6`
- **Goal**: an English user gets an English shopping list, which is the half that actually matters.
- **Scope**: `packages/database/src/{schemas/food.schema.ts,seed}`, `packages/core/src/{repositories/Recipe,controllers/Recipe}`, `apps/api/src/modules/ai/`.
- **Steps**:
  1. `ingredient_names`: ingredient id, locale, name — replacing the single `name` column's implicit Spanish. The existing `locale` column on `ingredients` is a row-level tag and is the wrong shape; migrate the ~200 names into the new table with both locales.
  2. `CatalogueIngredient.name` resolves by the requesting user's locale, falling back to `es-ES` with the gap logged rather than shown.
  3. **The prompt moves to English entirely**, for every locale — it steers the model better and keeps one prompt to maintain. It instructs the model to write dish names and steps in the *user's* language, passed as a parameter.
  4. `recipes` gains a `locale`; reuse is scoped to it, so an English user never receives a Spanish recipe from the shared library.
  5. Shopping list items already snapshot their name; snapshot the localised one.
- **Acceptance criteria**: PRD 11 (data half), 12.
- **Verification**:
  ```
  pnpm --filter database generate
  pnpm turbo lint ts:check test
  ```
  — owner-gated: the migration rewrites the catalogue, so it needs applying against the live database and a `seed` re-run. Hand over the exact commands.

### Phase 7 — The design pass

- [ ] in progress — code complete and green; awaiting the `human-verify` step below
- **Dispatch**: opus @ high — `/execute-project 003 phase 7`
- **Goal**: make it feel built rather than assembled — the owner's words were "empty", "bland" and "bunched up".
- **Scope**: `packages/ui/src/styles/`, `apps/web/src/**/*.module.css`, `apps/web/src/components/`.
- **Steps**:
  1. **Spacing audit.** Every `.module.css` in `apps/web` and every offender in `packages/ui`: no raw px or rem where a `--space-*` token exists. Establish and apply one rule for the gap between a heading and its content, and one for the gap between sections — the reported crowding is that rhythm being decided per component.
  2. **Alignment audit.** Optical alignment of numbers (tabular figures already in places, not everywhere), consistent card padding, and grid columns that agree between the dashboard, plan and profile.
  3. **Density.** The screens are sparse because they carry one card on a wide canvas. Give the dashboard and plan a real layout at desktop widths rather than a single centred column.
  4. **Motion system** in `packages/ui/src/styles/variables.css`: named durations and easings already exist; add entrance, exit and shared-axis transitions, and use them for page transitions, onboarding step changes, and list and card entrances. Every one behind `prefers-reduced-motion`, and none may delay interaction — a control must be usable before its animation finishes.
  5. Per-mutation feedback on every control that submits, completing PRD 6 (the route-level loading states landed as a task before this project began).
- **Acceptance criteria**: PRD 6, 13, 14.
- **Verification**:
  ```
  pnpm turbo lint ts:check test
  NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1 pnpm turbo build
  ```
  — human-verify: the owner reviews every screen at phone and desktop width, and with reduced motion enabled. This phase's acceptance is a judgement, and it is his.

### Phase 8 — Verification and documentation

- [ ] in progress — written and green; the e2e suites are `owner-gated` and have never been run
- **Dispatch**: sonnet @ medium — `/execute-project 003 phase 8`
- **Goal**: prove the new guarantees, and leave the docs true.
- **Scope**: `apps/api/test/`, `docs/`.
- **Steps**:
  1. e2e: a custom allergen that matches never reaches a plate; one that does not is stored and surfaced; a recorded medication never appears in a prompt or a log; an overridden target is what generation uses; an English user's plan and shopping list contain no Spanish.
  2. Update `docs/ARCHITECTURE.md` (locale resolution, the health-data boundary, target overrides) and `docs/PRODUCT.md` (the scope line on medical data now that some is collected).
  3. Append the phase entries to `LOG.md` with real evidence.
- **Acceptance criteria**: PRD 7, 8, 9, 11, 12 — verified rather than asserted.
- **Verification**:
  ```
  pnpm turbo lint ts:check test
  pnpm --filter api test:e2e     # owner-gated: needs a throwaway database
  pnpm check:leaks
  ```

## Hand-off

Standing constraints for every phase:

- **No medical reasoning, anywhere.** Conditions and medications are constraints and a
  supervision prompt. If a phase seems to want an interaction lookup or a
  condition-specific recommendation, the plan is wrong — stop and amend it, do not
  improvise across that line.
- **A guarantee is enforced in code or it is not offered.** Any new safety-shaped feature
  passes through `dishSafety`; nothing gets a second gate.
- **Health data never reaches a prompt or a log.** Extend the redaction list in the same
  change that adds a field.
- **One rule, one implementation.** Target bounds, locale resolution and allergen matching
  each get exactly one function. The 4,099 kcal defect and the three protein-ceiling
  revisions were all duplicated or contradicted rules.
- **Derived values are labelled as derived** wherever they are shown.
- Rebuild the packages after touching them: `pnpm --filter core build`, or `pnpm dev`.
- Green at every phase boundary: `pnpm turbo lint ts:check test`.

## Acceptance criteria → phases

| PRD | Phase |
| --- | --- |
| 1 — targets presented as estimates | 1 |
| 2 — targets correctable within bounds | 1 |
| 3 — a pace cannot contradict a goal | 1 |
| 4 — onboarding resumes | 2 |
| 5 — onboarding enforced server-side | 2 |
| 6 — nothing looks hung | 7 (route-level done as a task) |
| 7 — free-text allergens are honest | 3, 8 |
| 8 — health data handled as health data | 4, 8 |
| 9 — conditions produce constraints, not advice | 4, 8 |
| 10 — supplements recorded and counted | 4 |
| 11 — the product works fully in English | 5, 6, 8 |
| 12 — the prompt is in English | 6, 8 |
| 13 — spacing is systematic | 7 |
| 14 — motion is present and respectful | 7 |
| 15 — generation never fails on our own arithmetic | 1 |

## Out of scope

- Meal interaction, completion and replacement → a later project.
- The interactive shopping list → a later project.
- Progress tracking and check-ins → a later project.
- The AI assistant → a later project.
- Any clinical feature: dosing, interaction checking, condition-specific medical advice.
  Permanently out, by [`0004`](../../decisions/0004-deterministic-safety-layer.md).
- Locales beyond `es-ES` and `en-GB`, though nothing may assume exactly two.
