# Plan — Project 025: Anyone can open a practice

> **Purpose**: the phased technical execution plan — the engineering half of the
> contract. `/execute-project` follows this literally; executors implement phases, they
> do not redesign them. If implementation must diverge, the plan is amended in the same
> change and the deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes. **Written by**: a
> planner agent via `/plan-project`; approved by the owner before execution starts.
> Write repo-relative: no absolute paths, no references to other private repos.

- **Status**: draft — awaiting the owner's read
- **Type**: standard
- **PRD**: [./PRD.md](./PRD.md) — every acceptance criterion maps to at least one phase; the
  mapping is on each phase's **Acceptance criteria** line, and the table at the end checks it.
- **Routing profile**: `tiered` (AGENTS.md § Model routing), with its standing exception
  applied: phases that decide **who may read a client's data** (the badge, the delegated path,
  the guard) or that name allergens run at `quality-max` — opus @ high. That is phases 3–7.
  Phase 2 is opus @ high because it carries a migration. No phase runs on `fable`.

## Design summary

The shape is fixed by [`0111`](../../decisions/0111-a-badge-is-a-dated-check-and-the-link-decides-how-much-is-seen.md),
written with this plan, inside the owner's decisions of
[`0110`](../../decisions/0110-anyone-may-offer-their-services-and-a-checked-badge-is-what-opens-health-data.md)
and his answers of 2026-11-18 folded into the PRD.

- **"May practise" stays the `professionals` row**, now self-service. Every join on the
  delegated path already reads it, so nothing is moved.
- **The badge is derived from an append-only record of checks**, computed per request in one
  repository function and cached nowhere: a lapse or a removal closes access on the next
  request without a job having to run first.
- **The link decides how much is seen.** `CareRepository.activeLink` returns a scope, `full`
  or `plan`; `withClient` refuses every kind outside it with the 404 of every denial. `full`
  needs the badge **and** the link's own consent to the badged list. The cut sits in core,
  beside the health branch that already exists — not on a screen and not in a presenter.
- **A plan made through a link carries the link** (`meal_plans.care_link_id`), which is how a
  `plan` scope lists only "the plans they made through the link".
- **Ordering keeps every boundary safe.** The badge exists (3) and the view narrows on it (4)
  and consent splits by tier (5) **before** `practiceOpen` leaves the access check and anybody
  can open a practice (6). Until 6 lands, the only professionals are 004's grants, backfilled
  as badged, so phases 2–5 change nothing anybody sees. The `professional` switch stays off in
  production throughout, and is thrown only in phase 10, by the owner.
- **Texts first, wired last.** The `legal` agent drafts every text in phase 1 so that the
  code phases wire approved words; a version constant moves only in the phase that ships its
  words (phase 8 for the agreement and the consent, phase 10 for the terms and the policy).

**Amended after phase 1 (2026-11-18)**, from the `legal` agent's
`docs/legal/2026-11-18-anyone-can-open-a-practice.md` §§ 2, 3 and 9 and the owner's tapped
answers: F1 (the health consent names the illness rule, phase 5), F4 (no notice is distinct
under the illness rule, phase 5), C5 (the practitioner's re-check reminder, phase 3), C8 (the
owner's alert carries counts and a link, phase 3), F6 (refuse and hide are one act, phases 6
and 9), C12 (the college-issued e-mail channel is dropped: three channels, phases 2, 3 and 9),
C1–C4 (wording, phase 8), a real **suspension** of a practitioner (phases 2, 6 and 9;
[`decisions/LOG.md`](../../decisions/LOG.md) 2026-11-18), and the English grep (phase 10).

## Phases

### Phase 1 — The texts and the documents, drafted before any code

- [x] done — approved by the owner 2026-11-18 (tapped options); see LOG.md and
  `docs/legal/2026-11-18-anyone-can-open-a-practice.md`
- **Dispatch**: opus @ high, the `legal` agent (the only writer under `docs/legal/`) —
  `/execute-project 025 phase 1` — owner-approves: every text below and the `PRODUCT.md`
  amendment.
- **Goal**: every word this project ships, and the documents B9 requires, exist and are
  approved before a screen needs them.
- **Scope**: `docs/legal/**` (the `legal` agent), `docs/PRODUCT.md` § Scope (drafted here, the
  owner approves; `docs/` is "owner decides, agents draft").
