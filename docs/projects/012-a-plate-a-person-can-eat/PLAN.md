# Plan — Project 012: A plate a person can eat

> **Purpose**: the technical execution plan — the engineering half of the contract.
> `/execute-project` follows this literally; executors implement, they do not redesign.
> If implementation must diverge, the plan is amended in the same change and the
> deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes. **Written by**: a
> planner agent via `/plan-project`; approved by the owner before execution starts.
> Write repo-relative: no absolute paths, no references to other private repos.

- **Status**: done
- **Type**: standard
- **PRD**: ./PRD.md
- **Routing profile**: tiered

## Design summary

**One phase, on purpose.** The owner asked for a quick fix, so a real person's meal plan can be
regenerated. Each of the three changes is small and lives in one file. They are only worth
measuring together, because the evaluator judges the meal plan they produce together.
Decision: [`0076`](../../decisions/0076-protein-on-a-reference-weight-and-a-hard-plate-limit.md).

1. **Reference weight** (`packages/core/src/domain/Nutrition/Nutrition.ts`)
   - `macrosForKcal` takes the protein weight instead of the body weight. A new exported
     `proteinReferenceWeightKg(weightKg, heightCm, goal)` returns `min(weightKg, REFERENCE_BMI × (heightCm / 100)²)`
     for the goals in `REFERENCE_WEIGHT_GOALS` (`weight_loss`, `healthy_eating`, `maintenance`), and
     `weightKg` unchanged for `muscle_gain` and `performance` (option (c), owner 2026-10-01).
   - `REFERENCE_BMI = 25` and `REFERENCE_WEIGHT_GOALS` live in `core/entities/Nutrition`, beside the
     other protein constants.
   - Both callers (`nutritionTargets` and `resolveTargets`) pass it.
   - `targetBounds` (protein floor and ceiling) and `PlanValidation`'s 3 g/kg ceiling stay on
     actual weight: they bound plausibility, not need.
   - *Amended in execution:* the reference-weight protein is never below
     `PROTEIN_FLOOR_G_PER_KG` × actual weight. From about BMI 44 the reference weight alone fell
     under that floor, and `nutritionTargets` threw `protein_below_floor`. The energy share cap
     stays outermost. `macrosForKcal` takes an optional `heightCm` and keeps actual weight for the floor.
2. **Hard plate limit** (`packages/core/src/domain/Scheduler/Scheduler.ts`)
   - New exported `PLATE_LIMIT = { max: 1.5, min: 0.5 }`, a fraction of the slot budget's kcal.
     It sits outside the soft `SHARE_BAND` (0.7–1.4), which stays as the preference inside it.
   - One helper, `plateServings(perServing, budget)`, returns the quarter-serving sizes that are
     inside both `SERVING_BOUNDS` and `PLATE_LIMIT`. It can return none.
   - *Amended in execution:* when the pool holds no dish that fits a slot, the first placement
     (`pickBest`) falls back to the eligible dishes, as before. This avoids failing the meal plan
     with `insufficient_pool` for a target no dish fits. The later passes never swap a fitting
     plate out for an unfitting one.
   - Every place that sizes or offers a plate goes through it:
     - `servingsFor` clamps to it;
     - `balancedDay`'s `options` are filtered by it;
     - `pickBest`, `improveDay`'s candidates, `spreadAcrossDays`' replacements,
       `enforceDistinctDays` and `pickReplacement` skip a dish for which it returns none.
   - A day that cannot meet its macros inside the limit lands out of band and gets the usual
     advisory. Its plates do not leave the limit; the only exception is reaching the daily energy floor (see step 4).
3. **Evaluator** (`apps/api/scripts/evaluate-plans.mjs`)
   - A new profile `imc-alto-2-comidas`.
   - Per profile, the smallest and largest plate share (plate kcal ÷ that slot's budget on that
     day, from the same `weightsFor` the scheduler uses) and the count outside `PLATE_LIMIT`.
     It is printed and written to `--json`.

## Phases

### Phase 1 — Protein on a reference weight, a hard plate limit, and a profile that measures both

- [x] done
- **Dispatch**: opus @ medium — `/execute-project 012 phase 1` — owner-gated: after the merge deploys, the person regenerates their meal plan; a free account has one redo a fortnight (`0015`), so if it is spent the owner raises the account to premium from the admin console (`PATCH accounts/:id/tier`) first; then the owner runs a read-only check of the new meal plan
- **Goal**: PRD criteria 1–6 in one reviewable change.
- **Scope**:
  - `packages/core/src/entities/Nutrition/`
  - `packages/core/src/domain/Nutrition/` and its tests
  - `packages/core/src/domain/Scheduler/` and its tests
  - `apps/api/scripts/evaluate-plans.mjs`
  - `docs/ARCHITECTURE.md`
  - `docs/decisions/0076-*.md` (already written; amend only if implementation diverges)
  - `docs/decisions/LOG.md`
  - this project's `LOG.md`
