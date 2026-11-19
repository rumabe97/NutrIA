# LOG — Project 025: Anyone can open a practice

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

## Phase 1 — The texts and the documents, drafted before any code (2026-11-18)

- **Executor**: the `legal` agent on opus @ high (the only writer under `docs/legal/`); step 8
  applied by the planner.
- **Result**: done.
- **Evidence**:
  - New: `docs/legal/2026-11-18-anyone-can-open-a-practice.md` (the map, findings F1–F8,
    choices C1–C12, the `/privacidad` and `/condiciones` replacements, the words table, the
    disposition of every dictionary hit, the `PRODUCT.md` text, lawyer items M14–M17).
  - Amended: `docs/legal/dpia.md` (§ 9, DPIA 0.8: residual risk acceptable, no prior
    consultation), `docs/legal/record-of-processing.md` (rows 1, 3, 5 amended; 11, 12 new),
    `docs/legal/textos/01` (agreement 2.0.0 and the practice's screens), `textos/05` (consent
    3.0.0, re-consent, the illness rule's screens, § C bis), `textos/06` (§§ R–Z),
    `textos/02`, `textos/03`, `go-live-checklist.md` § 1 bis, `docs/legal/README.md`.
  - `pnpm check:leaks`: clean (its only output is the warning about uncommitted `.md` files).
  - Prettier was not run on `docs/legal/`: `pnpm format` runs per workspace package through
    Turbo and no package covers `docs/`, so there is no project command that formats it.
- **Owner's approvals**: every text of steps 1–8, the findings and choices C1–C11, by tapped
  options on 2026-11-18. C12 answered the same day by dropping the channel (below).
- **Deviations from plan**:
  - Step 8 (`PRODUCT.md`) was applied by the planner, not in phase 10: § Scope (legal file
    § 8.1) and § Users (§ 8.2), approved by the owner. Phase 10 no longer touches it.
  - **Two owner decisions**, recorded in [`decisions/LOG.md`](../../decisions/LOG.md)
    2026-11-18: (a) the college-issued e-mail channel is **dropped** (C12) — three channels
    remain, all read from the public register (an e-mail listed there, a letter, the owner's
    call). `0111` § 3 names no channel, so it is unchanged. (b) A real **suspension**: the
    console can suspend an account as a practitioner (immediate), a definitive close carries
    reasons and 30 days' notice, and a suspended, closing or closed account cannot reopen a
    practice (404). Hiding a profile and withdrawing a badge stay immediate.
  - **Plan amendments** (PLAN.md, and PRD scope 6, 9, 10, 11, 12, 13, 16 and criteria 3, 4,
    18, 19, 20, 22, 24, 25): phase 2 drops `college_email` and adds `practice_restrictions`;
    phase 3 sends the practitioner's re-check reminder (C5), keeps addresses out of the
    owner's alert (C8) and carries art. 14 and "not me" on every channel (F2); phase 5 moves
    `HEALTH_CONSENT_VERSION` to 1.2.0 with `health.consentNote` and the warning before saving
    (F1, C7), and sends the practitioner nothing distinct under the illness rule (F4); phase 6
    makes refuse and hide one act (F6) and builds suspend, close and lift, with a legal
    precondition for their two texts; phase 8 takes C1–C4; phase 9 gains the controls;
    phase 10 adds the English grep.
- **Decisions**: [`0111`](../../decisions/0111-a-badge-is-a-dated-check-and-the-link-decides-how-much-is-seen.md)
  (with the plan); the 2026-11-18 lines of [`decisions/LOG.md`](../../decisions/LOG.md).
- **Notes for phase 2**:
  - `channel` has three values: `register_email`, `post`, `phone`.
  - `practice_restrictions` cascades with the **account** (`user`), not with `professionals`,
    or a closed practice could be reopened.
  - The legal file's § 1 advises counting the links accepted at consent `2.0.0` read-only and
    ending the owner's test links before the switch; that is phase 10's checklist, not a
    migration.
  - Phase 6 cannot start until the `legal` agent has drafted, and the owner approved, the
    suspension and close statements and the agreement's § 13 clause.

## Phase 2 — The stores and the migration (2026-11-18)

- **Executor**: the `backend-high` agent on opus @ high, in its own worktree; reviewed by
  `migration-reviewer` (opus); end-to-end suites by the `tests` agent (opus).
- **Result**: done.
- **Evidence**:
  - Migration `0071_anyone_can_open_a_practice.sql`, generated by `pnpm --filter database
    generate` with one hand-added data step (the backfill of 004's grants). Applied to a fresh
    local Postgres: 72 migrations; `check-migrations --drift`: "schema and migrations agree".
  - `pnpm --filter core build` ok; core `test:coverage` 161 files, 4611 passed; database 69
    passed; `pnpm ts:check` 9/9; `pnpm lint` 7/7.
  - End-to-end, one suite at a time on local Postgres: `care` 72, `care-practice` 36,
    `care-review` 34, `plan-scheduled-care` 1, `professionals` 26, `admin` 86, `plan-lifecycle`
    11 — all passed, none skipped.
  - `migration-reviewer`: no P0; safe to deploy and to roll back; the API still running during
    the deploy works on the new schema; the guard's destructive patterns match nothing.
- **Deviations from plan**:
  - `professional_badge_codes.attempts smallint NOT NULL DEFAULT 0`, added here because phase 3
    caps attempts in Postgres and has no database scope.
  - The three new practitioner stores cascade from the **account** (`user_id`), as the record
    of processing rows 11–12 say, not from the `professionals` row.
  - Seven CHECK constraints the plan did not name (a closing has a date, a removal has a
    reason, a pass is due, an application declares its register and number, a hidden profile
    has a reason, studies length, price not negative).
  - An index on `meal_plans.care_link_id`, on the reviewer's finding.
  - Type-only fixes outside the phase's scope, no change of behaviour, because
    `collegiate_number` is now nullable: `ProfessionalController`, `CareController`,
    `ProfessionalRepository`, `CareRepository`, and `consentScope: 'full'` in three test
    fixtures.
  - The reviewer's P1 — the backfill's 30 days start at this deploy, not at the switch — is
    moot: the owner said on 2026-11-18 that production holds **no** granted professional. Not
    read from production (the read was denied and not worked around). Phase 3 gains a catch-up
    insert all the same.
  - The local database was reset to regenerate the migration, which reduced the local dish
    library (500 seed recipes left). Production untouched.
- **Decisions**: none new; the plan's phases 3, 5 and 6 each gained a step 0 from the review.
- **Notes for the next phase**: see phase 3's step 0. `badgeOf` reads by `user_id`; a `lapsed`
  row needs a reason; the code cap is `attempts`.

## Phase 3 — The badge (2026-11-18)

- **Executor**: the `backend-high` agent on opus @ high, in its own worktree; reviewed by
  `invariant-reviewer` (opus); the end-to-end suite by the `tests` agent (opus).
- **Result**: done. The feature is dark: every new route sits behind the `professional` switch
  or the admin role, and the sweep does nothing while the switch is off.
- **Evidence**:
  - Core coverage 4865 passed; api 1938 passed (both boundary specs included); database 69;
    `pnpm ts:check` 9/9; `pnpm lint` 7/7; api format clean; `check-migrations --drift`:
    "schema and migrations agree"; 73 migrations applied locally.
  - End-to-end on local Postgres, one at a time: `care-badge` (new) 19, `professionals` 26,
    `admin` 86, `care-practice` 36 — all passed.
  - `invariant-reviewer`: no P0; two P1 and five P2 fixed before this entry (below).
- **Deviations from plan**:
  - Files outside the phase's scope, each forced by a step: migration
    `0072_every_practitioner_has_a_check.sql` (data only, `NOT EXISTS`), the body schemas in
    `packages/core/src/entities/Professional`, and the new module names in the two boundary
    specs.
  - **No audit actions.** `AUDIT_ACTIONS` keys the web dictionary type, so a new action breaks
    the web's type-check; confirm, fail and withdraw record `checked_by`, and issuing a code
    leaves no actor row (only the owner can). Phase 9 may add the actions with their words.
  - A standing badge may be renewed without a new code: identity was bound at the first check
    and the yearly re-check is the register lookup. Accepted by the lead.
  - `BadgeSweepService` lives in the owner-alerts module.
  - `ProfessionalView.collegiateNumber` is `string | null`, read from the standing badge.
  - Fixed on review: `ProtectedWords` folds NFKC, strips invisible characters and reads
    Cyrillic and Greek look-alikes as Latin; `BadgeView` carries the latest decision and its
    reason, with states `refused` and `withdrawn`; a lapse is dated when the badge lapsed, so
    an application made before the sweep survives it; a malformed code answers the same 404 as
    a wrong one; the code mail carries the register name the **owner** types and no applicant
    text; the reminder uses a watermark; superseded codes are expired, not deleted.
  - PRD criterion 5 ("no unchecked number shown") is read as what clients and the public see.
    The code mail to the register's own contact names the declared number on purpose, so the
    person it belongs to can say it is not them (`textos/06` § R, approved 2026-11-18).
  - `textos/06` § R: the mail reads «del registro» where the approved text had «de el
    registro»; and § U.2's heading still says the reminder is not in phase 3. For the `legal`
    agent to align.
- **Decisions**: none new.
- **Notes for the next phase**: phase 4 calls `ProfessionalBadgeRepository.badgeOf(userId,
  now)`. The suite runs the sweep directly; only `Cron.controller.spec.ts` checks the cron calls
  it. An un-badged practitioner is still made by inserting a `professionals` row (self-service
  is phase 6). The frontend owes `BadgeView.decision` and the two new states (phase 8).
  `CareRepository.openInvitation` still prints «colegiado {number}»: phase 5.

## Phase 4 — The narrower view, in core (2026-11-19)

- **Executor**: the `backend-high` agent on opus @ high, in its own worktree; reviewed twice by
  `invariant-reviewer` (opus); the end-to-end suite by the `tests` agent (opus).
- **Result**: done. Nothing changes for anybody yet: every link in production reads `full`
  (there are none, by the owner's word), and no route writes `consent_scope = 'plan'` before
  phase 5.
- **Evidence**:
  - Core 4920 passed, with a test per `CARE_ACCESS_KINDS` value for the `plan`-scope outcome
    and key absence on every response type; api 1948 passed; `pnpm ts:check` 9/9; `pnpm lint`
    7/7.
  - End-to-end on local Postgres, one at a time: `care-scope` (new) 44, `care` 72,
    `care-review` 34, `plan-scheduled-care` 1, `care-practice` 36, `care-badge` 19 — all
    passed. The new suite found no backend defect.
  - `care-scope` walks three practitioners over every route that takes a link id and the
    roster — un-badged on a `full`-consent link, badged on a `plan` link, badged and `full`
    then withdrawn by the owner (narrow on the very next request) — with the exact key set of
    every answer, every denial compared byte for byte with the same route's answer for a link
    that does not exist, the client's event, condition and medication searched in every
    answer, no check-in notice by mail or push, and the race (a generation held at its save
    while the client changes practitioner: the plan carries no link and the new practitioner
    cannot see it).
  - `invariant-reviewer`, round one: three P1 and five P2, all fixed — the roster leaked a
    stage read from plans of other links; a plan could be stamped with a link that was not the
    one asking (`PlanRepository.isAskingLink`); the `plan`-scope presenter still carried
    `loadedFor`, `verdict` and `version`; `sharesHealth` read true on a narrowed link; a job
    from before the link was readable; `supervisedElsewhere` held the client's own nudge under
    a narrowed link. Round two: no P0, no P1; three P3 left as they are (below).
- **Deviations from plan**:
  - `packages/core/src/controllers/CheckIn/**` is outside the phase's scope: the client's own
    nudge is gated on the link's scope there (round one, P2), because a practitioner who
    cannot see targets cannot be the reason the client's are not suggested.
  - A new file, `repositories/Care/CareScope.ts` (`linkScope`), so the rule has one home.
  - The job answer in `plan` scope keeps the key `errorDetail`, always `null`, rather than
    dropping it: one job shape for the web, and the value names nothing.
  - The client page's answer is a union, `CareClientPageView` (the full page or
    `{client, plan, plans}`), rather than one type with optional keys.
  - An allergen's word may appear in a `plan`-scope answer inside a dish's own name or step
    («Espaguetis sin gluten»): that is the shared library's dish, which the practitioner is
    entitled to read, not the client's declaration. The suite searches allergen names outside
    `name`, `text` and `cue`, and the client's own words everywhere.
  - Three P3 accepted: a plan saved in the same millisecond as the link's creation is read as
    made before it; the client's own jobs, begun under the link, are readable by id through
    it (they name no health data in `plan` scope); a generation the client began before the
    link and that finishes after it is stamped with it when it lands `pending_review`.
- **Decisions**: none new.
- **Notes for the next phase**: phase 5 writes `consent_scope` at acceptance — today `accept`
  relies on the column's `full` default, so a link accepted for an un-badged practitioner
  widens by itself the day a badge arrives (the suite's "badge gained" case shows it): name
  the scope on every insert, then drop the default. `setSharesHealth(true)` must be refused
  on a `plan` link. The invitation view still prints «colegiado {number}». The suite sets
  `consent_scope` on the table; phase 5 replaces that with the real consent. Phase 6: the
  owner's revoke must write a `withdrawn` check. Phase 8: the web's client page must narrow
  `CareClientPageView`.

## Phase 5 — Consent per tier, and the illness rule (2026-11-19)

- **Executor**: `backend-high` (opus @ high) and `frontend` (opus), each in its own worktree;
  `invariant-reviewer` (opus), three rounds; `migration-reviewer` (opus) on 0073 and 0074; the
  end-to-end suites by the `tests` agent (opus).
- **Result**: done. Dark: every route sits behind the `professional` switch, except the daily
  sweep, which runs whatever the switch says (it only ever narrows or ends) and finds no link
  in production.
- **Evidence**:
  - Core 4990 passed; api 1968; database 69; web 441; `pnpm ts:check` 9/9; `pnpm lint` 7/7;
    `check-migrations --drift` agrees (75 migrations); the two boundary specs untouched.
  - End-to-end on local Postgres, one at a time: `care-illness-rule` (new) 30, `care-scope`
    44, `care` 72, `care-review` 34, `care-practice` 36, `care-badge` 19,
    `plan-scheduled-care` 1, `health-data` 3, `owner-alerts` 9, `accompaniments` 14 — all
    passed.
  - `care-illness-rule` on real Postgres: the acceptance matrix; a refused acceptance (one 409
    naming nothing, the invitation kept, the practitioner's roster byte-identical, nobody
    told; pregnancy, breastfeeding, a free-text condition and a medication count, a supplement
    does not); a declaration ending (`declared`, a paused link too, the practitioner's roster
    identical to a client's own ending); the sweep (`badge_lost`, the client alone mailed, no
    health or badge word in the mail, a second run does nothing); narrowing and regaining
    through the owner's withdrawal, `confirm`, the 004 grant and a `fail` on renewal; and the
    races, fifteen rounds each.
  - **A defect only the real database showed**: an owner's withdrawal racing an acceptance or
    a re-consent left the link stored `full` under a withdrawn badge (6–10 of 15 rounds, and
    3–5 of 15). Fixed: every writer that can widen a link takes the practitioner's badge lock
    before reading the badge (`ProfessionalBadgeRepository.lock`, one key for all). After it:
    15 of 15 stored `plan` in both races, and no deadlock in the four-way round.
  - `invariant-reviewer`: round one, no P0, three P1 (an omitted `consentScope` read as
    `full`; re-consent overwrote the acceptance's evidence; the consent version moved without
    its words) and four P2, all fixed; round two, the narrowing's own gaps (evidence, and a
    badge regained before the sweep), fixed; round three, nothing open.
  - `migration-reviewer`: 0073 and 0074 safe with conditions — nothing else merges a migration
    first; a later migration may write the new enum values only after this deploy is ready;
    CI's migration job is the first run inside drizzle's single transaction.
  - Web: the health screen, the invitation page (both tiers), the refusal and both ending
    notices seen at 320, 390 and 1280, light and dark, es and en, nothing overflowing;
    `apple-web-design` review PASS, no P0 or P1. The approved texts are copied verbatim
    (`textos/05` §§ C bis, F.1, F.3, G).
- **Deviations from plan** (the plan's step 7 records the amendments):
  - Two migrations where none was expected: `0073` (`badge_lost`), `0074` (`declared`,
    `narrowed_at`, `scope_consented_at`, `scope_consent_version`).
  - `consentScope` is required on accept; a rule ending has its own `ended_by`; a badge that
    stops standing narrows the stored consent, and a regained badge widens nothing.
  - The sweep's ending mails the client (`CareLinkEndedByRule`, `textos/06` § Y).
  - New client routes `POST /care/links/me/consent` and `GET /care/links/me/ended`.
  - The invitation page and the link card got the minimum for a `plan` tier (no number, the
    plan-only list, no health question), with the § F.1 and § F.3 keys ahead of phase 8; the
    invitation's two buttons now sit side by side at every width (one column only at 200 %
    text on a phone, as `AccountActions` does).
  - The local probe's account script builds the new states (`--unbadged`, `--invite-only`,
    `lose-badge`); `lose-badge` runs the real sweep and refuses anything but the local
    Postgres.
  - ADR `0111` §§ 4 and 8 amended: § 8 said a notice was queued to the practitioner.
  - `CARE_CONSENT_VERSION` does not move (phase 8 ships its words); the column's `full`
    default is not dropped (the release after this one).
- **Accepted, and open**:
  - A withdrawal racing a **declaration** can leave a `plan` link open over a record until the
    next daily sweep ends it (`badge_lost`); nothing is stored `full`. Once in 15 rounds.
  - The owner's removal and the sweep may deadlock on overlapping rows; Postgres aborts one,
    the sweep runs again the next day and the removal can be retried. Not seen in 30 rounds.
  - A second narrowing or a second re-consent overwrites the first one's date.
  - **For the `legal` agent**: when the app turns the health line off by narrowing, the
    client's trail still ends on their own `granted`; no row is fabricated for an act the
    client did not make, and `narrowed_at` is the evidence. Whether the trail should show it,
    and with which words, is theirs to say before the switch (phase 10). Also: `ended_by`
    `declared` / `badge_lost` in `care_links` implies a health record exists — for the DPIA.
  - Words still untrue under a `plan` link, left for phase 8: `care.invitationPrivacy`,
    `care.invitationNotShared`, «Tu dietista» as a title, `care.endConfirmBody`, the two
    health-share hints.
- **Decisions**: `0111` amended in place (2026-11-19).
- **Notes for the next phase**: phase 6 retires the 004 grant route — the narrow-before-pass
  guard lives in both pass writers until then; the owner's revoke of "may practise" must write
  a `withdrawn` check, which now narrows links in its transaction. The probe script's
  `--unbadged` inserts the `professionals` row by hand until phase 6 gives the route — replace
  it then. Phase 8 builds the re-consent button (`reconsentOffered`) and the § F.4 words. The
  release after this one drops `care_links.consent_scope`'s default.

