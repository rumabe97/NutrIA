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
