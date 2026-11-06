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

## Closing entry — what production says, read on 2026-11-06

The two things this project left open were the owner's: *generate a plan once the merge deploys*,
and *a read-only check of the new plan in production*. Both are answered, by one read-only
transaction against production (`default_transaction_read_only`, host asserted, counts and
percentages only, nobody named) — plus **one meal shape, the owner's own**, because the plan
he asked to have checked cannot be judged against anybody else's, and a shape is a statement
about how somebody eats. The other seven accounts' shapes were not read; see *what the read
could not answer* below.

**1. He regenerated.** Five fortnights exist on his account, the newest of 2026-10-20 — four of
them after #186 merged on 2026-10-01. Twenty-two plans in all were generated across production
since that date.

**Criterion 2 — the hard plate limit — holds, and the one plan that breaks it is the merge day's
own.** Judged against **his own meal shape** rather than the default one (a light morning snack at
6% of the day, lunch at 49%, dinner at 45% — the shares `weightsFor` gives that shape), the plans
of 2026-09-30, 10-02, 10-04 and 10-20 have **0 plates outside 0.5–1.5× their share**, with the
morning snack landing between 75 and 183 kcal against a share of about 125. The plan of
**2026-10-01** has **11 of its 14 days** with one, the worst a morning snack at **4.42×** its
share — and 2026-10-01 is the day #186 merged, so that plan was built by the code that preceded
it. Nothing since has reproduced it.

**Criterion 3 — the macro promise — is where production and the evaluator disagree, and the
disagreement is worth a roadmap line.** Over **298 days** of every plan generated anywhere in
production since #186, **275 are inside ±5% on all four macros** (92.3%), and the mean worst macro
across days is 4.4%. Per macro: energy **298/298**, carbohydrate **298/298**, fat **287/298**,
protein **284/298**. On the owner's own newest plan, read day by day, it is **10 of 14** — and
**every one of the four misses is fat**, at +14.8%, +14.8%, +15.2% and +23.7%, while energy stays
within 2.7%, protein within 4.9% and carbohydrate within 4.9% on all fourteen.

**Measured by hand, which bounds the claim.** The percentages above are an inclusive ±5%
over the stored `meals` rows against each day's stored targets, not `validatePlan` and
`planQuality` — the product's own verdict, which is what a fix would have to move. Taking a
hand-rolled band for that verdict is a known trap here (days sitting exactly on 5.00% are
inside it), so these figures say *there is something to look at*, not *this is the number*.

**So: fat is the macro that misses, on a real profile, and only fat.** This project promised the
macro promise would not get *worse* (criterion 3, measured against `main` on the evaluator's
profiles) and it did not — what this read shows is a standing gap that predates it and that no
profile in the evaluator's set exhibits. It is written into `docs/ROADMAP.md` § *Next* rather than
fixed here: a fix means touching how the scheduler trades fat against the other three, which is
`0076`/`0081` territory and not a closing entry's business.

**What the read could not answer, deliberately.** Criterion 2 over all 298 days would need all
eight accounts' meal shapes, and a shape is a statement about how somebody eats: the read took one
— the owner's own, for the plan he asked to have checked — and left the other seven alone. The
aggregate above is therefore macros only, which name nobody (`0028`).

**One correction, because it nearly became a false alarm.** The first version of this read summed
each day as `meals` **plus** `meal_accompaniments` and reported 10 days in band of 298, 113 days
past the plate limit and a worst macro of 50%. All of it was arithmetic: `meals.kcal` **already
includes** whatever was served beside the dish (`withAccompaniments` in `Scheduler.ts` does
`addMacros(plate.macros, set.macros)` precisely so that the day's totals, `validatePlan`, the
allergy gate and the shopping list all see what the person eats). The schema comment now says so.
