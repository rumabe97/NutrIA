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

## Phase 5 — What needs data to accumulate (2026-09-29)

- **Executor**: the `backend` agent (medium) wrote the API, and a second `backend` agent
  made the privacy fixes. The `frontend` agent (medium) built the pages, and a second
  `frontend` agent made the accessibility fixes. The `tests` agent (medium) wrote the
  end to end, and `plan-evaluator` decided the floor counts. All worked from phase 4's
  commit, each in its own worktree, which was brought into the main checkout and
  removed. The lead (opus, this session) decided the few-data rule and switched the
  page to core's type. Reviews: `invariant-reviewer` and `accessibility` with
  `/local-probe`.
- **Result**: done, **built early by the owner's choice**. It started on the day phase 1
  deployed rather than after the 2–4 weeks the dispatch asks for. Every page is
  written and tested for the empty and few-data states that dev has today. The full
  states are read from the markup and the unit tests, not seen in a browser.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api --filter=web`:
    17/17 tasks; api 1017 tests. `pnpm -w run deadcode` is clean.
  - **The floor counts** (`plan-evaluator`, dev library, read-only). Two counts, and never
    "days the floor bounded":
    - `daysFloorNarrowed`: days whose band minimum (the day's kcal target × 0.95)
      falls below the energy floor;
    - `daysFloorNarrowedOutOfBand`: of those, the days outside 5 % on any macro, with
      no cause attributed.
    - Of the 11 fixed profiles only `objetivo-bajo-3-comidas` is narrowed, and its one
      miss is carbs, not kcal.
  - **The verification baseline**: over the 11 fixed profiles, 153 of 154 days are inside
    5 % on all four macros (99.4 %). Phase 5's page, over real plans, is compared with
    this once there are at least 10 scored plans.
  - End-to-end, local, `SMTP_*` and `VAPID_*` blank: `system-events` and `access` 13/13,
    and `admin` 71/72.
    - The new cases cover:
      - 404 for an ordinary account and with no session, before 422;
      - 422 on bad and repeated params; retention takes no param at all;
      - exact keys for both halves of the plans-quality union, for `sweepHistory` (one
        value a day), and for a retention cohort and cell;
      - a plan generated today does not enter today's figures;
      - no email, `@` or id in any of the three bodies;
      - the floor counts in stored `quality`.
    - The one failure is "never name who made a dish". It fails on a second run of the
      unchanged phase 4 suite too; it is the shared dev database's known flake.
    - Which branch of the few-data test runs depends on the shared database's state.
      The other branch rests on the unit tests.
  - `invariant-reviewer`: no P0. Its two P1s are fixed, together with the lead's
    few-data rule:
    - **Few data**: under 10 scored plans, `plans/quality` returns only `dataStart,
      fewData, minPlans, period, plans, window, withoutQuality`, never a quality count.
    - **Subtraction** (P1):
      - the window ends at today's Madrid midnight, so reading before and after a named
        generation isolates nothing;
      - the rule of 10 applies to each disjoint stretch that nested periods expose
        ([−7,0), [−30,−7), [−90,−30)).
    - **Retention** (P1): a cell's `active` is shown only at 20 or more eligible people.
    - Week grouping is removed (P2: weeks subtracted from a month would give a hidden
      cell back).
    - `usedTheApp` shipping before five weeks is moot under the threshold.
    - **Left open, knowingly**: comparing the 30-day and 7-day views gives the number of
      plans in a thin stretch. The generation log already lists every plan, so it adds
      nothing.
  - `accessibility`: no P0 or P1. Its three P2s are fixed, and a re-probe at 320 px,
    normal and 200 % text, in both schemes, confirmed them:
    - a new `AdminReflowTable` swaps a table for a list per row below a 36rem card, on
      both retention tables and the per-day sweep table; the latter has a visible
      caption;
    - "—" cells carry hidden text that tells "under 20 people" from "week not lived
      yet", with the footnote above the tables.
    - Its P3s are fixed: the stacked chart's tone has 3:1 contrast and a Total column;
      the empty-chart copy; the count-list reading order; distinct list labels; no
      `role="status"` on static text.
    - Not seen: the populated charts and the full plan-quality state, since dev has no
      such data yet.
- **Deviations from plan**:
  1. The phase started before its wait (owner's choice).
  2. Retention is monthly only, with no week grouping (see the P2 above).
  3. `plans/quality` counts until yesterday, not until now.
  4. The floor is recorded as two counts, not one "days the floor bounded" (the
     `plan-evaluator`'s decision); `planQuality` takes `minimumKcal` again.
- **Decisions**: [`0071`](../../decisions/0071-the-service-records-what-leaves-no-row-and-the-console-watches-it.md).
- **Notes for the next phase**:
  - **Revisit this phase with real data** (from mid-October), once there are at least
    10 scored plans in a period:
    - compare the page's in-band share with the 99.4 % baseline (the plan's
      verification);
    - look at the populated charts and the full state in the browser;
    - check that `usedTheApp` fills in from 2026-10-06.
  - Plans generated before 2026-09-29 carry no `quality`, and plans between phase 1 and
    this deploy carry no floor counts. The page gives each its own "desde".
  - Phase 6 (alerts) and phase 7 (the terms) remain.

## Phase 6 — The owner's alerts (2026-09-29)

- **Executor**: the `backend` agent (medium), in its own worktree, which was brought
  into the main checkout and removed. The lead (opus, this session) made the review fixes,
  the digest-noise change and the `mailKinds` labels. Reviews: `invariant-reviewer`, and
  `legal` on the templates. The `tests` agent's end-to-end cases were still running at
  ship time and follow in their own change.
- **Result**: done. **Owner-approves (the digest's wording): approved by the owner's
  `/ship` of this change on 2026-09-29**, after he was shown the rendered digest and both
  alerts.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api`: 11/11 tasks; api 1048
    tests. `OwnerMail.spec.ts` renders the digest and each alert, and fails on an `@`, a
    uuid, a `usr-` id or a sentinel string from the database.
  - **Dev capture**, by `backend` against the dev database with a local SMTP sink, never
    production:
    - three failed generations (throwaway accounts with every allergen declared) sent
      exactly one "tres generaciones seguidas han fallado"; the fourth and fifth sent
      nothing;
    - `/cron/reminders` sent one digest, and a second run sent none;
    - `owner_alerted` rows: `generation-streak`, `digest`.
    - The spend alerts are covered by unit specs only.
    - The throwaway accounts and the capture's own rows were deleted.
  - `invariant-reviewer`: no P0 or P1. Its two P2s are fixed:
    - both cron routes catch an alert failure, so the reminders and the rewrite record
      still run (new specs);
    - the SMTP transport times out in 10–15 s, well inside the function's 300 s, so a
      claimed alert whose mail hangs is given back.
    - It also asked for two specs, now added: the alert runs after the job row is final
      (`invocationCallOrder`), and a failing alert never changes a failed job.
    - Its P3 on the index comment is fixed. Its P3 on `safeKind` is left: the kind list
      lives in `apps/api`, which core cannot import, and the only writer is typed.
  - `legal` ([`docs/legal/2026-09-29-correos-al-propietario.md`](../../legal/2026-09-29-correos-al-propietario.md)):
    the three mails can ship. They carry no user's address, name, id or text. The
    privacy policy and the DPIA are unchanged, and the records of processing get a
    revision line. `06-correos.md` gains H–J. Its two clearer sentences for the digest's
    intro and footer are applied.
