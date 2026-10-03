# Plan — Project 015: A plan waits for its day

> **Purpose**: the technical execution plan — the engineering half of the contract.
> `/execute-project` follows this literally; executors implement, they do not redesign.
> If implementation must diverge, the plan is amended in the same change and the
> deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes. **Written by**: a
> planner agent via `/plan-project`; approved by the owner before execution starts.
> Write repo-relative: no absolute paths, no references to other private repos.

- **Status**: approved
- **Type**: standard
- **PRD**: ./PRD.md
- **Routing profile**: tiered

## Design summary

**Two phases, because of Postgres.**
- A new `plan_status` value cannot be used in the transaction that adds it, and drizzle runs every pending migration in one transaction.
- `meal_plans_one_pending_review_per_user` is written as `NOT IN (…every other status)`, so a new value would silently join it (the comment at `plan.schema.ts`, `meal_plans` indexes).

Phase 1 therefore ships only the enum work in its own release. Phase 2 uses it.

**Reused from project 013 item 9:**
- the start-date body, the 422 and the person's-timezone today: the backend work left uncommitted in `.claude/worktrees/backend-traditional-spanish`;
- the web chooser: `agent/traditional-spanish/frontend` after ee8f20e6;
- the start-date e2e: d1164f23.

Each is adapted to the rule below, not taken as is.

**The rule** (PRD criterion 2), with A the active plan and S the requested start:
- `S > A.endDate` → next fortnight, free;
- `S ≤ A.endDate` → A is cut to `S − 1`, and a redo is counted;
- no A → a new fortnight;
- S after the person's today → the new plan is `scheduled`, otherwise `active`.

`core/domain/Allowance` gets the one pure function that decides this, and generation, the allowance view and the web read it.

## Phases

### Phase 1 — The `scheduled` status exists, and the review index no longer depends on the status list

- [x] done
- **Dispatch**: sonnet @ medium — `/execute-project 015 phase 1`. The `migration-reviewer` (opus · high) reviews.
- **Goal**:
  - Rewrite `meal_plans_one_pending_review_per_user` as `WHERE status = 'pending_review'`. That value is already committed, so this is safe in one migration: drop the index and create it again.
  - Append `'scheduled'` to `plan_status`.
  - Nothing uses the new value yet.
- **Scope**: `packages/database/src/schemas/_enums.ts`, `plan.schema.ts` (the index predicate and its comment), one migration with its meta, `schema.test.ts`.
- **Steps**:
  1. Write the migration: drop the index, create it with `= 'pending_review'`, then `ALTER TYPE … ADD VALUE 'scheduled'`. Regenerate the meta.
  2. Update `schema.test.ts`'s status-list guard to the new predicate.
  3. Run `node scripts/check-migrations.mjs --drift`.
  4. Have the migration reviewed.
- **Acceptance**: migration reviewed safe, with the old API unaffected, and gate green. *Amended:* the lock is ACCESS EXCLUSIVE on `meal_plans` until commit, so it also blocks reads and FK-checked inserts into plan_days, meals and plan_generation_jobs. That is milliseconds at today's size.
- **Verification**: `sh .claude/skills/ship/scripts/gate.sh --full <dir>`.

### Phase 2 — A plan waits for its day

- [x] done
- **Dispatch**: opus @ high — `/execute-project 015 phase 2`, run as `/team`:
  - `backend-high`: the allowance rule, generation, activation, the repository, vacations, events, the cron, and a migration adding `meal_plans_one_scheduled_per_user`;
  - `frontend`: the chooser, `/inicio`, `/compra`;
  - `tests`: e2e;
  - `migration-reviewer` and `invariant-reviewer`;
  - `accessibility`.
  - The allowance rule touches who may spend what, which sets the invariant-reviewer floor.
- **Goal**: PRD criteria 1–7.
- **Steps**:
  1. **Allowance.** A pure function `startMeaning(active, start, today)` returns `{ kind: 'new_fortnight' | 'redo', cuts: date | null, scheduled: boolean }`, with unit tests for each branch. `PlanController.allowances(…, true)` and the job's checks before and after the claim use it.
  2. **Generation.**
     - The body and the 422 come from 013's work.
     - `start` comes from the job, and the plan is written as `scheduled` or `active` by the rule.
     - When A is cut, its days after the cut are deleted with their meals, and its `endDate` becomes `S − 1`.
     - When a plan is already scheduled, it is replaced, and the replacement counts as a redo.
  3. **Activation.**
     - `PlanController.activateDue(userId, today)` runs at the start of every read of the active plan.
     - A cron, `/api/v1/cron/activate-plans` at 22:05 UTC (00:05 Madrid), with the existing cron auth, completes A (`completedAt` = S − 1) and activates every scheduled plan due.
     - It is idempotent and runs in one transaction per user.
  4. **Date readers.**
     - Add `scheduled` to `VacationRepository`'s `MOVABLE`.
     - Event loads take dates from the scheduled plan.
     - Allow swaps on a scheduled plan (`MealSwap.service.ts:83`).
     - Meal marks and mid-plan rebuild stay active-only.
     - Progress and admin counts treat `scheduled` as not yet started.
  5. **Web.**
     - The chooser is always shown. Its default is `A.endDate + 1` within range, else today, and each chip says "gratis" or "usa un rehacer".
     - `/inicio` gets a next-plan card.
     - `/compra` gets a current/next switch.
     - The empty /inicio state says when the scheduled plan starts.
  6. **e2e.** The criteria in PRD 6. For activation, call the cron route on a date-shifted plan; no fake system clock.
  7. **Docs.** A decision record, `ARCHITECTURE.md`, and project 013's item 9 marked superseded.
- **Verification**:
  - `gate.sh --full`;
  - the e2e suites;
  - the `/local-probe` screenshots;
  - the evaluator is not affected (no scheduler change), and `node --check` covers it.

## Hand-off

- **Migrations.** Phase 1 must be in production before phase 2 merges.
- **Numbering.** Migration numbers follow `main` at the time. The `feat/two-factor-removal` 0052 collision (see project 013's LOG) still applies to whoever merges second.
- **The care path is unchanged.**
- **No `fable` for agents.**

## Out of scope

- Professionals scheduling.
- More than one scheduled plan.
- Start notifications.
