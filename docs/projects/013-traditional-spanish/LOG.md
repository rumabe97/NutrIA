# LOG — Project 013: Traditional Spanish

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

## Phase 1, first delivery — Traditional Spanish (2026-10-01)

- **Executor**: run as `/team`. The lead was opus 5.5 at high effort.
  - `backend-high` (opus): two spawns. The first did not pick up the owner's prompt decision after two messages, so it was stopped and replaced on the same branch.
  - `frontend` (sonnet · medium), `tests` (sonnet · medium), `legal` (sonnet) and `accessibility-low` (sonnet).
  - `migration-reviewer` and `invariant-reviewer` (opus · high), and `plan-evaluator`.
  - After a machine shutdown killed the team, the lead ran the last machine checks (gate, e2e, evaluator) by script.
- **Result**: done for PLAN items 1–8. Item 9 (start date) ships in a second pull request. The owner then asked for it to be offered always, with a scheduled plan: that is a plan amendment still to be written.
- **Evidence**:
  - **Gate.** `gate.sh --full` green on 297916fe: migrations, lint, types, tests with coverage, web build, static pages, format, dead code, leaks.
  - **e2e.** traditional-spanish, onboarding, preferences and generation: 4 suites, 24/24 passed on 3369e2b2. Migration 0052 was applied to the test database.
  - **Evaluator.** On 3369e2b2, compared with `012-after.json`:
    - all 12 existing profiles are "the same";
    - `patron-tradicional-espanola` is 14/14 days inside 5%, with 0 excluded rows, 0 foreign cuisines and 0 foreign names on plates;
    - it has 8 lunches and dinners with legumes and 16 with fish (PRD asks ≥8 and ≥6);
    - its plate shares run 0.71–1.33.
    - For reference, the profiles without the pattern carry 17–63 excluded rows and 2–12 foreign-cuisine plates a fortnight.
  - **Reviews.**
    - `migration-reviewer`: 0052 safe. One P1 on merge order with `feat/two-factor-removal`, which also has a 0052 with an older `when`: whichever merges second must regenerate as 0053. Since the test database now has this 0052, that branch must regenerate before migrating dev too.
    - `invariant-reviewer`: one P0, the prompt naming the pattern, fixed in e0592fe5. The prompt is byte-identical with and without the pattern, and a spec pins it. One P3 was fixed. Nothing else.
    - `accessibility`: no P0 or P1. The P2 (the hint not tied to its fieldset) is fixed and measured.
    - Design review: pass.
- **Deviations from plan**:
  - The owner decided the model is not told about the pattern, which amended items 4 and 7. Privacy and consent texts are unchanged; `legal` confirmed nothing becomes untrue.
  - The lean is kept out of the prompt's liked foods (`leaningIngredientSlugs`). `breaksPatternDish` reads a preference flag. Legumes are matched by slug head, and `judias-rojas` was added.
  - Range and format refusals for item 9 will be 422 `INVALID_INPUT`.
- **Decisions**: [`0077`](../../decisions/0077-traditional-spanish-is-a-way-of-eating-enforced-in-code.md), plus `decisions/LOG.md` lines.
- **Notes for the next delivery**:
  - Item 9's backend is uncommitted in `.claude/worktrees/backend-traditional-spanish`.
  - Its web part is on `agent/traditional-spanish/frontend` after ee8f20e6, and its e2e is d1164f23.
  - The owner's new request (always offer a start date, with a scheduled plan) needs a plan amendment first.

## Closing (2026-10-08)

- **Closed** on 2026-10-08 at the owner's request, after the closing audit
  ([`closing-audit-2026-10-08.md`](../000-workspace/closing-audit-2026-10-08.md)).
  Anything found later is a new change, not a reopening.
- **Shipped:**
  - #187: items 1–8, migration 0052 and `0077`;
  - #209: a dish whose cuisine family is foreign (Turca, Cubana…) is refused too.
- **Item 9 is superseded.** The owner asked for the start date on every generation. It
  became project 015 (#189, #191), which reused this item's work. The notes above about
  an uncommitted worktree are stale. PRD criterion 8 is marked superseded, as 015's
  criterion 7 asked.
- **PRD criteria:** 1–7 met on #187 (LOG above).
