# Plan — Project 008: The console watches quality and spend

> **Purpose**: the phased technical execution plan — the engineering half of the
> contract. `/execute-project` follows this literally; executors implement phases, they
> do not redesign them. If implementation must diverge, the plan is amended in the same
> change and the deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes.

- **Status**: approved — by the owner, 2026-09-29 (by launching phase 1)
- **Type**: standard
- **PRD**: [./PRD.md](./PRD.md). Every acceptance criterion is mapped at the end of this file.
- **Routing profile**: `tiered`.
  - **Phase 1 runs at `quality-max` (opus @ high)**: it adds a hook to authentication (the
    session renewal) and writes into plan generation.
  - **Phase 7**, if `legal` asks for it, changes sign-up (authentication), so it is also
    `quality-max`.
  - Every API phase is read by `invariant-reviewer`, and the one migration by
    `migration-reviewer` (its own floor: opus @ high).

## Design summary

Recorded in [`0071`](../../decisions/0071-the-service-records-what-leaves-no-row-and-the-console-watches-it.md),
which extends `0033` (the event list) and `0068` (the console). The source for every
file:line below is the architect's report
[`0004`](../../reference/architecture/0004-consola-seguimiento-2026-09-29.md), and §
numbers refer to it. Read it before any phase.

- **What gets recorded:**
  - **Four new events.** `app_used` (with a user) is written from Better Auth's
    `session.update.after`, at most once a day per person. `cron_run`, `mail_sent` and
    `owner_alerted` carry no user.
  - **`feature` on `ai_call`**: `plan`, `swap` or `rewrite`.
  - **`generation_metadata.quality`** on each new plan.
  - **Admin actions in `audit_logs`**, with a `subject_user_id` foreign key
    `ON DELETE SET NULL`. This is the project's only migration.
- **The event list splits** into product events (`session_started`, `app_used`,
  `swap_requested`) and system events (`ai_call`, `cron_run`, `mail_sent`,
  `owner_alerted`).
  - `CHARTED_EVENTS` (`AdminSeriesController.ts:166`) becomes the product list.
  - Each new name gets a label in both dictionaries.
- **"Active"** becomes `session_started ∪ app_used` wherever 007 reads it: Resumen,
  Embudo, and Cuentas' `lastActiveAt`.
- **The console's rules from 007 hold** (see Hand-off).
  - New pages use the 007 components: `StatTile`, `Gauge`, `DataTable`, the charts,
    `AdminTable`, `PeriodSelector`, `HowCounted`.
  - New API routes live in the admin module under `@Roles('admin')`.
- **No new cron and no new table.** The digest and alerts live in `/cron/reminders` and at
  the failure point.

## Phases

### Phase 1 — Start recording (API and core, no pages)

- [x] done — commit `ccdaf5b` ("The service starts recording what leaves no row: real use, cron runs, mails, which feature spent on AI, and each plan's quality")
- **Dispatch**: opus @ high — `/execute-project 008 phase 1`. `quality-max`: it touches
  authentication and plan generation. Reviews: `invariant-reviewer`, and `plan-evaluator`
  on the floor definition. The `tests` agent writes the end-to-end cases.
- **Goal**: every new record is written from the day this deploys; nothing is shown yet.
- **Scope**:
  - `packages/core/src/{entities,repositories,controllers}/Analytics/**`;
  - `packages/core/src/domain/PlanValidation/**`;
  - `apps/api/src/modules/{auth,ai,meal-plans,cron,notifications,mail}/**`, plus the
    email service wherever it lives;
  - `packages/core/src/repositories/Notification/**`;
  - `packages/core/src/repositories/Admin/AdminGenerationsRepository.ts` (the P3 fix);
  - `packages/core/src/controllers/Admin/AdminSeriesController.ts` (the product/system
    split);
  - `apps/web/src/i18n/dictionaries/*` (event labels only);
  - `docs/reference/deployment.md` (the Pro line);
  - `apps/api/test/**` (the `tests` agent).