- **Steps**:
  1. **DPIA addendum** (`docs/legal/dpia.md`) and **record-of-processing rows**
     (`docs/legal/record-of-processing.md`): professionals who sign themselves up; the badge
     checks and codes (including a postal address and a phone the owner reads from a
     register); health data reaching un-verified recipients under a consent naming them; the
     first-look queue and its statements of reasons (legal § 3.e table, B9).
  2. **The professional's agreement, version 2.0.0** (`docs/legal/textos/01`): two tiers;
     statutory secrecy for the badged, contractual for the un-badged; what an un-badged
     practitioner may never receive; the allowed words and the fixed notice; the badge, its
     yearly re-check and lapse; the first look and its reasons; never a minor; P2B grounds for
     suspension and 15 days' notice of changes.
  3. **The client's consent, version 3.0.0** (`docs/legal/textos/05` § B): the badged list
     (today's, plus the separate health line) and the un-badged list (the plan only; not a
     verified health professional; no statutory secrecy; may deduce allergies from refused
     dishes and roughly the daily energy from the plan's totals; both controllers named, pending
     M12); the re-consent sentence that widens a link after a badge.
  4. **Mails and notices** (`docs/legal/textos/06`): the badge code by e-mail; the letter text
     for a code by post; the script for the owner's call; the re-check reminder; the lapse and
     removal statements of reasons; the first-look refusal and hiding statements of reasons;
     the illness rule's two notices (client: plain; practitioner: names no condition, reads as
     an ended link or an unanswered invitation); the change notice to every account.
  5. **`/privacidad` and `/condiciones`**: the replacement for «Tu dietista en NutrIA», «Si
     trabajas con un dietista», the liability paragraph, and every sentence of legal § 1.3 this
     project makes false — drafted as text, wired in phase 10.
  6. **The words table**, final, as a list the `core` function of phase 3 can be tested
     against (badge-only; never in v1; clinical; allowed with the notice), and the fixed
     notice's exact wording.
  7. **The neutral strings**: «clientes», «tu profesional», and a sentence for a first look
     that does not read as endorsement.
  8. **`PRODUCT.md` § Scope**: a professionals' area where anybody may offer their services
     moves into scope; the rest of "coach marketplaces" follows with its project. *As built:
     the legal file's § 8.1 and § 8.2 (§ Users too) were applied to `docs/PRODUCT.md` by the
     planner once the owner approved them, not in phase 10.*
- **Acceptance criteria**: PRD 21 (documents), and the approved words for PRD 6, 18, 19, 20, 22, 23 and
  the PRD's scope item 13.
- **Verification**: `pnpm check:leaks`; `pnpm format`; the owner's approval of each text,
  recorded in LOG.md with its date.

### Phase 2 — The stores and the migration

- [x] done
- **Dispatch**: opus @ high — `/execute-project 025 phase 2` — deviation from `tiered`'s
  implementation row: it carries a migration that runs against production during the API's
  build, reviewed by `migration-reviewer` (never below opus @ high).
- **Goal**: the tables, columns and backfills of `0111`, with nothing yet able to reach them.
- **Scope**: `packages/database/src/schemas/{professional,care,plan,_enums}.schema.ts`,
  `packages/database/src/migrations/**`, `packages/core/src/entities/{Professional,Care}/**`,
  and the tests beside each. **No repository logic and no route.**
