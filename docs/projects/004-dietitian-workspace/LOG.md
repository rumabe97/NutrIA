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
