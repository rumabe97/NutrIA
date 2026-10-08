# LOG — Project 018: More accompaniments

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

## Phase 1 — The batch, drafted (2026-10-03)

- **Executor**: opus @ high (`architect-018b`); the first architect was lost to a reboot.
- **Result**: done. Report [`0009`](../../reference/architecture/0009-more-accompaniments-2026-10-03.md).
  - 42 entries: Spanish 22, Asian 4, Latin 4, Arab 5, all families 7.
  - By role: 10 starch, 24 vegetable, 8 dessert.
  - No missing slugs.
- **Review (lead, owner's delegation of 2026-10-03).** Every listed entry is accepted except:
  - **picos-de-pan:** out. It is a BEDCA row, so it waits for the queued USDA re-sourcing task.
  - **caldo-de-pollo and caldo-de-verduras:** out of the batch until their allergen links exist (below).
  - **tostada-con-aceite and avellanas (breakfast only):** out. Sides are never served at breakfast (`MAIN_SLOTS`), so they would be dead entries. The existing breakfast-only rows stay as they are.
  - **espinacas-a-la-catalana (5 g pine nuts at lunch and dinner):** accepted, against the letter of `0079` answer 7. It is the nut case the phase 3 specs need, and the larder excludes it for nut allergies.
- **Safety finding, acted on in phase 2.**
  - `caldo-de-pollo` and `caldo-de-verduras` carry no allergen link. Spanish carton broths usually list celery, and the sibling rows (`pastilla-de-caldo-de-verduras`, `sopa-de-verduras-envasada`) carry it as traces.
  - Dishes in production that use them are not excluded for a celery allergy today.
  - Decision: add celery as `contains` to both rows, in the seed and through a reviewed data migration for production. The cautious reading wins on allergens.
- **Code finding, acted on in phase 2.** `itemGroups` (Accompaniment.ts) counts a food group with no gram threshold, unlike `dishGroups`: 10 g of fideos would make a side "pasta". Give it the same `FOOD_GROUP_GRAMS` threshold.
- **Phase 3 conditions:**
  - **Time first.** Paste the batch, measure schedulePlan, and stop above +10%. Prune each role before building the sets if needed.
  - **Variety.** If distinct sides per profile do not rise, add a small repetition cost for the same side within a fortnight, priced like the kind rules and measured.
  - **traditional_spanish spec.** It goes through `setsBeside` with a foreign dish.
- **Report revised (3ada521a).** It now follows the breakfast decision: the two breakfast-only entries are gone, and `curtido` and `ensalada-de-aguacate` (Latin vegetables, the thinnest family) take their places. The batch is still 42. Accepted: 39, all but `picos-de-pan`, `caldo-de-pollo` and `caldo-de-verduras`. That gives 18 Spanish, 4 Asian, 6 Latin and 5 Arab.

## Phase 2 — Celery on the broths, and the side threshold (2026-10-03)

- **Executor**: opus @ medium (`backend-018p2`). No advisor consulted.
- **Result**: done. Reviewed by `migration-reviewer-018`: safe to ship, no P0 or P1. Its findings are applied (below).
- **What changed**:
  - **Seed.** `caldo-de-pollo` and `caldo-de-verduras` (starter.ts) carry `celery` as `contains`. So do `caldo-de-carne` and `caldo-de-pescado` (pantry.ts): the reasoning for the two is the same, a generic carton broth that lists celery.
  - **Migration `0058_broths_declare_celery`** is data only (`--custom`). It was first written as 0057, then regenerated as 0058 on top of project 011's 0057 once that merged, so its snapshot and journal `when` follow 011's. It inserts the four links keyed by slug and allergen key, `ON CONFLICT ("ingredient_id", "allergen_id") DO NOTHING`. Celery derives no food class, so `ingredients.classes` is untouched.
  - **`itemGroups`** (core/domain/Accompaniment) now takes the whole portion. A vegetable or dessert side reads its groups through `dishGroups`, which has the `FOOD_GROUP_GRAMS` threshold. A **starch** side keeps every group it holds, whatever the grams.
    - **Deviation:** the plain threshold would have dropped the tabulé's 30 g of bulgur below grains' 40 g. That side would then have been offered beside a couscous. Of the 46 entries, only the tabulé changed.
    - So the threshold applies where the finding was (a few grams of noodles in a broth), and every existing entry keeps its groups.
- **Other broth and soup rows: verdicts.**
  - `caldo-de-carne`: **added**. Same case as the chicken broth.
  - `caldo-de-pescado`: **added**. A carton fish stock lists celery as often as the others, and the cautious reading wins.
  - `caldo-dashi`: no. It is kombu and bonito, with no celery.
  - `pastilla-de-caldo`, `pastilla-de-caldo-de-verduras`, `sopa-de-verduras-envasada`, `sopa-de-fideos-envasada`, `crema-de-verduras-envasada`: already carry celery as `may_contain`. **Left as they are.**
    - Moving them to `contains` would need `DO UPDATE`, outside this phase's idempotent `DO NOTHING`. It is open for the lead.
  - `crema-de-calabaza-envasada`, `crema-de-champinones-envasada`, `gazpacho-envasado`, `salmorejo-envasado`, `sofrito-envasado`, `cocido-madrileno-en-lata`, `fabada-en-lata`, `lentejas-con-chorizo-en-lata`, `alubias-con-verduras-en-lata`, `garbanzos-con-espinacas-en-lata`, `ramen-instantaneo`: **no link added**. None clearly carries celery.
    - The two creams and the canned stews sometimes do. They are worth a look in the queued USDA re-sourcing task, not a guess here.
- **Specs.**
  - `core/domain/Safety/Broths.seed.test.ts` reads the real seed's links through `dishSafety`, the gate generation, swaps and `larderFor` share:
    - each of the four broths is refused for a celery allergy;
    - a rice dish with a splash of broth is refused, and passes without it;
    - nobody without that allergy loses them.
  - `database/src/seed/seed.test.ts`: every `caldo-*` but dashi carries celery `contains`, and the migration's slug list equals those rows.
  - `Accompaniment.test.ts`:
    - a vegetable broth with 10 g of noodles is not pasta, at a Spanish dinner nor beside a pasta dish;
    - the tabulé stays grains beside a couscous.
    - Both checked failing against the old code and against a threshold-for-all.
  - `judge.catalogue.test.ts`: `CARRY_NOTHING_MORE` is one fewer for every example dish, because a broth now carries celery that none of them does.
- **Evidence.**
  - Measured on the reference library (`pnpm db:local reset --reference`, `NUTRIA_LOCAL_PG=1`, start 2026-10-05, 13 profiles), base (`de16e909`) against this branch:
    - **Days off:** 181/182 before and after. The one day out of band is objetivo-bajo-3-comidas, as in 017's baseline.
    - **Days on:** 182/182 before and after.
    - **`--compare`:** "the same" for all 13 profiles, off and on.
    - **Allergens:** 0 in all four runs.
  - The timings are not comparable: the base run shared the machine with a gate.
  - `check-migrations --drift` passed.
  - The gate (`--full`) passed: migrations, checks (lint, types, coverage), web build, static, format and deadcode.
    - The leak check ran with built-in rules only: a worktree has no `docs/local/leak-patterns.txt`. It needs a run from the main checkout.
- **Migration review (`migration-reviewer-018`), applied.**
  - The migration ends with a check. On a populated catalogue, it raises unless all four links are there as `contains`, and the whole migrate run then rolls back.
    - It is tested in a rolled-back transaction on the local reference database: it passes as is, and raises with one link as `may_contain`.
    - An empty catalogue (a fresh database, CI) passes.
  - Its header says the seed change and the migration land and revert together, because the seed rewrites an ingredient's links wholesale.
- The evaluator runs are in `docs/local/018-p2-{base-off,base-on,off,on}.json`.

## Phase 3 — The entries, live (2026-10-03)

- **Executor**: opus @ medium (`backend-018p3`), one advisor consult. The web phrases were written by the backend agent too, with the lead's approval.
- **Result**: done. Project delivered.
- **What changed**:
  - **The 39 accepted entries** of report `0009` are in `ACCOMPANIMENTS`, `COMPOSED_NAMES` and `COMPOSED_PREPARATIONS`, taken from the report's literals by script, not retyped. Each sits beside its role and family: new fruit after `pina`, the two dessert composites after the yoghurts, `kimchi`, `guacamole` and `datiles` at the end of 3a, and the composed ones after their family's existing entries. So a tie in the ranking still goes to an entry that was there before. The list is 85 entries, 50 of them composed.
  - **`meal.accompanimentNames`**: 39 phrases each in es-ES and en-GB, as the report wrote them.
  - **The table comment** no longer says "USDA rows only". It names the BEDCA row and the five `manual` rows that were already there.
  - **`FRUIT`** gains `datiles`, so dates are not served beside a dish that already carries 100 g of fruit. The four new fruits leave its literal list, because the `months: 'catalogue'` entries already supply them.
- **Time first (step 1).** schedulePlan is the evaluator's `scheduleMs`, summed over the 14 profiles. Base is `092de70b` (phase 2's tip, which becomes `main` when #206 merges). Base and branch ran back to back, two rounds, best of two:

  | Run | Off: base → branch | On: base → branch |
  |---|---|---|
  | Pasted, unpruned | 2,885 / 2,870 → 2,891 / 2,911 ms (+0.7 %) | 6,416 / 6,217 → 8,304 / 8,199 ms (**+31.9 %**) |
  | Eight portions per role | 2,970 / 2,917 → 3,208 / 2,907 ms (−0.3 %) | 6,398 / 6,296 → 7,129 / 7,047 ms (+11.9 %) |
  | Six per role, unfit singletons dropped | 2,994 / 2,949 → 3,310 / 2,972 ms (+0.8 %) | 6,519 / 6,498 → 6,222 / 6,107 ms (−6.0 %) |
  | **Six per role, unfit singletons kept last (shipped)** | 2,952 / 2,964 → 2,905 / 2,986 ms (−1.6 %) | 6,468 / 6,341 → 6,278 / 6,164 ms (**−2.8 %**) |

  - A first unpruned run on a loaded machine (load average 4–5) read −0.5 % on. That was noise, and it is why every row above was run back to back on a quiet machine (load about 1.3).
  - **Pruning.** `offeredSets` (Scheduler) gives `setsBeside` a new `keep` argument. Each role keeps its `ACCOMPANIMENT_CANDIDATES_PER_ROLE` (6) best portions, priced alone exactly as `setCost` prices a set of one. Only those are combined, still in table order. Generation and swaps share it.
    - A portion that fits no plate on its own is ranked last, not dropped. The plate's share has a floor (`PLATE_LIMIT.min`), and more energy beside a small plate can lift the meal over it. So a set can fit where its single portions do not.
    - The first pruned version dropped those portions. Ranking them last instead changed no measured number: 196/196, and 197 distinct.
    - Eight per role was over +10 %, and gave fewer distinct sides (189 against 197).
- **Specs (step 3)**, in `Accompaniment.seed.test.ts`, on the real seed: its links, seasons and macros. So no case passes because a fixture left a row out. The first assertion is that every row of every side is found.
  - **Milk** (`pure-de-patata`, `yogur-con-miel`), **gluten** (`salmorejo`, `pan-con-tomate`, `cuscus`, `espinacas-con-sesamo`) and **tree nuts** (`espinacas-a-la-catalana`, also through `setsBeside` at lunch and dinner beside a Spanish plate): each side is offered to somebody without the allergy and never to somebody with it.
  - **traditional_spanish.** The sides holding a `0077` row are out of the larder. Through `setsBeside`, across every month at lunch and dinner, nothing foreign is offered beside a Moroccan, Mexican, Turkish or Cuban dish, while everybody else gets those sides.
  - The oil test and the coverage tests pass. The composed count is now 50.
  - `Accompaniment.test.ts` tests `keep`.
- **Deviation: a larder rule for foreign-only sides.**
  - **What the specs showed.** `cuscus`, `elote`, `curtido`, `ensalada-de-aguacate`, `ensalada-de-zanahoria-marroqui`, `ensalada-de-remolacha`, `mutabal` and `datiles` hold no `0077` row. Only the dish filter kept them away, and `breaksPatternDish` refuses by `FOREIGN_CUISINES`. That list lacks values `cuisineFamily` maps to a foreign family: `turca`, `levantina`, `moroccan`, `asian`, `indian`, `mexican`, `colombiana`, `argentina`, `cubana` and `caribena`. A "Turca" dish reaches a traditional Spanish plan today, and would have brought a couscous with it.
  - **What changed.** `larderFor` now leaves out, for whoever `refusesForeignDishes`, every side that only the arab, asian or latin family serves. Shared sides (`'all'`) and Spanish or Italian ones stay. The spec fails on four cases without it.
  - **For the lead:** none of those cuisine values is in the reference library. Whether the dishes themselves should be refused (adding the values to `FOREIGN_CUISINES`) changes what the dish filter does, and is left to the lead.
- **Evaluator (step 4).** `accompanied.distinct` counts the different sides each profile's fortnight served. It is printed per profile and in `--compare`.
  - **Days in band.** Off: 196/196, the same as phase 2's tip measured the same day. Against `018-p2-off.json`, objetivo-bajo-3-comidas goes from 13 to 14, as on the base. The 14th profile (`tres-comidas-proteina-alta`) is not in the phase 2 files. On: 196/196, before and after.
  - **Safety and meals.** 0 allergens and 0 snack-at-main, off and on. `--compare` says "the same" for every profile on.
  - **Distinct sides per fortnight**, phase 2's code against this branch, flag on, total 145 → 197:
    - objetivo-alto-5-comidas 19 → 28;
    - tres-comidas-proteina-alta 10 → 21;
    - patron-vegetariano 14 → 19;
    - patron-halal 15 → 19;
    - patron-sin-lactosa 13 → 18;
    - imc-alto-2-comidas 15 → 18;
    - patron-tradicional-espanola 13 → 18;
    - alergia-personalizada-no-resuelta 15 → 18;
    - alergia-personalizada 12 → 16;
    - quincena-con-evento 8 → 11;
    - alergia-lacteos 11 → 11, the one that did not rise;
    - objetivo-bajo-3-comidas, patron-kosher and patron-sin-gluten 0 → 0: all 28 of their lunches and dinners took no side, before and after (`byCount` 0: 28). Why kosher and gluten-free get none was not looked into; it predates 018.
  - **No repetition cost.** The count rose, so it was not added.
  - **Risk 4 of the report** (near-zero sides): `kimchi` is never among the most served.
- **Evidence**:
  - `docs/local/018-p3-{off,on}.json`;
  - core: 122 files, 3,684 tests green at the final code;
  - the gate result is in the hand-back.

## Closing (2026-10-08)

- **Closed** on 2026-10-08 at the owner's request, after the closing audit
  ([`closing-audit-2026-10-08.md`](../000-workspace/closing-audit-2026-10-08.md)). The
  project was delivered on 2026-10-03. Anything found later is a new change, not a
  reopening.
- **Shipped:**
  - #206: phases 1 and 2 (report `0009`, migration 0058);
  - #207: phase 3, 39 entries live.
- **PRD criteria:** all five met (phase 3 above).
- **The item handed to the lead is fixed.** `FOREIGN_CUISINES` lacked cuisine values
  `cuisineFamily` reads as foreign ("turca", "cubana"…). #209 (2026-10-03) refuses such a
  dish for traditional Spanish.
- **Not looked into, older than 018:** `objetivo-bajo-3-comidas`, `patron-kosher` and
  `patron-sin-gluten` take no side at lunch or dinner.
