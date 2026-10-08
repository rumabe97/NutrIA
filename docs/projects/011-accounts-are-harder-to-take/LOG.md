# LOG — Project 011: Accounts are harder to take

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

## Phase 0 — Does the limit see each person? (2026-10-01)

- **Executor**: opus 5.5 @ high (the lead, directly — no code changed, so no role agent
  was spawned).
- **Result**: done — **Result A**.
- **Evidence**:
  - The owner ran report `0007` § 9's count query on Neon's `production` branch (last
    30 days): **12** sessions, **0** without an IP, **9** distinct IPs. Every session
    carries an IP, and the spread fits distinct people, not one shared Vercel egress
    (B2) nor the shared `no-trusted-ip` bucket (B1).
  - Spoofing (PRD 1, third clause): Vercel's request-headers documentation
    (`vercel.com/docs/headers/request-headers`, read through `search_vercel_documentation`)
    says Vercel overwrites `x-forwarded-for` and does not forward external IPs, unless an
    Enterprise trusted proxy is set up (not used here). A value the client sends never
    reaches Better Auth's key.
  - `pnpm turbo lint ts:check test --filter=api`: 11/11 tasks green, 93 suites,
    1250 tests passing.
- **Deviations from plan**: none. Under Result A nothing is configured, so steps 3–5 (the
  header choice, its spec, the re-run after deploy) do not apply.
  `apps/api/src/modules/auth/auth.config.ts` and `apps/api/src/config/CreateApp.ts`
  (`trust proxy` 1) are unchanged. `invariant-reviewer` was not run, because there is no
  diff to review.
- **Decisions**: none.
- **Notes for the next phase**:
  - The sample is small: a friends beta, 12 sessions in 30 days. If phase 7's brake ever
    sees one IP for many accounts, re-run the § 9 query before blaming the brake.
  - The Vercel log search for "Rate limiting could not determine a client IP" was not
    reported. With 0 empty IPs the warning cannot have fired on a sign-in. The owner may
    still run it once to close PRD 1's second clause by observation.
  - Phases 1+ may rely on Better Auth's limiter keying on the client's IP.

## Phase 1 — Strong passwords on every door (2026-10-01)

- **Executor**: run as a `/team` led by opus 5.5 @ high. Roster:
  - `backend-high`, `frontend-high`, `tests-high` and `accessibility-high`, all on opus,
    because of the plan's floor for the sign-up and reset paths;
  - `legal` on sonnet (a one-line judgement on a text, not on the sign-in path);
  - `invariant-reviewer` on opus @ high, twice.

  A follow-up of `frontend` (a headers unit test) ran as `frontend` on sonnet @ medium,
  because it is off the sign-in path. The machine shut down mid-phase; `tests`,
  `accessibility` and `invariant-reviewer` were spawned again on the merged commit, and
  no work was lost because every agent had committed. The advisor was not consulted.
- **Result**: done.
- **Evidence**:
  - Gate on `66f9cd2a`: `pnpm turbo lint ts:check test --filter=core --filter=api
    --filter=web --filter=ui`, 17/17 tasks. API 1293 tests, core 107 files, web 25,
    ui 59, database 4.
  - End-to-end on the final tree:
    - `passwords.e2e-spec.ts` 21/21;
    - `access.e2e-spec.ts` 9/9;
    - the affected suites on `66f9cd2a`: 13 of 14 suites, 267 of 269 tests. Both failures are in `admin`.
      One was a stale cron list (`['reminders','rewrite']`), fixed in `2df3efcb`. The other is
      "never name who made a dish", whose premise depends on the library (below).
  - The partial full run on `07077b76`, stopped at 18 of 42 suites to run the final
    tree: 16 pass, 2 fail.
    - `care-review`: its `beforeAll` passed the 120 s hook timeout (the slow-day case
      the suites' README names).
    - `admin` › "never name who made a dish": its premise needs a recipe the model
      generates, and Nutria-E2E's 2,072-recipe library serves the plan instead. The
      branch touches no generation or recipe code.

    CI's clean container is the proof for both.
  - HIBP never reached from a suite: `apps/api/test/hibp-tripwire.ts` refuses and counts
    every request, and the passwords suite asserts zero.
  - Reset timing (PRD 5), measured locally. The run used a local SMTP sink that waits
    ~500 ms and never relays, 20 + 20 requests, `NODE_ENV=test`, runs in threes with a
    61 s pause.
    - Before decision `0075`: existing 1374 ms, missing 1594 ms (+220 ms, fails).
    - After: existing **440 ms**, missing **366 ms** (−73 ms, within 100 ms).
    - What is left is one round trip: Better Auth reads the accounts only when the user
      exists. Round trips counted with a query logger: existing 3 in-request, missing 2.
    - A unit spec proves the reset answers before a mailer that resolves after 500 ms.
  - `invariant-reviewer`:
    - On `23f65209...5946a6da`, two P1s, both fixed and re-verified closed:
      - an empty body token skipped the reset checks (`??` → `||`, the way Better Auth
        reads it);
      - live reset and verification tokens were written to the request log in `url`,
        `referer` and `location` (`pino.ts` scrub).
    - A P2 (the headers source pattern unpinned) is fixed with a unit test over Next's
      own matcher.
    - On `30c794ce...66f9cd2a` (the sweep): no P0, no P1. Two P2 test gaps are fixed by
      `tests`.
  - `accessibility`: `/local-probe` on `/registro`, `/en/registro`, `/restablecer` and
    `/en/restablecer`, at 320, 390 and 1280 px, light and dark, plus scripted typing,
    pasting and submitting.
    - It found four P2s, all fixed and re-probed closed:
      - a dead end on an invalid link;
      - "try again" on a 429;
      - the hint at 4.41:1;
      - the meter saying "buena" over 128.
    - It found two P3s, fixed: the missing-count description and a stale field error.
    - The breached state could not be rendered, because HIBP is off locally.
  - `legal`: `/privacidad` names the breached-password check under "Cómo protegemos tus
    datos" (art. 5.1.a transparency; not required, on its reading that a 5-character
    hash prefix is not personal data, to be confirmed by a lawyer). The text is in
    `docs/legal/textos/02-politica-privacidad.md` and both dictionaries, and it must
    ship in the same deploy as the hook.
- **Deviations from plan** (the plan is amended in the same change):
  - **No `maxLength` on the password fields.** The browser would silently cut a pasted
    password. `passwordrules` stays, and over 128 is refused on the client.
  - **`newPasswordSchema` counts `.length`** with a `superRefine`, not `.min/.max`.
    Zod 4.6 counts code points while Better Auth counts UTF-16 units.
  - **Scope grew by `apps/api/src/shared/logging/pino.ts`**, after the invariant review.
    A refused reset now leaves a token spendable after its Referer was logged.
  - **Scope grew by the verification sweep**, the owner's choice for PRD 5 (decision
    `0075`): `verification.disableCleanup`, a daily cron
    `/api/v1/cron/sweep-verifications` at 08:05 UTC that records its run, the
    `verifications` cron label in both dictionaries, and `deployment.md` § 3b.
  - **The security headers skip the rewritten `/api/v1` paths**, so they don't double
    helmet's.
  - **Fixed in passing**, beyond the plan: the reset form's links dropped `/en`; "Pedir
    un enlace nuevo" was under 44 px; the shared `Input` replaced its own describedby
    links. The `Input` now takes a merged `describedBy` prop.
- **Decisions**:
  [`0075`](../../decisions/0075-expired-verification-rows-are-swept-daily-not-on-every-read.md).
