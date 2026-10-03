# PRD — Project 018: More accompaniments

> **Purpose**: what this project delivers and why — the product half of the contract.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: the lead via
> `/plan-project`, from the owner's scope of 2026-10-02; approved by the owner on 2026-10-03.

- **Status**: delivered (2026-10-03)
- **Roadmap item**: follow-up to project 016 (queued in `docs/projects/000-workspace/LOG.md`, 2026-10-02)

## Problem

Project 016 shipped 46 accompaniments (10 starch, 15 vegetable, 21 dessert; 18 composed), written in code in `core/domain/Accompaniment`. They are thin where people eat most:
- Spanish sides that are missing: vegetable creams (calabacín, calabaza), caldo, roasted peppers, menestra, mushrooms, wholemeal bread, picos;
- the Asian, Latin and Arab families, with 2–3 options each;
- breakfast.

The same sides come back across a fortnight.

## Outcome

- A first batch of about 40 new accompaniments, Spanish first, then the thin families and breakfast.
- Each one comes with:
  - catalogue ingredients at fixed grams, from public sources (USDA FoodData Central; never BEDCA);
  - its role, meals, cuisine families and season;
  - names in es-ES and en-GB;
  - for a composed side, a one-sentence preparation line whose oil matches its portion.
- Plans keep every day in band and gain variety beside meals.

## Scope

**In:**
- the batch, drafted by an `architect`;
- any missing catalogue ingredients, through a reviewed data migration;
- the code entries;
- the web phrases;
- the evaluator's side-variety count.

**Out:**
- a database table or an `/admin` editor for accompaniments (revisit when the dietitian workspace is in real use);
- prompt changes;
- new rules.

## Acceptance criteria

1. About 40 new accompaniments are in `ACCOMPANIMENTS`. At least 15 are Spanish-family; each of the Asian, Latin and Arab families gains at least 3. *Amended 2026-10-03 (lead, owner's delegation):* no breakfast target. Sides are offered only at lunch and dinner above 700 kcal of share (`MAIN_SLOTS`, `0079`), so breakfast sides would never be served; the slots go to the thin families and to Spanish variety.
2. Every new entry has catalogue ingredients only. Any new ingredient comes from a USDA FoodData Central row, with its FDC id recorded, through a migration that passes `migration-reviewer`.
3. Every composed entry has es-ES and en-GB names and a preparation line, and every simple one has a web phrase. The existing coverage tests pass. The oil a preparation line names matches its portion.
4. On the reference library (`pnpm db:local reset --reference`, `NUTRIA_LOCAL_PG=1`):
   - 196/196 days in band, off and on;
   - 0 allergens;
   - 0 snack-at-main;
   - schedulePlan time within +10% of project 017's close;
   - distinct accompaniments per profile per fortnight go up.
5. No allergen reaches a side: the existing larder checks (allergies, intolerances, kosher, traditional Spanish exclusions) cover every new entry, and specs prove a milk, gluten and nut case.

## Decisions (owner, 2026-10-02 and 2026-10-03)

- **Method.** Batches in code. A model may draft candidates offline, but every entry is reviewed before it goes in. Sources are public (USDA), never BEDCA.
- **Review of the batch.** The owner delegated this on 2026-10-03 ("las decisiones anótalas con lo más recomendado"). The lead reviews the architect's batch against the criteria above and records each accept or reject in the LOG.

## Open questions

None.