- **Steps**:
  1. **Event list.** Add `app_used`, `cron_run`, `mail_sent` and `owner_alerted` to the
     closed list (`Analytics.ts:14-33`). Export `PRODUCT_EVENTS` and `SYSTEM_EVENTS`.
     `CHARTED_EVENTS` becomes `PRODUCT_EVENTS`. Add labels for the new product event in
     both dictionaries.
  2. **`app_used`.**
     - Write it from `databaseHooks.session.update.after` (§ 4.6) through
       `AnalyticsRepository.record`, which never throws. Deduplicate so each person has at
       most one per Madrid day, for example "no `app_used` for this user today" before
       writing.
     - Write an integration test proving the hook fires when `SessionGuard` renews a
       session (`Session.guard.ts:38`).
     - **Stop signal:** if the hook does not fire, implement the fallback: a deduplicated
       write in the session guard's renewal path, not in `/users/me`'s handler. Record it
       in the LOG.
  3. **`feature` on `ai_call`.** Add it to `AiRequest` (`AiClient.ts:18-34`), set it at
     the three callers: `PlanGeneration.service.ts:178` (`plan`),
     `MealSwap.service.ts:153` (`swap`) and `RecipeRewriter.service.ts:178` (`rewrite`).
     `StructuredAiClient` records it on both the success and the failure event.
  4. **`cron_run`.** Written at the end of each cron in `Cron.controller.ts`:
     `{ job: 'rewrite', …RewriteRun counts }` and `{ job: 'reminders', …counts }`. No user.
  5. **`mail_sent`.** Written in `EmailService.send`: `{ kind, ok }`, where `kind` is the
     template, never the recipient. It is written on failure as well.
  6. **Reminder channel.** When a reminder goes out by both mail and push, record both
     (`CheckInReminder.service.ts:100`). Use one `notifications` row per channel; the
     `both` enum value would need a migration.
  7. **Plan quality.**
     - Add `planQuality(violations, dayTargets, minimumKcal, targets)`, a pure function in
       `core/domain/PlanValidation` with tests. It returns `{ days, daysInBand,
       missesByMacro: { kcal, protein, carbs, fat }, eventDays, eventDaysInBand,
       advisoriesByKind, loadsRefused, fallback }`. (`daysUnderFloorBand` was planned here
       and moved to phase 5: see the stop signal below and LOG phase 1.)
     - It returns counts only: no target, figure or event name.
     - Write it to `generationMetadata.quality` (`PlanGeneration.service.ts:565`).
     - `daysUnderFloorBand` is the days whose band minimum (target × 0.95) falls under the
       floor. Ask `plan-evaluator` whether the known 12/14 profile (`objetivo-bajo`) shows
       as such.
     - **Stop signal:** if `plan-evaluator` cannot confirm the definition, record without
       that field and add it in phase 5.
       **Taken on 2026-09-29:** the definition counts days whose band is narrowed by the
       floor — for `objetivo-bajo` all 14, although 13 of 14 are in band and its one miss
       is carbs. It does not say which days the floor bounded, so it is not recorded.
  8. **The P3 fix.** `AdminGenerationsRepository` selects only `planOf`'s allowed keys
     from `generation_metadata` in SQL (`:52`, `AdminController.ts:95-111`). `quality` and
     `advisories` never leave the database on that path.
  9. **Docs.** `docs/reference/deployment.md:177` says Vercel is on Pro (since
     2026-09-26), not Hobby.
  10. **Tests.**
      - Unit specs for every new writer, and for `planQuality`.
      - End-to-end (`tests` agent): a generated plan has `quality` with `days` equal to
        its length; `/admin/generations` never contains `quality` or `advisories`; the new
        system events carry no `user_id`; Embudo's `/admin/product` events contain only
        product keys.
      - Update the admin e2e key lists in the same change.
