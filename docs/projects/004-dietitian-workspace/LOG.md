# LOG — Project 004: A dietitian runs their practice on it

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

## Phase 1 — A professional is an account the owner grants (2026-09-23)

- **Executor**: fable @ high for steps 1–5 and the migration review; Opus 5.5 @ high for the
  end-to-end suite, the invariant review and the fixes that followed (see Deviations).
- **Result**: done locally; the end-to-end suite is still to run (on the pull request's CI).
- **Evidence**:
  - `pnpm turbo lint ts:check test`: 21/21 tasks; core 465 tests, database 22, api 535 (58 suites).
  - `node scripts/check-migrations.mjs --drift` (with `BASE=0fb6f46`, uncommitted): 34 migrations,
    journal and snapshot in order, schema and migrations agree.
  - `sh scripts/check-leaks.sh`: clean. `pnpm --filter api format`: clean.
  - `pnpm --filter api test:e2e -- professionals`: **not run locally.** The machine has no Postgres
    and the suites must not touch a database holding real data. CI's `e2e` job runs it against a
    throwaway `postgres:17` on the pull request.
  - `migration-reviewer` (fable): clean, with no P0–P2. Two P3 notes, no action: the foreign key
    adds briefly lock `user`, and `granted_by` has no index (fine at tens of rows).
  - `invariant-reviewer` (opus): no P0. The P1 was the missing end-to-end suite, which is now
    written. Two P2s were fixed in this phase: a grant needs a confirmed address, and the guard's
    404 promise is worded for confirmed, open accounts, with workspace controllers never carrying
    `@RequiresOnboarding()` (`apps/api/AGENTS.md`). The P3 was fixed too: `0059` now names the
    route the code uses, `POST /admin/accounts/:id/professional`.
- **Deviations from plan**:
  - The model changed mid-phase. Fable ran out of usage credits (HTTP 429) during the
    end-to-end work and the invariant review, and on 2026-09-23 the owner chose to finish the
    phase on Opus.
  - A grant refuses an account whose address is unconfirmed (404). The plan is amended in
    Phase 1 step 4.
  - The link counts are always zero (`noLinksYet()`): `care_links` does not exist until
    Phase 2. The shape is fixed and a unit test pins the exact keys.
  - Outside the listed scope, all minimal:
    - admin module and barrel wiring;
    - `Billing.spec.ts`: a full `FlagSet` literal gains `professional: false`;
    - a `makeProfessional()` fixture;
    - one `apps/api/AGENTS.md` bullet;
    - a row in `apps/api/test/README.md`;
    - the route name in `0059`.
  - No route carries `ProfessionalGuard` yet (the plan applies it from Phase 2). The
    end-to-end suite asks `ProfessionalController.hasAccess`, the guard's only question,
    against the real database; the guard itself has a unit spec.
  - The plan's `PATCH /users/me` does not exist. The suite proves it stays a 404, and tries
    the account's real update route instead: Better Auth's `POST /auth/update-user`.
- **Decisions**: none new; `0059` corrected (the route name).
- **Notes for the next phase**:
  - Phase 2 replaces `noLinksYet()` with a count-only query per status. Keep the key-set
    assertion in `ProfessionalController.test.ts`, and add an end-to-end assertion that the
    owner's list carries no client email or id.
  - Apply `@UseGuards(ProfessionalGuard)` on each `care` controller class, and never
    `@RequiresOnboarding()` there. Then remove the guard's `@knipignore` tag: it was added
    in this phase only because `pnpm deadcode` (CI) refused an export nothing used yet.
  - The `professional` flag fails off: suites that need it switch it on through
    `PATCH /admin/settings` and back off in `afterAll`, as `professionals.e2e-spec.ts` does.

## Phase 2 — The link: invitation, consent, revocation (2026-09-23)

- **Executor**: Opus 5.5 at `high` throughout: `backend-high` built the phase, then did the
  review-fix round; `tests-high` wrote `care.e2e-spec.ts`. The ownership guard stopped `backend` from
  writing to `apps/api/test/`, so the suite went to `tests`. The lead (Opus 5.5) made the final small
  fixes from the second invariant review.
- **Result**: done locally. The end-to-end suite is still to run, on the pull request's CI.
- **Evidence**:
  - `pnpm turbo lint ts:check test`: 21 of 21 tasks. api 564 tests in 61 suites; core 34 test files;
    database 2; ui 41; web 10.
  - `BASE=f7128dc node scripts/check-migrations.mjs --drift`: 35 migrations, journal and snapshot in
    order, schema and migrations agree. The script reads committed files only, so it counts 0034 as
    "0 new"; `migration-reviewer` and the lead checked 0034 by reading it: it only creates types,
    tables, foreign keys and indexes.
  - `pnpm -w run deadcode`: clean, with `ProfessionalGuard`'s `@knipignore` removed.
  - `sh scripts/check-leaks.sh`: clean, with the private patterns loaded.
  - Prettier over api `src` and `test`: clean.
  - `care.e2e-spec.ts`, 25 tests: tsc and eslint clean.
  - `pnpm --filter api test:e2e -- care`: **not run locally.** The machine has no Postgres or Docker,
    and the suites must not touch the `.env` database. The end-to-end job in CI runs it against a
    throwaway `postgres:17`.
  - An in-memory Postgres (PGlite) in the scratchpad applied migrations 0000 to 0034, and a smoke
    script ran the built controllers against it. It checked:
    - invite, re-invite, decline and accept;
    - the uniform 404s and the 409;
    - both sides of ending a link;
    - the switch;
    - `forgetAddress`;
    - both cascades and both CHECK constraints.
  - `migration-reviewer` (opus): no P0 or P1. Its P2 (one live invitation per address was held only
    by code) and its P3 (a comment for `'account'`) are fixed.
  - `invariant-reviewer` (opus), first pass: no P0. The P1 and the four P2s were fixed in the fix
    round (see Deviations):
    - P1: a used or declined invitation kept a deleted client's address;
    - P2: the switch was checked after the pipes;
    - P2: with the switch off, a client could not see or end their link;
    - P2: a failed mail logged the subject and the SMTP error;
    - P2: the token redaction missed the percent-encoded path.
  - `invariant-reviewer`, second pass: no P0, and every earlier finding closed. It found:
    - P1: the suite was missing. It had not landed when the pass started; it is in now.
    - P2: expired rows were purged only by the same professional. Now any new invitation purges
      every expired row, and revoking a grant deletes that professional's invitations.
    - P2: nothing tested the `beforeDelete` hookup. The suite's account-deletion test covers it
      through `DELETE /users/me`.
    - P3s, all fixed: `apps/api/AGENTS.md` named a controller that no longer exists; two comments
      said the switch-off 404 is identical to an unknown route's; the non-atomic `beforeDelete` is
      now commented; a token whose first character is percent-encoded escaped redaction.
- **Deviations from plan** (the plan is amended in step 1 and step 4):
  - **An invitation row exists only while it is live.** `usedAt` and `revokedAt` are gone, and
    there is a unique index on (`professionalId`, `email`).
    - Accepting (in the transaction that makes the link), declining and re-inviting each delete the
      row. A concurrent identical invite upserts, so both requests get the same answer.
    - Writing an invitation purges every expired row, and revoking a grant deletes that
      professional's invitations.
    - Better Auth's `beforeDelete` deletes every invitation to the deleted account's address.
    - Why: a used row kept a deleted client's address, against PRD 14, because an invitation holds
      an address, not an account id.
  - **A client's own link ignores the switch.** `GET /care/links/me` and the client's side of
    `DELETE /care/links/:linkId` work with the `professional` flag off, so consent stays revocable
    (`0059`, PRD 4). Every other care route is a 404 while the flag is off, answered by
    `ProfessionalSwitchGuard` or `ProfessionalGuard` before any pipe runs.
  - **A link id that is not a UUID gets 404, not 400.** `ParseUUIDPipe` was removed from the link
    route so that the switch-off answer stays uniform.
  - **Smaller choices:**
    - The enums live in `_enums.ts`, as `packages/database/AGENTS.md` asks.
    - `care_links` has an extra CHECK so a link cannot join an account to itself, and
      `care_invitations` one so the address is lowercase.
    - The 409 `CARE_LINK_EXISTS` body is `{ code, link: { professionalName, since, status }, message,
      statusCode }`.
    - `POST /care/invitations` answers 201 `{ email, expiresAt }`.
  - **Touched outside the listed scope, all minimal:**
    - `app.module.ts`;
    - `shared/filters/AllExceptions.filter` (the 409 mapping);
    - `shared/logging/pino` (the token is redacted from the logged URL and `referer`);
    - `shared/guards` (the new `ProfessionalSwitchGuard`);
    - `modules/auth/auth.config.ts` (`beforeDelete`);
    - `modules/email/services/Email.service.ts`, plus a fixed `kind` on every template: a failure now
      logs only the kind and the SMTP codes;
    - `packages/core/src/repositories/Professional` (the link counts, and `revoke`);
    - `apps/api/AGENTS.md`;
    - `apps/api/test/README.md`.
- **Decisions**: none new. `0059` stands; the invitation lifecycle above implements it.
- **Notes for the next phase**:
  - `withClient` must resolve on `status = 'active'` only. Ending sets `ended`, so access closes on
    the next request.
  - Add `core/controllers/Care`, `core/entities/Care`, `#repositories/Care` and `modules/care` to
    `apps/api/src/modules/ai/health-boundary.spec.ts` (Phase 3 step 6).
  - Nothing writes `endedBy` `'account'` yet: deleting an account cascades the rows away.
    `'lapse'` is Phase 7's.
  - Revoking a grant does not end that professional's open links. The client can still end them, and
    the professional's side 404s. Phase 3 or 7 decides whether a revoke should end them too.
  - Phase 7's limit counts active links plus live invitations. Every invitation row is live, so
    count the rows where `expiresAt > now`.
  - Phase 8's `/invitacion/[token]`:
    - keep that path in every locale, or `pino.ts`'s pattern has to follow it;
    - send `Referrer-Policy: no-referrer`;
    - keep the token out of analytics paths;
    - carry the token across sign-up in `sessionStorage`, not in `next` or `callbackURL`.
  - The global `RateLimitGuard` runs before the switch guard, so the 31st call in a window gets 429
    instead of 404. It is accepted, as for `/admin`.
  - `professionals.e2e-spec.ts` and `access.e2e-spec.ts` leave their accounts behind. `care`
    deletes its own and checks that none is left. Worth a separate fix.

## Phase 3 — Delegated reading, and the trail the client sees (2026-09-24)

- **Executor**: Opus 5.5 at `high` throughout.
  - `backend-high` built the phase.
  - `tests-high` wrote the end-to-end half of `care.e2e-spec.ts`.
  - `migration-reviewer` and `invariant-reviewer` ran on opus.
  - The lead (Opus 5.5) made the review fixes itself, including the P0 (see Deviations).
  - The lead also made the `.claude/agents/invariant-reviewer.md` edit that plan step 2 asks for: `.claude/` is outside the backend agent's ownership.
- **Result**: done locally. The end-to-end suite passed on a throwaway Postgres; the pull request's CI runs it again.
- **Evidence**:
  - `pnpm turbo lint ts:check test`: 21 of 21 tasks. core 519 tests, database 27, api 578 in 61 suites.
  - `BASE=78ee240 node scripts/check-migrations.mjs --drift`: 36 migrations, journal and snapshot in order, schema and
    migrations agree.
    - The script counts only committed migrations, so 0035 counts as "0 new".
    - `migration-reviewer` and the lead read 0035 by hand: it only creates two enum types, one table, two foreign keys and
      three indexes.
  - `pnpm -w run deadcode`: clean. `sh scripts/check-leaks.sh`: clean, with the private patterns loaded.
    `pnpm --filter api format`: clean.
  - `pnpm --filter api test:e2e -- care`: **44 of 44**. The whole end-to-end run: **22 of 22 suites, 193 of 193 tests**.
    - Both ran on a throwaway embedded Postgres 17 on a local port, migrated from empty through 0035.
    - `AI_PROVIDER=stub`; every mail, payment, OAuth, push and error-reporting variable blanked.
    - The `.env` database was never touched.
  - The new tests bite: on the backend before the review fixes, exactly the three contract gaps failed (6 tests). The care
    suite leaves no account, link, invitation or trail row behind.
  - A lead smoke test against a second throwaway Postgres covered the two new SQL paths:
    - the list's `list` rows: one per active link, none for a paused link or another professional's client;
    - a revoked grant: 404, nothing written;
    - the trail's cursor: 206 rows with microsecond ties, 3 pages, none lost or repeated.
  - `migration-reviewer` (opus): no P0 or P1.
    - P2 (the trail sorted in memory; adding the index later would block every professional read during the build): fixed.
      0035 creates `(user_id, created_at, id)`.
    - P3 (a later enum value followed by a rollback breaks the old reader): a note on `careAccessKind`.
  - `invariant-reviewer` (opus), first pass:
    - **P0: the list read client data (stages) without writing any trail row.** Fixed (see Deviations).
    - P2s, all fixed:
      - the list had no second check behind the guard;
      - the health line was enforced by the caller, not by `withClient`;
      - the trail stopped at 100 rows;
      - the roster needs `pending_review` in Phase 5 (added to the plan).
    - P3s, both fixed:
      - `fn` received both account ids;
      - the boundary spec missed a dynamic `import(`.
  - `invariant-reviewer`, second pass: no P0 or P1, and every first-pass finding closed. The new findings, all fixed:
    - P2: each list call writes a row per active client, so repeated calls could bury an earlier read pages deep.
      `GET /care/clients` is now limited to 10 a minute per account; the end-to-end suite stays under that (5 at most per
      account).
    - P3: `withClient` refuses kind `list` by type (`Exclude<CareAccessKind, 'list'>`); only `roster` writes it.
    - P3: the kind list in `Care.ts` now names `list`, and a stale JSDoc is gone.
    - P3: `0059` gets a dated amendment naming `roster` as the only other path, audited by its `list` rows.
    - The optional `schema.test.ts` pin for `professional_id` set null is not added: the end-to-end suite covers it.
  - After those fixes: `pnpm turbo lint ts:check test` 21 of 21, deadcode, leaks, format and drift clean. The end-to-end
    run above predates them; they are a route limit and a type narrowing, and CI runs the suite again.
- **Deviations from plan** (steps 1, 2, 3 and 5 are amended, and Phase 5 step 5):
  - **The list leaves a row.** `care_access_kind` gains `list`.
    - `GET /care/clients` writes one `list`/`read` row in the trail of every client with an active link and a standing
      grant, in one repeatable-read transaction, before it reads their stages. A paused link shows its name, no stage, and
      writes nothing.
    - Why: a stage is worked out from the client's onboarding, plans and check-ins, so the list is a read, and PRD 6 says
      every read leaves a row.
    - The executor had first written the list as an unaudited "other door", with that exception added to three documents.
      The review held it as a P0: a document is not a decision amendment. The exception text is gone.
    - One `overview` row per client was rejected: it would tell the client that their plans and weight were opened when
      they were not.
  - **`withClient` is stricter than the plan.**
    - It also checks the switch, and the grant (an inner join on `professionals`).
    - It refuses kind `health` on a link without `sharesHealth`.
    - Its callback gets the link without either account's id (`ClientAccess`).
  - **The client page writes two rows under the health line.** One `overview` row, then one `health` row through a second
    `withClient` call. If the link ends between the two, there is no `health` row and no `health` key.
  - **The trail is paged.** `GET /care/access-log?before=<row id>` returns `{ entries, next }`, 100 a page.
    - The cursor is a row id compared in SQL: a JavaScript date loses the microseconds `created_at` keeps.
    - A cursor that is not a UUID is a 422 `INVALID_INPUT`.
    - The trail ignores the switch, like `GET /care/links/me`.
  - **Invitations are not a stage.** They have no account behind them, so they come back as their own array.
    `plan_awaiting_review` is in the stage type but cannot occur until Phase 5.
  - **Touched outside the listed scope, all minimal:**
    - `CheckInController` (`isCheckInDue()` extracted, so the list and `status` share one rule);
    - `ProfileController.targets`, so the overview reads targets without allergies or preferences;
    - the care module wiring;
    - `apps/api/AGENTS.md`;
    - `apps/api/test/README.md`;
    - `.claude/agents/invariant-reviewer.md` item 1 (plan step 2).
    - The boundary spec also covers Professional and the `health-data` module (PRD 11).
- **Decisions**: none new. `0059` gains a dated amendment: `roster` is the only other path, audited by its `list` rows.
- **Notes for the next phase**:
  - Phase 4's target write goes through `withClient(…, 'targets', 'write', …)`, which already exists and is logged; the
    `ClientAccess` view has `sharesHealth` and `reviewBeforePublish`, not the client's id.
  - Phase 5 must teach `CareRepository.roster`'s latest-plan read `pending_review` (now in the plan) and fill
    `planPendingReview`.
  - Adding a value to `care_access_kind` or `care_access_action`: make `careAccessEntrySchema` tolerate unknown values one
    release before (the note on the enum).
  - Revoking a grant still does not *end* its links: access closes (the join), and the client can end them. Phase 7 or the
    owner decides.
  - The trail screen (Phase 8) should group or filter `list` rows, so they do not crowd out the reads that matter.
  - A throwaway Postgres works on this machine without Docker: the embedded-postgres binaries' `initdb` + `pg_ctl` on a
    free local port, TCP only (`-k ''`; the scratchpad path is too long for a socket). The e2e suites can run locally that
    way, never against `.env`.
  - The whole end-to-end run leaves 34 accounts from other, unchanged suites (one each). Worth a separate fix, as the
    Phase 2 note said.

## Phase 4 — Supervised targets (2026-09-24)

- **Executor**: Opus 5.5 throughout.
  - `backend` (medium, the plan's effort) on opus built steps 1–3 and their unit specs.
  - `tests` (medium) on opus wrote the end-to-end half in `care.e2e-spec.ts`.
  - `migration-reviewer` ran on opus.
  - The lead (Opus 5.5) made the review fix itself (see Deviations), with the owner's choice of design.
- **Result**: done locally. The end-to-end suite passed on a throwaway Postgres; the pull request's CI runs it again.
- **Evidence**:
  - `pnpm turbo lint ts:check test`: 21 of 21 tasks. core 534 tests in 36 files, database 27, api 583.
  - `BASE=origin/main node scripts/check-migrations.mjs --drift`: 37 migrations, journal and snapshot in order, schema and
    migrations agree. 0036 read by hand and by `migration-reviewer`: it only adds a nullable column, its foreign key
    (`on delete set null`) and an index.
  - `pnpm -w run deadcode`: clean. `sh scripts/check-leaks.sh`: clean. `pnpm --filter core format` and
    `pnpm --filter api format`: clean.
  - `pnpm --filter api test:e2e -- care target-overrides`: **60 of 60**. The whole end-to-end run: **22 of 22 suites,
    203 of 203 tests**.
    - Both ran on a throwaway embedded Postgres 17 on a local port, migrated from empty through 0036 and seeded;
      `AI_PROVIDER=stub`, every outside service blanked, no `.env` in the checkout. Stopped and deleted afterwards.
    - `target-overrides` is unchanged and passes. No existing test changed; `care.e2e-spec.ts` only gains a block.
    - Before the fix below, the new out-of-bounds test failed (a trail row after a 422): the test bites.
  - `migration-reviewer` (opus): no P0 or P1.
    - P2: a rollback can mislabel targets. A professional sets them on the new API, the deploy is rolled back, the client
      edits them on the old API (which does not write the new column), the deploy rolls forward: the client's own
      numbers read "set by" the professional. Only the label is wrong. For the pull request's rollback note.
    - P3: `userOwnedSingleton`'s new `extraIndexes` argument is loosely typed. It copies `userOwned`'s existing one;
      left alone.
    - P3: no `lock_timeout` on the migrate step, so a lock it cannot get hangs the build instead of failing it. Repo-wide,
      not this phase's.
- **Deviations from plan** (step 2 is amended):
  - **A write's trail row goes in with the change.** `withClient` wrote every row before `fn`, so a professional's
    out-of-bounds target (422) left a `targets`/`write` row for a change that never happened; the tests agent's suite
    caught it. The owner chose, over "log the attempt" and "validate before the row":
    - `withClient` hands `fn` a third argument, `record`. A read's row is written before the read, as before. A write's
      row is written by the writing repository inside its own transaction (`ProfileRepository.upsertTargetOverride` with a
      `ProfessionalSetter`). A write that returns without having recorded is a `DatabaseOperationError`.
    - Touched outside the listed scope: `controllers/Care`, `repositories/{Care,Profile}`, `packages/core/AGENTS.md`,
      `.claude/agents/invariant-reviewer.md` item 1, and `0059` (a dated amendment).
  - **An index on `set_by_professional_id`**, beyond the plan: Postgres does not index a foreign key, and without it
    every account deletion would scan `target_overrides`. `userOwnedSingleton` gains an optional `extraIndexes` argument
    for it; every other table's generated schema is byte-identical.
  - The upsert reads the row back to get the setter's name (`RETURNING` cannot join).
- **Decisions**: none new. `0059` gains a dated amendment (a write's row goes in the write's transaction).
- **Notes for the next phase**:
  - Phase 5's professional writes (publish, swap, regenerate, generate, the review toggle) go through
    `withClient(…, 'review', 'write', (clientId, access, record) => …)`, and the repository that writes must call
    `record(tx)` inside its transaction. `PlanRepository` already opens transactions; thread `record` into them.
  - The view is `ResolvedTargets.setBy`: `null` with no override, `{ kind: 'self' }`, or
    `{ kind: 'professional', name }`. No account id. Phase 8's `TargetsPanel` reads it.
  - **The check-in's kcal nudge clears the professional's mark.** `CheckInController.submit` calls `updateTargets`
    with no setter (the plan's letter), so a supervised client who answers hungry/full makes the whole override
    `self`, including the macros the professional named. For the owner or Phase 5/6 to decide.
  - An older problem, not new here: if a stored override names carbs and the nudged kcal no longer adds up,
    `updateTargets` refuses (`macros_do_not_sum`) after the check-in row is written, so the submit fails.
  - For the owner: after a link ends, the targets stay in force still labelled with the professional's name; a second
    professional's overview shows the first one's name until the client edits them. The plan says nothing about either.
  - The whole end-to-end run still leaves 34 accounts from other, unchanged suites (as Phase 3 noted).
