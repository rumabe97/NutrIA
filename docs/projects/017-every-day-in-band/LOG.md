# LOG — Project 017: Every day in band, every starch counted

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

## Phase 1 — A production-like library, a per-family starch report, a baseline (2026-10-02)

- **Executor**: backend agent, opus @ medium. The production export was run once by the lead.
- **Result**: done.
- **What was built**:
  - `scripts/export-reference-library.mjs`:
    - reads production read-only (`DATABASE_URL_PRO` via `guard.mjs` `readEnv`, `sql.begin('read only')`, `transaction_read_only` checked before the first query, no host printed);
    - writes `source = 'ai'` recipes by slug, `created_by` NULL, their ingredients by catalogue slug, `ON CONFLICT DO NOTHING`;
    - the file aborts the whole load if a slug is missing from the catalogue.
    - `--from-local [--source seed]` tests the format on the local Postgres. A round trip of the 500 seed dishes was identical: slugs renamed, the export loaded, both sets fingerprinted (every column and every ingredient row), then rolled back.
  - `pnpm db:local reset --reference` loads `docs/local/reference-ai-recipes.sql` after the seed, then re-runs 0056. It exits before dropping anything if the file is missing. `status` prints recipes by source and by source × slot.
  - The evaluator's starch section gains:
    - lunches and dinners by slot × cuisine family × base;
    - `dinnerPastaOrRiceOutsideAsian`;
    - gnocchi (`noquis`) on its own line.
    The JSON gains a top-level `library` block (by source, by source × slot, by slot × family).
- **Identity evidence**: off and on, on the seed library, before and after the change. Every field except `ms` and the new fields (`library`, `starch.byFamily`, `starch.dinnerPastaOrRiceOutsideAsian`, `starch.gnocchi`) was byte-identical (`cmp`). The text output only gained lines.
- **The export**: taken once on 2026-10-02 by the lead: 371 recipes with `source = 'ai'`, 2,534 ingredient rows, 269 catalogue slugs, 0 recipes without ingredients, 703.7 KiB. All 371 loaded; no slug collided with the seed.

### Library composition (`pnpm db:local status` and the evaluator's `library` block)

871 recipes: seed 500, ai 371. A recipe offered at two slots counts at both.

| slot | seed | ai | spanish | asian | italian | latin | arab | other |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| breakfast | 100 | 77 | 137 | 11 | 2 | 9 | 1 | 17 |
| morning_snack | 100 | 32 | 84 | 11 | 0 | 3 | 1 | 33 |
| lunch | 240 | 97 | 224 | 43 | 29 | 25 | 12 | 4 |
| afternoon_snack | 148 | 76 | 141 | 14 | 0 | 10 | 3 | 56 |
| dinner | 250 | 100 | 236 | 43 | 29 | 24 | 12 | 6 |
| supper | 50 | 10 | 27 | 4 | 1 | 6 | 2 | 20 |

### Baseline (`docs/local/017-base-off.json`, `017-base-on.json`; start 2026-10-05; branch at `origin/docs/017-scheduler-tuning`, whose code is `main`'s)

Days inside 5% on all four macros: **181/182 off, 182/182 on.** The one day out of band is objetivo-bajo-3-comidas, off, day 7: carbs 130 g against 123 g (5.6%). No allergen reached a plate in either run.

- "pasta" and "rice" count every meal; the cap is 4 each.
- "running" counts days running with the same capped base.
- "P/R dinners" are dinners of pasta or rice; "non-Asian" is how many of those sit outside the Asian family.

