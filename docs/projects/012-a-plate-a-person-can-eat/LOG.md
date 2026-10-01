# LOG — Project 012: A plate a person can eat

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

## Phase 1 — Protein on a reference weight, a hard plate limit, and a profile that measures both (2026-10-01)

- **Executor**: opus (the lead, directly in this worktree). The `backend` agent was spawned first but could not write to this worktree from its own isolated one, so it wrote nothing. Its review found the protein-floor defect recorded below.
- **Result**: done. The owner ran step 7, the evaluator on the new code, from this worktree with the dev environment linked in for the run only; the links were removed afterwards.
- **Evidence**:
  - `pnpm --filter core exec vitest run`: 108 files, 3,296 tests passed. That includes 6 new nutrition tests and 6 new scheduler tests.
  - `bash .claude/skills/ship/scripts/gate.sh`: green (migrations, lint + ts:check + tests, format, deadcode, leaks).
  - `node --check apps/api/scripts/evaluate-plans.mjs`: ok.
  - The plate-limit test was run once with the limit disabled, and it failed (a snack at 0.49 of its share). So it does guard the limit.
  - Evaluator baseline (step 1, on `main`'s scheduler and nutrition code, dev library): 14/14 days inside 5% on all four macros for every profile, except `objetivo-bajo-3-comidas` and `patron-kosher` at 13/14. No allergen on any plate.
  - Evaluator after (step 7), compared with `--compare` against the baseline:
    - No existing profile lost a day. Ten are "the same", and `objetivo-bajo-3-comidas` is "better" (13/14, worst day 5.5% → 5.3%).
    - Variety is unchanged everywhere, and no allergen is on any plate.
    - Plate shares across all 12 profiles run from 0.69 to 1.47, with **0 plates outside 0.5–1.5**.
    - The new profile `imc-alto-2-comidas` scores **14/14 days inside 5%** on all four macros, with plate shares from 0.69 to 1.31.
    - It had no baseline, because the old script had no such profile.
    - Measured on the dev library, which is not production's.
- **Deviations from plan** (both amended in PLAN.md § Design summary):
  1. **Protein floor.** Reference-weight protein is floored at 0.8 g/kg of actual weight. Without the floor, profiles from about BMI 44 (healthy_eating), 50 (maintenance) or 56 (weight_loss) got no targets at all, because `protein_below_floor` was thrown. This does not change the stand-in's figures.
  2. **Fallback at first placement.** When no dish fits a slot inside `PLATE_LIMIT`, the first placement uses the eligible dishes as before, instead of failing with `insufficient_pool`. The existing test with a 600 kcal target needed this.
  - `balancedDay` keeps the current sizes on a tie when they are inside the limit, so days already inside size exactly as before.
- **Moved test expectations**: none. Every existing test passes unchanged. The e2e suites' protein figures were grepped: the only literals are targets set by hand (`care-practice`, `target-overrides`), which are checked against bounds that stay on actual weight. None is weight-derived. The e2e suites themselves were not run in this phase.
- **Decisions**: [`0076`](../../decisions/0076-protein-on-a-reference-weight-and-a-hard-plate-limit.md).
- **Notes for the next phase**: none; this is the project's only phase. Still open, and the owner's:
  1. after the merge deploys, the person regenerates their meal plan, as described in the Dispatch line;
  2. a read-only check of the new meal plan in production.
