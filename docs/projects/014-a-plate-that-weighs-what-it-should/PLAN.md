# Plan — Project 014: A plate that weighs what it should

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
- **Routing profile**: tiered

## Design summary

**One phase, run as a `/team`** (core, API and web). It starts once project 013 is merged into `main`, because both touch `apps/api/scripts/evaluate-plans.mjs`. The decision is [`0078`](../../decisions/0078-a-plate-has-a-gram-ceiling-and-cooked-grains-read-dry.md).

1. **Gram ceiling** (`packages/core/src/domain/Scheduler/Scheduler.ts`).
   - `perServingIndex` also returns the grams per serving: the sum of `dish.ingredients[].grams` divided by `dish.servings`. Compute it once per dish.
   - A new exported `PLATE_GRAMS_MAX: Record<MealSlot, number>` holds the values in `0078`.
   - `withinPlateLimit` also requires `grams × servings ≤ PLATE_GRAMS_MAX[slot]`, so `plateServings`, `fitsPlate`, `servingsFor`, `balancedDay` and every caller listed in 012 inherit it.
   - This changes the signatures that need the slot. The floor fallback in `balancedDay` and the scale-up loop in `pickReplacement` stay the only way past the ceiling, exactly as for `PLATE_LIMIT`.
2. **Yields** (`packages/core/src/domain/Composition/` or a new `domain/Yield`).
   - Add `COOKED_YIELDS: Record<cookedSlug, { drySlug: string | null; yield: number }>`, from the table in `0078`.
   - Add `toDry(slug, grams)`, which returns `{ drySlug, dryGrams }` or null.
   - A unit test checks that every cooked slug and every non-null dry slug exists in the seed.
3. **Display** (`packages/core/src/controllers/Plan/PlanController.ts`, `MealDetail` at ~842 and its builder at ~947).
   - Each ingredient gains an optional `dryGrams`, set only for yield rows and rounded to 5 g.
   - The web meal page (`apps/web/src/app/(app)/plan/comida/[id]/page.tsx:166-193`) renders "{name}: {dry} g en seco ({cooked} g cocido)" when `dryGrams` is present. The copy goes in both dictionaries, and the "cocido/cocida" word is dropped from the name in that line.
4. **Shopping** (`packages/core/src/domain/ShoppingList/ShoppingList.ts`).
   - Before summing, map each yield row to its dry slug and dry grams.
   - Merge it with the same dry slug when the catalogue has it. When it does not, keep the cooked row's `ingredientId` with name "{nombre sin cocido} (en seco)".
   - Round totals up to 5 g.
   - The three callers (generation, swap, rebuild) need no change.
5. **Evaluator** (`apps/api/scripts/evaluate-plans.mjs`). Per profile, report the grams of every plate: max, mean per slot, and the count over `PLATE_GRAMS_MAX`. The values are imported from the core build.

## Phases

### Phase 1 — The gram ceiling and dry weights, end to end

- [x] done
- **Dispatch**: opus @ medium — `/execute-project 014 phase 1`, run as `/team`:
  - `backend` (opus · medium): items 1–2, 4, the core half of 3, and 5;
  - `frontend` (sonnet · medium): the web half of 3;
  - `plan-evaluator`: the before and after runs;
  - `accessibility` (sonnet · low): the probe of the meal page and `/compra`.
  - No migration, no route and no AI change, so neither `migration-reviewer` nor `invariant-reviewer` is needed.
  - **owner-gated:** the production simulation in step 6. It is read-only, and the owner runs it with `!`.
- **Goal**: PRD criteria 1–6.
- **Scope**:
  - `packages/core/src/domain/Scheduler/`, `.../Composition/` (or `.../Yield/`), `.../ShoppingList/`, `packages/core/src/controllers/Plan/PlanController.ts`, and their tests;
  - `apps/api/scripts/evaluate-plans.mjs`;
  - `apps/web/src/app/(app)/plan/comida/[id]/`, `apps/web/src/app/(app)/compra/` (if it needs to show anything new), and both dictionaries;
  - docs: `0078`, `decisions/LOG.md`, `ARCHITECTURE.md` (next to the plate-limit paragraph of `0076`), this LOG.
- **Steps**:
  1. **Baseline.** Run the evaluator on `main` after 013 is merged and write `docs/local/014-before.json`.
  2. **Items 1–2.** Unit tests:
     - a 1,000 g dish never served above 750 g at lunch;
     - a 300 g snack dish never served above 250 g;
     - the floor fallback still passes the ceiling when it must;
     - `pickReplacement` respects it;
     - the yield table matches the seed.
  3. **Items 3–4.** Unit tests:
     - 600 g `cuscus-cocido` reads as 240 g dry (yield 2.5) and is listed under `cuscus-crudo`;
     - cooked and dry couscous in one plan merge into one line;
     - `arroz-blanco-cocido` maps to `arroz-largo-crudo`;
     - `pasta-cocida`, which has no dry slug, reads "Pasta (en seco)";
     - lentils are unchanged.
  4. **Web.** Use `/local-probe` on a meal with couscous and on `/compra` at 320, 390 and 1280 px, light and dark. Run the `apple-web-design` review and fix P0 and P1.
  5. **After.** Run the evaluator with `--compare`.
     - If any profile loses more than one day in band, stop and report to the owner with the numbers. Do not tune the ceiling without the owner.
     - Report the new profile `imc-alto-2-comidas` in full.
  6. **Production simulation (owner-gated).** Re-run `simulate-pro.mjs` (the read-only script from 2026-10-01; the lead has it outside the repository) on the 014 code for the 012 profile. Report the grams per meal and the macro deviation.
  7. **Docs.** Write the phase LOG entry and update `ARCHITECTURE.md`.
- **Acceptance criteria**:
  - PRD 1 → step 2;
  - PRD 2 → steps 1 and 5;
  - PRD 3 → step 6;
  - PRD 4–5 → steps 3 and 4;
  - PRD 6 → step 7.
- **Verification**:
  - `sh .claude/skills/ship/scripts/gate.sh --full <dir>` green;
  - the two evaluator runs;
  - the simulation output;
  - the probe screenshots looked at.

## Hand-off

- **Stored data stays as it is.** Recipe grams are not changed and no data migration runs. Old shopping lists change only when they are regenerated.
- **Never touch production by hand.** The simulation is the owner's command and is read-only.
- **No `fable` for agents.**

## Out of scope

- Cooked legumes.
- Rewriting stored shopping lists.
- The prompt.
- Splitting a meal into primero and segundo.
