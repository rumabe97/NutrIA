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
