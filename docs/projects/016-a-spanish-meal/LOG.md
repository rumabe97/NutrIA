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
