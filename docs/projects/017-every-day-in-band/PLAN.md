# Plan — Project 017: Every day in band, every starch counted

> **Purpose**: the phased technical execution plan, the engineering half of the
> contract. `/execute-project` follows this literally; executors implement, they do not
> redesign. If implementation must diverge, the plan is amended in the same change and the
> deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes. **Written by**: a
> planner agent via `/plan-project`; approved by the owner before execution starts.

- **Status**: approved
- **Type**: standard
- **PRD**: ./PRD.md
- **Routing profile**: tiered

## Design summary

**Measure on something that looks like production, then change the rules.**

Project 016 measured with whatever library was at hand: the dev database's ~2,200 recipes (now over its Neon quota), then the local 500 seed dishes. Neither carries the model-made 4.6.0 dishes that broke the owner's v15 plan.

1. **Phase 1 builds the yardstick.**
   - A read-only export of production's model-made recipes, loaded on top of the seed into the local Postgres: decision [`0080`](../../decisions/0080-measure-on-a-production-like-local-library.md).
   - A per-family starch report in the evaluator.
   - A recorded baseline.
2. **Phase 2 fixes what the rule sees.** The threshold and the gnocchi, from the draft on `agent/starch-fix/backend-p7fix` (603fc977), re-measured against that baseline.
3. **Phase 3 wins the days back.** Each day out of band is diagnosed (which macro, which meal, why the search accepted it) and repaired in the scheduler's costs or search.
4. **Phase 4 decides the cap.** A hard pasta/rice cap is tried; where it costs a day, the cap stays soft there (owner: the macros win). The result goes in decision `0081`.

Every measurement runs on the local Postgres: `pnpm db:local`, `NUTRIA_LOCAL_PG=1`.

## Phases

### Phase 1 — A production-like library, a per-family starch report, a baseline

- [x] done (2026-10-02) — see LOG.md
- **Dispatch**: opus @ medium — `/execute-project 017 phase 1` — owner-gated: none. The lead runs the read-only production export itself; the owner approved it, decision 0080.
- **Covers**: PRD criteria 1 and 2.
- **Steps**:
  1. **Export.**
     - The script is `scripts/export-reference-library.mjs`.
     - It reads production read-only: `DATABASE_URL_PRO` through `guard.mjs`'s `readEnv`, inside `sql.begin('read only')`.
     - It takes every recipe with `source = 'ai'`, its `recipe_ingredients`, and the catalogue ids they reference.
     - It writes `docs/local/reference-ai-recipes.sql`, as INSERTs keyed by slug with `ON CONFLICT DO NOTHING`.
     - `created_by` is NULL and no user table is read.
     - It prints counts and the file size. It runs once.
  2. **Load.**
     - `pnpm db:local reset --reference` does the normal reset, then loads `docs/local/reference-ai-recipes.sql`, then re-runs 0056's statement.
     - `pnpm db:local status` prints recipes by source.
  3. **Report.** The evaluator's starch section gains:
     - per profile, lunches and dinners by starch base and by cuisine family (`cuisineFamily`);
     - "dinners with pasta or rice outside the Asian family" as its own number;
     - gnocchi as its own line (an unknown base today).
  4. **Baseline.** Run `NUTRIA_LOCAL_PG=1 node apps/api/scripts/evaluate-plans.mjs --json docs/local/017-base-off.json` and the same with `--flag accompaniments` into `017-base-on.json`, on `main`'s rules. Record in LOG.md:
     - the library's composition (by source, slot and family);
     - days in band per profile;
     - the starch table.
- **Verification**:
  - `pnpm db:local status` shows the composition;
  - the two baseline files exist;
  - `gate.sh --full` is green.

### Phase 2 — The rule sees small dishes and gnocchi

- [x] done (2026-10-02) — see LOG.md
- **Dispatch**: opus @ medium — `/execute-project 017 phase 2`. `plan-evaluator` (opus @ high) measures.
- **Covers**: PRD criterion 3 (read as "outside what `0079` allows": rice at an Asian or Latin dinner is allowed), and the owner's amendments of 2026-10-02 (grains capped, legumes varied, fruit in season in dishes, no protein dominates, snacks vary).
- **Steps**:
  1. Bring in 603fc977 (`FOOD_GROUP_GRAMS` for rice, pasta and grains at 20 g dry; `noquis` in pasta; specs from the four production dishes). Rebase it on `main` and keep its specs.
  2. Evaluate off and on against the phase 1 baseline. Report per profile:
     - days in band;
     - pasta/rice dinners outside Asian, which must be 0;
     - the starch totals.
  3. Find each day that moves out of band and record its cause, but do not fix it here: phase 3 does.
  4. *Amended 2026-10-02 (owner, from a second production plan).* Couscous and the other grains get the same fortnightly treatment as pasta and rice: a cap of 4 and never on consecutive days, priced in `STARCH_RULES`. A real plan served couscous 7 times, 5 of them at dinner.
  5. *Amended 2026-10-02 (owner): legumes vary.* The AESAN guidance of legumes at least 3–4 times a week stays a floor, not a ceiling: the total is not capped. What varies is the kind.
     - The same legume (chickpeas, lentils, white beans, other beans and so on, read from the dish's pulse ingredients) appears at most 3 times a fortnight and never on consecutive days.
     - The same dish appears at most twice a fortnight, as today.
     - This uses the same pricing as the starch rule.
     - The evaluator reports legumes by kind per profile.
     - A real plan served chickpeas at 6 of 14 lunches, twice on consecutive days.
  6. *Amended 2026-10-02 (owner): fruit in season in dishes too.*
     - A dish whose fresh fruit is out of season in a day's month (`seasonMonths`, Spain's calendar, `0062` § 2) is not served that day. This is the hard filter accompaniments already have.
     - Fruit only: vegetables are found all year.
     - The evaluator counts out-of-season fruit plates, which must be 0.
     - A real plan served "Biscotes con requesón y nectarina" in October.
  7. *Amended 2026-10-02 (owner): no protein dominates.*
     - The same main protein (pork, chicken, beef, turkey and so on, as `PROTEIN_RULES` reads it) appears at most about 3 times a week at lunch and dinner.
     - First find why the protein rule let pork through 8 of 28 mains in a real plan, then fix the cause.
     - Mind the person's dislikes: a person who dislikes fish gets no fish. A fish minimum was considered and refused by the owner for that reason.
  8. *Amended 2026-10-02 (owner): snacks vary.* The same kind of snack (a yoghurt cup, a toast and so on, by its main ingredient) appears at most 3 times a fortnight. A real plan served the same protein-yoghurt cup 6 of 14 mornings.
