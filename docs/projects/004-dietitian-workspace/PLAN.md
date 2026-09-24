# Plan — Project 004: A dietitian runs their practice on it

> **Purpose**: the phased technical execution plan — the engineering half of the
> contract. `/execute-project` follows this literally; executors implement phases, they
> do not redesign them. If implementation must diverge, the plan is amended in the same
> change and the deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes.

- **Status**: approved — by the owner, 2026-09-23
- **Type**: standard
- **PRD**: [./PRD.md](./PRD.md) — every acceptance criterion is mapped at the end of this file.
- **Routing profile**: `tiered`. Phases 1–3 build the second way into a user's data — the
  authorisation and consent path — and run at `quality-max`, the exception
  `AGENTS.md` § Model routing names for authentication. Phase 1 ran on fable; from
  2026-09-23 no phase or agent does (owner: fable's usage credits ran out mid-phase), so
  `quality-max` is opus at `high` and phases 2–3 dispatch there.

## Design summary

Three decisions shape everything, each recorded before any code:

- [`0059`](../../decisions/0059-a-professional-reaches-a-client-only-through-a-link.md) —
  **a professional reaches a client only through a consented, audited link.** Professional
  routes carry a *link* id; one core function, `CareController.withClient`, resolves it
  against the session's professional, writes the audit row, and hands the client's id to the
  controller that already exists. The client's id is never read from a request, so the
  ownership rule holds with one named exception instead of a hole.
- [`0060`](../../decisions/0060-a-reviewed-plan-waits-in-its-own-state.md) — **a plan
  awaiting review waits in a status of its own** (`pending_review`). Every client surface
  reads `active` plans, the offline copy included, so hiding needs no change there; the four
  reads that bypass `findActive` are named and taught the state.
- [`0061`](../../decisions/0061-a-subscription-grants-what-its-price-says.md) — **one
  subscription row per account; its price decides what it grants**: personal premium, or a
  practice that includes N active clients. A linked client is premium while the link is
  active and the practice open.

The whole feature sits behind a new `professional` flag that fails **off**
(`core/domain/Flag`). It is switched on in production only after the owner's legal review
(Phase 10), so phases can merge to `main` as they land without anybody seeing a half-built
workspace.

Built API first, in the order the data depends on itself — the account, the link, the
reading, then what the professional may change — then billing, then the two web halves,
then the documents. Each phase ends green.

## Phases

### Phase 1 — A professional is an account the owner grants

- [x] done — `test:e2e -- professionals` verified by the pull request's CI (required to merge) — commit `5a0df05` ("Project 004 phase 1: a professional is an account the owner grants (#82)")
- **Dispatch**: fable @ high — `/execute-project 004 phase 1`
- **Goal**: an account becomes a professional only by the owner's act, with a collegiate number, and nothing else can make it one.
- **Scope**: `packages/database/src/schemas` (new `professional.schema.ts`), one generated migration, `packages/core/src/{entities,repositories,controllers}/Professional/`, `packages/core/src/domain/Flag`, `apps/api/src/modules/admin`, `apps/api/src/shared/guards` (new `Professional.guard.ts`), `apps/api/test`.
- **Steps**:
  1. `professionals` table via `userOwnedSingleton`: `collegiateNumber` (text, not null), `grantedAt`, `grantedBy` (FK `user.id`, on delete set null), and for Phase 7 `practiceOpen` (boolean, default false) and `includedClients` (integer, default 0). Add it to the singleton list in `packages/database/src/schemas/schema.test.ts`. Generate the migration; nothing in it is destructive.
  2. `core/entities/Professional` (`grantProfessionalSchema`: collegiate number, trimmed, 3–20 characters of letters, digits and `/-`), `ProfessionalRepository` (`grant`, `revoke`, `find`, `list`), `ProfessionalController` with a `present` view that never includes another account's data.
  3. A `professional` flag in `core/domain/Flag` that fails **off**, readable by the owner only.
  4. Admin routes on `AdminAccounts.controller.ts` or a new `AdminProfessionals.controller.ts`, class `@Roles('admin')`: `POST /admin/accounts/:id/professional` (body: the collegiate number) and `DELETE` of the same; `GET /admin/professionals` (email, collegiate number, granted date, link counts by status — **no client identities**, `0028`). A grant needs a confirmed address (amended in execution: anybody can register a dietitian's address without owning it).
  5. `ProfessionalGuard`: the route requires the `professional` flag on and a `professionals` row for the session's user; anything else is a 404. Not global — applied per controller from Phase 2 on.
- **Acceptance criteria**: PRD 1.
- **Verification**:
  ```
  pnpm turbo lint ts:check test
  node scripts/check-migrations.mjs --drift
  pnpm --filter api test:e2e -- professionals
  ```
  A new `apps/api/test/professionals.e2e-spec.ts` proves: a non-admin cannot grant; a sign-up body, a `PATCH /users/me` body and a profile body carrying `professional`, `collegiateNumber` or `role` change nothing; only the admin route creates the row; revoking removes access. Reviews: `migration-reviewer`, `invariant-reviewer`.

### Phase 2 — The link: invitation, consent, revocation

- [x] done — `test:e2e -- care` verified by the pull request's CI (required to merge) — commit `9f48bef` ("Project 004 phase 2: the link — invitation, consent, revocation (#86)")
- **Dispatch**: opus @ high — `/execute-project 004 phase 2`
- **Goal**: a professional invites by email, the client accepts knowing exactly what is shared, and either side ends it in one action.
- **Scope**: `packages/database/src/schemas` (new `care.schema.ts`), one generated migration, `packages/core/src/{entities,repositories,controllers}/Care/`, new `apps/api/src/modules/care/`, `apps/api/src/modules/email` (one template), `apps/api/test`.
- **Steps**:
  1. `care_invitations`: `professionalId` (FK cascade), `email` (lowercased), `tokenHash` (sha-256, unique), `expiresAt` (14 days). A row exists only while the invitation is live: unique on (`professionalId`, `email`); accepting, declining or re-inviting deletes it, writing one purges every expired row, revoking a grant deletes that professional's, and deleting an account deletes every invitation to its address (amended in execution: a used or revoked row kept a deleted client's address, against PRD 14).
  2. `care_links`: `professionalId` and `clientId` (both FK `user.id`, cascade), `status` enum (`active`, `paused`, `ended`), `consentVersion`, `consentedAt`, `sharesHealth` (boolean — the separate consent line), `reviewBeforePublish` (boolean, default true), `endedAt`, `endedBy` (`professional` | `client` | `lapse` | `account`). Partial unique index: one `active` or `paused` link per client.
  3. `CARE_CONSENT_VERSION` in `core/entities/Care`; the consent list is dictionary copy (Phase 8), the version is code, as `HEALTH_CONSENT_VERSION` is.
  4. Routes (module `care`):
     - `POST /care/invitations` — `ProfessionalGuard`. Creates the invitation and queues the mail with `BackgroundTaskService`; **the response is identical and immediate whether or not the address has an account**. Refuses the professional's own address.
     - `GET /care/invitations/:token` — signed in; answers the professional's name, the consent version and the list of what is shared, only when the token is valid, unused, unexpired and addressed to the session's email; 404 otherwise, the same 404 for every reason.
     - `POST /care/invitations/:token/accept` — body `{ consentVersion, sharesHealth }`; the version must be the current one; creates the link and deletes the invitation, in one transaction. A client who already has an active link gets a 409 that names it.
     - `POST /care/invitations/:token/decline` — deletes it; nothing is created.
     - `DELETE /care/links/:linkId` — either side: the professional through the guard and `professionalId = session`, the client through `clientId = session`. Ends the link. The client's side, and `GET /care/links/me`, work with the `professional` flag off too (amended in execution: a link must stay revocable, `0059`); every other care route is a 404 while it is off, before any validation.
     - `GET /care/links/me` — the client's own link, if any: professional's name, status, what is shared, the date.
  5. The invitation mail (Spanish and English, the recipient's locale unknown so the inviter's): who invites, what accepting means, the link; no health word in it.
- **Acceptance criteria**: PRD 2, 3, 4 (the ending itself; its effect on access is Phase 3), 14 (link rows go with either account).
- **Verification**:
  ```
  pnpm turbo lint ts:check test
  node scripts/check-migrations.mjs --drift
  pnpm --filter api test:e2e -- care
  ```
  `care.e2e-spec.ts`: an invitation is single-use and expires (clock injected); the invitation route's body and status are identical for a registered and an unregistered address; a different signed-in account cannot see or accept it; declining creates no link; the accepted version is stored; ending from either side works; deleting the client's or the professional's account removes the link rows. Reviews: `migration-reviewer`, `invariant-reviewer`.

### Phase 3 — Delegated reading, and the trail the client sees

- [x] done — `test:e2e -- care` 44/44 on a throwaway Postgres; the pull request's CI runs it again — commit `02cff85` ("Project 004 phase 3: delegated reading, and the trail the client sees (#88)")
- **Dispatch**: opus @ high — `/execute-project 004 phase 3`
- **Goal**: the professional sees each client's state and progress through the one named path, every read leaves a row the client can read, and nothing crosses between professionals.
- **Scope**: `packages/database/src/schemas/care.schema.ts` (the log), one generated migration, `packages/core/src/controllers/{Care,Progress,Health}`, `apps/api/src/modules/care`, `apps/api/src/modules/ai/health-boundary.spec.ts`, `apps/api/test`.
- **Steps**:
  1. `care_access_log` via `userOwned` on the **client**: `professionalId` (FK, on delete set null), `professionalName` (snapshot), `kind` enum (`list`, `overview`, `plan`, `progress`, `targets`, `health`, `review`), `action` (`read` | `write`). No payload column. An index on (`userId`, `createdAt`, `id`) is created with the table (amended in execution: `list` is the list's own kind, step 3; the index would block every professional read if added later).
  2. `CareController.withClient(professionalId, linkId, kind, action, fn)` — resolves `care_links` by `(id, professionalId, status = 'active')` with the grant standing, throws `NotFoundError` otherwise (and for kind `health` on a link without `sharesHealth`), writes the log row, calls `fn(clientId)` with the link stripped of both account ids. **The only function in the codebase that turns a professional's session into another account's id**; say so in `packages/core/AGENTS.md`'s ownership rules and in `.claude/agents/invariant-reviewer.md` item 1.
  3. `GET /care/clients` — the professional's list: name, link state, and where each client is (invited, filling in the profile, plan awaiting review, plan under way, check-in due), from stored state only. A stage is read from the client's data, so the list writes one `list` row in the trail of every client with an active link, in one repeatable-read transaction before it reads the stages (amended in execution: PRD 6 — every read leaves a row; the invariant review held a list without rows as a P0). Invitations come back as their own array.
  4. `GET /care/clients/:linkId` — through `withClient`: the active plan and its history, `ProgressController.summary` (adherence per fortnight, weight series, check-ins), the resolved targets. `health` is **absent from the object**, not empty, unless the link's `sharesHealth` is true — and reading it is its own log row of kind `health`.
  5. `GET /care/access-log` — the client's own trail: who, which kind, read or write, when. 100 rows a page, `?before=` the previous page's `next` (a row id), so every row stays visible (amended in execution).
  6. Add `core/controllers/Care`, `core/entities/Care`, `#repositories/Care` and the new API module path to the AI boundary spec, as the health modules are.
- **Acceptance criteria**: PRD 4, 5, 6, 9, 11, 12, 14 (log rows go with the client).
- **Verification**:
  ```
  pnpm turbo lint ts:check test
  node scripts/check-migrations.mjs --drift
  pnpm --filter api test:e2e -- care
  ```
  `care.e2e-spec.ts` gains: the client ends the link mid-session and the professional's very next request for that client is a 404; professional A cannot list, read or infer professional B's clients by link id, by guessing, or by the invitation route; every professional read produces exactly one log row the client sees; without `sharesHealth` the response has no `health` key. Reviews: `invariant-reviewer` (P0 on any professional route that reaches a repository outside `withClient`).

### Phase 4 — Supervised targets

- [x] done — `test:e2e -- care target-overrides` 60/60 and the whole suite 203/203 on a throwaway Postgres; the pull request's CI runs it again — commit `dfb9ee8` ("Project 004 phase 4: supervised targets (#90)")
- **Dispatch**: opus @ medium — `/execute-project 004 phase 4`
- **Goal**: a professional sets a client's targets within the calculator's bounds, and the client's screens know whose they are.
- **Scope**: `packages/database/src/schemas/profile.schema.ts`, one generated migration, `packages/core/src/{controllers/Profile,domain/Nutrition}`, `apps/api/src/modules/care`, `apps/api/test`.
- **Steps**:
  1. `target_overrides.setByProfessionalId` (nullable FK `user.id`, on delete set null).
  2. `ProfileController.updateTargets` gains the setter: the client's own route passes nothing (and clears the column); `PATCH /care/clients/:linkId/targets` passes the professional through `withClient` (`targets`, `write`). The same `targetViolations`, the same `InputParseError` and sentence. The `write` row goes in the same transaction as the change, through a `record` function `withClient` hands its callback, so a refused target leaves no row (amended in execution: the row written before the change stayed in the trail after a 422; this touches `controllers/Care` and `repositories/{Care,Profile}`, and `0059` gains a dated amendment).
  3. `resolveTargets`' view gains who set the override: `self`, or the professional's name. A client who changes the targets afterwards makes them their own again; the professional's overview shows that.
- **Acceptance criteria**: PRD 7.
- **Verification**:
  ```
  pnpm turbo lint ts:check test
  node scripts/check-migrations.mjs --drift
  pnpm --filter api test:e2e -- care target-overrides
  ```
  An out-of-bounds professional target is refused with the same code and field errors as a self-set one; the existing `target-overrides` suite is unchanged. Reviews: `migration-reviewer`.

### Phase 5 — Review before publishing

- [x] done — `test:e2e -- care-review care` 81/81 and the whole suite 290/290 on a throwaway Postgres; the pull request's CI runs it again
- **Dispatch**: opus @ high — `/execute-project 004 phase 5`
- **Goal**: for a linked client with review on, a new plan is the professional's to look at, change and publish before the client sees it; for everybody else nothing moves.
- **Scope**: `packages/database/src/schemas/{_enums.ts,plan.schema.ts}`, one generated migration, `packages/core/src/{repositories/Plan,controllers/Plan,controllers/CheckIn}`, `apps/api/src/modules/{meal-plans,care}`, `apps/api/test`.
- **Steps**:
  1. `pending_review` added to `planStatus` (an added enum value; no rewrite). Partial unique index: one `pending_review` per user.
  2. `PlanRepository.createPlanAtomically`: when the user has an `active` link with `reviewBeforePublish`, insert as `pending_review` and **do not complete** the active plan. Every other case: today's code path, unchanged.
  3. `publish(planId)`: one transaction — complete the `active` plan, set this one `active`. Through `withClient` (`review`, `write`): `POST /care/clients/:linkId/plan/publish`.
  4. The professional's changes to the pending plan, through `withClient`: a meal swap (`PlanRepository.swapMeal` with the client's id, the client's allowance), a regeneration (replaces the pending plan; counted as the client's own regeneration would be), and generating a plan for a client who has none. `PATCH /care/clients/:linkId` toggles `reviewBeforePublish`. (Amended in execution, owner's decisions of 2026-09-24: the professional may generate only when a plan is pending or the client has no active plan, otherwise 404 with no trail row; a pending plan counts toward the client's allowance only while it can still be published, so a link that ends, pauses or loses its grant leaves it to be replaced by the client's next generation at no charge.)
  5. Hide the state from the client in the four reads that bypass `findActive` (`0060`): `CheckInController.status`'s `findChain`, `GET /meal-plans` (history), `GET /meal-plans/:id`, and the job route's success answer, which tells the client the plan is with their dietitian instead of sending them to it. On the professional's side, `CareRepository.roster`'s latest-plan read orders by version whatever the status: teach it `pending_review` (fill `planPendingReview`, and keep `check_in_due` on the plan under way) — a fifth read that bypasses `findActive` (found in Phase 3).
- **Acceptance criteria**: PRD 8.
- **Verification**:
  ```
  pnpm turbo lint ts:check test
  node scripts/check-migrations.mjs --drift
  pnpm --filter api test:e2e
  ```
  The **whole** end-to-end suite, unchanged, is the proof that unlinked generation is byte-for-byte today's. A new `care-review.e2e-spec.ts`: with review on, the new plan is absent from `/meal-plans/active`, the shopping list, history, a fetch by id and the check-in status for the client, and present for the professional; publishing swaps it in atomically; with review off, generation is today's. Reviews: `migration-reviewer`, `invariant-reviewer`.

### Phase 6 — A check-in reaches the professional

- [ ] pending
- **Dispatch**: sonnet @ medium — `/execute-project 004 phase 6`
- **Goal**: when a linked client checks in, their professional is told once, and the message carries nothing about their health.
- **Scope**: `packages/database/src/schemas/_enums.ts`, one generated migration, `packages/core/src/controllers/{CheckIn,Notification,Care}`, `apps/api/src/modules/{check-ins,notifications,email,care}`, `apps/api/test` (step 4 adds `Care` and `care`).
- **Steps**:
  1. `checkin_submitted` added to `notificationType`.
  2. After `CheckInController.submit` succeeds, and only for a client with an `active` link, a background task tells the professional by mail and push, following `CheckInReminderService`'s shape (record the notification, dedupe on it, `EmailService.send`, `PushService.send`). Text: the client's name and a link to `/consulta`; no answer, no weight, no word about health.
  3. Once per check-in: a retried request or a second worker does not send twice.
  4. **Owner's decision, 2026-09-24: the check-in's kcal nudge never touches a professional's targets.** Today
     `CheckInController.submit` calls `updateTargets` with no setter, so a supervised client who answers hungry or full
     turns the whole override into their own, macros included (Phase 4's LOG notes).
     - When the client has an `active` link **and** their override carries `setByProfessionalId`: skip the nudge. The
       targets, and their mark, stay exactly as they are.
     - The check-in is still recorded, and the professional is told as in step 2.
     - The professional's read of that check-in, through `withClient`, carries the kcal the nudge would have set
       (`suggestedKcal`, computed, no column). The professional applies it, or doesn't, through Phase 4's targets route.
     - Step 2's message still says nothing about it: the suggestion lives behind the audited read, never in a mail or a
       push.
     - With no link, or with targets the client set themselves, the nudge works as today.
- **Acceptance criteria**: PRD 10.
- **Verification**:
  ```
  pnpm turbo lint ts:check test
  node scripts/check-migrations.mjs --drift
  pnpm --filter api test:e2e -- care fortnight
  ```
  A unit spec asserts the rendered mail and push text contain none of the check-in's fields. Reviews: `migration-reviewer`.

### Phase 7 — The practice is paid for

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 004 phase 7`
- **Goal**: a professional's plan opens the workspace and sets how many clients it includes; a lapse pauses without deleting; a linked client has the paid allowances.
- **Scope**: `apps/api/src/{config/Env.validation.ts,modules/billing,modules/care}`, `packages/core/src/{controllers/Billing,controllers/Plan,controllers/Care,repositories/Billing,domain/Allowance}`, `apps/api/test`.
- **Steps**:
  1. `STRIPE_PRACTICE_PRICES` (`price_…=N` pairs, comma-separated): all or none with the core `STRIPE_*`, validated in `Env.validation.ts`.
  2. `POST /billing/checkout` accepts `plan: 'practice'` (and the price, from the configured list) for a professional only; a 14-day trial once per account, as `0056` does for premium.
  3. The webhook (`0061`): a practice price writes `professionals.practiceOpen` and `includedClients` from configuration, in the same transaction as the `subscriptions` row; an unknown price grants nothing. A status that stops paying pauses every `active` link (`endedBy` untouched, `status = 'paused'`); paying again reactivates them.
  4. `ProfessionalGuard` also requires `practiceOpen` for the client routes; the workspace itself still opens to show the way to pay.
  5. `POST /care/invitations` refuses when active links plus unexpired invitations reach `includedClients`: a 409 `PRACTICE_FULL` whose body says the included number and that the larger plan or ending a link are the ways up.
  6. `PlanController.tierOf`: behind the `professional` flag, a client with an `active` link to an open practice is `premium`, before the column is read.
  7. **Owner's decision, 2026-09-24: when a link ends, the targets stay but become the client's own.**
     - In the same transaction that sets a link `ended`, whoever ends it: clear `setByProfessionalId` on the client's
       target override, but only where it names that link's professional. The numbers are untouched.
     - A second professional then sees no earlier professional's name, and the client's screens show the targets as
       their own.
     - A **pause** (this phase's lapse, step 3) keeps the mark. The link can come back, and the targets are still that
       professional's while it is paused.
     - Deleting the professional's account already clears it (`on delete set null`).
     - Tests:
       - end by the client, and end by the professional: the mark is cleared and the numbers are equal before and
         after;
       - a lapse and a resume keep the mark;
       - another professional's mark on the same client, which can't exist today, is never touched by this link's end.
- **Acceptance criteria**: PRD 13, 17 (the refusal and the plan change), 14 (a lapse deletes nothing). Step 7 is the owner's decision of 2026-09-24.
- **Verification**:
  ```
  pnpm turbo lint ts:check test
  pnpm --filter api test:e2e -- billing care
  ```
  With Stripe's client faked at `StripeGateway`, as the billing suite does: a practice subscription opens the workspace with its number, the larger price raises it, cancelling pauses the links and returns the clients to free, resuming reactivates them, a body cannot set `includedClients`, the 31st invitation on a 30 is refused. Reviews: `invariant-reviewer` (money moves only through the signed webhook).
- **owner-gated**: in Stripe test mode, create the two practice prices and allow switching between them in the customer portal; put the pairs in `apps/api/.env` — steps in the payments runbook, Phase 10.

### Phase 8 — The client's side of the link, on screen

- [ ] pending
- **Dispatch**: sonnet @ medium — `/execute-project 004 phase 8`
- **Goal**: the client accepts an invitation knowing what is shared, sees and ends their link and its trail, and sees who set their targets and that a plan is with their dietitian.
- **Scope**: `apps/web/src/app/(app)/{invitacion,perfil,inicio,plan}`, `apps/web/src/components/{TargetsPanel,…}`, new components, `apps/web/src/i18n/dictionaries`, `apps/web/src/proxy.ts`.
- **Steps**:
  1. `/invitacion/[token]` (added to `PROTECTED`; a signed-out visitor signs in or registers and comes back): who invites, the consent list, the separate health line, one primary action to accept, a secondary to decline.
  2. `/perfil`: the link card — the professional, what is shared, since when, *Terminar* — and the access trail below it.
  3. `TargetsPanel`: the third source, *tu dietista* / *your dietitian*.
  4. `/inicio` and `/plan`: while a plan is pending review, a calm notice that it is with their dietitian; the previous plan stays usable. The supervision notice's wording when a professional is linked.
  5. Every string in `es-ES.ts` first, then `en-GB.ts`.
- **Acceptance criteria**: PRD 3, 7 (the client's side), 8 (the client's side), 15.
- **Verification**:
  ```
  pnpm turbo lint ts:check test
  pnpm --filter web build
  ```
  The `apple-web-design` review (P0 and P1 fixed) and `/local-probe` of every new and changed screen at 320, 390 and 1280 px, light and dark, recorded in the pull request's `## Checked`. Reviews: `accessibility`.
  — human-verify: on an iPhone, accept an invitation from a fresh account, see the notice while a plan is under review, end the link.

### Phase 9 — The practice, on screen

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 004 phase 9`
- **Goal**: the professional's workspace at `/consulta`, and the owner's view of professionals on `/admin`.
- **Scope**: `apps/web/src/app/(app)/{consulta,admin}`, new components, `apps/web/src/i18n/dictionaries`, `apps/web/src/proxy.ts`, `packages/ui` only if a component is genuinely shared.
- **Steps**:
  1. `/consulta` (added to `PROTECTED`; shown only to a professional, 404 otherwise, as `/admin` is): the client list with each state, the invitation form, the plan card (subscribe, the portal, trial days left, *n de N pacientes*, the full-practice refusal with its way up).
  2. `/consulta/[linkId]`: the overview — adherence, the weight line, the check-ins, the plan and its history; the targets form; the pending plan with swap, regenerate and *Publicar*; the review toggle; *Terminar vínculo*; conditions and medications only if shared.
  3. `/admin`: grant and revoke a professional with the collegiate number; the professionals list with link counts, no client identities.
  4. The words decided in the PRD: *Consulta* / *Practice*, *pacientes* / *clients*.
- **Acceptance criteria**: PRD 9 (on screen), 15, and the web half of 1, 5, 7, 8, 13, 17.
- **Verification**:
  ```
  pnpm turbo lint ts:check test
  pnpm --filter web build
  ```
  The design review and `/local-probe` as in Phase 8, with a professional throwaway account and a linked one. Reviews: `accessibility`, `invariant-reviewer` (the screens call only `/care/*` routes and never put a client id in a URL).
  — human-verify: invite, accept, review and publish a plan, set a target, and end the link, end to end, on a phone and a laptop.

### Phase 10 — What is now true, and switching it on

- [ ] pending
- **Dispatch**: sonnet @ medium — `/execute-project 004 phase 10` — owner-approves: the consent text and the professional's agreement after a lawyer's hour (PRD Decisions 2) — owner-gated: the live practice prices and turning on the `professional` flag in production
- **Goal**: the documents say what the product now is, the whole suite is green, and the owner has what they need to switch it on.
- **Scope**: `docs/{PRODUCT.md,ARCHITECTURE.md,ROADMAP.md}`, `docs/reference/payments.md`, `docs/reference/deployment.md` if it names flags, `apps/api/test/README.md`, the project's `LOG.md`.
- **Steps**:
  1. `PRODUCT.md`: the second kind of user and what they may and may not do; the "not a user" line unchanged (PRD Decisions 11).
  2. `ARCHITECTURE.md` § Invariants: the one delegated path (`0059`), the review state (`0060`).
  3. `payments.md`: the practice prices, `STRIPE_PRACTICE_PRICES`, the portal's plan switching, the trial; the switch order going live.
  4. `ROADMAP.md` § 9 marked done; the test README's table gains the new suites.
  5. The assembly for the owner: the consent list and every string a client reads before sharing, in both languages, for the lawyer.
- **Acceptance criteria**: PRD 14 (proven across the suites), 16.
- **Verification**:
  ```
  pnpm turbo lint ts:check test
  pnpm format
  pnpm -w run deadcode
  node scripts/check-migrations.mjs --drift
  pnpm --filter api test:e2e
  sh scripts/check-leaks.sh
  ```

## Hand-off

- **The flag first.** Every professional route, screen and effect is behind `professional`, failing off; nothing in phases 1–9 is visible in production until the owner turns it on in Phase 10.
- **One way in.** After Phase 3, any code that reads or writes a client's data on a professional's behalf goes through `CareController.withClient`. No professional route takes a client's user id; they take a link id.
- **Health data and models.** Nothing from `Care`, `Health` or a professional's action reaches `apps/api/src/modules/ai`; the boundary spec is extended in Phase 3 and must stay green.
- **Unlinked users are untouched.** The existing end-to-end suites pass unchanged at the end of every phase; a change to one of them is a deviation to record in LOG.md, with the reason.
- **Reviews are not optional.** A phase with a migration runs `migration-reviewer`; phases 1, 2, 3, 5, 7 and 9 run `invariant-reviewer`; phases 8 and 9 run the design review and `/local-probe` (`apps/web/AGENTS.md` § Design review). A P0 holds the phase.
- **Phases that touch API and web together run as `/team`** (the owner's standing rule); phases 1–7 are API-only, 8–9 web-only.

## Out of scope

Everything the PRD lists as out, and:

- **A printable plan** — the first thing after this project (PRD Decisions 9).
- **Charging per client beyond the plan's number** — left for later (`0061`).
- **A professional's own personal premium beside their practice** — one subscription per account (`0061`).
- **Clinics** — several professionals per client (`0059`, the partial unique index).

## PRD criteria → phases

| PRD criterion | Phase(s) |
| --- | --- |
| 1 — professional only by the owner's act | 1, 9 |
| 2 — invitation single-use, expiring, revealing nothing | 2 |
| 3 — the client sees what is shared; version stored | 2, 8 |
| 4 — ending in one action; 404 from the next request | 2, 3 |
| 5 — no crossing between professionals | 3 |
| 6 — every access audited, visible to the client | 3, 8 |
| 7 — targets within bounds, marked as the professional's | 4, 8, 9 |
| 8 — a reviewed plan invisible until published; unlinked unchanged | 5, 8, 9 |
| 9 — the overview from stored state | 3, 9 |
| 10 — a check-in notifies once, no health detail | 6 |
| 11 — the AI module imports nothing from health or professional modules | 3 |
| 12 — health only under its own consent line; absent otherwise | 3 |
| 13 — the subscription opens and closes through the webhook; lapse pauses | 7 |
| 14 — deletion cascades as specified | 2, 3, 7, 10 |
| 15 — both languages, the design review, 320 px | 8, 9 |
| 16 — everything green and the documents true | 10 |
| 17 — the plan's included clients, the refusal and the way up; the trial | 7, 9 |
