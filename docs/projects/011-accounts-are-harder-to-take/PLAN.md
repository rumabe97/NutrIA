# Plan — Project 011: Accounts are harder to take

> **Purpose**: the phased technical execution plan — the engineering half of the
> contract. `/execute-project` follows this literally; executors implement phases, they
> do not redesign them. If implementation must diverge, the plan is amended in the same
> change and the deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes.
> **Written by**: an agent via `/plan-project`.

- **Status**: approved — by the owner, 2026-10-01
- **Type**: standard
- **PRD**: [./PRD.md](./PRD.md). Every acceptance criterion is mapped at the end of this file.
- **Routing profile**: `tiered`, with **every code phase at `quality-max` (opus @ high)**.
  Authentication is one of the floors that never move (`AGENTS.md` § Model routing;
  `docs/reference/agent-team.md`). Each phase that touches the API, the web and the suites
  runs as a `/team`. The lead prices the web-only and suite-only tasks inside it by its
  rubric, but never below opus @ high for anything on the sign-in, sign-up, reset or
  second-factor paths. `invariant-reviewer` and `migration-reviewer` run at opus @ high.

## Design summary

The architect's report
[`0007`](../../reference/architecture/0007-seguridad-de-cuentas-2026-10-01.md) is the
design. Read its §§ 3–6 before any phase; every file and line it cites was read on
`09ed8323`. Decision
[`0074`](../../decisions/0074-accounts-are-guarded-by-a-server-password-rule-and-an-optional-second-factor.md)
records what was decided.

- **Better Auth does the cryptography; we write the rules around it.** Better Auth 1.7.6
  is installed. Its `twoFactor` plugin (TOTP, backup codes, per-challenge attempts,
  per-account lock, trusted device), its session routes (`/list-sessions`, `/revoke-*`),
  `/change-password` and its `isPasswordCompromised` export are used as they are.
- **What we write:**
  - the password rule, as a `core` constant and Zod schema;
  - the breached-password hook (timeout, fail-open) and the context-word check;
  - the forced `revokeOtherSessions`;
  - the per-account brake;
  - the owner's delayed removal;
  - the security emails and audit actions;
  - the screens.
- **Order follows dependencies.**
  - Phase 0 first: every limit, the second factor's included, rests on Better Auth seeing
    each client's IP.
  - The "Seguridad" section (phase 2) comes before the second factor (phase 3), because
    the factor needs a place to live and a way to change the password.
  - Passkeys (5) follow TOTP: they reuse its screen and its emails.
  - The mandatory rule (6) follows both.
  - The brake (7), sign-up (8) and CSP (9–10) are independent. They come last because
    they matter less, and because CSP needs a week of reports.
- **Every migration is additive**: a column with a default, a nullable column, an empty
  table. Each new table cascades on `user.id`. Migrations run against production during
  the API's build, so each one goes through `migration-reviewer`.
- **No new environment variable, no spend.** The TOTP secret is encrypted with
  `BETTER_AUTH_SECRET`; HIBP is free and keyless; the emails go out through the existing
  Gmail SMTP.

## Phases

### Phase 0 — Does the limit see each person?

- [x] done — commit `4b1b8933` ("A new password must be 12 to 128 characters and no known breach, and a reset no longer tells by its timing whether an address exists (#183)")
- **Dispatch**: opus @ high — `/execute-project 011 phase 0`. `quality-max`: the
  authentication limiter. Review: `invariant-reviewer`. — owner-gated: the owner runs the
  read-only count query of report `0007` § 9 on Neon's `production` branch and pastes
  the three numbers. Agents never query production.
- **Goal**: Better Auth's rate limiter counts per client IP in production, measured, not
  assumed.
- **Scope**: `apps/api/src/modules/auth/auth.config.ts` (`advanced.ipAddress`),
  `apps/api/src/core/CreateApp.ts` (`trust proxy`, only if the measurement says so),
  their specs, `docs/reference/deployment.md`, `apps/api/AGENTS.md`.
- **Steps**:
  1. Hand the owner the query of report § 9 and stop until the three numbers come back.
     Also ask him to search the API's Vercel logs for "Rate limiting could not determine
     a client IP". Agents may read logs through the Vercel MCP only if he says yes to that
     specific read.
  2. **Result A** (many distinct IPs, few empty): nothing changes. Record the numbers in
     the LOG; the phase is done.
  3. **Result B1/B2** (empty, or one or two IPs for many people):
     1. Read Vercel's documentation (`search_vercel_documentation`) for what
        `x-forwarded-for` and `x-vercel-forwarded-for` carry on a request the web
        rewrites to the API.
     2. Set `advanced.ipAddress.ipAddressHeaders` (and `trustedProxies` if Better Auth
        1.7.6 needs it) to the header that carries the **client's** IP and cannot be set by
        the client.
     3. Check `trust proxy` in `CreateApp.ts` against the same fact, for `RateLimitGuard`.
  4. A unit spec that pins the chosen header, and one that a client-sent `x-forwarded-for`
     does not change the key.
  5. After deploy, the owner re-runs the query, counting only sessions created after the
     deploy.