- **Notes for the next phase**:
  - **Owner, after deploy**:
    - `curl -sI` on the production web origin should show the four headers, with
      `x-vercel-cache: HIT` still on `/`.
    - Count `hibp_unavailable` in the API logs over the first day. The plan's stop
      signal is HIBP habitually over 2 s from `fra1`.
    - The first owner digest lists the new sweep as silent until its first run at
      08:05 UTC.
    - If the deploy is not on 2026-10-01, set `privacy.updated` to that day in both
      dictionaries.
  - **Owner, on the iPhone**:
    - whether VoiceOver reads the meter's level once per change;
    - whether the keyboard hides the meter at 320 px;
    - whether the Keychain suggestion honours `passwordrules`;
    - whether a refusal is announced twice (the alert plus the `Input`'s own live
      error).
  - **Open P3s**:
    - the form's top alert is not cleared when the field is edited;
    - links in running text are told apart by colour alone (shared `.link`);
    - the `token=` scrub misses a double-encoded `%253d`;
    - the `Cron.controller.ts:41` comment still says "a third sweep".
  - **Residual risks**:
    - Vercel's own access logs keep `/restablecer?token=…` (platform, single-use,
      1 h).
    - The OAuth `code=`/`state=` stay unscrubbed (single-use, PKCE-bound).
    - Expired verification rows now live up to a day.
  - **Nutria-E2E state**: an earlier cut-off run left `app_settings.professional`,
    `premium` and `automatic_activation` true. The full run resets `professional`; the
    other two's baselines are unknown.
  - **For phase 2**:
    - `/change-password` is already guarded by the hook (the session's own words, the
      authoritative session).
    - Its own refusal codes are mapped in `apps/web/src/lib/newPassword.ts`.
    - The `PasswordMeter` is reusable as it is.

## Phase 2 — "Seguridad" in /perfil (2026-10-01)

- **Executor**: run as a `/team` led by opus 5.5 @ high.
  - **Building:** `backend-high`, `frontend-high` and `tests-high`, all on opus, the
    authentication floor.
  - **Reviewing:** `accessibility-high` on opus; `migration-reviewer` and
    `invariant-reviewer` on opus @ high.
  - **`legal`** on sonnet: retention, and the `/privacidad` sentences.
  - **Follow-ups:** one CSS specificity fix by `frontend` on sonnet @ medium, because it is
    off the auth decision path. No advisor consultation.
- **Result**: done in code. Pending: the human-verify on the owner's iPhone after deploy.
- **Evidence**:
  - **Gate** on `e887966c`: `pnpm turbo lint ts:check test --filter=core --filter=database
    --filter=api --filter=web --filter=ui`, 17/17 tasks. API 1345 tests, core 108 files,
    web 26, ui 59, database 4.
  - **End-to-end** on `e887966c`, 101/101 tests:

    | Suite | Tests |
    | --- | --- |
    | `account-security` | 13/13 |
    | `access` | 9/9 |
    | `passwords` | 21/21 |
    | `isolation` | 6/6 |
    | `social-sign-in` | 9/9 |
    | `professionals` | 22/22 |
    | `audit` | 15/15 |
    | `onboarding` | 6/6 |

    The full run was left to CI.
  - **Migration 0050** (`user.password_compromised_at timestamptz NULL`): `migration-reviewer`
    found no P0.
    - Lock: a catalogue-only change, holding the lock for milliseconds.
    - Old API during the deploy: it survives.
    - Rollback: safe.
    - Its two P1s are closed and verified: the field is declared in Better Auth
      `user.additionalFields` (`input: false`), and `userSchema` carries it.
    - Its P3, a safety comment in the file, is done.
    - P2, accepted: a password changed under a rolled-back API leaves the mark.
    - The owner applied 0050 to Nutria-E2E on 2026-10-01.
  - **`invariant-reviewer`**: no P0, no P1.
    - **P2, fixed:** while HIBP was down, a marked account could clear its mark by
      "changing" to the same password.
      - On reset, the new password is now checked against the stored hash.
      - On change, `newPassword === currentPassword` is refused.
      - Change is not checked against the hash, because that check runs before Better
        Auth verifies the current password and would hand any session a guessing tool.
    - **P3, fixed:** `/privacidad` promised the person a view of their own trail. "tú" is
      dropped.
    - **P3, fixed:** the exemption scan now also catches the metadata key.
    - **Verified:**
      - whose sessions are listed and revoked;
      - the forced revoke against `revokeOtherSessions: false`;
      - that the mark cannot be cleared from `/update-user`;
      - the guard's exemptions;
      - no password, SHA-1 or prefix anywhere;
      - legal's condition (sign-in writes only the timestamp on a hit, nothing on a
        timeout);
      - audit rows with no token, IP, user agent or session id.
  - **`accessibility`**:
    - A code read before the build: ten findings, all fixed.
    - `/local-probe` on `e887966c`, covering `/perfil` with a fresh session and four
      sessions, the stale state, and `/cambiar-contrasena` and `/en/cambiar-contrasena`,
      at 320, 390 and 1280 px, light and dark, plus 200% text and keyboard walks: no P0,
      P1 or P2.
    - Four P3s, fixed (`6b95768b`), plus a specificity tie on the stale-state button,
      fixed after.
  - **`legal`**:
    - Retention for `auth.*` rows is 12 months (`docs/legal/analisis.md` § 4.1 bis). It
      differs from `audit_logs`, which never purges, so the purge moves to phase 7, and
      `checklist-activacion.md` § 0 quater makes it the condition for publishing the 12
      months.
    - `/privacidad` gains a "Seguridad de tu cuenta" category, a mail-provider line naming
      security notices that cannot be turned off, a retention line, and the
      breached-password sentence now covering sign-in.
- **Deviations from plan** (plan amended in the same change):
  - **The forced screen lives at `/cambiar-contrasena` in both trees.** Routes are Spanish
    in both, per `apps/web/AGENTS.md`. It sits beside `/pendiente` in `(auth)`, so the
    `(app)` layout cannot loop on it. The order is `/pendiente` first, then
    `/cambiar-contrasena`, then onboarding, so the stop signal never fired.
  - **The guard exempts GET/DELETE `/users/me` and GET `/auth/me`.**
  - **Better Auth's `/list-sessions` needs a session younger than `freshAge` (one day),**
    and answers 403 `SESSION_NOT_FRESH` otherwise.
    - The revokes and change-password don't need one.
    - Instead of the list, the web shows a sentence with "Cerrar sesión y volver a
      entrar", and keeps "Cerrar todas las demás".
    - PRD 6's "they can list their sessions" therefore holds after a sign-in within the
      last day. Most visits to `/perfil` will see the stale state.
    - The alternative is our own token-free `GET /users/me/sessions`, a design change
      that is the owner's call. `freshAge` itself also guards `DELETE /users/me` and was
      not touched.
  - **A revoke with another person's token is answered by our hook** with
    `{status: true}`, closing nothing and writing no row, so the trail never records a
    no-op.
  - **On a marked account, a wrong current password with an equal new one answers
    `PASSWORD_COMPROMISED`,** not `INVALID_PASSWORD`. It gives the same answer as the
    right password and changes nothing, so it reveals nothing, but its message is
    slightly misleading. Accepted.
  - **The `auth.*` audit purge moved to phase 7**, per `legal`.
  - **`.claude/skills/local-probe/scripts/account.mjs` gains `compromise` and `age`,**
    limited to `@probe.invalid` accounts and behind the production guard, documented in
    the skill, so the forced screen and the stale state can be probed without hand-written
    SQL.