- **Deviations from plan**:
  1. "Should be zero" counts never trigger the digest on their own; they ride along when
     something else does (the lead's recommendation to the owner). Dev's standing 107
     `unserved` would otherwise mail every day.
  2. The spend check runs at the end of each plan job, of the rewrite sweep, and in the
     digest, not per model call. The picture alert can therefore lag until the next of
     those; the picture cap itself is a hard stop in code.
- **Decisions**: [`0071`](../../decisions/0071-the-service-records-what-leaves-no-row-and-the-console-watches-it.md).
- **Notes for the next phase**:
  - **A blind spot:** the digest runs inside `/cron/reminders`, so a dead reminders cron
    cannot report itself. Sentry cron monitoring or an outside check would cover it
    (owner's choice, later).
  - `legal` P3: the existing account-waiting mail (`0029`) puts each new user's address
    in the owner's Gmail with no deletion deadline. It is a candidate for `analisis.md`
    § 9.
  - The end-to-end cases for this phase land in their own change.

## Phase 7 — The terms' acceptance (2026-09-29)

- **Executor**: the `backend-high` agent (opus, high, as dispatched: it changes sign-up)
  and the `frontend` agent (medium) worked in parallel from current main, and the `tests`
  agent (medium) wrote the end to end. Each worked in its own worktree, which was brought
  into the main checkout and removed. The lead (opus, this session) made the review
  fixes and applied migration 0049 on the dev branch with the owner's yes. Reviews:
  `migration-reviewer` (opus, high), `invariant-reviewer`, and `accessibility` with
  `/local-probe`.
- **Result**: done.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api --filter=web`:
    17/17 tasks; api 1052 tests. `pnpm -w run deadcode` is clean.
  - `pnpm --filter database generate` finds nothing more, and
    `node scripts/check-migrations.mjs` passes: 50 migrations in order.
  - End-to-end, local, blank `VAPID_*` and `SMTP_*`: `terms-record` (new, 4 cases),
    `social-sign-in` and `admin`, 85 of 87.
    - The new cases cover:
      - an email sign-up and a Google account (the e2e stub) are stored with `2.0.0` and
        a moment within a minute;
      - a forged sign-up body gets 400 and creates no account;
      - `/auth/update-user` can never change either column, with a value, null or `""`;
      - a Google link into a confirmed password account leaves its record as it was;
      - Consentimientos' `terms` row: its null bucket equals the unrecorded accounts,
        and a fresh sign-up adds one to `current`;
      - no addressed admin body carries either field.
    - The two failures are the shared dev database's week-count flakes ("count sign-ups
      and messages per Madrid ISO week", "a sign-up and a message made now in the
      current week"), which pass in CI.
  - `migration-reviewer`: no P0–P2, safe to ship.
    - The migration adds two nullable columns with no default: a catalogue change, no
      rewrite.
    - The old API selects named columns and never sees them. The new API cannot run
      before them, because `vercel-build` migrates before it serves.
    - Its P3s are in the comment: taking the lock waits for open transactions on
      "user", so the merge should not land just before the 03:30 and 08:00 UTC crons;
      and NULL means *not recorded*.
  - `invariant-reviewer`: no P0.
    - No client can set or change the version: `input: false` refuses a value with 400
      on sign-up and update-user, an empty one is dropped, and the provider profile
      skips the fields.
    - Sign-up and strict account linking are unchanged. Neither field reaches an
      addressed admin row.
    - `/get-session` shows them to the account's owner, which is acceptable.
    - Its P1 (the admin key lists) and both P2 test gaps (the provider path,
      update-user) are covered by the new cases. Its two P3 wordings are fixed.
  - `accessibility`: the legal check passes. The notice, with the age line, is fully
    visible without scrolling and 20 px above the Google button at 320, 390 and 1280 px,
    in both themes; the worst case ends at 369 px of a 700 px screen. Its contrast is
    4.90:1 in light and 6.92:1 in dark. `/condiciones` has one `h1` and 14 `h2`, in
    order.
    - Its P2s are fixed:
      - the auth card spilled sideways at 200 % text on every auth page, so
        `AuthShell`'s grid now has one `minmax(0, 1fr)` column;
      - the new terms section named a «Crear cuenta» button, but the button is «Crear
        mi plan» (EN "Create my plan"), so the section now names the real button.
    - Left: the notice's links open in the same tab, so a form half filled would be
      lost. It is unlikely, since the notice comes before the fields.
- **Deviations from plan**:
  1. The terms section names «Crear mi plan», not the legal note's «Crear cuenta» (§ 6.A),
     to match the control. The meaning is unchanged, so TERMS_VERSION stays 2.0.0.
  2. On `/acceder` the notice renders only when a provider button is drawn. Its text says
     "Google o Apple" while Apple is still off (§ 6.C kept as written).
- **Decisions**: [`0071`](../../decisions/0071-the-service-records-what-leaves-no-row-and-the-console-watches-it.md);
  legal's D5 note.
- **Notes**:
  - This is the plan's last phase. Still open from project 008:
    - the owner sets `AI_TEXT_MONTHLY_CAP_USD=5` on Vercel;
    - phase 5 is revisited with real data from mid-October;
    - phase 6's end-to-end cases are still to land;
    - #161 (phase 6) did not trigger its deploy, and ships with this merge;
    - the digest's reminders-cron blind spot.
  - After the merge, migration 0049 runs against production during the API's build. It is
    already applied on the dev branch.

## Follow-ups after phase 7 (2026-09-29)

- **Executor**:
  - `tests` (medium): phase 6's end-to-end cases;
  - `backend` (medium, twice): the crons watching each other, and the account-waiting mail;
  - `frontend-low`: the notice's links in a new tab;
  - `legal`: the record of both mails.
  
  Each worked in its own worktree, which was brought into the main checkout and removed. The
  lead made the review fixes. Review: `invariant-reviewer`, no P0 or P1.
- **What changed**:
  - **Phase 6's end to end** (`owner-alerts.e2e-spec.ts`, 9/9 locally): silent without
    config; the digest once a Madrid day, with a refused send releasing its claim; one
    streak alert with none on the fourth failure; a spend-cap alert; no `@`, uuid or `usr-`
    in any captured mail; `/cron/reminders` answering when the digest throws. The admin
    suite counts the owner mail kinds.
  - **The crons watch each other**: `/cron/rewrite-steps` alerts the owner when
    `/cron/reminders` has been silent for more than 26 h. The alert is claimed for 20 h (one
    a day) and the watch gets at most 10 s before the sweep starts. `apps/api/AGENTS.md`
    no longer says no cron is scheduled.
  - **The account-waiting mail carries no address, name, id or token** (owner, 2026-09-29).
    It links to Cuentas' waiting accounts. The mail-link route stays until tokens already
    sent expire; `docs/legal/checklist-activacion.md` dates their removal. Its failure log
    line keeps only the error's class.
  - **The terms notice's links open in a new tab**, and say so to screen readers.
- **Evidence**:
  - `gate.sh --full` is green; api 1063 unit tests.
  - A local full end-to-end run was not usable: two runs overlapped on the shared dev
    database. It showed the known `admin` flakes and a `care` block failing together,
    which points to its setup, not this change. CI's full run decides.
  - 27 leftover `@e2e.invalid` accounts from the interrupted runs were deleted from dev,
    after the guard confirmed it was not production.
- **Still open**:
  - Phase 5 is revisited with real data from mid-October.
  - The text gauge is compared with OpenRouter after a month.
  - The owner deletes the old account-waiting mails, which carry addresses and live
    tokens for up to 30 days.
  - The mail-link route is removed 30 days after deploy.

## Closing (2026-09-29)

- **Closed by the owner** on 2026-09-29 ("Cierra el proyecto 008"), after the follow-ups
  reached production (#163, with main CI green and both deployments live). Anything found later is a
  new change, not a reopening.
- **Shipped:**
  - #155: recording (app_used, cron_run, mail_sent, the AI feature, plan quality);
  - #156: the audit log, migration 0048;
  - #157: health data saved again (found in phase 3);
  - #158: Calidad, Consentimientos, Sistema, Notificaciones, and "active" means use;
  - #159: the text-AI cap;
  - #160: plan quality, retention and the sweep's history;
  - #161: the owner's alerts;
  - #162: the terms' acceptance, migration 0049;
  - #163: the account-waiting mail names nobody, the crons watch each other, and phase 6's
    end to end.
- **Left open, all time-bound:**
  - From mid-October, with at least 10 scored plans in a period, review Planes › Calidad
    against the 99.4 % baseline (phase 5's verification), look at the populated charts,
    and check that retention's "Usó la app" fills in from 2026-10-06.
  - After a month with `AI_TEXT_MONTHLY_CAP_USD` set, compare the gauge with OpenRouter's
    panel; a gap of more than 10 % is investigated before relying on the warnings.
  - Around 2026-10-29, remove `GET /admin/activate` and `ActivationLink`, once the tokens
    already mailed have expired (`docs/legal/checklist-activacion.md`). The owner deletes
    the old account-waiting mails.