- **Acceptance criteria**: PRD 1, 2, 12 (the P3 and docs halves), 13.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web`.
  - `pnpm --filter api test:e2e` on the touched suites (`tests` agent). CI runs the full
    suite.
  - In dev, after a local generation and a sign-in plus renewal, every new event appears
    with the expected properties. This is a read-only query, recorded in the LOG.

### Phase 2 — The admin audit log (the one migration)

- [x] done — commit `16193e6` ("Every admin action leaves one row in the audit log, and the owner can read them")
- **Dispatch**: opus @ medium — `/execute-project 008 phase 2`. Reviews:
  `migration-reviewer`, `invariant-reviewer`, `accessibility` (the page). The `tests`
  agent writes the end-to-end cases. After merge — owner-gated (or by the lead with the
  owner's standing yes): `pnpm --filter database migrate` on the dev branch.
- **Goal**: every admin action leaves one row, and the owner can read them.
- **Scope**:
  - `packages/database/src/schemas/platform.schema.ts` plus one migration;
  - `packages/core/src/{repositories,controllers}/{Audit,Admin,User,Professional,Feedback,Settings}/**`;
  - `apps/api/src/modules/{admin,auth}/**`;
  - `apps/web/src/app/(admin)/admin/ajustes/registro/**`;
  - `apps/web/src/components/AdminNav/sections.ts`;
  - the dictionaries;
  - `apps/api/test/**`.
- **Steps**:
  1. **Migration.** Add `audit_logs.subject_user_id text references "user"(id) on delete
     set null` and an index on `created_at`. `entity_id` stays for what is not a person:
     the switch key, or the feedback id.
  2. **The writes.** A closed action list: `account.activated` with `via:
     'console' | 'mail_link' | 'automatic'`, `account.tier_changed` with `{ from, to }`,
     `professional.granted`, `professional.revoked`, `feedback.handled`,
     `feedback.reopened`, `setting.changed` with `{ key, enabled }`, and
     `push.test_sent`.
     - Each is written **in the same transaction** as its action, as `careAccessLog` is
       (`0059`).
     - `actorId` is the session's user, or null for the mail link and for the automatic
       activation.
     - Never a request body; `ipHash` stays empty.
     - The routes are listed in § 2, Punto 4, plus the automatic activation on email
       confirmation.
     - **Stop signal:** if a transaction would force changes to the user repository beyond
       passing the `tx`, write immediately after the action instead and document the
       window.
  3. **`GET /admin/audit`.** Paged, filtered by `action`, `offset` and `size`. Rows are
     `{ at, action, actor (email or null), subject (email or null), detail }`, where
     detail is the closed metadata only.
  4. **Page.** Ajustes › Registro de acciones: an `AdminTable` with date, action, account
     and detail, and an action filter. Add the nav entry.
  5. **End-to-end.**
     - Each of the eight routes and the automatic activation leaves exactly one row.
     - Deleting an account leaves `subject_user_id` null.
     - No row carries a body or an IP.
     - An ordinary account gets 404.
- **Acceptance criteria**: PRD 3, 13.
- **Verification**:
  - `pnpm --filter database generate` produces exactly the one migration;
    `node scripts/check-migrations.mjs`.
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api --filter=web`.
  - The touched e2e suites (`tests` agent), and CI.
  - `/local-probe` on the page at 320, 390 and 1280 px, light and dark (built servers,
    never `--no-build`).

### Phase 3 — "Active" fixed, and the pages that read what already exists

- [x] done — commit `8118e50` ("The console says whether the catalogue, the consents, the crons and the reminders are sound, and \"active\" means use")
- **Dispatch**: opus @ medium — `/execute-project 008 phase 3`. Reviews:
  `invariant-reviewer`, `accessibility` with `/local-probe`, and `legal` (D5). Can run as
  one `/team` with phase 1's API if convenient.
- **Goal**: 007's activity figures mean use, and the catalogue, consents, system and
  notifications are visible.
- **Scope**:
  - `packages/core/src/{repositories,controllers}/{Admin,User,Recipe,Notification,Profile,Care,Professional}/**`;
  - `apps/api/src/modules/admin/**`;
  - `apps/web/src/app/(admin)/admin/{page.tsx,producto/**,cuentas/**,catalogo/calidad/**,consentimientos/**,ajustes/sistema/**,notificaciones/**}`;
  - `AdminNav`, the dictionaries, `apps/api/test/**`;
  - `docs/legal/**` (the `legal` agent, D5 only).
- **Steps**:
  1. **Active.** `AdminSeriesRepository` (`:75-97`) and `UserRepository.lastActiveAt`
     (`:60`) read `session_started ∪ app_used`. "Cómo se cuenta" on Resumen, Embudo and
     Cuentas gives the change date.
  2. **Catálogo › Calidad** (§ 4.1). All of it is computed with `composePerServing`,
     `isOversized`, `servingCap` and `MealFit`, never a new formula.
     - **"Debería ser cero"**, each count linking to Recetas with the filter set:
       - recipes past the bound;
       - recipes without costable macros;
       - meals with servings outside `SERVING_BOUNDS` (a count only, no rows returned);
       - dishes whose meals match none of their ingredients' meals;
       - recipes at the sweep's refusal limit.
     - **"Para mirar"**:
       - recipes over their meal's cap but within the bound, by source;
       - `oversized` rejections per day (the SQL at `AdminGenerationsRepository.ts:168`,
         grouped by day);
       - pictures `failed` for dish reasons.
     - The sweep's state cards: current, pending, with refusals, and given up, from
       `steps_version` (§ 4.5).
     - **Stop signal:** if the page reads more than about 2 MB a visit in dev, take a
       nightly snapshot inside the 03:30 cron instead.
  3. **Personas › Consentimientos** (§ 4.9). For each versioned consent (profile, health
     data, care link, the professional's agreement): the current version, how many
     accounts hold it and how many hold an older one. The profile consent is also shown
     against onboarded accounts. Numbers only.
  4. **Ajustes › Sistema** (§ 4.10, A3, A5).
     - The commit (`VERCEL_GIT_COMMIT_SHA`), the prompt, steps and consent versions, and
       the caps.
     - Each integration as a boolean.
     - Each cron's last `cron_run`, with a warning past 26 h.
     - A test proves the response holds only booleans, versions, dates and a hash.
  5. **Notifications** (§ 4.8): push subscriptions and people with one, reminders per
     week and channel, and "check-in within 3 days of a reminder" (distinct people).
  6. **Mail** (A4): sent and failed per template and day, from `mail_sent`, on Sistema.
  7. **D5 to `legal`.** Should sign-up record a versioned acceptance of `/privacidad` and
     `/condiciones`? `legal` writes its answer under `docs/legal/`. If yes, phase 7 runs;
     if no, the LOG says so and Consentimientos stays as it is.
  8. Nav entries and dictionary labels. End-to-end (`tests` agent): each new route 404s
     for an ordinary account, and exact key lists.
- **Acceptance criteria**: PRD 4, 5, 8 (the Sistema and mail half), 10, 11, 12 (the
  "active" half), 13.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web`;
    `pnpm -w run deadcode`.
  - The touched e2e suites, and CI.
  - `/local-probe` on every new or changed page, at 320, 390 and 1280 px, light and dark,
    and 200 % text at 320 px.

### Phase 4 — Spend against a cap

- [x] done — commit `c99def8` ("The text models' month is counted against a cap: the console shows it by feature and warns, and the nightly rewrite pauses at 80 %")
- **Dispatch**: opus @ medium — `/execute-project 008 phase 4`. Reviews:
  `invariant-reviewer`, `accessibility`. — owner-gated: set `AI_TEXT_MONTHLY_CAP_USD=5` on
  the Vercel API project, never above the OpenRouter key's own cap.
- **Goal**: text-AI spend has a visible monthly ceiling and warns before it, split by
  feature.
- **Scope**:
  - `apps/api/src/config/Env.validation.ts`, `turbo.json`, `apps/api/.env.example`,
    `docs/reference/deployment.md` (the new variable, all four);
  - `packages/core/src/{repositories,controllers}/Admin/**`;
  - `apps/api/src/modules/{admin,ai,cron}/**`;
  - `apps/web/src/app/(admin)/admin/{page.tsx,generacion/ia/**}`;
  - the dictionaries, `apps/api/test/**`.
- **Steps**:
  1. **`AI_TEXT_MONTHLY_CAP_USD`**: optional, positive number. Unset means no gauge and no
     warning.
  2. **The month's spend and uncosted calls.** Over the UTC month (`RecipeController.ts:80`
     style), `sum(costUsd)` of `ai_call` and a count of calls without a cost. Spend per
     feature (`plan`, `swap`, `rewrite`, and `unknown` before phase 1).
  3. **IA y modelos.** A `Gauge` against the cap, the uncosted count beside it, and a
     spend-by-feature bar or table. **Resumen:** the text-AI tile shows the month against
     the cap when it is set.
  4. **The sweep stops at 80 %.** `RecipeRewriter.rewriteOutdated` does not start when
     the month's text spend is at least 0.8 × the cap. It records `cron_run` with
     `skipped: 'cap'`.
  5. **End-to-end and unit tests.** The gauge fields appear only with the cap set. Update
     the exact key lists. The sweep skips at 80 % (unit, with a stubbed spend).
- **Acceptance criteria**: PRD 6, 13.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web`; the env spec.
  - The touched e2e suites, and CI.
  - `/local-probe` on IA y modelos and Resumen.
  - After deploy: the owner compares one month's gauge with OpenRouter's panel. A
    difference of more than 10 % is investigated before relying on the warnings.

### Phase 5 — What needs data to accumulate

- [x] done — built on 2026-09-29, the day phase 1 deployed, by the owner's choice rather than after the 2–4 weeks the dispatch asks for: the pages are built and tested now, and are reviewed against real data once it has accumulated (see LOG).
- **Dispatch**: opus @ medium — `/execute-project 008 phase 5`. Not before 2–4 weeks after
  phase 1 is in production. Reviews: `invariant-reviewer`, `accessibility`,
  `plan-evaluator` (the band figure against `evaluate-plans.mjs`).
- **Goal**: plan quality, retention and the sweep's history become readable.
- **Scope**:
  - `packages/core/src/{repositories,controllers}/{Admin,Analytics}/**`;
  - `apps/api/src/modules/admin/**`;
  - `apps/web/src/app/(admin)/admin/{producto/planes/calidad/**,personas/retencion/**,catalogo/calidad/**}`;
  - `AdminNav`, the dictionaries, `apps/api/test/**`.
- **Steps**:
  1. **Planes › Calidad** (§ 4.2). Over the period, from `generation_metadata -> 'quality'`
     and `created_at` only:
     - the share of days in band on all four macros;
     - the share per macro;
     - event days in their band;
     - advisories by kind;
     - plans that fell back;
     - days the floor bounded — first add the field to `planQuality`, deferred from
       phase 1. `plan-evaluator` confirms the definition before it is recorded. Its report
       of 2026-09-29 offers two: days whose band the floor narrowed, named as that, or
       the days missed among those. It is recorded only from phase 5's deployment.
     There is no series per day for the floor. The page says from which date data exists,
     and below about 10 plans in the period it says "pocos datos" instead of a percentage.
  2. **Personas › Retención** (§ 4.6).
     - The approximate "did something" version from the first day: distinct people per
       week with a `meal_completions`, `meal_swaps`, `check_ins` or `progress_entries` row.
     - The `app_used` version once five weeks of data exist.
     - Monthly cohorts by default, counts with the cohort size, no percentage under about
       20 people, and no link from a cell.
  3. **The sweep's history**: `cron_run` for the rewrite job and `feature: 'rewrite'`
     spend per day, on Catálogo › Calidad.
  4. End-to-end: exact keys, 404 for an ordinary account, and no field about a person.
- **Acceptance criteria**: PRD 2 (the console half), 7, 8 (the sweep half), 13.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web`.
  - The touched e2e suites, and CI.
  - `/local-probe` on the three pages.
  - `plan-evaluator` compares the band share with `evaluate-plans.mjs` on the same
    library. A difference is information, not a failure: real people against fixed
    profiles.

### Phase 6 — The owner's alerts

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 008 phase 6`. Reviews:
  `invariant-reviewer`, and `legal` on the mail template. — owner-approves: the digest's
  wording.
- **Goal**: the owner learns about trouble by mail, once, without noise.
- **Scope**:
  - `apps/api/src/modules/{cron,meal-plans,mail,admin}/**`;
  - `packages/core/src/{repositories,controllers}/{Admin,Analytics}/**`;
  - the mail templates, `apps/api/test/**`;
  - `docs/legal/**` (the `legal` agent's review).
- **Steps**:
  1. **Daily digest** (§ 4.7). It runs inside `/cron/reminders`, **before** the reminders
     switch is checked, and sends at most one mail a day, only when something is
     non-zero. It covers:
     - waiting accounts;
     - new inbox messages (the number);
     - failed generations in 24 h, by code;
     - text and picture spend against their caps;
     - non-zero "should be zero" counts;
     - failed mails;
     - crons silent for more than 26 h.
     Each item has a link to its console page. There are no addresses and no text from
     anybody.
  2. **Immediate alerts**, each de-duplicated for 6 h by `owner_alerted { kind }`:
     - three consecutive failed generations, checked where a job fails
       (`PlanJobRunner.service.ts:118`);
     - text or picture spend crossing 80 % or 100 % of its cap, once per threshold and
       month.
  3. **The template test** fails if the rendered mail contains an `@`, an account id or
     any free text from the database.
  4. **`legal` reviews the template**, with its verdict under `docs/legal/`.
- **Acceptance criteria**: PRD 9, 13.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api`.
  - The touched e2e suites, and CI.
  - In dev, with mail to the log (the probe's no-mail setup), provoke three failures and
    a digest: one alert, and never two of a kind in 6 h. Record it in the LOG.

### Phase 7 — The terms' acceptance (`legal` said yes in phase 3, for the terms only)

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 008 phase 7`. `quality-max`: it changes
  sign-up. Reviews: `invariant-reviewer`, `migration-reviewer`, `accessibility` with
  `/local-probe`, and `legal` on the texts.
- **Goal**: sign-up records which version of `/condiciones` each new account accepted,
  the notice is seen before every control that creates an account, and Consentimientos
  counts it.
- **Source**: `legal`'s answer to D5,
  [`docs/legal/2026-09-29-aceptacion-de-los-textos-legales.md`](../../legal/2026-09-29-aceptacion-de-los-textos-legales.md)
  § 5 (what is built) and § 6 (the texts). The privacy policy is informed, never
  accepted: nothing is recorded for it, and the console never shows it as a consent.
- **Scope**:
  - `packages/core/src/entities/User/**` (or wherever `backend` keeps the consent
    versions) and the admin consents and system repositories and controllers;
  - `packages/database/src/schemas/auth.schema.ts` plus one migration;
  - `apps/api/src/modules/{auth,admin}/**`;
  - `apps/web/src/components/{RegisterScreen,SignInForm,LegalNotice,SocialSignIn}/**`,
    the Consentimientos and Sistema pages, and the dictionaries (`terms`, `privacy`,
    `auth`);
  - `apps/api/test/**`.
- **Steps**:
  1. **Version.** `TERMS_VERSION = '2.0.0'` in core, beside the other consent versions.
     The rule is that any change of meaning in `terms` (either dictionary) bumps
     `TERMS_VERSION` and `terms.updated` in the same commit; a typo fix does not.
  2. **Storage.** Add `user.termsVersion text` and `user.termsAcceptedAt timestamptz`,
     both nullable, in one migration with no backfill: `null` means before recording.
     Declare them in Better Auth's `additionalFields` with `input: false`, as
     `activatedAt` is.
  3. **Write.** In `databaseHooks.user.create.before`, set `TERMS_VERSION` and now, in the
     same `INSERT`, for email, Google and Apple alike. The version never travels from the
     browser.
  4. **Show** (fixes the P1 in the note's § 4.1).
     - `LegalNotice` and `auth.legalAge` are visible without scrolling, before or right
       beside every control that creates an account: on `/registro`, Google, Apple and
       "Crear cuenta"; on `/acceder`, Google and Apple. The recommended place is just
       above `SocialSignIn`.
     - `/acceder` gets its own key, `auth.legalNoticeSignIn` (§ 6.C).
     - There is no checkbox.
  5. **Texts in the same deploy:** § 6.A (a new terms section, "Cómo se celebra este
     contrato", with a new `terms.updated`) and § 6.B (the privacy policy's "Cuenta" line,
     with a new `privacy.updated`). `HEALTH_CONSENT_VERSION` does not change.
  6. **Console.**
     - Consentimientos gets a "Condiciones de uso" row: the current version, and the
       accounts on it, on an older one, and with no record.
     - Sistema shows `TERMS_VERSION` beside the other versions.
     - The admin e2e exact key lists are updated in the same change.
  7. **Tests.**
     - An account created by email and one created with Google (the e2e provider stub)
       have `termsVersion = TERMS_VERSION` and a non-null `termsAcceptedAt`.
     - A sign-up `POST` with `termsVersion` in its body does not write it.
     - The consents response has its exact key list.
     - No console response carries the version on an addressed row.
- **Not in this phase:** asking `null` or older accounts to accept again; the LSSI
  art. 28 confirmation; rewriting the "continuing to use means you accept" clause; the
  acceptance at Stripe checkout. The note's § 7 lists the questions for a lawyer.
- **Acceptance criteria**: PRD 10 (the legal-texts half), 13.
- **Verification**:
  - `pnpm --filter database generate` produces exactly one migration, and
    `node scripts/check-migrations.mjs` passes.
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api --filter=web`.
  - The touched e2e suites, and CI.
  - `/local-probe` on `/registro` and `/acceder` at 320, 390 and 1280 px, in both themes:
    the notice is visible before the provider buttons with no scrolling.

## Hand-off

- **`0028` is the floor.**
  - No new page, table or endpoint shows a person's plan, meal, profile, health value or
    allergy.
  - Nothing new appears on an addressed row except the audit log.
  - Quality, retention and use are shown only aggregated over a period, with no per-day
    series that could be one person.
  - When in doubt, leave it out and ask the owner.
- **Every new admin route** is `@Roles('admin')`, with 404 before validation. Free text is
  always `q` (the log redacts only `q`). Sorts come from allow-lists, and bad input is
  `422 INVALID_INPUT`. See `apps/api/AGENTS.md` § Admin.
- **The admin e2e suite pins exact key lists** (`PERIOD_KEYS`, `AI_KEYS`, `STATS_KEYS`,
  `Object.keys(...).toEqual`). Every new response field is added there in the same
  change, or CI fails.
- **Probe with a fresh build**, never `servers.sh start --no-build` after an API change:
  a stale API build crashes the new pages.
- **UI rules** (`apps/web/AGENTS.md`):
  - one component per file, module CSS and tokens only, `<Fragment>`;
  - both dictionaries in the same change;
  - tables on a `Card`, cells on one line except prose;
  - `consoleMetadata` on every page;
  - `apple-web-design` before UI, `dataviz` before charts.
- **Production is read-only.** Measure on dev, read-only, with the guard. The one
  migration reaches production through the deploy.
- **Worktrees**, never a stash. Only the `tests` agent runs end-to-end suites locally,
  with `VAPID_*` blank. `pnpm check:leaks` runs before every push.
- **Pairs that can run as a `/team`:** 1 + 3 (API first, then web), and 4 + 5 once 5's
  wait is over. 2, 6 and 7 go alone.

## Out of scope

- Stopping plan generation at the cap (`0071`, owner's D1). The wall is the OpenRouter
  key's monthly cap (`0064`).
- Reminder opens: a pixel or beacon (ePrivacy).
- Ingredients without allergens or countries as a console check; the seed tests cover
  them.
- Push alerts to the owner, billing and Stripe figures, CSV export, the OmniRoute
  gateway, and Neon or Vercel quotas read from the app.

## PRD acceptance criteria → phases

| PRD | Phase |
| --- | --- |
| 1 Recording (four events, `feature`, `app_used` once a day, hook test) | 1 |
| 2 Plan quality recorded, never on an addressed row, shown aggregated | 1, 5 |
| 3 Audit: one row per action, same transaction, SET NULL, no body or IP | 2 |
| 4 "Active" reads `session_started ∪ app_used`, dated | 3 |
| 5 Catalogue quality, should-be-zero, the app's own helpers | 3 |
| 6 Spend gauge, uncosted calls, per feature, sweep stops at 80 % | 4 |
| 7 Retention as counts, no small percentages, approximate labelled | 5 |
| 8 Sweep state and history, crons' last run and 26 h warning, failed mails | 3, 5 |
| 9 Alerts: digest when needed, two immediate alerts, 6 h de-dup, no `@`, legal-reviewed | 6 |
| 10 Notifications per channel, check-in within 3 days, consents; legal texts if `legal` says so | 3, 7 |
| 11 Sistema returns only booleans, versions, dates and a hash | 3 |
| 12 007's findings closed | 1, 3 |
| 13 Product-only Embudo chart, admin 404s, dictionaries, leaks, accessibility, gate, 0 € | all |
