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