- **Decisions**: none new. `0074` covers the design.
- **Notes for the next phase**:
  - **Human-verify, after deploy:** on the owner's iPhone, change the password in
    `/perfil` → Seguridad. The session on the computer must end, and the "Tu contraseña de
    NutrIA ha cambiado" mail must arrive. Record "confirmed by human on <date>" here.
  - **Owner's product question:** is relisting sessions without a fresh sign-in worth a
    token-free API route?
  - **Open, minor:**
    - a refusal is announced twice (the form's alert plus the field's error), in both the
      phase 1 and phase 2 forms; change both or neither;
    - `#seguridad` does not land on a full page load (nothing links there yet);
    - the Google-only variant of the section was not probed;
    - VoiceOver's actual reading was not checked (it needs the iPhone).
  - **For phase 3:**
    - TOTP lives in this section, after the password card.
    - `UserView.hasPassword` already says who may enable it.
    - `PasswordChangeGuard` exempts `/auth/*`, so `/auth/two-factor/*` stays reachable
      for a marked account.
    - The new audit actions follow `legal`'s rule: the account id only in
      `actorId`/`subjectUserId`, no `ipHash`, metadata a single word.

## Phase 3 — Optional second factor: an authenticator app (2026-10-01)

- **Executor**: run as a `/team` led by opus 5.5 @ high.
  - **On opus · high:** `backend-high`, `frontend-high`, `tests-high` and
    `accessibility-high`, the authentication floor.
  - **Reviewers on opus · high:** `migration-reviewer` and `invariant-reviewer`.
  - **`legal`** on sonnet.
  - **The lead's mistake:** the lead spawned duplicate `backend-2` and `tests-2` while the
    originals were still running, having declined their shutdown to fix findings.
    - Both duplicates were stopped with TaskStop.
    - `tests-2` wrote into the tests worktree before it stopped; `tests` reviewed and kept
      those edits. Nothing of `backend-2` reached the branch, as `backend` checked.
    - A killed `tests-2` run left 5 accounts on Nutria-E2E; `tests` deleted them by stamp.
  - No advisor consultation.
