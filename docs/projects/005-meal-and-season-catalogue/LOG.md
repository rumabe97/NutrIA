# LOG — Project 005: Each meal sees its own foods, in season

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

## Phase 1 — The two columns, empty (2026-09-25)

- **Executor**: `backend` agent on opus (definition effort `medium`), in its own worktree;
  brought into the main checkout and the worktree removed. Migration reviewed by
  `migration-reviewer` (opus @ high).
- **Result**: done.
- **Evidence**:
  - Migration `0041_an_ingredient_names_its_meals_and_season.sql` is exactly two statements:
    `ALTER TABLE "ingredients" ADD COLUMN "meal_slots" text[] DEFAULT '{}' NOT NULL` and
    `… "season_months" smallint[] DEFAULT '{}' NOT NULL`. Re-running `generate` reports no
    schema changes; journal and snapshot chain intact (0041 points back to 0040).
  - `migration-reviewer`: no P0/P1/P2. No data lost; a metadata-only column add (constant
    default, no rewrite), lock held for milliseconds; the old API survives the deploy
    (it names its columns and never inserts ingredients); a code rollback needs no schema
    change. The seed against a 0040 database fails loudly at the first ingredient insert,
    before any partial write beyond the idempotent allergens upsert — `migrate` first.
  - `pnpm turbo lint ts:check test`: 21 of 21 tasks (core 717 tests, api 741, database 29).
  - `gate.sh --full`: migrations, checks, web-build, static, format, deadcode, leaks — green.
- **Deviations from plan**:
  - `PlanRepository` never builds a `CatalogueIngredient`; `RecipeRepository.loadCatalogue`
    is the only builder. The phase's Scope is amended to say so.
  - The seed types `MealSlot` from the database's own `meal_slot` pgEnum: `core` depends on
    `database`, so importing it from `core` would reverse the chain.
  - Fixtures in `apps/api/src` (five specs) needed the two fields too; the Scope now names
    them. `PoolPrompt.spec.ts:208` casts a partial `{ category, name, slug }` object and was
    left as it is — nothing reads the new fields there yet.
- **Decisions**: none new ([`0062`](../../decisions/0062-each-meal-sees-its-own-foods-and-the-season.md) stands).
- **Notes for the next phase**:
  - Both overlays are empty maps: `ONLY_AT` in `seed/ingredients/meals.ts`, `IN_SEASON` in
    `seed/ingredients/seasons.ts`. Phase 2 fills them.
  - Neither column is checked in the database (`text[]`, not the enum; no 1–12 check): only
    the seed writes them, through TypeScript types. Phase 2's tests are the check.
  - Phase 3 will make `PoolPrompt.spec.ts:208`'s partial fixture need both fields.
  - Owner-gated before phase 2 can be measured: `pnpm --filter database migrate`, then
    `pnpm --filter database seed`, against the dev database.
