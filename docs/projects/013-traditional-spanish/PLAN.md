# Plan — Project 013: Traditional Spanish

> **Purpose**: the technical execution plan — the engineering half of the contract.
> `/execute-project` follows this literally; executors implement, they do not redesign.
> If implementation must diverge, the plan is amended in the same change and the
> deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes. **Written by**: a
> planner agent via `/plan-project`; approved by the owner before execution starts.
> Write repo-relative: no absolute paths, no references to other private repos.

- **Status**: approved
- **Type**: standard
- **PRD**: ./PRD.md
- **Routing profile**: tiered, with this phase at `quality-max`. It changes AI output validation (`PoolBuilder`), which AGENTS.md § Model routing puts at that floor whatever the profile.

## Design summary

**One phase, run as a `/team`** at the owner's request for speed. It touches core, API, web and a migration, and the owner's standing rule sends that to the team. The decision is [`0077`](../../decisions/0077-traditional-spanish-is-a-way-of-eating-enforced-in-code.md), which holds the lists.

1. **The value.**
   - `traditional_spanish` is added to `dietaryPattern` (DB) and `DIETARY_PATTERNS` (core).
   - The migration is a single `ALTER TYPE "public"."dietary_pattern" ADD VALUE 'traditional_spanish';`, in the shape of `0037`. Regenerate the drizzle snapshot and journal.
   - `Onboarding.ts`'s `dietaryPatterns` `.max(9)` becomes `.max(10)`.
2. **Ingredients** (`core/domain/Preference`).
   - A new `PATTERN_EXCLUDED_SLUGS: { traditional_spanish: [...] }` holds the exact slugs listed in `0077`. They are exact slugs, not runs: `ostra` as a run would take `seta-ostra`.
   - `resolvePreferences` adds them to `excludedIngredientIds` exactly where `PATTERN_SLUG_RUNS` are added.
   - A slug in the list that is missing from the catalogue is ignored, and a unit test pins that the list matches the seed.
3. **Cuisine and name** (`core/domain/Preference`).
   - A new `breaksPatternDish(dish, patterns)` applies two rules: the dish's `cuisine` is normalised with `normaliseForMatching` and checked against `FOREIGN_CUISINES`, and its name is checked against `FOREIGN_DISH_NAME`. Both lists are in `0077`.
   - It is called beside `breaksDishRule`:
     - in `RecipeController.usesExcluded` (reuse and swaps);
     - in `PoolBuilder`'s validation, where it rejects as `unwanted`.
   - A null cuisine passes.
4. **Prompt — amended 2026-10-01 (owner): no change.** The prompt stays byte-identical for every person: no `NAMEABLE_PATTERNS` entry, no pattern-dependent example, and no new `PROMPT_VERSION`. A spec proves the prompt is the same with and without the pattern. The reason is that naming the pattern would make the accepted consent untrue. *Superseded:* **Prompt** (`apps/api/src/modules/ai/prompts/PoolPrompt.ts`).
   - Add `traditional_spanish` to `NAMEABLE_PATTERNS`, with its own `WAY OF EATING` line from the PRD, criterion 4.
   - When the pattern is present, `BREAKFAST_CHARACTER` and `characterOf` drop "skyr bowl"-type examples for Spanish ones (tostada con tomate y aceite, pan con queso fresco, yogur con fruta).
   - The `cuisine` field is asked as "española".
   - Bump `PROMPT_VERSION` to 4.6.0, with a changelog entry.
5. **Lean** (`core/domain/Variety/Rotation` and its callers).
   - With the pattern, `preferIngredientSlugs` also gets the catalogue rows of legumes, fish and seafood, rice, and huerta vegetables.
   - These are selected by category or class plus a slug list in `0077`. Do it in the one place that builds `preferredIngredientSlugs` (`buildContext`), so plan generation and swaps agree.
