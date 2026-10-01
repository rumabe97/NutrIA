# LOG — Project 014: A plate that weighs what it should

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

## Phase 1 — The gram ceiling and dry weights, end to end (2026-10-02)

- **Executor**: run as `/team`, with opus 5.5 as lead. `backend` (opus · medium), `frontend` (sonnet · medium), `accessibility-low` (sonnet). The lead ran the evaluator itself.
- **Result**: done. Step 6, the production simulation of a real profile, is owner-gated and runs after the deploy.
- **Evidence**:
  - **Backend.** Gate green. Core has 3,338 tests, with 26 new: 7 scheduler, 9 yield, 7 shopping list, 3 meal detail.
  - **Frontend.** Web lint, types and tests green (203) with backend merged.
  - **Evaluator** on bd4d018b vs `013-after.json` (main):
    - all 13 profiles are now 14/14 days in band; `objetivo-bajo-3-comidas` and `patron-kosher` went 13 → 14, the rest are the same;
    - **0 plates over the ceiling** across all profiles, and the heaviest plate is 750 g;
    - `imc-alto-2-comidas` averages 684 g at lunch and 663 g at dinner.
  - **e2e.** The local full run was stopped after its first suite, `admin`, failed on three environment-bound assertions: the dev `.env` has mail configured, and the dev catalogue's size moves a listing. They do not touch plans. CI's clean end-to-end run is the gate for merge.
  - **Accessibility.** No P0, P1 or P2. The dry line was rendered at 320 and 390 px. The real-page probe of `/plan/comida` and `/compra` was not run, because it needs the owner's dev account; the owner will check it on the phone after deploy.
  - **Design review.** Pass.
- **Deviations from plan**: the backend's eight small ones are in its hand-back and in the PR body. The shape of the contract is unchanged.
  - The en-GB names drop "cooked".
  - The shopping suffix follows the locale.
  - Only dry rows round up to 5 g, and a dry weight is never shown below 5 g.
  - The database package exports `./seed/ingredients` so a test can read it.
  - The meal page makes one more catalogue query, and only when a dry row is present.
  - Two scheduler fixtures were re-densified to the same macros.
- **Decisions**: [`0078`](../../decisions/0078-a-plate-has-a-gram-ceiling-and-cooked-grains-read-dry.md).
- **Notes**:
  - Alternatives of a cooked grain stay in cooked grams. Their names say "cocido", so they read consistently (P3, left).
  - The owner asked for the fuller answer next: plate + accompaniments, normal-serving dishes, a meal-count hint and per-food ceilings. That is project 016, under an `architect` study.
