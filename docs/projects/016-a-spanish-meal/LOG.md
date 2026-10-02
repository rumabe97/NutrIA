# LOG — Project 016: A Spanish meal

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

## Phase 0 — Measure 014 (2026-10-02)

- **Executor**: the lead. The owner ran the read-only simulation (`simulate-pro.mjs`, kept outside the repository) on the production library for their own profile: two main meals and a light snack, 2,177 kcal.
- **Result**: done for the simulation. The evaluator extension moved to phase 1.
- **Evidence**, measured on the 014 code now in production (9820f627):

  | | Owner's live plan (pre-014) | 014, rotation pool (50 dishes) | 014, whole library (198) |
  |---|---|---|---|
  | Days inside 5% | 14/14 | **3/14** | 11/14 |
  | Worst deviation | — | kcal 18.9%, fat 38.5% | fat 19.0% |
  | Lunch grams, mean / max | 829 / 1,351 | 667 / 755 | 687 / 748 |
  | Dinner grams, mean / max | 954 / 1,371 | 722 / 1,096 (floor) | 639 / 748 |
  | Most potato or boniato in one plate | 925 g | 481 g | 481 g |
  | Servings | up to ×3 | up to ×2.25 | up to ×2.25 |
  | Time | — | 151 ms | 119 ms |

  Real generation also adds fresh dishes, so it falls between the two 014 columns.
