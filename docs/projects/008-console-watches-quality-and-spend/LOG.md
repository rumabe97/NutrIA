# LOG — Project 008: The console watches quality and spend

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


## Phase 1 — Start recording (2026-09-29)

- **Executor**: the `backend-high` agent (opus, high) for core and the API, in its own
  worktree, brought into the main checkout and removed. The `tests` agent (medium) wrote
  the end-to-end cases, also in its own worktree. The lead (opus, this session) put in the
  dictionary labels, the Embudo colour for `app_used`, `deployment.md`, and the review
  fixes below. Reviews: `invariant-reviewer`, and `plan-evaluator` on the floor definition.
- **Result**: done.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web`: 17/17 tasks;
    api 987 tests. Rerun for core and api after the review fixes: 11/11.
  - **The session hook fires on renewal**, so the fallback was not needed.
    `apps/api/src/modules/auth/SessionRenewal.spec.ts` runs the real Better Auth and the
    real `SessionGuard` on an in-memory adapter. A session two days old is renewed and
    records one use; a fresh one records none; a failing counter still lets the request
    through.
  - End-to-end, local, `VAPID_*` blank, on the final diff: `admin` 55/55 and the new
    `system-events` 5/5. `mail_sent` and a swap's `feature: 'swap'` cannot be
    reached end to end (`SMTP_*` is empty in every suite; a swap calls the model only when
    no stored dish fits). Their unit specs cover them.
  - `invariant-reviewer`: **no P0 or P1.** System events carry no user, `mail_sent` no
    recipient, `quality` no target, figure or name, and the generation log selects only
    `planOf`'s keys in SQL. Its two P2s and one P3 are fixed:
    - the lock no longer waits: `pg_try_advisory_xact_lock`, and a renewal that does not
      get it writes nothing, since the holder is about to write the row;
    - the hook has its own `.catch`, so a counter can never make a renewal a 500;
    - the repository says what the transaction costs, and where it must never run.
    Left for later (P3): `record` still accepts a user id on a system event. Every writer
    passes null and is tested.
  - `plan-evaluator`, on the dev library: `objetivo-bajo-3-comidas` 13/14 days in band
    (the one miss is carbs on day 9), `patron-vegetariano` 14/14.
- **Deviations from plan**:
  1. **`daysUnderFloorBand` is not recorded (the step 7 stop signal).** As coded, it
     counted days whose band the floor narrows. That is every day of a small target
     (14 for `objetivo-bajo`, against 13 days in band), not the days the floor bounded.
     The field moves to phase 5, with the evaluator's two candidate definitions. The plan
     and `0071` are amended.
  2. `objetivo-bajo` is 13/14 in band, not the 12/14 the memory of #68/#69 held.
     `docs/projects/005-meal-and-season-catalogue/LOG.md` already said 13.
- **Decisions**: [`0071`](../../decisions/0071-the-service-records-what-leaves-no-row-and-the-console-watches-it.md)
  (amended: the floor field from phase 5).
- **Notes for the next phase**:
  - From this deployment on, `analytics_events` holds `app_used`, `cron_run`,
    `mail_sent` and `ai_call.properties.feature`, and `generation_metadata.quality` is on
    new plans. Nothing before it has them: every page built on them says from when.
  - Phase 3 reads "active" as `session_started` ∪ `app_used`. Embudo already charts only
    `PRODUCT_EVENTS`, and `app_used` has its labels and colour.
  - Reminders now write one `notifications` row per channel: a count of rows is a count
    of sends, not of reminders.
  - Two `billing-…@e2e.invalid` accounts on the dev database make the e2e global teardown
    complain. The owner decides on deleting them.
