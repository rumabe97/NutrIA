# Plan — Project 018: More accompaniments

> **Purpose**: the phased technical execution plan, the engineering half of the
> contract. `/execute-project` follows this literally.
> **Audience**: agents primarily, humans review. **Committed**: yes. **Written by**: the
> lead via `/plan-project`; approved by the owner's delegation of 2026-10-03.

- **Status**: approved
- **Type**: standard
- **PRD**: ./PRD.md
- **Routing profile**: tiered

## Design summary

**The catalogue stays code**, the shape `0079` set. A batch is drafted and reviewed, any missing ingredients come in first through a reviewed data migration, and then the entries go in.

Starts after project 017 is merged, since 017 changes the scheduler these sides are priced in.

## Phases

### Phase 1 — The batch, drafted

- [ ] pending
- **Dispatch**: opus @ high — `architect` — `/execute-project 018 phase 1`.
- **Covers**: PRD criteria 1 and 2 (the design side).
- **Steps**:
  1. Read `core/domain/Accompaniment` (`ACCOMPANIMENTS`, `COMPOSED_NAMES`, `COMPOSED_PREPARATIONS`, `larderFor`), decision `0079`'s tables, and the catalogue (`packages/database/src/seed/ingredients/`).
  2. Draft about 40 entries in a report, `docs/reference/architecture/0009-more-accompaniments-<date>.md`, Spanish first (vegetable creams, caldo, roasted peppers, menestra, mushrooms, wholemeal bread, picos…), then Asian, Latin, Arab and breakfast. For each entry give:
     - key;
     - role, slots, families, months;
     - portion items (catalogue slug and grams);
     - kcal and macros computed from the catalogue;
     - es-ES and en-GB names;
     - a preparation line if composed (no oil unless the portion carries it, and then the exact amount).
  3. List every slug the catalogue lacks, with the USDA FoodData Central row proposed (FDC id and per-100 g values).
- **Verification**: the report exists; every slug is either in the catalogue or on the missing list.
- **Review**: the lead accepts or rejects each entry against the PRD (owner's delegation) and records it in LOG.md.

### Phase 2 — Missing ingredients

- [ ] pending
- **Dispatch**: opus @ medium — `backend` plus `migration-reviewer` (opus @ high) — `/execute-project 018 phase 2`. Skipped, with a LOG line, if phase 1 lists none.
- **Covers**: PRD criterion 2.
- **Steps**:
  1. Add the rows to the seed's ingredient files (`source: 'usda'`, FDC id), with allergen links and season months where they apply.
  2. Write a data migration inserting them into production's catalogue: idempotent, `ON CONFLICT (slug) DO NOTHING`.
  3. Have it reviewed by `migration-reviewer`.
- **Verification**:
  - `pnpm db:local reset --reference` (the migration applies);
  - `check-migrations`;
  - `gate.sh --full`.

### Phase 3 — The entries, live

- [ ] pending
- **Dispatch**: opus @ medium — `backend` and `frontend` (web phrases), `plan-evaluator` — `/execute-project 018 phase 3`.
- **Covers**: PRD criteria 1, 3, 4 and 5.
- **Steps**:
  1. Add the accepted entries to `ACCOMPANIMENTS`, `COMPOSED_NAMES` and `COMPOSED_PREPARATIONS`, and the web dictionary's `meal.accompanimentNames` in es-ES and en-GB.
  2. Specs:
     - milk, gluten and nut allergies never get the new sides that carry them;
     - traditional Spanish never gets a foreign one;
     - the existing coverage tests pass.
  3. Add to the evaluator: distinct accompaniments per profile per fortnight.
  4. Measure on the reference library, off and on, and compare with project 017's close.
- **Stop if**: a day is lost, an allergen appears, or time rises past +10%.
- **Verification**:
  - `docs/local/018-p3-{off,on}.json`;
  - `gate.sh --full`;
  - CI e2e.

## Hand-off

- **Never Neon for measurement.** Use `pnpm db:local` with `NUTRIA_LOCAL_PG=1`.
- **Production data only through phase 2's reviewed migration.**
- **No `fable` for agents.**
