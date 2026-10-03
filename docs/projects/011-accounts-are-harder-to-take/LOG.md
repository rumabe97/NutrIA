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

## Hotfix — the confirmation link signed in whoever opened it (2026-10-03)

- **Found by**: the phase 8 invariant review, as a P0 already on `main`. Fixed by
  `backend` (`backend-011p6`) on `fix/verify-no-auto-sign-in`, outside phase 8's own
  scope; the lead assigned the web and e2e halves to it too.
- **The attack**: `emailVerification.autoSignInAfterVerification` was `true`.
  1. A stranger signs the victim's address up with a password of their own; Better Auth
     mails the victim the confirmation link.
  2. The victim opens it and is signed into the stranger's account. Onboarding asks for
     health data, and the victim enters it.
  3. The stranger, who holds the password (and still the session sign-up gave), reads
     it.
- **The fix**:
  - `autoSignInAfterVerification: false`. The link proves the mailbox and nothing more.
  - Every confirmation link lands on the web's `/verificar-email` (`VERIFIED_PAGE` in
    `VerificationMail.ts`, set before `absoluteCallback`), whatever `callbackURL` the
    client sent. Links already in mailboxes carry `callbackURL=/` and land on the home
    page, signed out: harmless, and they still confirm.
  - `/verificar-email` was orphaned (sign-up has gone to `/onboarding` for a while). It is
    now "Correo confirmado" / "Ahora inicia sesión con tu correo y tu contraseña", with a
    link to sign in and, for somebody who did not make the account or does not know its
    password, a link to reset it. Focus goes to the heading on arrival. A refused link
    (Better Auth's `?error=…`) says "Este enlace ya no sirve". The page stays static:
    the confirmed copy is the `Suspense` fallback, and only `?error` changes it.
  - The pending screen no longer says "Ábrelo y entras".
  - The way back in for the victim: they reset the password. `revokeSessionsOnPasswordReset`
    was already `true`, so the reset ends every session the stranger had, and the
    stranger's password stops working.
- **Not affected**: change-email is not enabled (its branch of `/verify-email` mints a
  session regardless). There is no native app and no deep link; the PWA opens the link
  in the browser, which now asks to sign in.
- **What phase 8 must keep**: PLAN phase 8 said "`autoSignInAfterVerification` stays on";
  amended. With phase 8's `autoSignIn: false` on sign-up too, a new account signs in
  after confirming.
- **Pinned**: `EmailVerification.spec.ts` (the two options, and the attack end to end
  on the real `createAuth`: the link gives the victim no session, the stranger's
  session survives the confirmation and dies at the reset, the stranger's password is
  401 and the victim's new one 200). It fails on `true`. `VerificationMail.spec.ts`: a
  link lands on `/verificar-email` whatever the client asked.

