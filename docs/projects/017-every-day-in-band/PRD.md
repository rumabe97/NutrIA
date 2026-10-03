# PRD — Project 017: Every day in band, every starch counted

> **Purpose**: what this project delivers and why — the product half of the contract.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project`, from the owner's scope of 2026-10-02; approved by the owner before the
> plan is written.

- **Status**: delivered
- **Roadmap item**: follow-up to project 016 (scheduler tuning, queued in `docs/projects/000-workspace/LOG.md`, 2026-10-02)

## Problem

Project 016 shipped Spanish meals: accompaniments, a per-food ceiling, dishes for one person, and pasta and rice at lunch with a fortnightly cap. Three gaps remain.

1. **Days out of band.**
   - Phase 7 cost two evaluator profiles one day each with accompaniments on: `objetivo-bajo-3-comidas` (protein +5.4%) and `objetivo-alto-5-comidas` (protein +5.1%).
   - The owner's standing rule is all four macros within ±5% every day.
2. **Starch the rule cannot see.** The owner's production plan (v15, 2026-10-02, generated after phase 7 shipped) had:
   - pasta on 6 of 14 days, two of them running;
   - a pasta dinner (an "Italiana" dish with 80 g of cooked pasta), a couscous dinner (a "Mediterránea" dish with 70 g of cooked couscous) and two gnocchi dinners.

   The cause:
   - The food-group threshold (`FOOD_GROUP_GRAMS`, 40 g dry a serving) is above what the smaller 4.6.0 dishes carry: 80 g of cooked pasta is about 36 g dry.
   - `noquis` is in no group.

   A draft fix (20 g, plus gnocchi) lost two days a mode on the local evaluator, and its counts are not comparable with the old ones, because what counts as pasta changed.
3. **A soft cap.** Pasta and rice are capped at 4 a fortnight by price, not by rule. Rice still reaches 5–6 on some profiles.

All of this was measured on whatever library was at hand. The dev database had about 2,200 recipes and is now over its Neon quota. The local database has only the 500 seed dishes, with none of the model's dishes that production is full of. A measurement that doesn't look like production can't settle these questions.

## Outcome

- A reference library on the local Postgres that looks like production's (seed plus model-made dishes), loaded by one command. Every evaluator run in this project uses it.
- The evaluator reports pasta, rice and other starch at dinner per cuisine family, so a rise can be told apart as allowed (Asian) or a leak.
- Starch is recognised in the dishes production actually serves: small servings and gnocchi.
- Every evaluator profile is 14/14 days with all four macros within ±5%, with accompaniments on and off.
- The pasta and rice cap is either made hard or deliberately kept soft, decided on measured days in band.

## Scope

**In:**
- the reference library and its loader;
- the evaluator's per-family starch report;
- starch recognition (threshold and missing slugs);
- the scheduler changes that bring back the lost days;
- the cap decision;
- decision records.

**Out:**
- generation speed (shipped in #198);
- new accompaniments (project 018, queued);
- prompt changes;
- any production data change;
- Neon for any measurement (the owner's rule since 2026-10-02: local Postgres only).

## Acceptance criteria

1. `pnpm db:local reset` (or a sibling command) loads the reference library. Its composition is stated: recipes by source, by slot and by cuisine family.
2. The evaluator reports, per profile, pasta, rice, grains and gnocchi at lunch and at dinner by cuisine family, plus the consecutive-day repeats. A baseline run on the reference library is recorded before any rule changes.
3. The four production dishes above are recognised as pasta, grains or gnocchi and are lunch-only in Spanish, Mediterranean and Italian. No dinner outside the Asian family carries pasta or rice on any profile.
4. On the reference library, every evaluator profile is 14/14 days within ±5% on all four macros, with accompaniments off and on, and no allergen reaches a plate.
5. Pasta and rice stay within 4 each a fortnight on every profile, or a decision record states why the cap stays soft and by how much it is exceeded.
6. Plan generation time with accompaniments on stays within 10% of the post-#198 figures.

## Decisions (owner, 2026-10-02)

1. **Reference library: option (a).** A one-time, read-only export of production's model-made recipes and their ingredients, without `created_by`. It is kept under `docs/local/` (gitignored) and loaded into the local Postgres.
2. **The macros win.** Where a hard pasta/rice cap would cost a day in band, the cap stays soft for that case, and the decision record names the profiles and the excess.

## Open questions

None.
