# LOG — Project 019: Balanced plans by goal

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

## Phase 1 — Measure the way production does (2026-10-03)

- **Executor**: Opus 5.5, medium (agent `backend-019p1`).
- **Result**: done.
- **What changed**:
  - `core/domain/Balance` (new, no production caller): report `0010` § 1.2's recognition as pure functions (`legumeDryGrams`, `isOilyFish`, `isProcessedMeat`, `meatColour`, `isWholeGrain`, `isVegetable`, `isFruit`, `mealGroups`) and `balanceOf`, which scores a fortnight against the PRD table; `balanceSupply` decides which rules apply from the person's filtered library; `proteinPerKgBySlot`.
  - `planBandMiss` moved unchanged from `PlanGeneration.service.ts` to `core/domain/PlanValidation`; the service imports it, and the evaluator decides `wider_rotation` with the same function.
  - `evaluate-plans.mjs --rotate [seeds]` (default 10): each seed is `reusablePool(slots, context, rotation)` with a `Rotation` built as `PlanGeneration` builds it (seed `profile:n`, `leaningSlugs`), then the same rescues in the same order (whole library when the pool cannot fill or the plan is blocked; the uncapped rotation when a band is missed and it misses by less). Without the model's fresh third, as `PoolBuilder` serves with no provider. Every plan, plain or rotated, also carries `balance` and `proteinPerKg`.
- **Evidence**:
  - Local Postgres, `pnpm db:local reset --reference` (871 recipes: 500 seed, 371 ai), `NUTRIA_LOCAL_PG=1`. No Neon, no model.
  - Plain evaluator output unchanged: the previous script and this one, on the same library, off and on, produce identical JSON once `balance`, `proteinPerKg` and the timings are removed, and identical text bar the two new lines.
  - `core/domain/Balance` 14 specs, `planBandMiss` 1 spec. Gate `--full` green.
  - Baseline files (gitignored): `docs/local/019-base-off.json`, `docs/local/019-base-on.json`.