- **Steps**:
  1. **Baseline first.** Before changing anything, on this branch's base, from `apps/api`
     after `pnpm --filter core --filter database --filter api build`, run
     `node --env-file-if-exists=.env scripts/evaluate-plans.mjs --json ../../docs/local/012-before.json`.
     Run it from the **main checkout**, because worktrees have no `.env`. That file stays in
     `docs/local/`. Only its numbers go into LOG.md.
  2. **`REFERENCE_BMI`.** Add `REFERENCE_BMI = 25` and `REFERENCE_WEIGHT_GOALS` to
     `core/entities/Nutrition`, with a doc comment saying why: protein need follows lean mass, not fat
     mass, and BMI 25 is the usual reference. Training goals are left out because their excess weight
     is likely muscle.
     Add `proteinReferenceWeightKg` to `core/domain/Nutrition`. Change `macrosForKcal(kcal, weightKg, goal)`
     to `macrosForKcal(kcal, proteinWeightKg, goal)` and update both callers to pass
     `proteinReferenceWeightKg(input.weightKg, input.heightCm, input.goal)`. Update the doc comments that say
     "per kg of body weight".
  3. **Nutrition tests.**
     - the stand-in, 176 cm / 102 kg / 60 y / male / moderate / weight_loss 1.0 → `{ kcal: 2122, proteinG: 139, fatG: 66, carbsG: 243 }` (today `proteinG: 184`),
       with carbohydrate and fat re-derived and summing within `MACRO_SUM_TOLERANCE`.
     - A BMI 22 profile → identical to today's figures.
     - A BMI 27 profile with `maintenance` → protein on the BMI 25 weight.
     - 98 kg / 190 cm with `muscle_gain` → protein on actual weight, unchanged from today.
     - `resolveTargets` with a kcal-only override → protein on the reference weight too.
     Fix any existing expectation this moves, and name each one in LOG.md.
  4. **`PLATE_LIMIT` and `plateServings`.** Add both in `Scheduler.ts` with a doc comment citing
     `0076`, and saying how `PLATE_LIMIT` relates to `SHARE_BAND` and to `0070`: 0070 caps a
     serving, this caps the plate. Route every path listed in the design summary through it.
     A dish with no admissible size is not eligible for that slot, in the same way as a dish that
     does not fit the slot's meal. If no dish is eligible, the existing `insufficient_pool`
     shortfall applies unchanged. **The energy floor outranks the limit.** `pickReplacement`'s
     existing loop, which scales a swapped plate up until the day reaches `plateMinimumKcal`, may
     go past `PLATE_LIMIT.max`, but only as far as the floor needs. In `balancedDay`, if no combination
     inside the limit reaches the floor, the search runs once more over the full `SERVING_BOUNDS` for
     that day, and the floor term (`FLOOR_OUTRANKS_ORDER`) decides as today. Test both.
  5. **Scheduler tests.**
     - A pool where only a 2× lunch reaches a high protein target, on the snack-light, lunch,
       dinner shape. Every plate stays within `PLATE_LIMIT`, and the day is reported out of band
       rather than being met by an oversized plate.
     - A dish whose 0.5 serving already exceeds 1.5× a light snack's budget is never placed there.
     - `pickReplacement` never returns a size outside the limit.
     - Existing scheduler tests stay green, or each change is justified in LOG.md.
  6. **Evaluator.** Add the profile `imc-alto-2-comidas`:
     `{ activityLevel: 'moderate', ageYears: 60, goal: 'weight_loss', heightCm: 176, paceKgPerWeek: 1, sex: 'male', weightKg: 102 }`,
     with shape `{ ...DEFAULT_MEAL_SHAPE, breakfast: 'off', morning_snack: 'light', lunch: 'normal', dinner: 'normal', afternoon_snack: 'off', supper: 'off' }`.
     Add the per-plate share report: min, max, count outside `PLATE_LIMIT`, imported from the core
     build so it cannot drift. Keep `--compare` working with the new fields.
  7. **After run.** Run the evaluator again with `--json ../../docs/local/012-after.json --compare ../../docs/local/012-before.json`.
     Spawn the `plan-evaluator` agent to read both. If any existing profile loses more than one
     day in band, **stop and report to the owner** with the numbers. Do not tune constants to
     chase it without his yes.
  8. **Docs.**
     - In `docs/ARCHITECTURE.md`, next to the nutrition tolerances paragraph, add: protein is
       computed on the reference weight, and each plate stays within 0.5–1.5× its share, as a
       bound rather than a preference.
     - `decisions/LOG.md` already has its `0076` line; amend it only if the implementation diverges.
     - Write the phase entry in LOG.md: before/after per profile, the new profile's numbers, any
       test expectations moved.
- **Acceptance criteria**:
  - PRD 1 → steps 2–3.
  - PRD 2 → steps 4–5.
  - PRD 3 → step 7.
  - PRD 4 and 5 → steps 6–7.
  - PRD 6 → step 8.
- **Verification**:
  - `pnpm --filter core test`
  - `pnpm --filter core build && pnpm --filter api build`
  - `pnpm lint`
  - `pnpm check:leaks`
  - the two evaluator runs of steps 1 and 7, from the main checkout's `apps/api`
  - `bash .claude/skills/ship/scripts/gate.sh` green before hand-back

## Hand-off

- **Unchanged behaviour.** No prompt version changes, nothing is migrated, and no stored dish or
  meal changes. Existing meal plans keep their numbers until they are regenerated.
- **Never touch production.** The executor never reads or writes production. The read-only check
  after the person regenerates is the owner's: same shape as the 2026-10-01 analysis, inside
  `BEGIN … READ ONLY`.
- **No `fable` for agents.** The `plan-evaluator` runs on its own definition.
- **No real data in the repository.** It is public: no email, name or identifiable figures from the
  real person in any committed file. The evaluator profile is a synthetic stand-in with the same shape.

## Out of scope

- An absolute gram ceiling per plate, if the limit by share proves not enough: a follow-up task,
  with evaluator evidence.
- Showing the person the basis of their protein figure.
- Re-tuning `SHARE_BAND`, `SERVING_BOUNDS` or the macro bands.