- **Steps**:
  1. `professionals.collegiate_number` → nullable (`DROP NOT NULL`, metadata only).
  2. `professional_badge_checks` (append-only, cascades with the practitioner): `kind`
     (`applied`, `pass`, `fail`, `withdrawn`, `lapsed`; an `applied` row holds the register
     and number the practitioner declared, and is what a code points at), `checked_at`, `checked_by` (set null), `register`,
     `number`, `channel` (`register_email`, `post`, `phone` — all three read from the public register;
     the college-issued e-mail channel was dropped by the owner on 2026-11-18, C12), `reason` (text,
     for `fail`/`withdrawn`/`lapsed`), `due_at`. No identity document, no contact column beyond
     the channel.
  3. `professional_badge_codes`: `code_hash`, `check_id`, `channel`, `expires_at` (30 days),
     `used_at`, cascading with the practitioner. The contact it went to is **not** stored after
     sending.
  4. `professional_profiles` (singleton per practitioner): `display_name`, `studies` (≤ 2,000),
     `price_cents`, `price_unit` (`consultation`, `month`, `plan`), `hours` (seven day ranges,
     JSON, display only), `queued_at`, `seen_at`, `seen_by` (set null), `hidden_at`,
     `hidden_reason`.
  5. `care_links.consent_scope`: a new enum type (`full`, `plan`), not null, default `full`
     (every existing link consented to 004's list). A new type used in the migration that
     creates it is not the `0060` two-release case, which is about adding a value to an
     existing type; `migration-reviewer` confirms.
  6. `meal_plans.care_link_id`: nullable, `REFERENCES care_links ON DELETE SET NULL`. No index
     in this migration unless `migration-reviewer` asks for one: every reader filters by
     `user_id` first.
  7. Backfill: one `pass` row per existing `professionals` row, `checked_at = granted_at`,
     `checked_by = granted_by`, `number = collegiate_number`, `channel` null with
     `reason = 'project 004 grant'`, `due_at = now() + interval '30 days'`, so the re-check is
     due within 30 days of the release (PRD 4) and lapses 30 days after that if not done.
  8. `practice_restrictions` (append-only, cascading with the **account**, not with the
     `professionals` row, so it outlives a closed practice): `kind` (`suspended`, `closing`,
     `lifted`), `reason`, `acted_by` (set null), `acted_at`, `effective_at` (a `closing` row's
     date, 30 days on). What stands is the latest row; nothing else stores it.
  9. Zod entities in `core` for each new row; `Professional` loses `collegiateNumber`'s
     `min(1)` requirement.
- **Acceptance criteria**: the storage of PRD 3, 4, 9 (`care_link_id`), 12 (`consent_scope`),
  18 (queue columns), 24 (`practice_restrictions`); the migration is clean.
- **Verification**:
  - `pnpm db:local status` (else `pnpm db:local reset`), then `pnpm --filter database migrate`
    against the local Postgres (`NUTRIA_LOCAL_PG=1`)
  - `node scripts/check-migrations.mjs --drift` clean
  - `pnpm --filter database test`, `pnpm --filter core build`, `pnpm --filter core test:coverage`
  - `pnpm ts:check && pnpm lint`
  - `migration-reviewer`'s verdict in LOG.md

### Phase 3 — The badge, as the owner's check

- [x] done
- **Dispatch**: opus @ high — `/execute-project 025 phase 3` — `quality-max`: it decides who
  may later receive health data. Reviewed by `invariant-reviewer`.
- **Goal**: a practitioner can apply, the owner can check, a code proves the contact, and the
  badge lapses and is withdrawn with reasons — in core and the API, with no screen yet.
- **Scope**: `packages/core/src/{repositories,controllers}/Professional/**`,
  `packages/core/src/domain/ProtectedWords/**` (new), `apps/api/src/modules/{care,admin}/**`,
  `apps/api/src/modules/recipes/controllers/Cron.controller.ts` (the daily sweep's call only),
  `apps/api/src/modules/owner-alerts/**`, `apps/api/src/modules/email/**`, the tests beside each.
- **Steps**:
  0. **From phase 2's review** (amended 2026-11-18): (a) a data-only catch-up migration writes a
     `pass` (due 30 days on) for every `professionals` row with no check yet —
     `INSERT … SELECT … WHERE NOT EXISTS` — so a grant made through the old route between
     `0071` and this phase is not left without one; (b) the sweep writes a **reason** on every
     `lapsed` row (`professional_badge_checks_removal_has_reason` refuses one without);
     (c) the code cap uses `professional_badge_codes.attempts`; (d) `badgeOf` reads by
     `user_id`: the three stores hang off the account, not the `professionals` row.
  1. `ProfessionalBadgeRepository.badgeOf(userId, now)`: among the decisive rows (`pass`,
     `fail`, `withdrawn`, `lapsed`; `applied` is not one) the latest is `pass`, and
     `now < due_at + 30 days`. The **only** definition of the badge;
     every other reader calls it.
  2. Practitioner routes, behind the guard's before-practice lane: `GET /care/practice/badge`
     (state: none, applied, code sent, badged, due, lapsed — never the code), `POST` apply
     (register and number, with the art. 13 sentence of phase 1), `POST …/code` (enter it).
     The body carries no contact field; a wrong, used or expired code is the same 404 as an
     unknown one, and attempts are capped per practitioner in Postgres.
  3. Owner routes under `/admin/professionals/:userId/badge`: record channel + contact, read
     from the public register only, and issue a code (`register_email` sends it with the
     art. 14 information and the "if this was not you" path of `06` § R, F2; `post` and `phone` return it once to the console
     and never again); confirm (writes `pass`, `due_at` = twelve months); fail or withdraw with
     a reason (writes the row, mails the statement of reasons; "it was not me" from the
     register's contact is a `fail` with that reason); the due list.
  4. The daily sweep (`/cron/reminders`), **only while the `professional` switch is on**, so
     nothing is mailed before phase 10 (the badge itself still lapses by date, being derived):
     the owner's reminder of what is due — one alert carrying **counts and a link to the
     console, no address** (C8; the owner's alerts carry none since 2026-09-29); **the
     practitioner's own reminder when their re-check falls due** (`docs/legal/textos/06`
     § U.2, C5), once; for each badge 30 days past due, a `lapsed` row and its statement of
     reasons (`06` § V), once.
  5. `ProtectedWords`: normalisation (case, accents, punctuation, spacing, common
     substitutions) and the three lists of phase 1, with a test per listed word.
  6. A badge's number is presented only from a `pass` check (PRD 5).
  7. **Transitional, until phase 6 retires it**: the owner's existing grant route also writes a
     `pass` check, so the existing care suites' professionals stay badged through phases 4–5.
- **Acceptance criteria**: PRD 2 (badge part), 3, 4, 5, 6 (the function), 14, 15, 16 (the new
  module inside both boundary specs).
- **Verification**:
  - `pnpm --filter core build && pnpm --filter core test:coverage`
  - `pnpm --filter api test` (incl. `apps/api/src/modules/ai/health-boundary.spec.ts` and
    `apps/api/src/modules/assistant/assistant-boundary.spec.ts`)
  - `pnpm ts:check && pnpm lint`
  - `invariant-reviewer`'s report in LOG.md

### Phase 4 — The narrower view, in core

- [x] done
- **Dispatch**: opus @ high — `/execute-project 025 phase 4` — `quality-max`: the delegated
  path and allergen naming. Reviewed by `invariant-reviewer`; a P0 that survives two rounds
  stops the project for redesign (`0013` § 9, stop signal).
- **Goal**: an un-badged link reaches the plans its practitioner made through it and nothing
  else, by any route.
- **Scope**: `packages/core/src/controllers/{Care,Plan}/**`,
  `packages/core/src/repositories/{Care,Plan}/**`, `apps/api/src/modules/{care,check-ins}/**`,
  the tests beside each.
- **Steps**:
  1. `activeLink` returns `scope`: `full` when `badgeOf` holds and `consent_scope = 'full'`,
     else `plan`. `withClient` refuses `overview`'s non-plan reads, `progress`, `targets`
     (read and write) and `health` outside `full`, with the same `NotFoundError`. The health
     branch needs `full` **and** `sharesHealth`.
  2. `overview` in `plan` scope builds the plan-only page: the active plan and the history,
     each only if it carries this link's `care_link_id`; `progress`, `targets` and `health`
     keys absent.
  3. A plan presenter for `plan` scope drops `strategy`, every day's `targets` and every
     meal's `status`; `listPlans`, `pendingPlan` and `planJob` go through it.
  4. `care_link_id` is written inside the existing transactions when the professional
     generates through `withClient`, when a plan lands `pending_review` for that link
     (`publishingLink`: reviewing it is how it becomes theirs, PRD scope 7), and at publish.
  5. The roster in `plan` scope never yields `check_in_due` (folded into `plan_under_way`);
     `activeProfessional` returns null outside `full`, so the check-in notice stops.
  6. Every error a `plan`-scope practitioner can receive from generate, swap or publish names
     no allergen, intolerance or condition (`0013` § 5.3): a test per refusal path.
- **Acceptance criteria**: PRD 9, 10 (core and API), 11 (health branch), 12 (narrowing on
  loss), 13, 14, 15.
- **Verification**:
  - `pnpm --filter core build && pnpm --filter core test:coverage`
  - `pnpm --filter api test`
  - `pnpm ts:check && pnpm lint`
  - the `tests` agent runs `care.e2e-spec.ts`, `care-review.e2e-spec.ts` and
    `plan-scheduled-care.e2e-spec.ts`, one at a time, after the build and nothing else heavy
  - a core test per `CARE_ACCESS_KINDS` value asserting the `plan`-scope outcome, and key
    absence on every response type
  - `invariant-reviewer`'s report in LOG.md

### Phase 5 — Consent per tier, and the illness rule

- [x] done
- **Dispatch**: opus @ high — `/execute-project 025 phase 5` — `quality-max`: consent to
  health data and a write path inside the health module. Reviewed by `invariant-reviewer`.
- **Goal**: the client consents to the list of the tier they link to, widening needs their
  fresh consent, and a declared illness or medication never sits behind an un-badged link.
- **Scope**: `packages/core/src/{entities,controllers,repositories}/{Care,Health}/**`,
  `apps/api/src/modules/{care,health-data}/**`, the daily sweep's call in
  `Cron.controller.ts`, and — by the `frontend` agent — the health screen and the
  `health.consentNote` / `health.illnessLinkWarning` keys of both dictionaries, the tests
  beside each.
- **Steps**:
  0. **From phase 2's review** (amended 2026-11-18): every insert into `care_links` names its
     `consent_scope`; the release after this phase drops the column's `full` default, so an
     insert that forgets the scope fails instead of recording a consent nobody gave.
  1. `CARE_SHARED_PLAN` (the plan list) beside `CARE_SHARED`; `presentInvitationDetail` and
     `presentLink` pick by the practitioner's badge: no health line and no number for an
     un-badged practitioner. `CARE_CONSENT_VERSION` stays until phase 8 ships its words.
  2. Acceptance records `consent_scope` from the badge at that moment. A client route
     re-consents an open link to the badged list, only while the badge stands.
  3. `setSharesHealth(true)` is refused outside `full`.
  4. **The illness rule** (`0111` § 8): `CareRepository.accept` refuses, in its transaction,
     when the client has an illness or medication on record and the practitioner is
     un-badged — a client-facing error with no condition in it, and the invitation stays open
     to expire like any unanswered one; `HealthController.replace` ends such a link in its own
     transaction when a declaration arrives; the daily sweep ends the links of practitioners
     who lost the badge while a client has one. "On record" is any row of `HEALTH_CONDITIONS`
     (pregnancy and breastfeeding included) or any medication; supplements are not in the rule
     (F1).
  5. **Notices under the rule (F4).** The client gets the plain notice of `textos/05` § G. The
     practitioner gets **nothing distinct**: a refused acceptance sends them nothing (the
     invitation simply goes unanswered); an ended link reads exactly as one the client ended.
     If a value is added to `care_link_ended_by`, every practitioner-facing view and mail
     presents it exactly as `client`. No template fires only under this rule.
  6. **The health consent names the rule (F1).** `health.consentNote` takes the sentence of
     `textos/05` § C bis and `HEALTH_CONSENT_VERSION` moves `1.1.0` → `1.2.0` **in this
     phase**, so the purpose is named no later than the rule runs; `health.consentStale` asks
     again. **The warning before saving (C7)**: on the health screen, a person linked to an
     un-badged practitioner reads `health.illnessLinkWarning` before a declaration is saved.
  7. **Amended 2026-11-19, during the phase** (the invariant review and the approved texts;
     decided by the lead inside the owner's "widening needs the client's fresh consent"):
     - the accept body **names the list the client read** (`consentScope`, required), so a
       badge that lands between reading and accepting cannot store a wider consent;
     - a rule ending is recorded for what it is — `care_link_ended_by` gains `badge_lost`
       (migration 0073) and `declared` (0074) — and the client reads the reason at
       `GET /care/links/me/ended`; a practitioner reads both as `client`;
     - **a badge that stops standing narrows the stored consent**: open links become `plan`,
       health line off, `narrowed_at` dated — in the owner's removal, in the sweep, and before
       any pass recorded while no badge stood; a regained badge widens nothing;
     - re-consent leaves its own evidence (`scope_consented_at`, `scope_consent_version`,
       0074) and never rewrites the acceptance's date and version;
     - the sweep's ending mails the **client** (`textos/06` § Y,
       `CareLinkEndedByRule`); step 5's "no template fires only under this rule" is about the
       practitioner;
     - scope grows by: migrations 0073 and 0074 (`migration-reviewer`),
       `apps/api/src/modules/email`, the error class and its filter mapping, the invitation
       page and the link card (the minimum so a `plan` invitation or link renders nothing
       empty; the full screens stay phase 8), and the local probe's account script.
- **Acceptance criteria**: PRD 10 (invitation and link views), 11, 12, 22, 25.
- **Verification**:
  - `pnpm --filter core build && pnpm --filter core test:coverage`
  - `pnpm --filter api test`
  - `pnpm ts:check && pnpm lint`
  - the `tests` agent runs `care.e2e-spec.ts` and `health-data.e2e-spec.ts`, one at a time
  - a test that every practitioner-facing presenter maps each `care_link_ended_by` value
    other than `professional` to `client`, and that nothing is queued to the practitioner by
    a refused acceptance or an illness-rule ending
  - `pnpm --filter web test` and `/local-probe` on the health screen
  - `invariant-reviewer`'s report in LOG.md

### Phase 6 — Anyone can open a practice

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 025 phase 6` — `quality-max`: the guard is
  authorisation. Reviewed by `invariant-reviewer`.
- **Goal**: an adult account opens its own practice, free, with ten seats, a profile and a
  place in the owner's queue — and no premium.
- **Scope**: `apps/api/src/shared/guards/Professional.guard.ts`,
  `packages/core/src/{controllers,repositories}/{Care,Professional}/**`,
  `packages/core/src/domain/Allowance/**` (the name, `ALLOWANCE_BOUNDS`, the registry),
  `apps/api/src/modules/{care,admin}/**`, the console's allowance row
  (`apps/web/src/app/(admin)/admin/ajustes/**` and both dictionaries), every fixture that
  enumerates the allowances (the pitch's, and `apps/api/test/billing.e2e-spec.ts`, which
  hard-codes every number on purpose — edited by the `tests` agent), the four care suites'
  set-up (granting gives way to self-service plus a badge, by the `tests` agent), the tests
  beside each.
- **Steps**:
  0. **From phase 2's review** (amended 2026-11-18): the owner's revoke of "may practise" also
     writes a `withdrawn` check with its reason — the badge stores hang off the account, so
     without it an old `pass` would survive a reopened practice.
  1. `POST /care/practice`: the session's account, switch on, confirmed address, a birth date
     on record or given in the body, checked by `assertOldEnough` **and** non-null; writes the
     `professionals` row with nothing from the body but the birth date. Every refusal is 404 —
     including an account under a standing `suspended` or `closing` restriction, or one whose
     practice was closed (step 7).
  2. `practiceOpen` leaves the guard, `practises`, `activeProfessional` and the `practising`
     join. Seats read `practiceOpen ? includedClients : practiceClients`, the new structural
     allowance (10 on both tiers), resolved per `0097` inside the invitation's transaction.
  3. `tierOf` and `coveredByOpenPractice` untouched; a test that a client of a free practice
     keeps their own tier.
  4. Profile routes (`GET`/`PUT /care/practice/profile`): schema with `ProtectedWords` and the
     badge as context; a create or a change to a free-text field sets `queued_at`; a badge lost
     re-queues a profile carrying badge-only words (`0111` § 7).
  5. Owner's queue: `GET /admin/professionals/queue`, mark seen, or **hide** with a reason —
     refusing and hiding are **one act** in the data (`hidden_at`, `hidden_reason`) and one
     statement of reasons (`textos/06` § X), whose wording differs only by whether the profile
     had been marked seen (F6). Hiding is immediate. Practitioner data only; no client.
  6. Retire `POST /admin/accounts/:id/professional` and `GrantProfessional.dto.ts`. The 004 criterion-1 spec in `AdminProfessionals.controller.spec.ts` is
     replaced by its inversion — no body can set the badge, `practiceOpen` or `includedClients`
     — and LOG.md names the replaced test.
  7. **Suspension and close** (owner, 2026-11-18). `PracticeRestrictionRepository.standing`
     is the one reader. Owner routes under `/admin/professionals/:userId`: **suspend** (a
     `suspended` row with a reason; immediate: the guard, `practises` and the `practising`
     join refuse the account, every client route is 404, the statement of reasons is mailed);
     **close** (a `closing` row with a reason and `effective_at` 30 days on, mailed at once as
     notice; the practice works until then; at `effective_at` the daily sweep deletes the
     `professionals` row as today's revoke does, and the restriction stays, so the account
     cannot reopen); **lift** (a `lifted` row). Today's immediate revoke route becomes the
     close act. Hiding a profile and withdrawing a badge stay immediate.
  - **Precondition** — owner-approves: the suspension, lifting and close statements of reasons
    (`docs/legal/textos/06` § W bis) and the agreement 2.0.0's §§ 11 and 13 were drafted by the
    `legal` agent on 2026-11-18, after the owner decided the suspension; he approved the
    decision, not yet these words. He approves them before this phase starts.
- **Acceptance criteria**: PRD 1, 2, 6 (server side), 7, 8, 14, 15, 16 (the profile inside
  both boundary specs), 18 (API), 24.
- **Verification**:
  - `pnpm --filter core build && pnpm --filter core test:coverage`
  - `pnpm --filter api test`, `pnpm --filter web test`
  - `pnpm ts:check && pnpm lint`
  - the `tests` agent runs `billing.e2e-spec.ts` and the four care suites, one at a time
  - `invariant-reviewer`'s report in LOG.md

### Phase 7 — The walk: every route, as every kind of account

- [ ] pending
- **Dispatch**: opus @ high, the `tests` agent only — `/execute-project 025 phase 7` —
  deviation from `tiered`'s implementation row: this suite is the proof of PRD 10, the
  invariant the whole project exists to keep.
- **Goal**: end-to-end proof, on the local Postgres, that no un-badged account obtains
  weight, targets, adherence, check-ins, illnesses or medication by any route, and that the
  existing care suites still hold.
- **Scope**: `apps/api/test/**` only.
- **Steps**:
  1. `care-unbadged.e2e-spec.ts`: an un-badged practitioner walks every care route (enumerated
     from the care controllers, so a new route without a case fails the suite) and every
     response is checked for absent keys; a plan from before the link is 404 by id.
  2. `care-badge.e2e-spec.ts`: apply, code, confirm; wrong/used/expired code; lapse by clock;
     withdrawal; narrowing on the next request; widening only after re-consent.
  3. `care-open-practice.e2e-spec.ts`: self-service opening and its refusals; ten seats;
     the client's tier unchanged; no body sets the badge; the illness rule's three points,
     with nothing sent to the practitioner; a suspended or closed account cannot reopen.
  4. The four existing suites (`care`, `care-practice`, `care-review`, `plan-scheduled-care`)
     pass, each change named in LOG.md.
  5. **One suite at a time**, by `--runTestsByPath`, with the command of
     `apps/api/test/README.md` § On this machine; nothing else heavy running.
- **Acceptance criteria**: PRD 9, 10, 12, 17, 22, and the end-to-end half of 1–8.
- **Verification**: each suite's run and count in LOG.md; `pnpm --filter api test`.

### Phase 8 — The practitioner's and the client's screens

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 025 phase 8` — the `frontend` agent with
  `accessibility`; `apple-web-design` mandatory. — human-verify: the owner opens a practice and
  accepts an invitation on his iPhone.
- **Goal**: the flows exist on screen with the approved words, per tier.
- **Scope**: `apps/web/src/app/(app)/{consulta,invitacion,perfil}/**`, `apps/web/src/components/**`,
  `packages/ui/**` if a component is needed, `apps/web/src/i18n/dictionaries/{es-ES,en-GB}.ts`,
  and `PROFESSIONAL_AGREEMENT_VERSION` / `CARE_CONSENT_VERSION` in `packages/core/src/entities`.
- **Steps**:
  1. `/consulta`: open a practice (birth date if missing, agreement 2.0.0); the profile form
     with the server's word refusals shown inline; the badge application and code entry; seats
     «x de 10»; the plan-only client page for an un-badged practitioner; «clientes» for
     **every** tier, the badge line carrying the title (C3); NutrIA's own labels avoid
     «consulta» where a client or a profile reads them — «por sesión» (C2).
  2. The client: the invitation page per tier with the fixed notice and its list — the
     un-badged one says «the plans they make for you and where things stand», no chat, until
     project 3 (C1); «tu profesional» for **every** tier (C3); «Acepto y consiento» on the
     un-badged accept button (C4); the re-consent card; the illness refusal, plain.
  3. `PROFESSIONAL_AGREEMENT_VERSION` → 2.0.0 and `CARE_CONSENT_VERSION` → 3.0.0 in this phase,
     with their words.
- **Acceptance criteria**: PRD 12 (screen), 19, 20 (the agreement and consent), 22 (screen).
- **Verification**: `pnpm --filter web test`, `pnpm ts:check && pnpm lint`, `/local-probe` at
  320, 390 and 1280 px, light and dark, both tiers (nothing overflows), and the owner's
  confirmation recorded in LOG.md.

### Phase 9 — The owner's console

- [ ] pending
- **Dispatch**: sonnet @ medium — `/execute-project 025 phase 9` — the `frontend` agent with
  `accessibility`, from the complete API of phases 3 and 6.
- **Goal**: the owner checks badges and looks at profiles without reading anybody's client.
- **Scope**: `apps/web/src/app/(admin)/admin/profesionales/**`, `apps/web/src/components/**`,
  both dictionaries.
- **Steps**:
  1. The badge page: declared name and number, the register's link, channel (three: an
     e-mail the register lists, a letter, a call) + contact entry, the code shown once for
     post and phone, confirm, fail or withdraw with a reason.
  2. The re-check list, the first-look queue (seen, or hide with a reason — one act), and the
     professionals table without an unchecked number.
  3. Suspend, close (its 30 days shown) and lift, each asking for a reason; the standing
     restriction shown on the row.
  4. The switch's strings stop saying «Consulta para dietistas».
- **Acceptance criteria**: PRD 3, 4, 5 (console), 18 (screen), 19 (console words), 24
  (console).
- **Verification**: `pnpm --filter web test`, `pnpm ts:check && pnpm lint`, `/local-probe` on
  `/admin/profesionales` at the three widths, both themes.

### Phase 10 — The texts, the notice, then the switch

- [ ] pending
- **Dispatch**: opus @ medium, the `frontend` agent with the `legal` agent reviewing —
  `/execute-project 025 phase 10` — owner-gated: the owner sends the change notice to every
  account, then throws the `professional` switch in `/admin`. — human-verify: the switch on,
  checked on his iPhone.
- **Goal**: nothing published says what the product no longer does, everybody was told, and
  then it is on.
- **Scope**: `apps/web/src/i18n/dictionaries/{es-ES,en-GB}.ts`, the legal pages,
  `packages/core/src/entities/User` (`TERMS_VERSION`, by `backend`),
  `docs/projects/004-dietitian-workspace/PRD.md` (a pointer line only), `docs/ROADMAP.md`,
  `docs/decisions/LOG.md`.
- **Steps**:
  1. Wire phase 1's `/privacidad` and `/condiciones` texts (legal file §§ 4–5);
     `TERMS_VERSION` `2.3.0` → `2.4.0`; the policy's `updated`.
  2. Run `grep -nE 'dietista|nutricionista|colegiad|secreto profesional|paciente'` over
     `es-ES.ts` **and** `grep -niE 'dietitian|dietician|nutritionist|registered|registration
     number|professional secrecy|patient'` over `en-GB.ts`; every hit is disposed of as the
     legal file's § 7 table says. The list goes in LOG.md.
  3. PRD 004 gains a pointer to `0110`; ROADMAP gains this project's line. (`PRODUCT.md` was
     applied after phase 1.)
  4. Before the switch, `docs/legal/go-live-checklist.md` § 1 bis: the links accepted at
     consent `2.0.0` are counted read-only, and the owner's test links are ended so that no
     real link rests on the shorter text (legal file § 1).
  5. The owner sends the change notice (`docs/legal/textos/06`) to every account and LOG.md
     records the date; then, once the DPIA addendum is merged, he throws the switch;
     `docs/decisions/LOG.md` gains the dated line.
- **Acceptance criteria**: the PRD's scope item 13; PRD 20, 21, 23.
- **Verification**: `pnpm --filter web test`, `pnpm check:leaks`, `node scripts/check-static-pages.mjs`,
  `node scripts/smoke.mjs` after the deploy, and the owner's confirmation in LOG.md.

## Hand-off

Standing constraints for every executor of this project:

- **The owner's decisions are final.** `0110` and the PRD's § Decided by the owner are not
  reopened; a phase that seems to need one changed stops and logs it.
- **The cut lives in core.** No phase may narrow a view only on a screen or in an API
  presenter. If a route can reach a client's data, it goes through `withClient` and its scope.
- **The badge has one definition** (`ProfessionalBadgeRepository.badgeOf`) and no cache.
- **A version constant moves in the phase that ships its words**, never before.
- **Feature work runs as the agent team** (AGENTS.md § Common commands): `backend` for 2–6
  and for the version constants that phases 8 and 10 move in `packages/core`; `tests` for 7
  and every end-to-end run or fixture in the other phases; `frontend` + `accessibility` for
  8–10; `legal` for 1 and 10's texts;
  `invariant-reviewer` on 3–6; `migration-reviewer` on 2. A phase touching a directory no
  listed role owns has drifted — amend the plan.
- **After editing `packages/core` or `packages/database`, run `pnpm --filter core build`.**
- **Tests, probes and migrations run on the local Postgres** (`pnpm db:local`,
  `NUTRIA_LOCAL_PG=1`), never Neon. End-to-end suites only by the `tests` agent.
- **One heavy job at a time.** Never the gate, an end-to-end suite and a build together.
- **The screens follow the design the owner approved on 2026-11-18** («Aprobado»): sixteen
  phone screens on a private design canvas, <https://claude.ai/artifact/B8hhdEcvn6hte9aKMeFzE6>
  (the owner's account). Screens 8–10 and 13–16 are this project's; 1–7, 11 and 12 belong to
  the later projects. A screen is compared with its sheet before its phase is called done; the
  words on a sheet are illustrative and phase 1's approved texts win.
- **No model reads anything this project adds.** Profiles, badge records and codes join the
  walls of `health-boundary.spec.ts` and `assistant-boundary.spec.ts`; nothing of them is
  logged.

## Out of scope

The directory, search and requests (project 4 of `0013` § 9), the chat (project 3), ratings and
reports (project 5), public pages (project 6), `authored_by` and "put this dish here"
(project 2), any payment, an automated register lookup, a «Técnico Superior» mark, profile
photos, and a practitioner closing their own practice. Each waits for its own project, planned
when the owner asks.

## Criteria map

| PRD | Phases | PRD | Phases | PRD | Phases |
| --- | --- | --- | --- | --- | --- |
| 1 | 6, 7 | 9 | 4, 7 | 17 | 7 |
| 2 | 3, 6, 7 | 10 | 4, 5, 7 | 18 | 1, 2, 6, 9 |
| 3 | 2, 3, 9 | 11 | 4, 5 | 19 | 1, 8, 9 |
| 4 | 2, 3, 9 | 12 | 2, 4, 5, 7, 8 | 20 | 1, 8, 10 |
| 5 | 3, 9 | 13 | 4, 7 | 21 | 1, 10 |
| 6 | 1, 3, 6 | 14 | 3, 4, 6 | 22 | 1, 5, 7, 8 |
| 7 | 6, 7 | 15 | 3, 4, 6 | 23 | 1, 10 |
| 8 | 6, 7 | 16 | 3, 6 | 24 | 2, 6, 7, 9 |
| | | | | 25 | 5 |