- **Stop if**: an allergen reaches a plate, or a dinner pool falls under `DISHES_NEEDED_PER_SLOT`.
- **Verification**:
  - `docs/local/017-p2-{off,on}.json`;
  - unit specs, including the mutation check (40 g fails them);
  - `gate.sh --full`.

### Phase 3 — Every day in band

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 017 phase 3`. `plan-evaluator` (opus @ high). Deviation from `tiered`'s medium: the fix is a design choice in the scheduler's search, not a specified change.
- **Covers**: PRD criteria 4 and 6, and the owner's amendments of 2026-10-02 (snack dishes at dinner, the new profile).
- **Steps**:
  1. For every day out of band on the phase 2 runs, off and on, read the day: which macro, which meal and serving size, which accompaniment set, and which rule priced the better day away (starch, protein, per-food ceiling, plate limit, energy floor).
  2. Fix by cause, the cheapest sound fix first:
     - weights;
     - the repair pass (`improveDay` and `spreadAcrossDays`) reconsidering a day that leaves the band;
     - an accompaniment set chosen to close a macro gap.
     A rule may not be loosened in a way that lets an allergen, a per-food ceiling or the 35% side share through.
  3. Re-run until 14/14 everywhere. Scheduler hash-pinned specs may move only with a comment naming the cause.
  4. Time: the evaluator's `ms` per profile against #198's figures, within +10%.
  5. *Amended 2026-10-02 (owner): a dinner is a meal.*
     - A dish that is a snack or a breakfast by its own slots never fills lunch or dinner.
     - No dish is served above 2 servings at a main meal unless it was designed as a main.
     - A real plan served "Copa de yogur proteico con pistachos y mandarina" ×3 as dinner.
     - Add a spec, and an evaluator count of main meals filled by snack or breakfast dishes, which must be 0.
  6. *Amended 2026-10-02 (owner): add an evaluator profile like that real plan's person.* Three meals (morning snack, lunch, dinner), 2,079 kcal, protein 138 g. Its protein ran −3% to −15% on most days, so it joins the 14/14 target.
- **Stop if**: a fix needs a rule change the owner has not decided, or 14/14 is unreachable on a profile. In that case, write down why and which macro, and stop.
- **Verification**:
  - `docs/local/017-p3-{off,on}.json` at 182/182;
  - no allergen;
  - Scheduler specs;
  - `gate.sh --full`.

### Phase 4 — The cap, decided

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 017 phase 4`. `plan-evaluator` (opus @ high).
- **Covers**: PRD criterion 5.
- **Steps**:
  1. Make the pasta and rice cap hard, the way the protein rule's hard limits are enforced (a candidate past the cap is not placed while another fits). Evaluate off and on.
  2. Where a profile loses a day, keep the cap soft for that case: the macros win (owner). Prefer one rule for all (hard with a fallback when no dish fits) over per-profile switches.
  3. Write decision `0081`:
     - the rule chosen;
     - the profiles where the cap is exceeded and by how much;
     - the days kept.
  4. Mark the project done and update `docs/projects/000-workspace/LOG.md`.
- **Verification**:
  - `docs/local/017-p4-{off,on}.json`: 182/182, and pasta ≤ 4 and rice ≤ 4 on every profile, or as `0081` states;
  - `gate.sh --full`.

## Hand-off

- **Never Neon for measurement.** Every evaluator run and every e2e suite uses `pnpm db:local` with `NUTRIA_LOCAL_PG=1`. The only production read is phase 1's export, run once by the lead.
- **No production data change.**
  - No migration is expected.
  - If one becomes necessary, it is reviewed by `migration-reviewer` and the owner is told.
- **Scheduler output identity.** Phase 1 changes no behaviour, so its runs must be byte-identical to `main` apart from timings and the new report fields.
- **No `fable` for agents.**
- **Ordering.** Project 018 (more accompaniments) waits for this one, because new sides widen the same search.
