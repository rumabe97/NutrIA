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

## Phase 2 — Celery on the broths, and the side threshold (2026-10-03)

- **Executor**: opus @ medium (`backend-018p2`). No advisor consulted.
- **Result**: done. The migration review (`migration-reviewer`) is the lead's to start. The migration number is to be redone after project 011 merges (below).
- **What changed**:
  - **Seed.** `caldo-de-pollo` and `caldo-de-verduras` (starter.ts) carry `celery` as `contains`. So do `caldo-de-carne` and `caldo-de-pescado` (pantry.ts): the reasoning for the two is the same, a generic carton broth that lists celery.
  - **Migration `0057_broths_declare_celery`** is data only (`--custom`). It inserts the four links keyed by slug and allergen key, `ON CONFLICT ("ingredient_id", "allergen_id") DO NOTHING`. Celery derives no food class, so `ingredients.classes` is untouched.
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
- **For the lead.**
  - Project 011's `0057_a_lost_second_factor…` takes 0057 and merges first (lead's decision). After that merge, this branch:
    1. merges `origin/main`;
    2. deletes its 0057 files and regenerates the migration as 0058 with `generate --custom`, so its snapshot carries `two_factor_removal`;
    3. reruns `check-migrations --drift` and the gate.
  - The evaluator runs are in `docs/local/018-p2-{base-off,base-on,off,on}.json`.