6. **Web** (`apps/web`).
   - Add the value to `OnboardingFlow`'s `DIETARY_PATTERN_VALUES`.
   - Add the labels in `es-ES.ts` ("Tradicional española") and `en-GB.ts` ("Traditional Spanish").
   - Extend `dietaryPatternsHint` with one sentence: "Solo platos de cocina casera española: fuera tofu, seitán, quinoa, salsas asiáticas o tacos."
   - `perfil/page.tsx:224` shows translated labels for every pattern. Today it shows raw enum values.
7. **Legal — amended: no text changes**, since the model is not told. *Superseded:* **Legal.**
   - The `legal` agent drafts the sentence for `/privacidad` (es-ES:2320, en-GB:2306) naming this choice among what the model receives.
   - The frontend agent applies it, and the change ships in the same release.
8. **Evaluator.**
   - Add `patron-tradicional-espanola` to `apps/api/scripts/evaluate-plans.mjs`: male, 62, 172 cm, 78 kg, moderate, maintenance; ordinary shape; `dietaryPattern: 'traditional_spanish'`. It goes through the same branch that replicates `resolvePreferences`.
   - Report per profile: forbidden ingredients, foreign cuisines and foreign names on plates; lunches and dinners with legumes and with fish.

9. **Start date** (added 2026-10-01, owner; the simple version, PRD criterion 8). *Ships in a second pull request* (owner, 2026-10-01): traditional Spanish (items 1–8) goes out first on its own, and this item follows on the same branch history once its backend is done and reviewed. Range and format refusals answer **422 `INVALID_INPUT`**, the repository's convention for body validation, not 400.
   - **DB.** A nullable `start_date date` column on `plan_generation_jobs`, in this branch's migration or a second one (`migration-reviewer` re-reviews).
   - **API.**
     - `POST /meal-plans/generate` takes the optional body `{ startDate }`.
     - Validation: a DTO date, and from `isoToday()` to `isoToday()` + 7, else 400.
     - `PlanJobController.start` refuses a `startDate` other than today with `ConflictError('GENERATION_START_NOT_ALLOWED')` unless `planRedoStanding(...).kind === 'new_fortnight'`.
     - The date is stored on the job, and `PlanGeneration.run` uses `start = job.startDate ?? today` (PlanGeneration.service.ts:146).
     - The outgoing plan is closed with `completedAt = today`, never a future date (PlanRepository.ts:160-167).
     - The care path is unchanged.
   - **Web.**
     - On `/plan/generando` (GenerationProgress.tsx:86), before the POST, when `/meal-plans/allowances` says `planRedo.kind === 'new_fortnight'`, offer "¿Cuándo empiezas?" as chips: Hoy, Mañana, then the next 6 days by weekday and date. The default is Hoy.
     - Inicio (inicio/page.tsx:87-88, :197-213): when the active plan's `startDate` is after today, show "Tu plan empieza el {fecha}" with links to the shopping list and the plan, not the "plan ended" state.
     - PlanBrowser (PlanBrowser.tsx:52) opens on day 1 when today is before the start.
     - The new error code goes into both dictionaries.
   - **Tests.**
     - Unit: the range, the 409, `start` from the job, and `completedAt` never in the future.
     - e2e: the 400, the 409, and a plan whose day 1 is today + 3.

## Phases

### Phase 1 — Traditional Spanish, end to end

- [ ] in progress
- **Dispatch**: opus @ high — `/execute-project 013 phase 1`, run as `/team`:
  - `backend-high`: steps 1–5 and 8;
  - `frontend`: steps 6–7;
  - `legal`: the step 7 text;
  - `migration-reviewer` and `invariant-reviewer`: the diff;
  - `plan-evaluator`: step 8.
  - The `/privacidad` gate is dropped by the amendment to item 7.
