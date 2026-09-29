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

## Phase 3 — "Active" fixed, and the pages that read what already exists (2026-09-29)

- **Executor**: the `backend` agent (medium) wrote the API, and a second `backend`
  agent made the review fixes. The `frontend` agent (medium) built the pages, the `tests`
  agent (medium) wrote the end to end, and `legal` answered D5. Each worked in its own
  worktree, based on phase 2's commit before it merged, and was brought into the main
  checkout and removed. The lead (opus, this session) made the accessibility fixes and
  amended phase 7. Reviews: `invariant-reviewer` and `accessibility` with `/local-probe`.
- **Result**: done.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api --filter=web`:
    17/17 tasks; api 1001 tests. `pnpm -w run deadcode` is clean.
  - End-to-end, local, `SMTP_*` and `VAPID_*` blank: `admin` 63/63, and `access` passed.
    - The new "watching pages" cases: 404 for an ordinary account and with no session,
      also with a bad query; exact keys at every level; 422 on a bad period; the sweep's
      states add up to the recipes; each `check=` total equals its quality count;
      `app_used` moves last activity and active people by exactly one, and a swap alone
      moves nothing.
    - `/admin/system` answers 200 on the dev Postgres. Two of its queries group by
      position, and only a real database runs them.
    - In a combined run, "never name who made a dish" (`admin.e2e-spec.ts:1959`) failed
      once and passed on the rerun. It is the same intermittent test as in 007.
  - Catálogo › Calidad reads about 0.45 MB a visit on dev, under the 2 MB stop signal, so
    there is no nightly snapshot.
    - On dev, 1,835 recipes: `overBound` 0, `uncosted` 0 and meals outside the serving
      bounds 0.
    - `unserved` is **107** (64 seed, 43 AI), a real catalogue defect: for example, a
      seed breakfast holding quinoa, which is listed for lunch and dinner only. It is
      explained here as PRD criterion 5 asks, and left for the owner to decide.
    - `refusalLimit` 6, `withRefusals` 8, pending 194.
  - `invariant-reviewer`: no P0 or P1. Its two P2s are fixed, both counts that could be
    one person in a beta of about ten accounts:
    - `care.sharingHealth` is gone from Consentimientos (the plan never asked for it);
    - mail on Sistema is now per-template totals over the period, plus one daily series
      summed across templates, so `checkin-submitted` per day cannot be one client's
      check-in calendar.
    - Its P3s are fixed: the JSON key is bound as a parameter, and the commit hash
      accepts 7–40 characters.
    - A leak spec runs the real system snapshot with placeholder env values and finds
      none in the HTTP body.
  - `accessibility`: 320/390/1280, light and dark, and 200 % root text at 320 show no
    sideways scroll.
    - Headings, `aria-current`, the charts' "Ver datos" tables and warnings in words as
      well as colour are all right.
    - Its two P1s are fixed:
      - Calidad's counts were clipped at 200 % text. `AdminCountList` now holds one
        column no wider than its card, and a re-run confirmed it.
      - On Sistema and Consentimientos at 320 px, the value column sat off-screen. Below
        a 36rem container the row header now wraps; the fix was confirmed by an injected
        rule.
    - The cron table (3 columns) and Consentimientos (5 columns) still scroll inside
      their card at 320 px, as the console's other wide tables do.
    - Its P2 (the period selector at 200 %) was withdrawn as a probe artefact: a root
      font size does not trigger the `rem` media query that real text zoom does.
- **Deviations from plan**:
  1. Mail per template and day (A4) is per template over the period, plus one daily sum
     (0028, see the review above).
  2. Recetas takes an allow-listed `check` filter (`over_bound`, `uncosted`, `unserved`,
     `refusal_limit`, `over_cap`), so every "should be zero" count links to its rows.
  3. Active people count `session_started` and `app_used` only, so a swap alone no
     longer moves last activity.
- **D5 (step 7)**: `legal` answered
  [`docs/legal/2026-09-29-aceptacion-de-los-textos-legales.md`](../../legal/2026-09-29-aceptacion-de-los-textos-legales.md).
  - **Phase 7 runs, for the terms only.** The privacy policy is informed, not accepted.
    The plan's phase 7 is amended from its § 5.
  - It also found two P1s in production:
    - saving health data on `/perfil` had failed since #106; fixed in #157;
    - the terms notice sat below the Google and Apple buttons; phase 7 fixes it.
- **Decisions**: [`0071`](../../decisions/0071-the-service-records-what-leaves-no-row-and-the-console-watches-it.md).
- **Notes for the next phase**:
  - Health-consent version counts are shown as the plan asked. With about ten accounts, a
    1.0.0 against 1.1.0 split of one can date a person's save of their health section.
    The owner was told.
  - A 429 from the API on a console page reads as "not found" (`serverApi` →
    `notFound()`); a probe can trip it. Accessibility P3, not fixed.
  - The nav has "Registro" (Generación) and "Registro de acciones" (Ajustes), which sound
    alike to a screen reader. Accessibility P3, not fixed.

## Phase 4 — Spend against a cap (2026-09-29)

- **Executor**: the `backend` agent (medium) wrote the API, and a second `backend`
  agent made the review fixes. The `frontend` agent (medium) built the gauge and the
  tile, and the `tests` agent (medium) wrote the end to end. All were based on phase 3's
  commit before it merged, each in its own worktree, which was brought into the main
  checkout and removed. The lead (opus, this session) fixed the accessibility P2.
  Reviews: `invariant-reviewer` and `accessibility` with `/local-probe`.
- **Result**: done. **Owner-gated:** set `AI_TEXT_MONTHLY_CAP_USD=5` on the Vercel API
  project, never above the OpenRouter key's own monthly cap.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api --filter=web`:
    17/17 tasks; api 1016 tests. `pnpm -w run deadcode` is clean. The env spec covers
    unset, empty, 5, 2.5, 0, −1 and text.
  - End-to-end, local, `SMTP_*` and `VAPID_*` blank. The new `text-cap` suite passes
    5/5, run twice. It sizes the cap from the month's real dev spend and asserts deltas:
    - the gauge's seven keys with the cap, and the summary tile's five;
    - features in order, and their costs sum to the spend;
    - an uncosted call counts, and a row before the UTC month does not;
    - `/cron/rewrite-steps` answers `heldBy: 'cap'`, records `cron_run`
      `skipped: 'cap'`, and makes no model call;
    - it deletes everything it seeded, and its `afterAll` asserts that.
  - `admin` without the cap: exact keys, no gauge fields, and `tiles.textAi` unchanged.
    - Two tests failed in the combined local run: "count a sign-up and a message made
      now in the current week", and "active moves on a use, and not on a swap alone".
    - They fail the same way on phase 3's code with phase 4 reverted, and both passed in
      phase 3's run and in #158's CI, so they are not from this change. The cause on the
      shared dev database is unconfirmed. CI decides.
  - `monthByFeature` runs on the dev Postgres, with and without the cap.
  - `invariant-reviewer`: no P0 or P1.
    - Neither a plan nor a swap can be held by the cap; the only reader is the nightly
      sweep. When the spend cannot be read, the sweep does not start, and that is
      confirmed as the right call.
    - Its P2 is fixed: `modules/ai` imported the whole `core/controllers/Admin` barrel,
      which reaches health repositories. The spend reader now lives in
      `core/controllers/Analytics` (`TextSpend`), and `health-boundary.spec.ts` forbids
      the Admin barrel.
    - Its P3s are fixed:
      - the sweep and the gauge share one predicate (`textCapOf`);
      - `cron_run` counts take a number or `'cap'` only.
    - A source-scan spec keeps the cap's reader out of everything but the sweep, and
      a unit spec proves the sweep fails closed.
  - `accessibility`: no cap, 27 %, 90 % and 217 %, at 320, 390 and 1280 px, light and
    dark. There is no sideways scroll, and every warning is in words.
    - Its P2 is fixed: the feature table's cost column sat off the card at 320 px; the
      feature name now wraps below a 36rem container.
    - Its P3 is fixed: the table has its own caption, apart from the chart's.
    - Its period-selector P2 is the probe artefact of phase 3, a root font size that
      does not trigger `rem` media queries.
- **Deviations from plan**:
  1. The cap has no default in code. Unset means no gauge and nothing changes (PRD 6);
     the owner sets 5 on production. `0071` is reworded to match.
  2. `cron_run` for a held sweep records `skipped: 'cap'`, a string in a field that is a
     count otherwise.
- **Decisions**: [`0071`](../../decisions/0071-the-service-records-what-leaves-no-row-and-the-console-watches-it.md)
  (the cap's wording).
- **Notes for the next phase**:
  - After a month with the cap set, compare the gauge with OpenRouter's panel. A gap
    of more than 10 % is investigated before relying on the warnings. Uncosted calls
    make the app's figure a minimum.
  - A suite that wants the rewrite sweep to run must override `AI_REWRITE_CLIENT` as well
    as the AI client.
  - Phase 5 waits 2–4 weeks after phase 1 (deployed 2026-09-29). Phase 6 (alerts) and
    phase 7 (the terms) can go first.