| profile | days off | days on | pasta off / on | rice off / on | running off / on | P/R dinners off / on | non-Asian off / on | gnocchi off / on |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| objetivo-bajo-3-comidas | 13 | 14 | 1 / 2 | 1 / 3 | 0 / 0 | 1 / 1 | 0 / 0 | 0 / 0 |
| objetivo-alto-5-comidas | 14 | 14 | 4 / 4 | 6 / 7 | 0 / 1 | 2 / 4 | 1 / 2 | 0 / 0 |
| alergia-lacteos | 14 | 14 | 2 / 2 | 4 / 4 | 0 / 0 | 5 / 2 | 1 / 0 | 0 / 0 |
| patron-vegetariano | 14 | 14 | 2 / 2 | 5 / 5 | 0 / 0 | 0 / 1 | 0 / 0 | 0 / 0 |
| quincena-con-evento | 14 | 14 | 0 / 2 | 4 / 4 | 0 / 0 | 2 / 1 | 1 / 0 | 0 / 0 |
| alergia-personalizada | 14 | 14 | 0 / 0 | 5 / 4 | 0 / 0 | 3 / 2 | 1 / 1 | 0 / 0 |
| alergia-personalizada-no-resuelta | 14 | 14 | 1 / 1 | 6 / 5 | 0 / 0 | 4 / 4 | 1 / 1 | 0 / 0 |
| patron-halal | 14 | 14 | 1 / 4 | 6 / 4 | 0 / 0 | 2 / 1 | 0 / 0 | 0 / 0 |
| patron-kosher | 14 | 14 | 1 / 0 | 4 / 4 | 0 / 0 | 1 / 1 | 0 / 0 | 0 / 0 |
| patron-sin-gluten | 14 | 14 | 1 / 1 | 3 / 3 | 0 / 0 | 2 / 2 | 0 / 1 | 0 / 0 |
| patron-sin-lactosa | 14 | 14 | 3 / 3 | 4 / 4 | 0 / 0 | 5 / 4 | 1 / 1 | 0 / 0 |
| imc-alto-2-comidas | 14 | 14 | 4 / 4 | 6 / 5 | 1 / 0 | 4 / 3 | 1 / 0 | 0 / 1 |
| patron-tradicional-espanola | 14 | 14 | 3 / 2 | 4 / 4 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| **total** | **181** | **182** | | | **1 / 1** | **31 / 26** | **7 / 6** | **0 / 1** |

Rice is past its cap of 4 on 6 profiles off and 3 on. Every pasta or rice dinner outside the Asian family is a Latin rice dish: none is Spanish, Italian or Arab.

The one gnocchi plate is imc-alto-2-comidas, on, day 5 dinner: "Ñoquis salteados con pechuga de pollo, espinacas y mozzarella" (Italian). It is read as base `none`, so neither the cap nor the dinner rule sees it.

### Lunches and dinners by cuisine family and starch base, all 13 profiles summed

| | off | on |
| --- | --- | --- |
| lunch, spanish | legume 52, rice 18, potato 15, grains 8, bread 7, pasta 6, none 1 | legume 48, rice 20, grains 12, bread 7, potato 6, pasta 2 |
| lunch, italian | pasta 11, rice 2, grains 1 | pasta 14, grains 4, rice 4 |
| lunch, asian | legume 10, rice 9, pasta 1 | pasta 8, rice 7, legume 7, grains 1 |
| lunch, latin | bread 9, grains 5, legume 3, rice 3 | bread 7, legume 5, grains 5, rice 2 |
| lunch, arab | grains 12, legume 8, none 1 | grains 16, legume 5, none 2 |
| dinner, spanish | potato 48, bread 17, legume 6, none 4 | potato 53, bread 16, legume 5, none 4 |
| dinner, asian | rice 19, legume 19, grains 7, pasta 5, none 1 | legume 22, rice 17, grains 6, pasta 3, none 3 |
| dinner, latin | legume 17, bread 12, grains 9, rice 7, potato 3 | bread 15, legume 12, grains 8, rice 6, potato 4 |
| dinner, italian | grains 3, bread 2 | grains 2, bread 1, none 1 |
| dinner, arab | none 1, potato 1 | potato 3 |
| dinner, other | potato 1 | potato 1 |

- **Evidence**:
  - `pnpm db:local status`: 871 recipes, seed 500, ai 371.
  - Both baseline runs exited 0.
  - `gate.sh --full` was green.
- **Deviations from plan**: none. Two additions:
  - the evaluator's `library` block, which supplies the composition by family; `status` cannot import core.
  - a line in `AGENTS.md` § Local database for `reset --reference`.