- **Baseline, `--rotate 10`, 14 profiles × 10 seeds** — plans meeting each rule, where it applies:

  | Rule | Off | On | Both | Report 0010 |
  |---|---|---|---|---|
  | Legumes ≥ 8 | 112/140 | 83/140 | 195/280 (70%) | 74% |
  | Fish ≥ 6 | 82/120 | 93/120 | 175/240 (73%) | 83% |
  | Oily fish ≥ 2 | 108/120 | 95/120 | 203/240 (85%) | 84% |
  | Fish + shellfish ≤ 8 | 72/140 | 68/140 | 140/280 (50%) | 54% |
  | Meat ≤ 6 (12 with no fish) | 39/130 | 41/130 | 80/260 (31%) | 25% |
  | Red ≤ 4, never on days running | 56/130 | 60/130 | 116/260 (45%) | 42% |
  | Processed ≤ 2, never on days running | 25/130 | 41/130 | 66/260 (25%) | 28% |
  | Eggs ≤ 8 (not vegetarians) | 43/130 | 67/130 | 110/260 (42%) | measured only |
  | Pasta, rice, grains ≤ 4, sides included | 106/140 | 65/140 | 171/280 (61%) | — |
  | — the dish's own base only | 106/140 | 94/140 | 200/280 (71%) | 78% |
  | Vegetables ≥ 150 g at every main (PRD, scored) | 0/140 | 1/140 | 1/280 (0%) | — |
  | Vegetables ≥ 150 g at 80% of mains (report, unscored) | 7/140 | 33/140 | 40/280 (14%) | 19% |
  | Fruit ≥ 2 a day | 0/140 | 25/140 | 25/280 (9%) | 0% |
  | Whole grain ≥ 50% of cereal | 7/140 | 8/140 | 15/280 (5%) | 7% |
  | Fibre ≥ 25 g a day | 130/140 | 130/140 | 260/280 (93%) | 93% |

  - **Days in band**: 1,958/1,960 off, 1,959/1,960 on (report: 1,959 and 1,960). A band was missed on the rotation in 110 of 140 plans off and 35 of 140 on; `wider_rotation` rescued every one of them, and `full_library` was never needed (report: 111 and 42). 0 allergens.
  - **Score by goal** (mean of the profiles' median scores, off / on): weight loss 43% / 43%, muscle gain 42% / 35%, maintenance 45% / 45%, healthy eating 53% / 55%, performance 35% / 42%.
  - **Per profile, on** (legumes · fish · processed, min / median / max; median score): objetivo-bajo-3-comidas 3/5/6 · 11/14.5/18 · 3/4.5/6, 38%; objetivo-alto-5-comidas 10/11/12 · 4/5/7 · 4/7/8, 35%; alergia-lacteos 3/8/13 · 3/7.5/11 · 3/6/9, 42%; patron-vegetariano 12/17/22 · — · —, 57%; quincena-con-evento 4/6.5/10 · 4/7.5/15 · 1/2.5/4, 42%; alergia-personalizada 3/7.5/13 · 4/8.5/11 · 0/2/4, 54%; alergia-personalizada-no-resuelta 4/8/13 · 6/8/12 · 2/5/7, 46%; patron-halal 5/9.5/14 · 3/6/9 · 0/1/4, 46%; patron-kosher 9/10.5/15 · 4/6/7 · 0/2/3, 62%; patron-sin-gluten 5/6/11 · 6/14/20 · 1/4.5/5, 54%; patron-sin-lactosa 6/10/13 · 3/11/13 · 2/4/6, 42%; imc-alto-2-comidas 5/9.5/13 · 4/8.5/13 · 0/3/4, 42%; patron-tradicional-espanola 3/5.5/7 · 5/10.5/14 · 0/4/11, 38%; tres-comidas-proteina-alta 3/10.5/16 · — · 1/3/5, 36%. The full figures, protein per kg by meal included, are in the JSON files.
- **Deviations from plan**:
  - **`harina-de-maiz` not added to `grains`.** In the reference library it is in two breakfast-only dishes (arepas 132 g and corn pancakes 50 g a serving) and in no lunch or dinner. Added, `fitSlots` would take both off breakfast (no `0079` family allows grains there) and recognise no polenta the existing rows do not. The lead read the v17 dish from an earlier read-only dump: "Pollo al Parmesano con Polenta Cremosa…" uses `polenta`, 80 g, which is already grains, Italian, where grains are allowed at dinner (`0079`). There is no gap. The lead agreed.
  - **Vegetables scored at every main** (the PRD rule), with the report's 80% kept beside it and unscored: owner's delegation of 2026-10-03, since phases 5 and 6 are judged against the PRD rule.
  - **Choices the lead approved, beyond § 1.2**: eggs scored (≤ 8, not for vegetarians or vegans), so the score has 13 rules to the report's 12. A rice or grain side counts towards the starch cap (PRD), and the dish's own base is reported beside it. Banana, pineapple, papaya, passion fruit and frozen fruit count as fruit, and not as vegetables. Stocks, a stock cube, lard, pastries and the meat sauces are not a meat portion. A rule applies when the person's filtered library holds a lunch or dinner dish of that group, or a dish at any meal for processed meat.
  - **Fish ≥ 6 reads lower than the report** (73% against 83%): here a meal counts with ≥ 60 g of class `fish` itself. Shellfish counts only towards the maximum, as § 1.2 and premise 7 say. The seeds also differ from the report's, so per-seed figures are not comparable one to one.
- **Decisions**: none new.
- **Notes for the next phase**:
  - Compare against `docs/local/019-base-{off,on}.json` with `--rotate 10` on the same reference library.
  - `rules[*].applies` comes from `balanceSupply` over the whole filtered library. Phase 4's effective minimum should read the same thing.
  - The rotation offer (`offer`: legume dishes and kinds, fish dishes, per seed) is in each plan of the JSON. It is phase 2's metric.
