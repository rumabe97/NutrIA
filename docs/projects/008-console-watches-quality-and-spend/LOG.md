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

## Phase 2 — The admin audit log (2026-09-29)

- **Executor**: the `backend` agent (medium) wrote the migration, the writes and
  `GET /admin/audit`. A second `backend` agent (medium) made the review fixes. The
  `frontend` agent (medium) built the page, and the `tests` agent (medium) wrote the end to
  end. Each worked in its own worktree, which was brought into the main checkout and
  removed. The lead (opus, this session) renamed and commented the migration, fixed
  `account.mjs`, the accessibility P2 and 0071's wording, and applied 0048 on the dev
  branch with the owner's yes. Reviews: `migration-reviewer` (opus, high),
  `invariant-reviewer`, `accessibility`.
- **Result**: done.
- **Evidence**:
  - `pnpm --filter database generate` finds nothing more ("No schema changes"), and
    `node scripts/check-migrations.mjs` passes: 49 migrations, journal and snapshots in
    order.
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api --filter=web`:
    17/17 tasks; api 993 tests.
  - End-to-end, local, `VAPID_*` blank, dev branch with 0048 applied, one suite at a time,
    346/346 over 12 suites. The new `audit` suite passes 15/15, `admin` 55/55 and
    `access` 8/8. The rest are the suites whose direct core calls now pass `UNAUDITED`.
    - `audit` covers every route and the automatic activation (one row each, with its
      actor, subject and metadata). The automatic one goes through a real sign-up and
      email confirmation.
    - It also covers: a 404 writes nothing; deletion leaves `subject_user_id` null; no
      row carries an `ip_hash`; and the read contract (404 before validation, 422, exact
      keys, filter, newest first, paging).
    - With push unconfigured, `push.test_sent` writes no row.
  - `migration-reviewer`: no P0–P2. Both P3s are fixed: the file now has a descriptive
    name, and a comment explains the locks.
  - `invariant-reviewer`: no P0 or P1. Its P2 and P3s are fixed:
    - the audit argument is now required: `UNAUDITED` is the only way to skip it, and a
      spec proves `apps/api/src` never uses it;
    - activation is a union type, so `console` needs an actor and the others must have
      none;
    - an activation by email takes its subject from `RETURNING`;
    - activating an already-active account, or setting the same tier, writes no row;
    - a failed audit write after a delivered push is logged, not answered as a failure.
  - `accessibility`: 320/390/1280, light and dark, and 200 % text at 320 show no sideways
    scroll, and the filter's label, the live count and focus are right. Its P2 is fixed:
    the toolbar was a search landmark named "Buscar y filtrar" on a table with no search.
    With no search field, `AdminTableForm` now drops `role="search"`, and the toolbar
    reads "Filtrar" and "Quitar los filtros". An activation with no actor names how it
    happened in the actor column only, not twice.
- **Deviations from plan**:
  1. `push.test_sent` is written after the push is sent, not in a transaction: sending
     a push is a provider call, with no database write to share one with. It is skipped
     when nothing was sent.
  2. The page for the switches is now called "Interruptores" (its route is unchanged),
     so the Ajustes group does not repeat its own name in the menu.
  3. `AdminTable`'s `search` is optional: the audit log has no free text.
- **Decisions**: [`0071`](../../decisions/0071-the-service-records-what-leaves-no-row-and-the-console-watches-it.md)
  now says the audit log also records the automatic activation.
- **Notes for the next phase**:
  - Migration 0048 runs against production during the API's build. It is already
    applied on the dev branch.
  - Every new admin mutation passes its audit argument. `UNAUDITED` is for tests, fixtures
    and `account.mjs` only (see `apps/api/AGENTS.md` § Admin).
  - The e2e harness reads `audit_logs` through the raw client; `createdAt` comes back as
    a string there.