- **Decisions**: none new (0080 applied).
- **Notes for the next phase**:
  - The new baseline is 181/182 off and 182/182 on, not the seed library's figures. Phase 2 compares against these two files.
  - Every non-Asian pasta or rice dinner here is Latin rice. Check whether Table 2 allows rice at a Latin dinner before counting those against criterion 3.

## Plan amended (2026-10-02, owner)

A second production plan was reviewed with the owner: v3 of a 3-meal account, 2,079 kcal.
- **In band:** 12/14 days, both misses on protein (−15.1%, −5.9%).
- **Couscous:** 7 times, 5 of them at dinner, and a pasta dinner. That is the threshold leak phase 2 fixes.
- **Chickpeas:** at 6 of 14 lunches, twice on consecutive days.
- **A snack dish as dinner:** a yoghurt cup at 3 servings.

Added:
- Phase 2: grains capped like pasta and rice, and legumes varied by kind.
- Phase 3: a dinner is never a snack or breakfast dish, no more than 2 servings unless the dish is a main, and a new evaluator profile shaped like that account.
- Criterion 3 is read as "outside what `0079` allows": rice at a Latin dinner is allowed.

## Plan amended again (2026-10-02, owner)

The same plan was read again for variety and season.
- **Season:** the caqui was in season (October–December). A nectarine dish was not (May–September): season filters accompaniments, not dishes.
- **Pork:** in 8 of 28 mains.
- **Fish:** almost none, but this person told the app he dislikes fish, so that is correct. The owner refused a fish minimum for that reason.
- **Snacks:** the same yoghurt cup on 6 of 14 mornings.

Added to phase 2: fruit in season in dishes, no protein dominates (about 3 times a week at most), and snacks vary (the same kind at most 3 times a fortnight).

## Phase 2 — The rule sees small dishes and gnocchi; grains, legumes, season, proteins and snacks vary (2026-10-02)

- **Executor**: backend agent `backend-017p2`, opus @ medium. No advisor consulted.
- **Result**: done. Four groups, each committed and measured on its own against the phase 1 baseline (`docs/local/017-base-{off,on}.json`), on the local Postgres with the reference library (`pnpm db:local reset --reference`, `NUTRIA_LOCAL_PG=1`), off and `--flag accompaniments` in parallel. Final runs: `docs/local/017-p2-{off,on}.json`.

### What changed, by group

