# LOG — Project 015: A plan waits for its day

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

## Phase 1 — The `scheduled` status exists, and the review index no longer depends on the status list (2026-10-02)

- **Executor**: `backend` (sonnet · medium) as `backend-015`, and `migration-reviewer` (opus · high).
- **Result**: done.
- **Evidence**:
  - Migration `0053_a_plan_can_be_scheduled.sql`, in drizzle-kit's generated order: `ADD VALUE 'scheduled'`, then drop and recreate `meal_plans_one_pending_review_per_user` as `WHERE status = 'pending_review'`.
  - `check-migrations --drift`: 1 new, 54 in all, schema and migrations agree. Gate green.
  - Review: safe to ship, nothing at P0 or P1.
    - There is no window without uniqueness: one transaction, with ACCESS EXCLUSIVE on `meal_plans` until commit.
    - The new predicate selects exactly the old rows (`status` is NOT NULL, and NOT IN the other six values of a seven-value enum is `= 'pending_review'`).
    - 'scheduled' is unused, and the rollback is clean.
- **Deviations from plan**:
  - The acceptance line was amended about the lock.
  - The P3 (statements reordered by hand) was fixed by restoring the generated order, with a comment.
- **Open, not this phase's**:
  - P2: the migrate step sets no `lock_timeout`. A task for the deploy recipe.
  - The 0052 collision with `feat/two-factor-removal` still applies to whichever merges second.
- **Notes for the next phase**: phase 1 must be deployed before phase 2 merges.

## Phase 2 — A plan waits for its day (2026-10-02)

- **Executor**: run as `/team`, with opus 5.5 as lead.
  - `backend-high` (opus) as `backend-p2`, `frontend` (sonnet · medium) as `frontend-p2`, `tests` (sonnet · medium) as `tests-p2`.
  - `migration-reviewer-p2` and `invariant-reviewer-p2` (opus · high), and `accessibility-low` (sonnet) as `accessibility-p2`.
  - The earlier start-date work of project 013 item 9 was reused and adapted.
- **Result**: done (merge pending CI).
- **Evidence**:
  - **Migration 0054.**
    - It adds `plan_generation_jobs.start_date` (nullable) and the partial unique index `meal_plans_one_scheduled_per_user`.
    - Review: no P0. The P1 (a stale scheduled plan after a rollback) is fixed: an older scheduled plan is deleted on activation, never activated, with a test. The P3 comment is done.
    - It depends on 0053 being deployed first, which is true since #189. The two migrations cannot share one migrator transaction.
  - **Invariant review**, on a84f4883..30356293: nothing holds the merge.
    - **P1, the redo-allowance dodge**, by alternating a cutting start and a replacing start (≈6–12 generations a fortnight on the free tier). Fixed: while a plan waits, every start counts the waiting plan's chain, and a cut also counts the running plan's chain, the larger deciding. A replaced waiting plan carries what it spent. The reviewer's walk-through is a unit test, and the e2e caught it too.
    - **P2s, fixed:**
      - a professional's generation was refused because of a waiting plan;
      - publishing over a scheduled plan (owner decision (a): the scheduled plan is deleted at publish, at no charge);
      - the cron moved to 23:05 UTC;
      - the cut plan's list is rebuilt only when every kept food resolves, otherwise it is left as it stands.
    - **P3, accepted as deliberate (strict side):** after a scheduled-plan replacement has spent the next fortnight's redo, a cut of the current plan is refused.
  - **Backend.** Gate green: core 3,378+, api 1,389+.
  - **Web.** Lint, types and tests green (206). Design review pass.
  - **Accessibility probe.** Six screens at 320, 390 and 1280 px, light and dark, with keyboard: no P0, P1 or P2. The one P3 (an empty tick circle on the upcoming plan) is fixed.
- **Deviations from plan**:
  - Trips shift only the newly created plan.
  - A replaced scheduled plan is deleted.
  - Cutting A returns its swaps on the deleted days.
  - Activation also runs on allowances and the scheduled reads.
  - The midnight-crossing cut heals on read.
  - Next-plan screens are `/plan/proximo` and `/compra/proxima`, so the offline copy is never overwritten.
- **Decisions**: `decisions/LOG.md` lines of 2026-10-02 (the project, and the care-path publish).

## Closing (2026-10-08)

- **Closed** on 2026-10-08 at the owner's request, after the closing audit
  ([`closing-audit-2026-10-08.md`](../000-workspace/closing-audit-2026-10-08.md)).
  Anything found later is a new change, not a reopening.
- **Shipped:**
  - #189: phase 1, migration 0053;
  - #191: phase 2, migration 0054.
- **PRD criterion 7, finished in the closing change:** project 013's start-date item is
  marked superseded, and `ARCHITECTURE.md` names the `scheduled` state beside the review
  state.
- **Handed on, not this project's:** the migrate step sets no `lock_timeout` (P2 of phase
  1's review), a task for the deploy recipe.