- **Goal**: PRD criteria 1–7.
- **Scope**:
  - `packages/database/src/schemas/_enums.ts` and a new migration with its meta;
  - `packages/core/src/entities/Profile/Profile.ts`, `packages/core/src/entities/Onboarding/Onboarding.ts`;
  - `packages/core/src/domain/Preference/`;
  - `packages/core/src/controllers/Recipe/RecipeController.ts`;
  - `apps/api/src/modules/ai/prompts/PoolPrompt.ts` and its spec;
  - `apps/api/src/modules/ai/services/PoolBuilder.service.ts` and its spec;
  - `apps/api/scripts/evaluate-plans.mjs`;
  - `apps/web/src/components/OnboardingFlow/`, `apps/web/src/app/(app)/perfil/page.tsx`, both dictionaries;
  - `apps/api/test/` (one e2e: onboarding with the pattern, then a generated plan with no forbidden row);
  - docs: `0077`, `decisions/LOG.md`, `ARCHITECTURE.md`, this project's LOG.
- **Steps**:
  1. **Baseline.** Run `evaluate-plans.mjs --json docs/local/013-before.json` from the main checkout. Do it after `012` is merged, because worktrees have no `.env`.
  2. **Migration and value** (design summary, item 1). The `migration-reviewer` reviews it. Adding an enum value is not destructive, but it does not run in a transaction with its own use: nothing in the migration may use the new value.
  3. **Preference: ingredients, cuisine and name** (items 2–3). Unit tests:
     - every slug of the list is excluded;
     - `seta-ostra` survives;
     - a "mexicana" dish and a "Wok de…" dish are refused;
     - a null-cuisine paella passes;
     - "Huevos al plato con tacos de jamón" passes (the name rule must not take Spanish "tacos de jamón");
     - the list is a subset of the seed's slugs.
  4. **Reuse and pool builder** (item 3). Unit tests:
     - `reusablePool` with the pattern returns no excluded dish;
     - `PoolBuilder` rejects a generated "Tofu salteado" and a cuisine "asiática" dish as `unwanted`.
  5. **Prompt** (item 4). Update `PoolPrompt.spec.ts`'s allow-list test, and add a spec that the pattern line and the Spanish breakfast examples appear only with the pattern.
  6. **Lean** (item 5). Unit test: with the pattern, a lentil stew ranks before an equal dish without legumes.
  7. **Web** (items 6–7).
     - Run `/local-probe` on onboarding and `/perfil` at 320, 390 and 1280 px, light and dark.
     - Run the `apple-web-design` review; fix P0 and P1.
  8. **e2e** (`tests`): onboarding with `traditional_spanish`, a generated plan with no excluded row, foreign cuisine or foreign name.
  9. **After run.** Run the evaluator with `--compare`, then have `plan-evaluator` read it.
     - The new profile meets PRD criterion 6, and no existing profile loses a day.
     - If the legume or fish counts fall short, **stop and report**. Do not add a scheduler minimum without the owner.
  10. **Docs.** Update `ARCHITECTURE.md` (the patterns paragraph) and add the phase LOG entry.
- **Acceptance criteria**:
  - PRD 1 → steps 2 and 7;
  - PRD 2–3 → steps 3, 4 and 8;
  - PRD 4 → step 5;
  - PRD 5 → step 6;
  - PRD 6 → steps 1 and 9;
  - PRD 7 → steps 7 and 10.
- **Verification**:
  - `sh .claude/skills/ship/scripts/gate.sh --full <dir>` green;
  - the e2e suite for step 8;
  - the two evaluator runs;
  - `/local-probe` screenshots looked at.

## Hand-off

- **Never touch production.** Production data is read only, and only by the owner's command. The migration reaches production through the API build after merge, and the report says so.
- **Every list lives once.** The ingredient, cuisine and name lists are in `0077` and in one core module. The web and the prompt never copy them.
- **The owner's choice is final.** Avena, aguacate, cuscús, basmati, queso batido, kéfir, yogur proteico and seeds are kept. Do not re-open it.
- **No `fable` for agents.**

## Out of scope

- Re-labelling stored dishes' `cuisine`.
- A hard weekly legume minimum in the scheduler.
- Regional variants.
- A cuisine filter for people without the pattern.