- **A. Starch** (steps 1 and 4).
  - 603fc977 cherry-picked as is: rice, pasta and grains count from 20 g dry a serving, `noquis` is pasta (`0079`'s threshold amendment, already in that commit).
  - `STARCH_RULES.capped` gains `grains`: couscous and the other grains four a fortnight, never on days running, priced like pasta and rice.
  - The evaluator reports every day out of band with its meals (`outOfBand`), every capped base, and `starch.outsideTable2`: plates whose pasta, rice or grains `0079` Table 2 refuses at their meal. That count, not "outside the Asian family", is criterion 3 as amended: rice at a Latin dinner is allowed.
- **B. Legumes and proteins** (steps 5 and 7).
  - `LEGUME_RULES`: the same legume (chickpeas, lentils, white beans, other beans, broad beans, split peas, soya, read from `0079`'s pulses by their heaviest row) three times a fortnight at most, never on days running. The total is not capped. Priced like `STARCH_RULES`, through one shared kind rule (`core/domain/Variety/Kinds.ts`) that starch now uses too. Swaps and the event rebuild carry each kept meal's legume as they carry its starch (`MealCompositionView.legume`, `Placement.legume`).
  - **Protein diagnosis.** The evaluator's profiles draw on the whole library, where no protein reached more than 6 mains. The production pool is a rotation of 19 a slot plus the model's dishes. On rotated pools of the reference library (a scratch copy of the evaluator, a 3-meal high-protein profile that dislikes fish, 10 seeds), one protein reached 8 of 28 mains (chicken, beef), the real plan's figure. Instrumenting the passes showed it was decided in `improveDay`, not in the first pick or the fortnight passes. A meal past `PROTEIN_RULES` cost 0.05 there, less than the few points of fit a swap toward it bought, and the same as serving a dish twice. Two smaller causes in the rule's classes: `kindOf` named pork by slug (`lomo-embuchado`, `jamon-serrano`, `chorizo` and `secreto-de-cerdo` were four proteins), and `huevo-de-codorniz` read as quail. The limits were not the cause: three lunches and three dinners a fortnight is already about three a week.
  - **Protein fix.** Pork in every cut and any egg are one protein each, by class (`KIND_BY_CLASS`). A swap pays 0.15 a meal past a protein rule or a kind rule (`PROTEIN_SWAP_WEIGHT`). The mains of each plan week (days 1–7, 8–14) hold one protein three times at most (`PROTEIN_RULES.perMainsWeek`), and the spread pass prices an exchange that breaks that. On the rotated pools the most-served protein fell from 8 mains to 6, the busiest week to 4. Dislikes are untouched: there is no minimum of any protein.
- **C. Season** (step 6). The scheduler is told each day's month (`SchedulerInput.monthOf`, from generation, the event rebuild and the evaluator, flag or not). It serves no dish whose fresh fruit (`FRESH_FRUIT_SLUGS`) is out of season that month, in the first pick, the swaps, the spread exchanges and the distinct-days repair. When no in-season dish can fill a meal, it serves one anyway, so the person still gets a plan. A swap is told the day's month and offers none. Fruit only.
- **D. Snacks** (step 8). `SNACK_RULES`: the same kind of snack three times a fortnight at most, over the mid-morning, afternoon and late snacks. The kind is the heaviest ingredient outside the fruit and drinks aisles: every yoghurt, skyr and kefir is one kind; every fresh cheese is one; every bread or toast is one; anything else is named by its protein. Priced like the other kind rules. A kept snack outside the pool counts for nothing in a swap or a rebuild, as a kept protein always has.

### Days in band (off / on)

| profile | base | A | B | C | D (final) |
| --- | --- | --- | --- | --- | --- |
| objetivo-bajo-3-comidas | 13 / 14 | 12 / 13 | 11 / 13 | 10 / 14 | 10 / 14 |
| imc-alto-2-comidas | 14 / 14 | 14 / 14 | 13 / 14 | 14 / 14 | 12 / 14 |
| the other eleven | 14 / 14 each | 14 / 14 | 14 / 14 | 14 / 14 | 14 / 14 |
| **total** | **181 / 182** | **180 / 181** | **178 / 181** | **178 / 182** | **176 / 182** |

Per group, against the group before: A −1 / −1, B −2 / 0, C 0 / +1, D −2 / 0. No group cost more than 2 days in a mode. No allergen reached a plate in any run. No dinner pool fell under `DISHES_NEEDED_PER_SLOT` (19); the thinnest was the vegetarian's 76.

### Counts, all 13 profiles (main's code with this phase's report → final)

| | off | on |
| --- | --- | --- |
| most of one capped starch (pasta, rice, grains) | 6 → 5 | 7 → 5 |
| capped starch on days running | 1 → 0 | 1 → 0 |
| pasta, rice or grains where Table 2 refuses them | 0 → 0 | 0 → 0 |
| most of one legume | 8 → 6 | 6 → 4 |
| one legume on days running or twice a day | 48 → 0 | 34 → 0 |
| most of one main protein, lunch and dinner | 6 → 6 | 6 → 6 |
| one protein's busiest week of mains | 5 → 3 | 5 → 3 |
| most of one kind of snack | 16 → 3 | 15 → 3 |
| plates with fresh fruit out of season | 41 → 0 | 44 → 0 |

"Main" here is `bde8c425` measured with this phase's evaluator, its new figures read with the new kinds; its days matched the baseline exactly. Still over a soft cap in the final runs: rice 5 for objetivo-alto-5-comidas (off and on) and patron-vegetariano (on); one legume 6 (off) and 4 (on) for patron-vegetariano, 4 for imc-alto-2-comidas (off). These pools have few alternatives, and the rules are priced, not hard. Gnocchi served: 0 in the final runs.

### Days out of band in the final runs, with causes (phase 3 to fix)

- objetivo-bajo-3-comidas, off:
  - day 2, carbs +6.4%: a chickpea-salad lunch ×1.25 and a tortilla de patatas dinner ×1.25.
  - day 3, carbs +5.8%: a whole-wheat pasta lunch at ×0.5.
  - day 10, protein +5.5%: a seafood lunch beside a skyr bowl at dinner.
  - day 14, fat +5.7%: a couscous lunch ×1.5.
  - This small-target profile (1,200-odd kcal, three meals) moved by a day or two with every group; its losses follow the kind rules, which take its best-fitting starchy lunches away (pasta, couscous, chickpeas).
- imc-alto-2-comidas, off (lost in group D):
  - day 10, fat +13%: a bread-and-requesón morning snack ×0.5 beside a chickpea-and-coconut curry ×1.75.
  - day 13, carbs −6.8%: a protein-yoghurt snack ×0.75 beside two bread-based mains.
  - The snack rule took away its best-fitting snacks (bread and yoghurt, three each).
- On: none; every profile 14/14.

### Time (evaluator `ms`, back to back on this machine, main → final)

Total 4,234 → 4,746 ms off (+12%) and 7,894 → 8,933 ms on (+13%).

| profile | off | on |
| --- | --- | --- |
| objetivo-bajo-3-comidas | 397 → 479 | 400 → 463 |
| objetivo-alto-5-comidas | 750 → 759 | 1,398 → 1,876 |
| alergia-lacteos | 265 → 334 | 471 → 513 |
| patron-vegetariano | 288 → 238 | 637 → 722 |
| quincena-con-evento | 369 → 405 | 507 → 604 |
| alergia-personalizada | 260 → 356 | 860 → 820 |
| alergia-personalizada-no-resuelta | 366 → 476 | 792 → 817 |
| patron-halal | 302 → 342 | 749 → 792 |
| patron-kosher | 226 → 278 | 196 → 299 |
| patron-sin-gluten | 270 → 241 | 263 → 215 |
| patron-sin-lactosa | 366 → 382 | 724 → 768 |
| imc-alto-2-comidas | 185 → 260 | 346 → 430 |
| patron-tradicional-espanola | 190 → 196 | 551 → 614 |

A CPU profile of objetivo-alto-5-comidas on puts the time in `balancedDay`'s search (`visit`, `fitAlong`), not in the new rules (`proteinExcess` 2%). The searches take other paths and more rounds. The swap pass prices the kinds once per meal and kind, not per candidate. Load on the machine varied between runs by ±10%. Phase 3's criterion (within 10% of #198) has to win this back.

- **Evidence**:
  - Unit specs per rule: `Kinds.test.ts`, `Legume.test.ts`, `Snack.test.ts`, `Protein.test.ts` (pork and egg by class, the pinned rule), `Starch.test.ts` (grains), `MealFit.test.ts` (`outOfSeasonFruit`), and `Scheduler.test.ts`: proteins per week and pork as one, legumes, snacks, fruit in season, a swap's month.
  - Mutation checks, each failing the specs:
    - 40 g back: 7 fail.
    - grains uncapped: 1.
    - pork class removed: 1.
    - weekly limit off: 1.
    - legume rule off: 2.
    - swap weight back to 0.05: 2.
    - snack rule off: 3.
    - skyr not a yoghurt: 1.
    - no season in the first pick: 1.
    - no season at all: 1.
  - Hash-pinned specs: two in `Scheduler.accompaniments.test.ts` moved in group D (five meals; two mains and a light snack), commented: their fixture snacks are all one kind.
  - `Scheduler.test.ts` "repairs the fortnight without bringing rice onto days running" moved its filler from quinoa to the fixture's own `arroz` in group A, commented: quinoa is a capped grain now.
  - `gate.sh --full`: see the hand-back.
- **Deviations from plan**:
  - The protein rule's weekly limit counts plan weeks (days 1–7, 8–14), not a rolling window.
  - The swap weight for the kind rules rose with the proteins' (0.05 → 0.15): at 0.05 a meal past a kind rule cost exactly what a second serving of a dish does, and a starch spec broke once legumes took capacity.
  - The snack rule includes the late snack (`supper`).
  - The season filter falls back to an out-of-season dish when nothing else fills a meal.
  - 603fc977 also edited `0079` and project 016's LOG (the lead's files) and came in unchanged.
- **Decisions**: none new. `0079`'s threshold amendment came with 603fc977. The new rules are the owner's amendments of 2026-10-02 recorded above; phase 4's `0081` may want to cite them.
- **Notes for the next phase**:
  - Phase 3 starts from 176/182 off and 182/182 on: the six days above, all off, all on two profiles.
  - The time is +12–13%.
  - `PROTEIN_SWAP_WEIGHT` and the kind rules' cost in `improveDay` are where macros and variety trade. Loosening them wins days back but brings dominance back (rotated pools, 0.05: 8 mains).

## Phase 3 — Every day in band (2026-10-03)

- **Executor**: opus @ high (`backend-017p3`). The agent was lost to a reboot after its last commit; the lead finished the gate, this entry and one spec.
- **Result**: done.
- **Evidence**:
  - Reference library (871 recipes, local Postgres): **196/196** days within ±5% on all four macros off and on, 14 profiles, the new `tres-comidas-proteina-alta` included. 0 allergens. 0 snack or breakfast dishes at lunch or dinner. Outputs in `docs/local/017-p3-{off,on}.json`.
  - schedulePlan time against #198 (median of 5 interleaved runs, the 13 shared profiles, scheduler only): −1.3% off, −2.1% on.
  - `gate.sh --full` green after one spec fix (below).
- **Changes**:
  - `b99a0a1c`: a dish that names breakfast or a snack among its slots never fills lunch or dinner (`isSnackOrBreakfastDish` in `fitSlots`). The evaluator counts such plates.
  - `dedc89bb`: a day still outside its bands after the spread pass is repaired by a pool swap sized to the bands, judged on the macros as delivered (rounded).
  - `31fb7e19`: `improveDay` memoises the days it has sized and prices protein and reuse once per meal. Plans are byte-identical. The evaluator times the scheduler alone.
  - `51e941ab`: the evaluator profile `tres-comidas-proteina-alta` (3 meals, 2,079 kcal, protein 138 g, dislikes fish).
- **Deviations**: the "no more than 2 servings unless a main" rule is met through the snack rule. Every dish at a main meal is now one designed only for main meals, so no snack is scaled up.
- **Spec**: `PoolBuilder.spec.ts` "leaves a dish of staples exactly as the model sent it" used a dish naming breakfast, lunch and dinner. It now names lunch and dinner, because the case is about staples, not about light dishes.
- **Note**: e2e runs on the shared local DB add recipes. Reset with `pnpm db:local reset --reference` and check for 871 before measuring.

## Phase 4 — The cap, decided (2026-10-03)

- **Executor**: opus @ medium (`backend-017p4`) wrote the cap (`760edbf0`, `e4e780ef`). The agent was lost to a reboot, and the lead measured and closed the phase.
- **Result**: done.
- **Evidence**: on the reference library, 871 recipes, local Postgres:
  - 196/196 days off and on;
  - 0 allergens;
  - 0 profiles past four pasta, rice or grains (phase 3: 7);
  - time +2.2% off and +0.8% on against phase 3, best of two back to back.
  - Outputs are in `docs/local/017-p4-{off,on}.json`.
- **Decisions**: [`0081`](../../decisions/0081-pasta-rice-and-grains-capped-unless-the-bands-need-more.md): the cap is held above any fit, and only the bands outrank it.

## Project closed (2026-10-03)

- **PRD criteria:** all six met. Library and baseline (1); per-family report (2); starch seen, no pasta or rice at a dinner outside what `0079` allows (3); 196/196 off and on (4); the cap held (5); time within +10% (6).
- **Owner amendments also met:** grains capped, legumes varied, fruit in season in dishes, no protein dominating, snacks varied, a dinner is a meal, and the new profile.
- **Next:** 018.
