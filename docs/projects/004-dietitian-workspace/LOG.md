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
    `@RequiresOnboarding()` there.
  - The `professional` flag fails off: suites that need it switch it on through
    `PATCH /admin/settings` and back off in `afterAll`, as `professionals.e2e-spec.ts` does.
