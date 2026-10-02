# 0080 — Measure the scheduler on a production-like local library

- **Status**: accepted
- **Date**: 2026-10-02
- **Project**: docs/projects/017-every-day-in-band

## Context

The evaluator's verdicts depend on the library it plans from.

- Project 016 measured on the dev database's ~2,200 recipes until that Neon project went over its quota. About 30 full-library reads in one day did it, and production shares the account.
- Since then the only library at hand is the local Postgres's 500 seed dishes. That library starts some profiles below 14/14, and it has none of the model-made dishes that broke the owner's production plan (small 4.6.0 servings, any pasta labelled "Italiana").

## Decision

- **The library.** Scheduler measurements run on the local Postgres (`pnpm db:local`, `NUTRIA_LOCAL_PG=1`), on a reference library: the seed dishes plus production's model-made recipes.
- **The export.** It is taken once, read-only:
  - recipes with `source = 'ai'` and their ingredients;
  - `created_by` dropped, and no user table read.
  - It is kept as `docs/local/reference-ai-recipes.sql` (gitignored, never committed), and loaded by `pnpm db:local reset --reference`.
- **Refreshing it** is a deliberate act, recorded in the project LOG that does it. Never more than once a project.

## Alternatives considered

- **Synthetic dishes that mimic the model's.** Rejected: they reproduce the failures someone already thought of, not the ones production has.
- **Measuring on production directly.** Rejected: bulk reads on the Neon account that serves users, against the rule of 2026-10-02.
- **The seed library alone.** Rejected: it lacks the model's dishes.

## Consequences

- One small production read per refresh.
- The reference file holds no personal data: recipes and ingredients, without their maker.
- Recipes are public-facing content, but the file stays local, because it is large and specific to one moment.
- Evaluator numbers before and after this record are not comparable. Each project records its own baseline on the reference library.
