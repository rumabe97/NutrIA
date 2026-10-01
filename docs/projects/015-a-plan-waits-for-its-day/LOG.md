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