- **Result**: done in code. Pending: the human-verify on the owner's iPhone after deploy.
- **Evidence**:
  - **Gate** on `978b2700`: `pnpm turbo lint ts:check test --filter=core --filter=database
    --filter=api --filter=web --filter=ui`, 17/17 tasks. API 1375 tests, core 108 files,
    web 27, ui 59, database 4.
  - **End-to-end** on `f729e636`, by file path: `two-factor` 24/24; `social-sign-in`,
    `access` and `account-security` 31/31. A first run on the stale `c6b67a1e` failed 3;
    two were product code that `910faa2b` added, and one was the test's error-code
    expectation. The full run is left to CI. No leftover accounts.
  - **Migration 0051** (the `two_factor` table, `ON DELETE CASCADE`, `UNIQUE(user_id)`, and
    `user.two_factor_enabled`): `migration-reviewer` found no P0.
    - `UNIQUE(user_id)` cannot break the plugin. The only insert is `/enable` after an
      empty `findOne`, and a racing double enable gets a 500, which is safer than two
      secrets.
    - The column is catalogue-only, and the old API survives.
    - A rollback quietly turns 2FA off while it lasts.
    - Its point (`twoFactor` in the adapter's schema map) was already met.
    - Applied to Nutria-E2E by the lead on the owner's word, 2026-10-01.
  - **`invariant-reviewer`**: no P0. Its two P1s are fixed and verified closed against
    Better Auth 1.7.6's source.
    - **P1-a:** a new implicit Google link at `/callback/google` into an account with the
      factor on gave a session with no code, because the link ignores
      `twoFactorEnabled`. Fixed by `databaseHooks.account.create.before`, which refuses it
      unless that account's own session asks. The callback then answers
      `?error=unable_to_link_account` and the web shows its generic social failure.
      Side effect: an explicit Apple link would also be refused, since Apple's
      `form_post` carries no session cookie. Apple is dark, and this is noted in
      `apps/api/AGENTS.md`.
    - **P1-b:** `/two-factor/get-totp-uri` handed the secret to session+password with no
      trace. It now answers the guard's 404.
    - **P2, done:** trusted devices are forgotten on disable, change, reset and
      revoke-(other-)sessions. This relies on Better Auth's plain verification identifiers,
      and the comment says so.
    - **P2, done:** regenerating codes is audited (`auth.backup_codes_regenerated`) and
      mailed.
    - **P3, done:** an idle disable writes and mails nothing; a wrong comment is corrected;
      the card says Google sign-in is guarded by Google, not by this code.
  - **`accessibility`**:
    - **Code read:** 1 P1 (the 52-character secret did not wrap) and 3 P2s, all fixed in
      `cbd66a37`.
    - **`/local-probe`** on `37f0561f`, covering the whole flow in Chrome with real TOTP
      codes at 320, 390 and 1280 px, light and dark, plus 200% text: no P0 or P1. 2 P2s
      and 1 P3 were fixed in `1d8e2935`, and a re-probe on `8eb06490` was clean.
    - Not rendered: the 10-failure lockout screen (Better Auth's rate limit answers 429
      from the 4th wrong code), and the English flow beyond the redirect.
  - **`legal`**: `/privacidad` gains a "Verificación en dos pasos" data item and the
    30-day "confiar en este dispositivo" cookie. The three mails fit the published
    security-notices line. Its condition (disable deletes the `two_factor` row) holds.
    The trust cookie's LSSI 22.2 exemption is to confirm with a lawyer.
- **Deviations from plan** (plan amended in the same change):
  - the invariant fixes above;
  - the `uqr` dependency, added by the lead before the agents started;
  - the challenge route is `/acceder/codigo` in both trees, beside `/pendiente` in `(auth)`.
- **Decisions**: none new (`0074` covers the design).
- **Notes for the next phase**:
  - **Human-verify, after deploy, on the owner's iPhone with the installed app:**
    - turn the factor on (Keychain through the "Añadir a tu app" `otpauth://` link, or an
      app);
    - sign in with a code, then with a backup code;
    - turn it off;
    - also check the `.txt` download, code autofill and VoiceOver on the grouped key and
      the codes.

    Record "confirmed by human on <date>" with the iOS version. Stop signal: the
    challenge does not work inside the installed app.
  - **Owner decisions:**
    - (a) **TOTP replay:** a code is accepted again on a new challenge within about 90 s,
      because the plugin keeps no record of used codes (RFC 6238 § 5.2, NIST 800-63B "only
      once"). Refusing it needs a used-step record and a hook that decrypts the secret. A
      P2, and the suite pins today's 200.
    - (b) **Linked Google account:** an account the person linked to Google themselves
      still signs in through Google without the code, per `0074`. It matters more in phase
      6, where TOTP becomes mandatory for professionals.
  - **Open, minor:**
    - `/change-password`'s rotated session counts as a `session_started`;
    - migrations that lock `user` set no `lock_timeout`;
    - outside the feature: the "Ver tu evolución →" link on `/inicio` is 20 px tall on a
      phone, and the welcome tour overflows at 320 px with 200% text.
  - **For phase 4:**
    - the owner's removal clears the `two_factor` row and `two_factor_enabled`, and should
      also forget trusted devices (`UserRepository.forgetTrustedDevices`);
    - the audit actions follow the same rule;
    - the mails reuse the TwoFactorChanged template.

## Phase 4 — owner's approval of the procedure, and the migration renumbered (2026-10-03)

- **Owner decision**: the procedure in
  [`docs/legal/procedimiento-quitar-segundo-factor.md`](../../legal/procedimiento-quitar-segundo-factor.md)
  is approved as written. This is the plan's "owner-approves" step before the console
  action ships. (who decided: owner, delegated on 2026-10-03 — "las decisiones anótalas con
  lo más recomendado".)
- **Deviation**: the phase's migration is `0057`, not `0052`. Main took `0052`–`0056`
  while the branch waited, and an older journal `when` would have been skipped silently in
  production. It was regenerated by drizzle-kit on main's snapshot, with the same statements
  (the `two_factor_removal` table and `two_factor.last_totp_step`) and the reviewed header
  comment unchanged.
- **Deviation** (plan amended in the same change): the routes are
  `/admin/accounts/:id/two-factor/removal`, not the plan's `/admin/users/:id/…`, to match the
  console's other account routes. The account rows carry two more keys, `twoFactorEnabled`
  and `twoFactorRemovalDueAt`, and the system page lists the `twoFactorRemovals` cron;
  `admin.e2e-spec.ts` was updated for both (by `backend`, with the lead's approval, since
  the file is `tests`').

## Phase 5 — Passkeys (2026-10-03)

- **Executor**: opus @ high (`backend`, resumed by a second `backend` after the first
  stalled), with `frontend` and `legal`.
- **Result**: partial — built, migration `0059`, e2e green locally; the migration and
  invariant reviews, the live accessibility probe and the owner's iPhone check are still
  to come.
- **Upgrade notes** (step 1, `better-auth` 1.7.6 → 1.7.7 alone, before the plugin; the
  dist diff read between the two versions):
  - sessions, cookies and hooks are unchanged; the two-factor plugin is unchanged;
  - OAuth state rows are now `auth-state:<state>` in `verification`, with a cookie key
    derived from their purpose (the Magic Link advisory GHSA-965c-763c-88jm);
  - a 429 and a middleware error now carry `Content-Type: application/json`;
  - the Drizzle adapter's conditional `updateOne` keeps its `WHERE` (the database-backed
    rate limit relies on it);
  - the web client's session signal is a refactor only: the list of paths that refresh
    the session moved into an exported `matchesSessionSignal`, same paths.
- **Decisions** (who decided: the lead, delegated by the owner on 2026-10-03 — "las
  decisiones anótalas con lo más recomendado"):
  - **(b) the password before a passkey**: `POST /auth/passkey/confirm-password
    { password }` leaves a ten-minute, single-use grant for that session in
    `verification` (`passkey-grant-<sessionId>`); without it both registration steps answer
    403 `PASSWORD_CONFIRMATION_REQUIRED`. An account with no password adds one only from a
    session ten minutes young (403 `SESSION_NOT_FRESH` otherwise). A session somebody else
    holds cannot turn itself into a key that outlives it.
  - **(c) a password reset removes every passkey** of the account, in the reset's
    transaction, one `auth.passkey_removed` per key, and the "password changed" mail says
    how many went. A reset is what someone does when the account is no longer only theirs.
  - **User verification required** (from `legal`'s art. 32 RGPD finding): the options ask
    for `userVerification: 'required'` at registration and at sign-in, and the plugin's
    `afterVerification` hooks refuse an answer without the UV flag (registration 400
    `FAILED_TO_VERIFY_REGISTRATION`, sign-in 401 `AUTHENTICATION_FAILED`). A passkey
    sign-in opens a session with no second step only because the device held and the
    person who unlocked it are the two factors; a key on possession alone never signs in.
- **Migration**: `0059_a_person_keeps_passkeys_on_their_account` — one new table,
  `passkey` (`credential_id` UNIQUE, `counter` bigint, `user_id` ON DELETE CASCADE, indexed),
  generated on main's `0058` snapshot.

## 2026-10-03 — Phase 5 also carries a scheduler fix (`0082`)

- **What**: pasta, rice and grains are no longer served on two days running, and no legume more than three times a fortnight, unless a day's bands need it. Both rules now sit with the starch cap (`0081`) in `KindRules.held`.
- **Why here**: the owner, 2026-10-03, after his production plan served rice on days 1 and 2 and white beans four times: "mete ese pequeño arreglo en esta fase del 011". It is project 017's rule, shipped in this phase's pull request, with no other link to accounts.
- **Measured**: reference library, 196/196 days off and on; starch runs 1 → 0; meals past a legume's three 13 → 0 off and 5 → 0 on; `schedulePlan` time +3.2% off and −9.2% on. Full table in `0082`.

## 2026-10-03 — Phase 5, the invariant and migration reviews applied

- **Executor**: opus (`backend`), on `agent/passkeys/backend-011p5` (PR #210). The lead
  allowed it to edit `apps/api/test` and the web dictionaries for this round.
- **Decisions** (who decided: the lead, delegated by the owner on 2026-10-03; recorded in
  `0083`, which amends `0074`):
  - **P1 — any password change forgets passkeys, as with trusted devices** (option a). A
    change from Seguridad now removes every passkey of the account in the same transaction
    as a reset does, with one `auth.passkey_removed` each, and the "password changed" mail
    says "se han quitado las N llaves de acceso" whenever N > 0. This replaces decision (c)
    above, which removed them on a reset only. The Seguridad copy, the reset page and the
    `/privacidad` item now say "al cambiar o restablecer la contraseña".
  - **P2**:
    - When the change or reset transaction fails, the passkeys are deleted again on their
      own (`UserController.forgetPasskeys`). If that fails too, the error line
      `passkeys_not_removed {"userId"}` is written.
    - An unconfirmed address cannot add a passkey: new code 403
      `EMAIL_CONFIRMATION_REQUIRED`, on both registration steps.
    - A passkey sign-in cancels a pending lost-factor removal and sends the "cancelled"
      mail, as a correct code does. The two-factor item of `/privacidad` now says "con un
      código o con una llave de acceso". Its parenthetical speaks of signing in with the
      password, which is the only sign-in that may skip the code and so not cancel.
  - **P3**:
    - Better Auth's `logger` (`authLogger`) scrubs every quoted value on a line that
      mentions a challenge, so no WebAuthn challenge reaches a log.
    - The grant is spent atomically by `/passkey/verify-registration` before the plugin
      runs (`DELETE … RETURNING`), so two parallel verifies on one confirmation cannot
      both pass. A verify the plugin refuses spends it too, and the person confirms again.
  - **Named consequence**: a user-verified passkey is a passwordless door as strong as a
    second factor. An account with TOTP on that adds one signs in with it without a code,
    on purpose. This includes the professionals and the admin of phase 6, whose TOTP rule
    accepts it.
- **Migration reviewer's notes** (comments only, the SQL of `0059` untouched):
  - Redeploying after a rollback must first `DELETE FROM passkey` (or delete the rows of
    accounts that reset or changed their password meanwhile), because the old API did not
    remove passkeys.
  - `auth.schema.ts` notes that a duplicate `credential_id` from another account surfaces
    as a 500, which is acceptable.
- **Tests**:
  - Specs: `Passkey.spec.ts` (34), `AccountSecurity.spec.ts`, `AuthLogger.spec.ts`, and
    `core`'s `UserController` and `UserRepository` tests.
  - End-to-end, in `passkeys.e2e-spec.ts` (21): the guards' three 409s after a passkey
    sign-in; a TOTP account signing in with no `twoFactorRedirect`; a change and a reset
    each removing passkeys; both reset failure paths; a pending removal cancelled; an
    unconfirmed address refused; no challenge in the logs; two parallel verifies on one
    grant, only one passing.
  - `deleteAccountByEmail` in the harness is now paced: the suite's last minute could
    spend the API's own allowance, and a 429 was read as "already gone".
- **Web** (with the lead's approval, since `frontend` was not running): `passkeyAddRefusal`
  answers `EMAIL_CONFIRMATION_REQUIRED` with "Confirma tu dirección de correo antes de
  añadir una llave de acceso…" in es-ES and en-GB. `/perfil` has no resend, so the text
  points to the sign-up mail's link.
- **Build**: `@simplewebauthn/server` is back in `apps/api`'s `dependencies`. The inferred
  type of `createAuth` names its WebAuthn JSON types, and as a devDependency
  `nest build` failed with TS2883 (CI e2e, PR #210), because TypeScript does not write a
  declaration that references an unlisted package. An explicit return type would have
  imported the same types into production code, so it is listed in knip's
  `ignoreDependencies` for `apps/api` instead, with the reason.
- **Advisor**: not consulted.

## Phase 5 — shipped and verified (2026-10-03)

- Merged as #210 and deployed. Migration 0059 is applied.
- **Human-verify:** the owner added a passkey in Perfil › Seguridad and signed in with Face ID on his iPhone: "funciona, por lo menos en iPhone". The iOS version was not recorded. Android and desktop are not yet checked.

## Phase 6 — Mandatory for professionals and the admin (2026-10-03)

- **Executor**: opus 5.5 @ high (`backend`, named `backend-011p6`), on
  `agent/privileged-2fa/backend-011p6`. For this phase the lead allowed it to edit
  `apps/web` (the workspace copy and the console's gate) and `apps/api/test`.
- **Owner gate, cleared**:
  - The owner, 2026-10-03: "Activado el 2FA, no tengo nutricionista".
  - A read-only production check confirmed both halves. The one admin account has a
    password and `two_factor_enabled = true`. The only `professionals` row is that same
    account.
  - So no professional is active with a password and no second factor (the phase's
    stop signal), and the admin half ships with the professionals' half.
- **Result**: done, pending the invariant and legal reviews.
- **The rule, as written** (`core/domain/SecondFactor`, `secondFactorMissing`):
  - An account with a `credential` account must have `twoFactorEnabled`.
  - An account with only provider accounts passes.
  - `UserController.needsSecondFactor(user)` asks it from the session's user. The flag
    rides the session (`SessionGuard` copies it to `request.user`), so an account with
    the factor on costs no query. Only an account with it off is asked whether it has a
    password, and only in `ProfessionalGuard` and `AdminGuard`.
  - **Professionals**: every client route is the guard's 404. The `@BeforePractice()`
    routes stay open: the workspace's page and accepting the agreement.
    `GET /care/practice` adds `secondFactorRequired`, and `/consulta` shows
    `SecondFactorRequired` in place of the workspace, before the agreement.
  - **The admin**: `AdminGuard` (now async) answers the same 404 on every
    `@Roles('admin')` route. The web's console gate applies the same function to
    `/users/me` (`role`, `hasPassword`, `twoFactorEnabled`) and shows
    `SecondFactorRequired` instead of the console.
- **Decision: a passkey does not stand in for TOTP on a password account** (the lead's
  view, confirmed here). `0083` makes a user-verified passkey's own sign-in two factors,
  but it guards nothing at the password door beside it. So a privileged account with a
  password, a passkey and no TOTP is refused, however it signed in. With TOTP on, a
  passkey sign-in passes with no code, as `0083` § Consequences says. The rule asks
  about the account, never about how the session was opened. The copy says "mientras tu
  cuenta tenga contraseña, una llave de acceso no la sustituye", and never promises that
  every sign-in asks for the code.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api
    --filter=web`: green. The API has 1510 unit specs.
  - `pnpm --filter api build`: green.
  - The end-to-end suites ran on local Postgres (`NUTRIA_LOCAL_PG=1`), one run at a
    time, all green:
    - professionals 25;
    - admin, access, two-factor, two-factor-removal, care-review, billing and
      social-sign-in: 258 together;
    - care and care-practice: 107;
    - audit, text-cap, the five picture suites, dish-pictures, plan-scheduled-care,
      accompaniments and passkeys: 142.
  - New end-to-end cases:
    - professionals: client routes shut with the guard's 404 byte for byte, the page
      open with `secondFactorRequired: true`; opened by TOTP and shut again on the next
      request after `/two-factor/disable`; a professional with no `credential` account
      never blocked;
    - admin: console routes shut with the stranger's 404, `/users/me` saying what the
      web reads, opened by TOTP; an admin with no password never blocked;
    - passkeys: an admin with a password and a passkey but no TOTP is refused after a
      passkey sign-in, and let in by a passkey sign-in with no code once TOTP is on.
- **Harness**:
  - `enableTotp(app, account, password?)` turns TOTP on through `/two-factor/enable` and
    the first `/verify-totp`. It answers the account with its rotated cookie: the old
    one is gone.
  - Every suite that makes an admin or a working professional calls it and puts the
    new cookie in its cleanup list.
  - `register` is now paced: the two extra `/auth/*` calls per privileged account
    pushed `care.e2e-spec.ts` past the API's own 120-a-minute limiter.
  - `care-practice`'s "deletes a professional who pays" deletes from the confirmed
    session. A password sign-in would now be challenged.
- **Deviations from plan**: none in scope. The plan names `Session.guard.ts`,
  `Professional.guard.ts` and `Admin.guard.ts`; the practice view's field and the web's
  console gate are how "copy that says what to do" reaches each page.
- **Not changed, to note**:
  - Billing's practice checkout and the Stripe test-mode check (`role === 'admin'`) are
    not behind these guards. They read no health data.
  - The owner's one-click activation link is `@Public()` and authorised by its token, not
    the session.
- **Advisor**: not consulted.
- **After deploy**: the owner still reaches `/admin` (his account has TOTP on).
- **Legal review, P2 applied** (`legal-p6`): turning TOTP on now closes every other
  session of the account. The flag rides every session's user row, so a session opened
  earlier with the password alone would otherwise have passed the privileged rule once
  the factor went on.
  - In `twoFactorAfter`, the confirmation that turns the factor on deletes every
    session but the one the plugin just made, awaited, and writes
    `auth.sessions_revoked {scope:'others'}` when any went. A failure is the line
    `two_factor_sessions_not_closed {"userId"}`, not a 500.
  - This applies to every account, not only privileged ones.
  - The "enabled" mail and the web's confirmation say the other sessions were closed.
  - Pinned by three specs in `TwoFactor.spec.ts` and by a `professionals.e2e-spec.ts`
    case: a session signed in with the password before TOTP went on is gone afterwards.
  - Rerun: two-factor, professionals, passkeys, two-factor-removal and care-practice,
    126 tests, green. API unit specs: 1513.
- **Legal review, agreement § 8** (`legal-p6`, `e1f79a94` on this branch; applied under
  the owner's delegation of 2026-10-03):
  - `practiceAgreement` § 8 in `es-ES.ts` and `en-GB.ts` carries the
    ⟦dos-pasos-obligatoria⟧ bullet. A password account must have the authenticator app
    on; a passkey does not replace it. A Google-only professional keeps Google's own
    two-step verification on, which NutrIA cannot check.
  - `PROFESSIONAL_AGREEMENT_VERSION` is `1.1.0`, so every professional is asked again.
    Today that is only the owner's own account.
- **Invariant review** (`invariant-reviewer-p6`): no P0 or P1. The P2s and P3s are
  applied:
  - **P2-1**: the "off again" checks now run on a session that already existed before
    the factor went off, for a professional (`professionals.e2e-spec.ts`) and for the
    admin (`admin.e2e-spec.ts`). Nothing else pins `cookieCache` off, and this is the
    first place the flag decides who gets in.
  - **P2-2**: `two-factor-removal.e2e-spec.ts` makes an admin with TOTP, carries out the
    owner's removal through the cron, and checks that the admin's existing session gets
    the guard's 404 on `/admin/accounts` while `/users/me` still answers.
  - **P3-1**: `apps/api/AGENTS.md` names `CareService.practice` as the third caller of
    the password lookup, and `docs/ARCHITECTURE.md` § Invariants gains a phase 6
    paragraph.
  - **P3-2**: `deleteAccountByEmail` finishes a TOTP challenge when given the account's
    `totpURI`, and throws without it instead of leaving the account behind. New harness
    helper `signInWithTotp`.
  - **P3-3**: `enableTotp` types its code inside the retried request.
- **Also**: an admin case for the session gap — a session opened with the password alone
  before TOTP went on is closed (`admin.e2e-spec.ts`).
- **Merged `origin/main`** (CSP report-only, phase 5 shipped). The local database had
  been reset by another agent, so migrations were re-applied first. Rerun on local
  Postgres, all green:
  - professionals, admin, two-factor-removal, two-factor, passkeys and access: 179;
  - care, care-practice, care-review, plan-scheduled-care, accompaniments and audit: 171.
- **Delta invariant review on `75dab360`** (resumed after the machine crashed; one P1,
  P2s and P3s, all applied):
  - **P1, the close was capped and racy.** `closeOtherSessions` listed the sessions with
    `internalAdapter.listSessions`, which Better Auth caps at 100 rows
    (`defaultFindManyLimit`), in no order and expired rows included, then deleted that
    list. An account with more than 100 sessions kept the rest, and a session opened
    between the list and the delete survived. Now it is one `DELETE` through the adapter
    (`userId = …` and `token <> the kept one`), uncapped, with the count back. A unit spec
    with 150 other sessions proves it; on the old code the same spec leaves 50 alive. No
    `session.delete` hooks and no secondary storage exist, so bypassing the internal
    adapter loses nothing. `auth.sessions_revoked {scope:'others'}` is written only when
    the count is above 0.
  - **P2, fail open but honest.** The delete is tried twice, as `forgetPasskeys` is. When
    it still fails, the factor stays on (not a 500). The enabling `/two-factor/verify-totp`
    answer gains `otherSessionsClosed` (`twoFactorAfter` returns `context.json`, as
    `Passkey.ts` does for the authenticate options). The "enabled" mail
    (`TwoFactorEvent.enabled.otherSessionsClosed`) and the web's confirmation
    (`twoFactor.enabled` / `enabledSessionsOpen`) say the sessions closed only when it is
    `true`. Otherwise they send the person to "Cerrar todas las demás" in Seguridad. The
    web treats a missing field as `false`.
  - **P2, the passkey residual.** A session opened with the password alone before the
    factor went on could have added a passkey, and closing
    the session does not remove it; once TOTP is on, its sign-in passes (`0083`). The
    "enabled" mail and both confirmations now ask the person to check their passkeys.
    `apps/api/AGENTS.md` and `docs/ARCHITECTURE.md` name both residuals. "A session
    opened with the password alone never passes the rule" was too broad and is gone.
  - **P3, the lines.** `two_factor_sessions_not_closed` now means only that the delete
    failed twice. A failed audit row after a delete that worked is
    `sessions_revoked_unrecorded {scope:'others'}`, as in `AccountSecurity.ts`.
  - **E2e preconditions.** The stolen cookie answers `/users/me` 200 before `enableTotp`,
    in `professionals` and `admin`. In `admin`, `elsewhere` still answers `/users/me` 200
    after `/disable`: refused by the rule, not signed out.
  - **Legal P3.** `01-acuerdo-profesional.md` reads `PROFESSIONAL_AGREEMENT_VERSION =
    '1.1.0'`, in force. `78118da3` had not changed that line.

## Phase 7 — A brake per account (2026-10-03)

- **Executor**: opus 5.5 @ high (`backend`, one agent; the lead allowed it to edit
  `apps/web`'s `SignInForm` and dictionaries and `apps/api/test` for this phase).
- **Result**: partial — built, migration `0060`, unit and local e2e green; the migration
  and invariant reviews and CI are still to come.
- **What was built**:
  - `sign_in_failure` (`0060_a_sign_in_brake_per_address`): `key` (HMAC-SHA256 of
    `sign-in-brake:` + the lower-cased address, with `BETTER_AUTH_SECRET`), `count`,
    `window_started_at`, `next_allowed_at`. No address, no user FK.
  - The rule is `core/domain/SignInBrake` (`decideAttempt`, `waitAfter`): the tenth attempt
    in fifteen minutes runs and leaves the next waiting 30 s, then 1, 2, 4, 8 min, capped at
    15 min. Until the waits begin, the window is fixed from its first attempt; once they have
    begun, it restarts only after fifteen minutes with no attempt past the end of the last
    wait, so a patient guesser stays at the cap rather than earning nine free tries back.
  - `hooks.before` on `/sign-in/email` answers 429 `{code:'TOO_MANY_ATTEMPTS'}` with
    `Retry-After` and `X-Retry-After` while the address waits, before the password is checked.
    It is the same for an address with an account and one without: nothing about the
    account is looked up.
  - A 2xx sign-in clears the row. So does a password reset (`onPasswordReset`).
  - The daily `/cron/sweep-verifications` now also deletes brake rows a day quiet, and the
    `auth.*` audit rows older than twelve calendar months, and nothing else
    (`AuthRetentionService`; the run's record gains `signInFailures` and `authAuditRows`).
  - `SignInForm` maps any 429 to "Demasiados intentos; prueba dentro de un rato." /
    "Too many attempts; try again in a while." (`auth.signInPaused`).
- **Deviations from plan** (plan amended in the same change):
  - **Counted before, not after.** The plan counted a 401 in `hooks.after`. That leaves the
    time Better Auth spends hashing (tens of ms) between the check and the count, and a burst
    from many IPs would all pass the check together. Every attempt is now counted in
    `hooks.before`, in one transaction under the row's lock
    (`INSERT … ON CONFLICT DO UPDATE … RETURNING`, then `UPDATE`). A correct password
    deletes the row, so what stays counted is the failures. A braked attempt writes nothing,
    so a wait is never stretched by the attempts made during it.
  - **A reset clears the brake.** Whoever reset holds the mailbox, and should not wait out a
    brake somebody else's guesses at the old password left.
  - **It fails open.** If its row cannot be read or written, the sign-in goes on behind
    Better Auth's per-IP limit and the line `sign_in_brake_unavailable` is written (never
    the address). A broken brake must not lock everybody out.
  - `X-Retry-After` beside `Retry-After`: it is the header Better Auth's own limiter sends,
    and the e2e harness's `paced` reads it to tell the product's 429 from the API guard's.
- **Passkeys are not braked** (the lead's question). A passkey sign-in has no password to
  guess. Its verify is already held to 3 in 10 s per IP, and every attempt needs a
  user-verified signature from a registered key (`0083`). Braking it by address would only
  let a stranger shut the owner's one guess-proof door. It also stays open, with Google,
  for the owner of an address somebody else is braking.
- **Known limits** (accepted, stated for the reviewers):
  - The brake throttles; it does not stop. Escalating then going quiet, a guesser gets
    about ten tries per quarter hour per address, under a thousand a day, from any number of IPs.
    Against a 12-character password with no known breach that is harmless. A daily budget
    would be the next step if the § 9 numbers ever show it.
  - **Not "never a hard lock"** (invariant review, P1-a). An attacker who knows the
    address can keep a password-only account braked for as long as the attack runs: the
    attempt at the end of each wait goes to whoever asks first, and `Retry-After` says
    when. A passkey or Google sign-in is the escape. The reset clears the row but can be
    raced: ten more failures brake it again. No single wait exceeds 15 min. PRD 12 is
    amended to say so, and phase 7b (a device cookie that exempts a browser that signed in
    before) is the remedy, planned after phase 8.
  - **Clearing on success leaks existence slowly** (invariant review, P1-b). Only an
    address with an account can have its row cleared, by a correct sign-in or a reset. The
    probe is nine failures, then the victim signs in with a password, then two more
    probes: 401 then 401, where an address with no account answers 401 then 429. It needs
    a password sign-in by the victim inside the prober's window. No health data crosses an
    account boundary. The trade-off is that without clearing, the owner's own sign-ins
    would count against them. **Stands as a known limit** (who decided: the lead, under
    the owner's delegation of 2026-10-03 — the recommended option; the owner can revisit
    it).
  - **Decision** (who decided: the lead, under the owner's delegation of 2026-10-03, "las
    decisiones anótalas con lo más recomendado"): ship the brake, state its limits
    honestly, and plan the real remedy as phase 7b.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api` green:
    core 125 files, database 53 tests, api 1511 tests.
  - New tests:
    - `core`: `SignInBrake.test.ts` (12), `SignInBrakeRepository.test.ts` (5: the exact SQL
      of the locked upsert, the update, the clear and the sweep), `SignInBrakeController`,
      and `AuditRepository`/`AuditController` for the purge (`action like 'auth.%' and
      created_at < cutoff`).
    - `database`: `schema.test.ts` (no address column, no FK).
    - `api`: `SignInBrake.spec.ts` (10, over HTTP on the real `createAuth`),
      `AuthRetention.spec.ts`, `Cron.controller.spec.ts`.
  - End-to-end, local Postgres (`NUTRIA_LOCAL_PG=1`), one run:
    `sign-in-brake|access|passwords|account-security|two-factor|passkeys|admin`, 7 suites,
    **170/170**. `sign-in-brake.e2e-spec.ts` (5, then 6 after the review):
    - (added after the invariant review, P2) thirty simultaneous wrong passwords for one
      new address, each with its own `X-Forwarded-For`: exactly ten 401s, twenty 429s,
      `count = 10` on the row; three runs, all green;
    - ten failures, then 429 with `Retry-After` even to the right password, no session;
    - an unknown address gets the same status, body and headers;
    - four columns, 64-hex keys, no address in any row;
    - after the real wait the right password gets in and the row is gone;
    - the cron deletes a 13-month `auth.password_changed`, keeps an 11-month
      `auth.passkey_added` and 13-month `account.activated` and `setting.changed`, deletes
      a quiet brake row and keeps one still waiting.
- **For `legal` and the lead**: the `auth.*` purge exists from this merge. `/privacidad`
  still names no retention for those rows; it may say twelve months once this runs in
  production (the plan's condition).
- **Decisions**: none new.
- **Advisor**: not consulted.

## Phase 8 — Sign-up reveals nothing (2026-10-03)

- **Executor**: opus 5.5 (`backend`, one agent, resumed after a machine crash from the WIP
  commit; the lead allowed it to edit `apps/web`'s `RegisterScreen`, `SignInForm` and
  dictionaries and `apps/api/test` for this phase).
- **Result**: partial — built, unit and local e2e green; the invariant review, CI,
  `/local-probe` and the owner's iPhone check are still to come. **The
  `requireEmailVerification` part is not to reach production until the lead confirms**,
  after the owner OKs a read-only count of the unconfirmed production accounts.
- **What was built** (the plan's scope):
  - `autoSignIn: false`: sign-up opens no session for anybody, and Better Auth answers an
    address that already has an account with its 200 and a synthetic user
    (`customSyntheticUser` adds the terms' record, so both answers carry the same fields).
  - `onExistingUserSignUp` mails that address "somebody tried to create an account with
    your address" (`ExistingAccountSignUp`, es/en), after the response.
  - `RegisterScreen` drops the 422 branch and ends on "check your email" for every address,
    with the iPhone note (the link opens in Safari; the installed app then signs in).
- **Amendment** (who decided: the lead, under the owner's delegation of 2026-10-03; the
  plan amended in the same change): **sign-up then sign-in was still an oracle.** A
  stranger signs up an address with a password of their own, then signs in with it: 200
  where the address was new (their own unconfirmed account), 401 where it already had one.
  - `requireEmailVerification: true`. Better Auth answers an unconfirmed account's right
    password 403 `EMAIL_NOT_VERIFIED`; `hooks.after` makes it Better Auth's own 401
    `INVALID_EMAIL_OR_PASSWORD` (`services/UnconfirmedSignIn.ts`). Found in Better Auth
    1.7.7's dispatch: over HTTP the response keeps the *status of the error the route
    threw*, whatever an after-hook returns in its place, so the hook answers a finished
    `Response` built as better-call builds a thrown error's (status, its text,
    `Content-Type`, the JSON body); through `auth.api` it throws the error.
  - State identical too: the brake (phase 7) counted the attempt before the route ran, and
    only a 2xx clears it, so an unconfirmed right password is +1 and the row stays.
  - `sendOnSignIn: true`: that person gets a fresh link, after the response. Better Auth
    sends it only when the address is unconfirmed, so a confirmed account never gets one.
  - **Mail budget, new.** Better Auth's only limit on a verification mail is per IP (3 a
    minute on `/send-verification-email`), and `sendOnSignIn` does not even pass through
    that route. With the brake letting about ten attempts per quarter hour through, a
    stranger holding the password of an account they made with somebody's address could
    mail that address hundreds of times a day. So every confirmation link, and the
    "somebody tried" mail, is held to **three per address per hour, per kind**
    (`core/domain/MailBudget`): the existing rule's three, over the life of a link, per
    address instead of per IP. The rows are HMAC-keyed (`mail-budget:<key>`) in Better
    Auth's `verification` table, decided under a transaction-scoped advisory lock, expired
    by `expiresAt` and swept by the daily `/cron/sweep-verifications`: no migration. It
    runs in the background task, so nothing a client sees or times changes; it fails open
    with `mail_budget_unavailable`.
  - The web's 401 copy says, for everybody, what an unconfirmed person must do;
    `socialNotLinked` no longer sends them to a password sign-in that cannot succeed.
  - Google, passkeys and the harness are unaffected: Better Auth reads this flag only in
    `/sign-in/email` (the social link reads the provider's own option); a passkey needs a
    confirmed address to be added; `register()` confirms before it signs in.
- **Unit specs that signed in an unconfirmed account** now confirm it in their memory store
  first (`AccountSecurity`, `TwoFactor`, `PasswordPolicy`, `Passkey`, `SessionRenewal`,
  `AccountDeletion`, `SignInBrake`). E2E suites that test the address lock sign in
  confirmed and put the address back (`harness.ts` `unconfirmAddress`): no route makes an
  unconfirmed session any more, but one from before this change, or one through a
  provider that would not vouch for the address, still exists. `deleteAccountByEmail`
  confirms before its sign-in.
- **The lead's two checks on the budget**: the HMAC label is `mail-budget:<kind>:`, not
  the brake's `sign-in-brake:`, so a budget key and a brake key for one address cannot be
  matched across tables. The rows are not in `rate_limit` but in `verification`, with the
  key and a count only (no address). They expire at the end of their hour, and the daily
  `/cron/sweep-verifications` deletes every row whose `expiresAt` has passed. Better
  Auth's own cleanup is off (`verification.disableCleanup`).
- **Timing** (step 1, measured locally: 25 rounds alternating, on the real app over
  supertest, local Postgres). Medians, min in brackets:
  - sign-up, new address 93.6 ms (85.9), existing address 85.6 ms (78.3). The
    existing-address branch is not slower: its mail already goes after the response. The
    **new** branch is ~8 ms slower here (the row, the credential, `onAccountCreated`, inline).
    On Neon that is a few more round trips, so it is a residual timing signal, not padded in
    this change (see the hand-off).
  - sign-in with the stranger's password, new (unconfirmed, right password) 90.8 ms
    (82.6), existing (wrong password) 91.3 ms (84.3): no difference.
- **Evidence**:
  - `sh .claude/skills/ship/scripts/gate.sh --full`: green. That covers migrations, lint,
    types, coverage, the web build, static pages, format, dead code and leaks.
  - New tests:
    - core: `MailBudget.test.ts`, `MailBudgetRepository.test.ts` (the lock, the read, the
      insert/update SQL), `MailBudgetController.test.ts`.
    - api: `MailBudget.spec.ts`. `SignInBrake.spec.ts` gains 4 cases: an unconfirmed right
      password equals a wrong one to the byte with a fresh link; the new-address and
      existing-address probes give the same answer and brake rows; the tenth such attempt
      brakes; and the `auth.api` path throws the same 401. `SignUp.spec.ts` gains the
      budget case: five sign-ups, three mails.
    - web: `lib/authAnswer.test.ts`.
  - End-to-end on the local Postgres, all 48 suites in band: 697/699. The two failures:
    - `care` (an unconfirmed squatter's session): fixed, then green on rerun.
    - `admin` "never name who made a dish": finds no `source='ai'` dish with `created_by`
      in the library. That is data state from the shared local library, not this change;
      it still fails alone and is reported to the lead.
  - `access.e2e` pins the oracle: the stranger's sign-in with their own password gives the
    same status, body and headers, and the same `sign_in_failure` row
    `{count: 1, next_allowed_at: null}`, for a new and an existing address. A fresh link
    goes to the new one only.
- **Decisions**: the mail budget (the lead, under the owner's delegation, 2026-10-03).
- **Advisor**: not consulted.

## Phase 8 — two additions after the hand-off (2026-10-03)

- **Executor**: opus 5.5 (`backend`, the same agent).
- **Who decided**: the lead, under the owner's delegation of 2026-10-03. Both close
  differences the hand-off listed.
- **A time floor on `/sign-up/email`** (`services/SignUpFloor.ts`):
  - Every sign-up answers no earlier than **500 ms**, the floor Better Auth itself keeps
    on `/send-verification-email`. A refused password is not held: its answer is the same
    for every address.
  - The new-address branch was ~8 ms slower locally (the row, the credential and
    `onAccountCreated`, inline). On Neon that is a few round trips, well under the floor.
  - The clock starts in `hooks.before` once the password checks have passed, not at the
    request. HIBP can take up to two seconds (`HIBP_TIMEOUT_MS`), the same for any
    address; counting it would let a slow HIBP push one branch past the floor and not the
    other. So the floor covers exactly the part that depends on the address.
  - `hooks.after` waits out what is left, whatever the answer.
  - Keyed on the request: HTTP only, since a call through `auth.api` has no request and no
    stranger can make one.
  - On under `NODE_ENV=test` too, as the brake is. The unit suites took ~50 s with it.
  - Pinned by:
    - `SignUpFloor.spec.ts` (fake clock: what is left of the floor, nothing past it, no
      other route, no `auth.api` call, nothing before the clock started);
    - `SignUp.spec.ts`: on the real Better Auth over HTTP, both branches take at least the
      floor.
- **A completed reset confirms the address** (`onPasswordReset`):
  - Better Auth 1.7.7's reset does not: `routes/password.mjs` never touches
    `emailVerified`.
  - Now `UserController.confirmAddressByReset` sets it, on that account and only while it
    was unconfirmed. When it does, it runs what confirming an address runs
    (`onAddressConfirmed`: the account opens itself, or the owner is told).
  - A failure leaves the address as it was, writes one line
    (`address_not_confirmed_on_reset`, the account id only), and the reset still answers
    200.
  - This closes the squatter case: a stranger signs up somebody's address with their own
    password, never confirms; the owner resets and signs in with the new password.
  - Pinned by:
    - `AccountSecurity.spec.ts` (3 cases: confirmed, then signs in; an already confirmed
      address runs nothing; a failure still resets);
    - `UserRepository.test.ts` (the `WHERE` holds `email_verified = false`);
    - `access.e2e-spec.ts`: the squatter signs up, the owner resets, the new password gets
      200 and the squatter's gets 401.
- **Test-only rate rule**: `/request-password-reset` joins the paths raised under
  `NODE_ENV=test`. Its three-a-minute per-IP rule was shared, in one run, by the reset
  suites and the squatter's reset in `access`. No suite asserts that 429.

## Phase 8 — the invariant, accessibility and legal reviews applied (2026-10-03)

- **Executor**: opus 5.5 (`backend`, the same agent). Routing by the lead; the
  invariant review's P0 (`autoSignInAfterVerification`, already on main) goes to main
  as a separate hotfix by `backend-011p6`, not here.
- **Invariant review**:
  - **P1, `/send-verification-email` timing**: Better Auth awaits our
    `sendVerificationEmail` on the anonymous resend and only pads it to 500 ms. So the
    budget's lookup and SMTP made an unconfirmed address slower than an unknown or a
    confirmed one. The callback now hands budget and SMTP to `BackgroundTaskService` and
    returns at once. Pinned by `VerificationResend.spec.ts`: with SMTP that never answers,
    an unconfirmed address answers at the floor, like an unknown one.
  - **P1, sign-up floor**: `SIGN_UP_FLOOR_MS` is now **800 ms**. The slow branch's tail on
    Neon could not be measured here, so the floor is set with margin over the ~95 ms
    measured locally. Raise it if production timing ever shows a sign-up near it.
  - **P2**: a third budget kind, `reset`, for the reset mail. Better Auth already sends it
    after the response, so the answer is unchanged.
  - **P3**: `emailVerification.expiresIn` is written out as `MAIL_BUDGET.windowMs / 1000`
    (3600). A spec ties the two.
  - **P3**: a spec shows that no address reaches any log line, Nest's or the console's, on
    an existing-address sign-up.
- **Accessibility review** (static read):
  - "Check your email" focuses its heading and titles the tab (`lib/authAnswer`
    `arriveAtSent`, tested with fakes). The old title comes back on the way out.
  - "Usar otro correo" returns to the form with the name and address as typed, and focuses
    the address field.
  - The sign-in alert remounts per submit (`key={attempt}`).
  - A 401 sits on the password field (`aria-invalid`, described by it), and the alert is
    kept for a wait or an outage (`signInRefusal` answers `where`, tested).
  - Secondary text measured: 4.9:1 light and 6.9:1 dark against the page.
  - Not tested: the focus and the key in a DOM. `apps/web`'s vitest runs in node with no
    testing library; the probe is the check.
- **Legal review**:
  - The ⟦frenos⟧ item and the widened legitimate-interest paragraph go into `/privacidad`
    (es/en), exactly as `legal` wrote them. `privacy.updated` already reads 3 October
    2026. There is no privacy version constant to bump.
  - `auth.signUpSent` and `auth.invalidCredentials` no longer claim a mail was sent: the
    first is conditional ("si {email} es correcta, te llegará…"), the second names the
    three-an-hour limit. Reconciled with the accessibility wording ("si aún no has
    confirmado tu dirección…"); neither says an account exists.
  - The "somebody tried" mail gains, before the reset link, the line for somebody who never
    made the account. This is variant A, since a completed reset confirms the address.
  - P2-15, a sweep of unconfirmed accounts, is in the PLAN as a pending follow-up.


## Phase 8 — the invariant review's last three P3s (2026-10-08)

- **Executor**: opus 5.5 (`backend`, resumed from a WIP commit after a machine crash).
- **A reset confirms the address after the sessions are revoked**
  (`services/ResetConfirmsAddress.ts`). Better Auth 1.7.7 calls `onPasswordReset` before
  `revokeSessionsOnPasswordReset` deletes the account's sessions, so confirming there left,
  for a moment, a confirmed address with a session from before the proof. `onPasswordReset`
  now only remembers the account against its request; `hooks.after`, on a 2xx
  `/reset-password`, confirms it. What confirming runs (the account opens itself, or the
  owner is told) goes to `BackgroundTaskService`: the reset never waits for that mail. A
  call through `auth.api` has no request and is confirmed at once. Pinned by
  `AccountSecurity.spec.ts`: no session is left when the address is confirmed.
- **`resetPasswordTokenExpiresIn`** is written out as `MAIL_BUDGET.windowMs / 1000`, as
  `emailVerification.expiresIn` already was; a spec in `SignUp.spec.ts` ties the two.
- **The reset budget**: four `/request-password-reset` for one address answer 200 four
  times and send three mails (`SignUp.spec.ts`).