- **Decision** (owner, 2026-10-02, on the lead's recommendation):
  - **Reorder:** C, then A, then D (only if still needed), then B.
  - **Scale the gram ceiling for main meals over 950 kcal,** up to 900 g, until accompaniments are on. The ±5% promise outranks a flat 750 g for two-meal people.
  - The phase 0 stop condition ("014 alone is enough") did not hold. The opposite holds: A is what restores the macro fit.

## Phase 1 — The choice before generating (C), and a scaled weight ceiling (2026-10-02)

- **Executor**: run as `/team`, with opus 5.5 as lead. `backend-016` (opus · medium; consulted the advisor twice), `frontend-016` (sonnet · medium) and `accessibility-016` (sonnet · low).
- **Result**: done.
- **Evidence**:
  - **Core and API.**
    - `mealShareKcal` and `mainMealSize`, with `LARGE_MEAL_KCAL` = 850.
    - `mealSize: MealSizeView | null` on `/meal-plans/allowances` and `/profile`. It is null while there are no targets.
    - `plateGramsMax(slot, budgetKcal)`: 750 g up to 950 kcal, then share ÷ 950, capped at 900 g. Marked temporary.
    - Unit tests: 900 kcal → 750 g, 1,050 → 828.9 g, 1,400 → 900 g, snacks unchanged, the floor still the only way past.
    - Core has 3,351 tests and the API 1,380. Gate green.
  - **The 14 → 13 regression, caught by the stop rule and fixed.**
    - The first backend commit rewrote `slotBudgets` as kcal × (weight ÷ total). One floating-point bit pushed a borderline day of `objetivo-bajo-3-comidas` out of band.
    - c5c6ac47 restores the base expression byte for byte, and `mealShareKcal` uses the same form.
    - The lead's interim "library drift" reading was wrong and is withdrawn.
  - **Evaluator vs `014-after`:**
    - 13/13 profiles 14/14, no unsafe plate, 0 plates over their (scaled) ceiling;
    - `imc-alto-2-comidas`: lunch 742 g mean, 825 g max, and dinner 642 g mean;
    - 0.97–5.4 s per profile;
    - the servings histogram, grams per food group and time are now reported.
  - **Owner's production simulation** on this code (read-only):
    - whole library: 13/14 days in band (014: 11/14), worst fat 7.4%;
    - rotation-only: 6/14 (014: 3/14);
    - lunch 724 g mean and 842 g max, dinner 692 g and 770 g;
    - potato or boniato 481 g max.
  - **Web.** Web lint, types and tests green (205). Design review pass, with one P2 fixed (the heading level on /perfil).
  - **Accessibility.** No P0, P1 or P2. Probed at 320, 390 and 1280 px, light and dark, and at 200% text, with a throwaway account that showed the note (1,098 kcal):
    - the outline, targets, order and focus are right;
    - the dismissal is announced;
    - the `?volver=generando` round trip returns.
  - **Three P3s, left:**
    - the generando actions sit outside the note's section;
    - the button widths differ;
    - en-GB was not reachable at signed-in routes.
- **Deviations from plan**:
  - `mealSize` is nullable.
  - "Seguir así" is the screen's primary because it is the generate action. Its accessible name is "Seguir así y generar mi plan".
  - The allowances read now makes five parallel reads for the meal size.
- **Notes for the next phase**:
  - Phase 2 is accompaniments in the domain, behind a flag.
  - Base for the evaluator: `016-p1.json`.
  - The owner's rotation-only run (6/14) is the number A must lift.

## Phase 2 — Design: cuisine families, meal fit by cuisine, accompaniments by cuisine (2026-10-02)

- **Executor**: `architect` (opus · high) as `architect-016`. It drafted the tables with sources it read and measured them read-only on the dev database, behind `guard.mjs`.
- **Result**: done. The owner approved all nine answers. Decision [`0079`](../../decisions/0079-meals-fit-by-cuisine-and-accompaniments-by-cuisine.md) is accepted.
- **Evidence** (dev, excluding 906 end-to-end leftover recipes):
  - Dinners servable: 310 → 198 (omnivore), 199 → 129 (`traditional_spanish`), 74 → 57 (vegan, keeping the `0062` §4 pulse exception).
  - Worst profile (traditional_spanish, coeliac, no milk): 81 dinners.
  - No slot is pushed below the 19 a fortnight needs.
- **Decisions**:
  - **Six families.** A null or unmapped cuisine is read as Spanish, the strictest, so a mislabel can only lose a meal.
  - **Five food groups**, recognised by slug and dry grams (40 g by `0078`'s yields). "Fried" and "heavy sauce" were dropped as unrecognisable from the data.
  - **The table widens as well as narrows.**
  - **The dish's family sets the accompaniments.** Cheese and nuts are breakfast-only, and season is a hard filter for accompaniments.
  - **No BEDCA** (owner): sources and macros are USDA FoodData Central. The 14 BEDCA-sourced catalogue rows are re-sourced in a queued task (`000-workspace` LOG). `queso-de-burgos` (breakfast only) is the one accompaniment still on such a row.
- **Notes for the next phase**:
  - Phase 3 implements 0079 tables 1–3 literally. Phase 7's step 1 is superseded.
  - Dev holds 906 end-to-end leftover recipes that inflate library counts: a cleanup for dev data, not this project.

## Phase 3 — Meal fit by cuisine, and accompaniments in the domain behind a flag (2026-10-02)

- **Executor**: run as `/team`.
  - `backend-high` (opus) as `backend-a`. The machine restarted and lost the team, so `backend-a2` resumed its uncommitted fixes from the worktree.
  - `frontend-low` (sonnet) as `frontend-a`.
  - `invariant-reviewer` (opus · high), twice.
- **Result**: done.
- **Evidence**:
  - **What was built.**
    - `0079` tables 1–2 in core: the family normaliser, and meal fit by family and food group, widening and narrowing, always on.
    - `core/domain/Accompaniment`: `0079` table 3, filtered per person through `dishSafety`, exclusions (`traditional_spanish`, dislikes, free-from), unresolved labels (ingredients and the side's own name), season (hard), slot and family. Kosher is checked on the dish plus the whole set (`setsBeside`).
    - Sets are chosen inside `balancedDay` at K = 6 above 700 kcal of share, with a soft cost outside 0.75–1.5 servings.
    - `ScheduledMeal.accompaniments`, with macros and ingredients covering the whole meal.
    - The `accompaniments` flag, admin-only and off. With it off, plans are byte-identical, pinned by hashes.
    - `mealSizeSuggestion` and the web note naming the change ("Si añades un desayuno, tu comida bajaría a unas 745 kcal").
  - **Gate:** core 3,535 tests and api 1,392, lint at max-warnings 0. The web flag label comes from `frontend-a`.
  - **Evaluator, flag off** vs `016-p1`: 13/13 profiles the same, 14/14 days, no allergen.
  - **Evaluator, flag on** vs off:
    - 13/13 profiles 14/14 days, no allergen.
    - Mains within 0.75–1.5 servings rise on every profile; `imc-alto-2-comidas` goes 17 → 27 of 28.
    - That profile's plate falls from 821 to 733 g max, with lunch and dinner means of 563 and 515 g. Meals with their sides average 716 and 706 g.
    - 89% of its mains carry a side. Sides average 20.9% of the meal's energy, with a maximum of 34.4% on this profile but up to 54% on others; phase 4 caps it at 35%.
    - Time per profile is 1.6–13.1 s, the worst being five meals with a high target.
  - **Invariant review of 9cac67bf:** no P0 or P1. P2-1 (kosher on the whole set), P2-2 (side names against unresolved typed allergies) and the P3 comment were fixed in f0a043fb. P2-3 (phase 4 wiring) is a TODO in phase 4's steps.
- **Deviations**:
  - Fit by cuisine is always on, not behind the flag, as `0079` intended.
  - The flag is an admin setting.
- **Notes for the next phase**:
  - Persist and show the sides.
  - Cap their share at 35%.
  - Wire the larder from the generation context.
  - Return the gram ceiling to a flat 750 g when the flag turns on.

## Phase 5 — No plate holds more than two servings of one food (D) (2026-10-02)

- **Executor**: `backend-d` (opus · medium) in `/team`.
- **Result**: done.
- **Evidence**:
  - **What was built.**
    - `core/domain/PlateFood`: `PLATE_FOOD_MAX` (meat 250 g, fish 300 g, cooked legume 400 g, grain 160 g dry, potato 400 g), recognised as `0008` § D says. `plateFoodMax` scales a meal past 1,100 kcal of share by share ÷ 1,100; snacks and supper never scale.
    - Checked inside `withinPlateLimit`, so the schedule, swaps (`pickReplacement`) and event rebuilds hold it, flag on or off. The energy floor still outranks it.
    - The evaluator counts plates over each ceiling with core's own recogniser.
  - **Tests.** Unit tests for the table, the recogniser and the scaling, and through `pickReplacement` and `schedulePlan`, the floor included. Mutation checks: lifting the potato ceiling fails 6 tests, and unplugging it from `withinPlateLimit` fails 3. One hash pinned by phase 3 moved on purpose (five meals at 1.8×, a chicken plate over 250 g) and was re-pinned.
  - **Evaluator** (`016-p5-off` vs `016-p3-off`, `016-p5-on` vs `016-p4-on`):
    - 13/13 profiles 14/14 days, flag off and on. No allergen, no blocking.
    - Plates over a ceiling: 0 flag off and on.
    - Heaviest plate per food, flag off: potato 500 → 400, meat 360 → 240, fish 375 → 300, legumes 438 → 410 (a scaled share), grains 160 → 157.
    - Flag on: potato 450 → 400, legumes 313 → 375, meat 240 → 225, fish 285, grains 138.
    - Mains within 0.75–1.5 servings: flag off 276 → 283 of 364, flag on 356 → 357. `objetivo-alto-5-comidas` flag off 10 → 6 of 28.
    - Time per profile: at most 2.8 s off and 13.1 s on.
- **Deviations**: grain counts the cooked slugs of `0078`'s yield table only, as the evaluator did. A dry grain in a recipe is not counted.

## 2026-10-02 — Project closed

- Shipped:
  - #190: phase 1;
  - #192: phases 2–3;
  - #193: phase 4;
  - #194: phase 5, plus the admin switch;
  - #195: phase 6 and migration 0056;
  - #196: phase 7.
- The `accompaniments` flag is on in production (owner).
- Left open, for the owner:
  - two weeks of watching `oversized` and `unwanted` in the console (phase 6 step 4);
  - running `migrate` on Nutria-E2E for 0055 and 0056;
  - checking VoiceOver on the "+" and the side headings, on the iPhone.
- Carried to the next project ("scheduler tuning", queued in the workspace LOG):
  - generation is slow with accompaniments on (35–110 s of CPU per plan in the e2e harness, against about 19 s off); the speed-up branch `agent/sides-perf/backend-h` is in progress;
  - the two days phase 7 lost with the flag on (`objetivo-bajo-3-comidas` and `objetivo-alto-5-comidas`, protein 5.4% and 5.1%);
  - whether the starch cap becomes hard;
  - the e2e suite speed-up waiting on that work (`agent/sides-speed/tests-g` at 724e3870).
- Next by owner decision: project 017, more accompaniments.