- **Acceptance criteria**: PRD 1.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=api`.
  - owner-gated: the query again after deploy, with a result of A.
  - **Stop signal:** Vercel does not deliver the client IP through the rewrite at all.
    Stop, and ask the `architect` for a separate report on a signed header the web adds.
    Phases 1–2 may proceed meanwhile; phases 3+ wait.

### Phase 1 — Strong passwords on every door

- [x] done — commit `4b1b8933` ("A new password must be 12 to 128 characters and no known breach, and a reset no longer tells by its timing whether an address exists (#183)")
- **Dispatch**: opus @ high — `/execute-project 011 phase 1`, as a `/team` (`backend`,
  `frontend`, `tests`). `quality-max`: sign-up and reset. Reviews: `invariant-reviewer`,
  `accessibility` with `/local-probe`, `legal` (one line).
- **Goal**: a weak or breached password cannot be set, the reset no longer tells by its
  timing that an address exists, and the web pages send the simple security headers.
- **Scope**:
  - `packages/core/src/entities/**`: a new `Password` module holding
    `PASSWORD_MIN_LENGTH = 12`, `PASSWORD_MAX_LENGTH = 128`, the new-password Zod schema
    and the context-word check, all pure and unit-tested.
  - `apps/api/src/modules/auth/**`:
    - `minPasswordLength`/`maxPasswordLength` from `core`;
    - `hooks.before` on `/sign-up/email`, `/reset-password`, `/change-password` that runs
      the context-word check, then `isPasswordCompromised` from
      `better-auth/plugins/haveibeenpwned` (the export, **not** the plugin) behind a ~2 s
      timeout. On a hit the hook answers 400 with a closed code (`PASSWORD_COMPROMISED`,
      `PASSWORD_HAS_CONTEXT`); on a timeout or error it lets the request through and logs
      `hibp_unavailable` with no password and no hash;
    - off under `NODE_ENV=test` (the context-word check stays on);
    - `advanced.backgroundTasks.handler` wired to `BackgroundTaskService`, injected into
      `createAuth` from `auth.module.ts` as `mailer` and `billing` are.
  - `apps/web`:
    - `RegisterScreen.tsx` and `ResetPasswordForm.tsx` read the constant from `core` (no
      more `8`);
    - a simple strength meter component (length bar plus the hint "mejor una frase de
      varias palabras");
    - `passwordrules="minlength: 12; maxlength: 128;"` on the fields;
    - the new error codes mapped to copy in `es-ES.ts` and `en-GB.ts`;
    - `headers()` in `apps/web/next.config.js` with `X-Frame-Options: DENY`,
      `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
      and a `Permissions-Policy` that denies camera, microphone and geolocation (nothing
      in `apps/web/src` uses them on 2026-10-01; re-grep before shipping).
  - `apps/api/test/**`: a new `passwords.e2e-spec.ts`.
  - `apps/api/src/shared/logging/pino.ts` and its spec (amended 2026-10-01, after the
    invariant review): the request log scrubs reset and verification tokens from `url`,
    `referer` and `location`, because a refused reset now leaves a token spendable after
    its Referer was logged.
  - `verification.disableCleanup` in `auth.config.ts`, a daily cron
    `/api/v1/cron/sweep-verifications` (route, service, spec, `apps/api/vercel.json`) and
    `docs/reference/deployment.md` § 3b (amended 2026-10-01, owner: "corrige lo del tiempo
    ese"; decision [`0075`](../../decisions/0075-expired-verification-rows-are-swept-daily-not-on-every-read.md)).
    Better Auth's cleanup on read added one round trip to the missing-address reset.
  - `apps/api/AGENTS.md`, `apps/web/AGENTS.md`, `docs/legal/**` (`legal`).
- **Steps**:
  1. `core` first, with its tests:
     - 11 characters refused, 12 accepted, 129 refused;
     - the local part of the email (case-insensitive, at least 3 characters), the name
       (each word of at least 3 characters) and "nutria" refused as substrings;
     - no composition rule anywhere.
  2. The API hook and its spec:
     - HIBP is mocked: a hit, a miss, a timeout, a network error;
     - a timeout or network error lets the request through;
     - the request to HIBP carries only the 5-character prefix (`isPasswordCompromised`
       already does this; the spec pins that our wrapper does not log the password or
       the hash).
  3. `backgroundTasks`: the reset mail is sent through `BackgroundTaskService`. The proof
     is a unit spec: a mocked `mailer.send` that resolves after ~500 ms, and the reset
     handler must answer before that send resolves. As secondary evidence, and only with
     the local mailer **configured** (otherwise neither branch waits and the measure
     proves nothing), time the reset locally, 20 runs each, for an existing and a missing
     address. Record both medians in the LOG; they must be within 100 ms.
  4. The web: forms, meter, copy, headers. Apply the `apple-web-design` skill. Errors are
     announced (`aria-live`), and the meter is not the only signal (it carries text).
  5. E2E: sign-up refused with `Password123!`-shaped context words and with 11
     characters; reset refused likewise. The breached case is unit-only, because the
     suites never call HIBP. The suites' shared password (29 characters, 0 HIBP hits)
     keeps working.
  6. `legal`: does `/privacidad` need to name the breached-password check? If yes, the
     sentence ships with this phase in both dictionaries and
     `docs/legal/textos/02-politica-privacidad.md`.
- **Acceptance criteria**: PRD 2, 3, 5, 14 (simple headers).
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web`.
  - `passwords.e2e-spec.ts` and `access.e2e-spec.ts`, then CI.
  - `/local-probe` on `/registro` and `/restablecer` at 320, 390 and 1280 px, in light and
    dark.
  - After deploy: `curl -sI` on the production web origin shows the four headers;
    `x-vercel-cache: HIT` is still on `/`.
  - **Stop signal:** HIBP from `fra1` habitually takes over 2 s (the hook's
    `hibp_unavailable` count in the logs during the first day). Then the check moves to
    the background with a warning afterwards, and the plan is amended.

### Phase 2 — "Seguridad" in /perfil

- [ ] in progress
- **Dispatch**: opus @ high — `/execute-project 011 phase 2`, as a `/team` (`backend`,
  `frontend`, `tests`). `quality-max`. Reviews: `invariant-reviewer`, `migration-reviewer`,
  `accessibility` with `/local-probe`, `legal` (retention).
- **Goal**: a person changes their password, sees their sessions and closes them, is told
  by email when the password changes, and must change a password found breached.
- **Scope**:
  - `packages/database/src/schemas/auth.schema.ts` and one migration:
    `user.password_compromised_at timestamp null`.
  - `packages/core`: the audit actions `auth.password_changed` and
    `auth.sessions_revoked` in `AUDIT_ACTIONS`; the user field.
  - `apps/api/src/modules/auth/**`:
    - `hooks.before` on `/change-password` forces `revokeOtherSessions: true` whatever the
      body says;
    - `hooks.after` on `/change-password` and `onPasswordReset` send the "password
      changed" email and write the audit row;
    - `hooks.after` on `/sign-in/email` with a 200 runs the HIBP check through
      `BackgroundTaskService` and sets `password_compromised_at` on a hit;
    - after a successful change or reset, `password_compromised_at` is cleared.
  - `apps/api/src/shared/guards/**`: when `password_compromised_at` is set, `SessionGuard`
    (or a guard beside it, like `RequiresOnboarding`) answers 409 `PASSWORD_CHANGE_REQUIRED`
    on every route but `/users/me` (amended 2026-10-01: GET and DELETE `/users/me`, plus
    GET `/auth/me`, our echo of the session user). Better Auth's own routes (`/auth/*`, including
    `/auth/change-password`, `/auth/sign-out` and, from phase 3, `/auth/two-factor/*`) are
    `@Public()` in `Auth.controller.ts` and never pass the global guards, so they stay
    reachable without an allowlist; a spec pins that. This 409 is the documented
    exception, like `ONBOARDING_INCOMPLETE`: it is the person's own account and they
    must be told what to do.
  - `apps/api/src/modules/email/templates/**`: "tu contraseña ha cambiado", es/en, with no
    word of health (M14).
  - `apps/web`:
    - a "Seguridad" section in `/perfil` with a change-password form (current + new + the
      phase 1 meter), plus a list of sessions (device from the user agent, created,
      last used, "this device") with "Cerrar" and "Cerrar todas las demás";
    - a screen the 409 sends to;
    - `proxy.ts` if the redirect lives there;
    - dictionaries.
  - `apps/api/test/**`: `account-security.e2e-spec.ts`.
- **Steps**:
  1. Migration and schema; `migration-reviewer`.
  2. The API hooks, each with a unit spec. The forced revoke is tested with a body that
     says `revokeOtherSessions: false`.
  3. The guard and its spec; the 409 is added to the documented exceptions in
     `apps/api/AGENTS.md`.
  4. The email and its audit row. `legal` sets the retention of these rows; the value goes
     to `docs/legal/` and, if it differs from `audit_logs`' current one, to a later phase.
  5. The web section and the forced-change screen. Closing another device's session leaves
     its offline copy until it next talks to the API (`0053`); the copy says nothing that
     contradicts this.
  6. E2E:
     - change with the wrong current password → refused;
     - change with the right one → a second session's cookie gets 404 afterwards;
     - list shows both sessions;
     - revoke one → it is gone;
     - a seeded `password_compromised_at` → 409 everywhere but the allowed routes, cleared
       by a change.
- **Acceptance criteria**: PRD 4, 6, 15 (password email, audit).
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api --filter=web`.
  - `account-security.e2e-spec.ts` and the suites the guard touches, then CI.
  - `/local-probe` on `/perfil` (signed in) and the forced-change screen, 320/390/1280,
    light and dark.
  - `invariant-reviewer` no P0/P1.
  - human-verify: on his iPhone, the owner changes his password and the session on his
    computer ends; the email arrives.
  - **Stop signal:** the forced-change screen collides with the onboarding or `/pendiente`
    flow. Redesign before going on.

### Phase 3 — Optional second factor: an authenticator app

- [ ] in progress
- **Dispatch**: opus @ high — `/execute-project 011 phase 3`, as a `/team` (`backend`,
  `frontend`, `tests`). `quality-max`. Reviews: `invariant-reviewer`, `migration-reviewer`,
  `accessibility` with `/local-probe`. — human-verify: the owner turns it on in his
  iPhone (Keychain via the `otpauth://` link, or an app), signs in from the installed app
  with a code and with a backup code, and turns it off.
- **Goal**: an account with a password can turn on TOTP with backup codes, and the
  sign-in asks for it.
- **Scope**:
  - `packages/database`: one migration for `user.two_factor_enabled boolean not null
    default false` and the `two_factor` table, copied from the plugin's `schema.mjs`
    (`secret`, `backup_codes`, `user_id` **ON DELETE CASCADE**, `verified`,
    `failed_verification_count`, `locked_until`).
  - `packages/core`: audit actions `auth.2fa_enabled`, `auth.2fa_disabled`,
    `auth.backup_code_used`.
  - `apps/api/src/modules/auth/**`:
    - `twoFactor({ issuer: 'NutrIA', backupCodeOptions: { amount: 10 }, trustDeviceMaxAge:
      30 days })`, with `two_factor` in the adapter's schema;
    - `TEST_AUTH_RULE` also on `/two-factor/*`;
    - enabling refused for an account with no credential (password) account, by a
      `hooks.before` on `/two-factor/enable` → 404;
    - emails on enabled, disabled and backup code used, with their audit rows;
    - **the double `session_started`**: the `session.create.after` hook must not count
      the provisional session the plugin creates and deletes before the challenge
      (`two-factor/index.mjs:287-288`). Count it only when the session survives, or on
      the verify route. A spec pins one count per sign-in, with 2FA and without.
  - `apps/web`:
    - `twoFactorClient` in `lib/auth-client.ts`;
    - `SignInForm.tsx` follows `twoFactorRedirect` to a new challenge screen (code, "use a
      backup code", "trust this device") instead of pushing to `/inicio`;
    - in "Seguridad": turn on (password, QR plus a tappable `otpauth://` link,
      confirmation code, the 10 codes shown once with copy and download), turn off
      (password), regenerate codes (password);
    - a Google-only account sees the text pointing to Google's two-step verification
      instead of the switch;
    - dictionaries.
  - `apps/api/test/**`: `two-factor.e2e-spec.ts`.
  - Amended 2026-10-01, after the invariant review:
    - a new implicit provider link into an account with the factor on is refused unless
      that account's own session asks (`databaseHooks.account.create.before`);
    - `/two-factor/get-totp-uri` answers the guard's 404;
    - trusted devices are forgotten on disable, password change, reset,
      `/revoke-other-sessions` and `/revoke-sessions`;
    - regenerating backup codes is audited (`auth.backup_codes_regenerated`) and mailed;
    - the QR is drawn by `uqr` (0.1.3, MIT, no dependency), added by the lead.
- **Steps**:
  1. Migration; `migration-reviewer`.
  2. Plugin and hooks; unit specs for the password-only rule and the analytics count.
  3. Web: challenge screen first (the sign-in must never land on `/inicio` without a
     session), then the "Seguridad" controls. The `apple-web-design` skill applies;
     inputs use `autocomplete="one-time-code"` and `inputmode="numeric"`.
  4. E2E, generating TOTP codes in the test from the secret:
     - enable → sign-in returns `twoFactorRedirect` and no usable session;
     - a wrong code is refused;
     - a right code gives a session;
     - a backup code works once and not twice;
     - disabling needs the password;
     - a reset does not skip the challenge;
     - a Google-only account gets 404 on enable (the social-sign-in suite's harness);
     - deleting the user removes its `two_factor` row.
- **Acceptance criteria**: PRD 7, 8, 15 (2FA emails, audit).
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api --filter=web`.
  - `two-factor.e2e-spec.ts`, `social-sign-in.e2e-spec.ts`, `access.e2e-spec.ts`, then CI.
  - `/local-probe` on the challenge screen and "Seguridad", 320/390/1280, light and dark.
  - human-verify as in the dispatch, recorded in the LOG with the iOS version.
  - **Stop signal:** the challenge does not work inside the installed app on the owner's
    iPhone.

### Phase 4 — The owner removes a lost second factor, after 48 hours

- [ ] in progress
- **Dispatch**: opus @ high — `/execute-project 011 phase 4`, as a `/team` (`backend`,
  `frontend`, `tests`). `quality-max`: it removes a person's protection. Reviews:
  `invariant-reviewer`, `migration-reviewer`, `legal` (the procedure). — owner-approves:
  `legal`'s written procedure before the console action ships.
- **Goal**: someone who lost the phone and the codes has a way back that a forged request
  cannot take in less than 48 hours.
- **Scope**:
  - `packages/database`: a `two_factor_removal` table (`user_id` unique **ON DELETE
    CASCADE**, `requested_by`, `requested_at`, `due_at`, `cancelled_at`), one migration.
  - `packages/core`: entity, repository and controller; audit actions
    `auth.2fa_removal_requested`, `auth.2fa_removal_cancelled`, `auth.2fa_removed_by_owner`.
  - `apps/api`:
    - `POST /admin/users/:id/two-factor/removal` (request) and `DELETE …/removal`
      (cancel), behind `AdminGuard`, each writing its audit row in the same transaction
      (`apps/api/AGENTS.md` § Admin);
    - the request emails the account's address at once;
    - a successful 2FA verification by that account (`hooks.after` on `/two-factor/verify-*`)
      cancels a pending removal and audits it;
    - the execution runs in the existing daily cron route (`Cron.controller.ts`, behind
      `CronSecretGuard`) or a sibling route in the same `vercel.json` schedule. It removes
      every due, uncancelled request's `two_factor` row, sets `two_factor_enabled = false`
      and emails the address. On the daily schedule, "48 h" means "the first run at least
      48 h later" — between 48 and 72 h, as the copy says.
  - `apps/web/src/app/(admin)/**`: on a user's console row, "Quitar el segundo factor"
    with a confirmation that states the 48 h, the pending state and "Cancelar"; the audit
    log's labels for the new actions.
  - `docs/legal/**`: the procedure (`legal`). The request must come from the account's own
    address; the owner checks the headers for a lookalike; what he answers.
  - `apps/api/test/**`: `two-factor-removal.e2e-spec.ts`.
  - Amended 2026-10-01, owner: "bloquea códigos repetidos". A TOTP code is accepted
    once. `two_factor.last_totp_step` (nullable bigint, in this phase's migration) is
    claimed atomically before `/two-factor/verify-totp` runs. A code whose step is not
    newer than the last one used is refused like a wrong code. Phase 3 left the plugin
    accepting a replay within its ±1 window (RFC 6238 § 5.2, NIST 800-63B). Specs and E2E
    pin the refusal.
  - Amended 2026-10-03: the routes are `POST` and `DELETE
    /admin/accounts/:id/two-factor/removal`, not `/admin/users/:id/…`, so they sit beside
    the console's other account routes (`/admin/accounts`). The account rows gain
    `twoFactorEnabled` and `twoFactorRemovalDueAt`, and the system page's crons gain
    `twoFactorRemovals`; `admin.e2e-spec.ts` pins both.
- **Steps**:
  1. `legal` drafts the procedure; the owner approves it.
  2. Migration, `core`, routes, cron step, emails, each with its spec.
  3. Console UI.
  4. E2E:
     - request → email sent, nothing removed;
     - the cron run before `due_at` removes nothing;
     - after `due_at` it removes and emails;
     - a 2FA verification in between cancels;
     - an owner cancel works;
     - a non-admin gets 404;
     - every step has its audit row.
- **Acceptance criteria**: PRD 10, 15.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api --filter=web`.
  - `two-factor-removal.e2e-spec.ts`, `admin.e2e-spec.ts`, `audit.e2e-spec.ts`, then CI.
  - `/local-probe` on the console row and dialog.
  - `invariant-reviewer` no P0/P1.

### Phase 5 — Passkeys

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 011 phase 5`, as a `/team` (`backend`,
  `frontend`, `tests`). `quality-max`. Reviews: `invariant-reviewer`, `migration-reviewer`,
  `accessibility` with `/local-probe`. — human-verify: the owner adds a passkey on his
  iPhone and signs in with Face ID from the installed app.
- **Goal**: a signed-in person adds a passkey and signs in with Face ID.
- **Scope**:
  - `apps/api/package.json` (and the workspace lockfile): `better-auth` to the version
    `@better-auth/passkey` requires (≥ 1.7.7 on 2026-10-01; check `npm view` at the time),
    plus `@better-auth/passkey`. `apps/web`'s client package to the same version.
  - `packages/database`: the plugin's `passkey` table, `user_id` **ON DELETE CASCADE**,
    one migration.
  - `apps/api/src/modules/auth/**`:
    - `passkey({ rpID: <web origin host>, rpName: 'NutrIA', origin: <web origin> })`,
      derived from `APP_URL` with no new variable, so a local run and production each get
      their own;
    - email and audit `auth.passkey_added`.
  - `apps/web`:
    - `passkeyClient`;
    - in "Seguridad": add, list (name, created) and remove;
    - on `/acceder`: "Entrar con llave de acceso", with `autocomplete="username webauthn"`
      on the email field for conditional UI;
    - dictionaries.
  - `apps/api/test/**`: what WebAuthn allows without a real authenticator — registration
    options require a session, the list and delete routes are owned by session (another
    account's passkey → 404), and the cascade on user deletion.
- **Steps**:
  1. Upgrade alone first. The whole gate and the auth suites must be green on the new
     version before the plugin goes in. Read Better Auth's changelog between the two
     versions for anything touching sessions, cookies or hooks, and note it in the LOG.
  2. Migration; `migration-reviewer`.
  3. Plugin, email, audit, specs.
  4. Web, with the copy saying the passkey belongs to this web address.
  5. E2E as scoped.
- **Acceptance criteria**: PRD 9, 15 (passkey email, audit).
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=database --filter=api --filter=web`.
  - All auth-related suites, then CI.
  - `/local-probe` on "Seguridad" and `/acceder`.
  - human-verify as in the dispatch, with the iOS version in the LOG.
  - **Stop signal:** the upgrade changes session or hook behaviour the suites catch.
    Stop and report before adding the plugin.

### Phase 6 — Mandatory for professionals and the admin

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 011 phase 6`. `quality-max`: it changes who
  may read health data. Reviews: `invariant-reviewer`, `legal` (EIPD R8). — owner-gated:
  the admin half ships only after the owner has turned on his own TOTP and kept his codes,
  and says so.
- **Goal**: a privileged account with a password cannot act without a second factor.
- **Scope**:
  - `apps/api/src/shared/guards/Session.guard.ts` (carry `twoFactorEnabled`, which rides
    the session's user row, on `request.user` — no extra query), `Professional.guard.ts`,
    `Admin.guard.ts`, and their specs. Whether the account has a credential (password)
    account is looked up **only** in those two guards, which run on few routes, never in
    `SessionGuard`, which runs on every request.
  - The professional workspace page (`@BeforePractice()` area) and the admin entry: copy
    that says what to do. Dictionaries.
  - `apps/api/test/**`: `professionals.e2e-spec.ts`, `care*.e2e-spec.ts`,
    `admin.e2e-spec.ts` updated; the harness gains a helper that turns TOTP on for an
    account.
- **Steps**:
  1. The rule, written once (in `core` if both guards share it): an account with a
     credential account must have `twoFactorEnabled`; an account with only provider
     accounts passes. A missing second factor is a 404, like every denial.
  2. Professionals first; their suites enable TOTP through the helper. A professional
     without it gets 404 on client routes and sees the instruction on their page.
  3. **The admin half, gated.** Before merging it, confirm with the owner that his own
     TOTP is on. This holds if his admin account has a password at all, even alongside
     Google: the rule looks at whether a credential account exists, not at how he signs
     in. The suites' admin enables TOTP through the helper.
- **Acceptance criteria**: PRD 11.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web`.
  - The professional, care and admin suites, then CI.
  - After deploy, the owner still reaches `/admin`.
  - **Stop signal:** a professional is already active in production with a password and
    no second factor. Stop; the owner tells them first.

### Phase 7 — A brake per account

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 011 phase 7`, as a `/team` (`backend`,
  `tests`). `quality-max`. Reviews: `invariant-reviewer`, `migration-reviewer`.
- **Goal**: many failed sign-ins for one address slow down, from however many IPs, without
  ever locking the owner of the address out.
- **Scope**:
  - `packages/database`: a `sign_in_failure` table keyed by an HMAC of the lower-cased
    email with `BETTER_AUTH_SECRET` (no email stored), with `count`, `window_started_at`
    and `next_allowed_at`. No user FK: an unknown address must be braked identically, or
    the brake becomes an oracle. Rows older than a day are deleted by the daily cron.
    One migration.
  - `apps/api/src/modules/auth/**`:
    - `hooks.before` on `/sign-in/email`: before `next_allowed_at`, answer 429 with
      `Retry-After`, the same for a known and an unknown address;
    - ~~`hooks.after` on a 401: count~~ — amended in execution (LOG, phase 7): every
      attempt is counted in `hooks.before`, under the row's lock, and a 2xx clears it,
      so what stays counted is the failures without a burst from many IPs racing the
      count; from the 10th in 15 minutes set `next_allowed_at` growing (30 s, 1 min,
      2 min… capped at 15 min);
    - on a 200 (and on a password reset): clear the row;
    - `NODE_ENV=test` keeps it on; suites use distinct addresses.
  - The `auth.*` audit purge (added 2026-10-01 from phase 2, `legal`'s retention in
    `docs/legal/analisis.md` § 4.1 bis): the same daily cron also deletes `audit_logs`
    rows whose `action` starts with `auth.` and are older than 12 months. It touches no
    other action, and a spec proves it. Until it runs in production, `/privacidad` must not
    name the 12 months.
  - `apps/web`: `SignInForm` maps the 429 to "Demasiados intentos; prueba dentro de un
    rato" (es/en).
  - `apps/api/test/**`: `sign-in-brake.e2e-spec.ts`.
- **Acceptance criteria**: PRD 12.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=database --filter=api --filter=web`.
  - `sign-in-brake.e2e-spec.ts` (10 failures → 429; after the wait the right password
    gets in; an unknown address behaves the same; no row holds an email), then CI.

### Phase 8 — Sign-up reveals nothing

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 011 phase 8`, as a `/team` (`backend`,
  `frontend`, `tests`). `quality-max`. Reviews: `invariant-reviewer`, `accessibility` with
  `/local-probe`.
- **Goal**: sign-up answers identically for a new and an existing address.
- **Scope**:
  - `apps/api/src/modules/auth/**`: `emailAndPassword.autoSignIn: false`;
    `onExistingUserSignUp` sends "someone tried to create an account with your address;
    if it was you, sign in or reset your password" (es/en, a template). The comment above
    `requireEmailVerification` is rewritten to say why sign-up no longer signs in
    (`0074`).
  - `apps/web`:
    - `RegisterScreen.tsx` drops the "already registered" branch and, after sign-up,
      shows "revisa tu correo" for every address;
    - `autoSignInAfterVerification` stays on, so the link signs the person in;
    - the copy says that on iPhone the link opens in Safari, and that in the installed
      app they then sign in;
    - dictionaries.
  - `apps/api/test/**`: a case in `access.e2e-spec.ts`; `harness.ts` already signs in after
    sign-up and must keep working.
- **Steps**:
  1. Confirm in Better Auth 's installed source (the version phase 5 left) that the
     response body and status are identical for both cases, and measure the timing
     locally as in phase 1 step 3. If the existing-address branch is measurably slower,
     send its email through `BackgroundTaskService`.
  2. API, email, specs.
  3. Web, copy, `/local-probe`.
  4. E2E: same status and body shape for both; no session cookie for either; the email
     sent once to the existing address; the harness suites still green.
- **Acceptance criteria**: PRD 13.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=api --filter=web`.
  - `access.e2e-spec.ts`, `onboarding.e2e-spec.ts`, `terms-record.e2e-spec.ts`, then CI.
  - `/local-probe` on `/registro` and the after-sign-up screen.
  - human-verify: the owner signs up a throwaway address on his iPhone, confirms it, and
    signs in in the installed app.

### Phase 9 — A Content Security Policy, report-only

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 011 phase 9`, as a `/team` (`frontend`,
  `backend`). Below the auth floor is allowed here: the lead may price it lower, with a
  line in the LOG. Reviews: `seo` (the landing page stays static and cached),
  `accessibility` with `/local-probe`.
- **Goal**: the web sends a CSP in report-only mode, and its reports can be read.
- **Scope**:
  - `apps/web/next.config.js` `headers()`: `Content-Security-Policy-Report-Only` without
    nonces (so `/` stays cached), listing exactly what the web loads today: self, the API
    origin, Vercel Blob for dish pictures, Vercel Analytics if present, and Google and
    Apple sign-in. Include `frame-ancestors 'none'`.
  - `apps/api`: `POST /csp-report`, public and rate-limited by `RateLimitGuard`, accepting
    only the CSP report shape. It logs the directive and the blocked origin with no URL
    query and no IP, and keeps nothing in the database.
  - `apps/web/AGENTS.md`: how to add an origin to the policy.
- **Acceptance criteria**: PRD 14 (report-only).
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=api --filter=web`.
  - `/local-probe` across the signed-out and signed-in screens with the console open:
    zero reports on a normal walk.
  - After deploy: `curl -sI` shows the header; `x-vercel-cache: HIT` on `/`.

### Phase 10 — Enforce, and close the project

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 011 phase 10`. Reviews: `legal`,
  `invariant-reviewer`. — owner-gated: at least 7 days after phase 9 reached production,
  the owner says yes to reading the API's logs for `csp-report` lines through the Vercel
  MCP (read-only).
- **Goal**: the CSP enforces, and the record of the project is complete.
- **Scope**: `apps/web/next.config.js`; `docs/legal/eipd.md` (R8/M13: second factor,
  breached passwords, the per-account brake, the removal procedure) and anything else
  `legal` names; `apps/api/AGENTS.md`, `apps/web/AGENTS.md`; `docs/ROADMAP.md`;
  `docs/ARCHITECTURE.md` if the auth section names the factors; the LOG.
- **Steps**:
  1. Read a week of reports. Every legitimate violation is either added to the policy or
     explained in the LOG. Switch the header to `Content-Security-Policy`.
  2. `legal` updates the EIPD and confirms the privacy policy is still true.
  3. Roadmap line, AGENTS notes, PRD status `delivered` once the owner has confirmed the
     human-verify items of phases 2, 3, 5 and 8 are recorded.
- **Acceptance criteria**: PRD 14 (enforcing), 16.
- **Verification**:
  - `pnpm turbo lint ts:check test`.
  - After deploy: `/local-probe` walk with zero violations; `curl -sI` shows the enforcing
    header; `/` still cached.

## Hand-off

- **Report `0007` is the design**: its line references were read on `09ed8323`. When a
  line has moved, find the same code; do not trust the number.
- **Better Auth's routes and plugins are used, not re-implemented.** Hashing, tokens, TOTP,
  backup-code encryption and session rotation stay Better Auth's. Our code is hooks,
  guards, rules and screens. Never `allowPasswordless`, never `trustedProviders`, never
  `freshAge: 0`, never the password in `DELETE /users/me` (`apps/api/AGENTS.md`, `0058`).
- **Every denial is a 404.** The only new 409 is `PASSWORD_CHANGE_REQUIRED` (phase 2),
  added to the documented exceptions. Every new user-scoped table cascades on `user.id`.
- **No email carries a word of health** (M14), and every security event is an
  `audit_logs` row without IP. Every admin mutation writes its audit row in the same
  transaction.
- **No password, no hash and no HIBP prefix is ever logged.**
- **The suites never call HIBP and never turn on 2FA unless they test it.** Their shared
  password stays `correct-horse-battery-staple-9`. The exact key lists in the e2e suites
  move in the same change as any new field on a response.
- **Production is read-only for agents.** The owner runs phase 0's query and every
  migration happens through the API's build. Neon writes are blocked by the classifier;
  Vercel reads need the owner's yes for that specific read.
- **Probe and dev-database scripts run from the main checkout only**: worktrees have no
  `.env`. Never the whole e2e suite locally, and never two runs at once; let CI run them.
- **The web follows the `apple-web-design` skill**, and every screen is probed with
  `/local-probe` before it ships.

## Out of scope

- SMS, magic links, push approval, email OTP as a factor; composition rules, expiry,
  security questions, hard lockout (report `0007` § 4.4).
- A second factor for Google- or Apple-only accounts.
- Cloudflare Turnstile — only with data showing attacks the brake does not stop, and
  through `legal` first.
- A "new device signed in" email.
- A custom domain, and moving passkeys to it — a follow-up whenever a domain is bought.
- zxcvbn.

## PRD acceptance criteria → phases

| PRD | Phase |
| --- | --- |
| 1 The limit sees each person | 0 |
| 2 The password rule holds on every door | 1 (sign-up, reset), 2 (change) |
| 3 HIBP down does not break sign-up | 1 |
| 4 A breached password is caught at sign-in | 2 |
| 5 Reset takes the same time | 1 |
| 6 Change password and sessions | 2 |
| 7 Optional TOTP | 3 |
| 8 The sign-in flow handles the challenge | 3 |
| 9 Passkeys | 5 |
| 10 The owner's removal | 4 |
| 11 Privileged accounts | 6 |
| 12 Per-account brake | 7 |
| 13 Sign-up reveals nothing | 8 |
| 14 Headers and CSP | 1 (simple headers), 9 (report-only), 10 (enforcing) |
| 15 Every security email and audit row | 2, 3, 4, 5, 8 |
| 16 Across the project | all; closed in 10 |
