# apps/api AGENTS.md

The NestJS backend. Rules here are more specific than the root `AGENTS.md` — both apply.

---

## What this app is

The **only** process that opens a database connection, holds an auth secret, or talks to an AI provider. `apps/web` is a browser client that reaches it over HTTPS and nothing else.

```
apps/api/src/
  main.ts            — bootstrap: helmet, CORS, parsers, Swagger, shutdown hooks
  app.module.ts      — root module; registers the global guards, filter, interceptor
  config/            — Env.validation.ts (boot-time contract), swagger.config.ts
  database/          — DatabaseModule + the health indicator
  shared/            — decorators/ dto/ guards/ filters/ interceptors/ pipes/
                       plus logging/ observability/ services/
  modules/           — auth, users, profiles, onboarding, safety, health, email, …
test/                — e2e specs; need a real database (see test/README.md)
```

**`shared/index.ts` re-exports only what a controller writes** — decorators, DTO
helpers, pipes. Not the filter, which would pull Sentry, and not the guards, which
would pull Better Auth, into the import graph of every module and every unit spec
that touches one. `app.module.ts` reaches those through their own barrels, and
nothing inside `shared/` imports the top barrel.

### Every module has the same parts

Per [`0039`](../../docs/decisions/0039-a-route-names-what-it-takes-and-what-it-answers.md).
A module creates only the parts it has — `settings` takes no body, `ai` and `email`
have no routes — but never a different part under a different name.

```
modules/<name>/
  <name>.module.ts   wiring, and nothing else
  controllers/       HTTP: routing, guards, validation, status codes
  services/          orchestration — the only caller of packages/core in this app
  dto/in/            one declared input per route body, naming a core Zod schema
  dto/out/           one declared answer per route
  index.ts           the module's public surface — what app.module.ts imports
```

Two modules carry a folder beyond those five, because they have a concern the five
do not name: `ai/clients/` and `ai/prompts/`, and `email/templates/`.

`email` has no routes, so it has no `controllers/` and no `dto/`. It is not an
exception to the shape: a module creates the parts it has, and a mailer's parts are
a service, its templates and the wiring.

## Layering — what belongs here and what does not

```
apps/api/modules   ← HTTP: routes, DTO validation, guards, DI, I/O orchestration
       ↓
packages/core      ← controllers/ (business rules) → repositories/ (Drizzle) → entities/ (Zod)
                     plus domain/ — pure, framework-free logic
       ↓
packages/database  ← schemas + the Neon client
```

A Nest controller method should read as: take `@CurrentUser()`, bind the body with
`@ZodBody(SomeDto)`, call one method on its own service, return. **If a route method
contains a business rule, it is in the wrong file** — and so is a second call to
`packages/core`, which belongs in the service.

**The controller does not call `packages/core`; its service does.** Most services are
one line, and that is the point: the seam exists before the day something needs to go
in it, rather than being cut into a handler under pressure.

Business rules stay in `packages/core`. The test is: if the logic needs NestJS or an
I/O provider it is a service here, and if it does not it is a core controller. An API
service that grew a rule is a bug.

Nest controllers never import `database` or `drizzle-orm`. Data access lives in `packages/core/repositories`.

**Naming collision to keep straight:** a *controller* in `packages/core` is an application service; a *controller* here is an HTTP endpoint class. The root `AGENTS.md` vocabulary records this.

## Module system — ESM, deliberately

NestJS 12 ships ESM only, so this app is `"type": "module"` with `module: nodenext`.

- **Every relative import needs a `.js` extension**, including directory barrels (`'../../config/index.js'`). Node will not guess.
- `packages/core` and `packages/database` compile to **CommonJS** and are consumed through Node's ESM→CJS interop. That is why they have a `build` step and why `exports` splits `types` (source) from `default` (`dist`). Run `pnpm --filter core build` after changing them, or `pnpm dev`, which watches.
- Jest runs with `NODE_OPTIONS=--experimental-vm-modules`. That is not optional under ESM.

## Security invariants

Not style preferences. Changing one is a security regression.

- **Denials are 404, never 401 or 403.** A distinct status confirms to precisely the blocked caller that the route or resource exists. `SessionGuard`, `AdminGuard` and the exception filter all agree on this, so no handler can drift into being the one that confirms.
- **`SessionGuard` is global and deny-by-default.** A route is protected unless it carries `@Public()`. Opting *in* to protection means a forgotten decorator is an open endpoint.
- **The session is re-read on every request.** Never cache authorisation. A logout or a deleted account must take effect immediately, not at token expiry.
- **Completeness of a profile is the API's judgement, not the client's.** `RequiresOnboardingGuard` is global and opted into per route with `@RequiresOnboarding()`; the meal-plan controller carries it on the class. Opt-in, not deny-by-default, because most routes are how someone *finishes* onboarding. It is the one refusal that is **not** a 404 — a 409 with code `ONBOARDING_INCOMPLETE` — because the caller owns the account and the only useful answer is which step they left. A check the web app performs and the API does not is a suggestion.
- **A breached password must be changed before anything else** (PLAN 011 phase 2). `PasswordChangeGuard` is global and deny-by-default: while `user.password_compromised_at` is set, every non-`@Public()` route answers 409 `PASSWORD_CHANGE_REQUIRED` — the other documented exception beside `ONBOARDING_INCOMPLETE`, for the same reason: the account is the caller's and the answer is what to do. The exceptions carry `@AllowPasswordChangePending()`: `GET /users/me`, `DELETE /users/me` and `GET /auth/me`, and a spec (`PasswordChange.guard.spec.ts`) fails if the decorator appears anywhere else. Better Auth's own `/auth/*` — `/change-password`, `/sign-out` — are `@Public()` and never reach it. The flag rides the session (`additionalFields.passwordCompromisedAt`, `input: false`) and `SessionGuard` re-reads it every request. Order in `GLOBAL_GUARDS`: `EMAIL_NOT_VERIFIED` / `ACCOUNT_NOT_ACTIVATED`, then `AdminGuard`'s 404, then `PASSWORD_CHANGE_REQUIRED`, then `ONBOARDING_INCOMPLETE`.
- **`@CurrentUser()` is the only sanctioned source of a user id.** An id from a path param, query string or body is an id the caller chose. Never scope a query with one.
- **Every route body is declared by a DTO and bound with `@ZodBody`.** `@Body() body: SomeType` with no pipe gets *no* validation and arrives as whatever was sent. A DTO in the module's `dto/in` names a Zod schema from `packages/core/entities` — the same one the web form uses, never a second copy of the rule — and `@ZodBody(SomeDto)` binds the validation pipe, the parameter's type and the published OpenAPI request schema together, all three from that one schema. **Never `@UsePipes(...)` at the handler**: that binds the pipe to *every* parameter, so the body schema also validates `@CurrentUser()` and rejects every valid request. That shipped once; routing the binding through one decorator is what stops it shipping again. See the traps below.
- **Nothing internal reaches a response.** `AllExceptionsFilter` is the single translation point. Driver messages carry connection strings, Zod issues describe the schema, stacks carry paths. An unrecognised error is a bare 500.
- **Deleting an account asks for a fresh session, and Better Auth's refusals are translated.** `DELETE /users/me` calls `auth.api.deleteUser` with no password, so Better Auth accepts only a session created within `freshAge` (default, one day). It refuses an older one with `SESSION_EXPIRED` before `beforeDelete` (Stripe, invitations) and before any row goes. `UsersService.remove` turns that into 409 `REAUTHENTICATION_REQUIRED`: sign out, sign in, delete. Never set `freshAge: 0` and never accept a password there: a stolen session must not delete an account, and a direct `auth.api` call is outside Better Auth's rate limit. **Each `auth.api.*` caller catches the 4xx codes it expects and throws a domain error for them**, as `UsersService.remove` does. `AllExceptionsFilter` is only the safety net for the rest, and it never names a code that could say whether an address has an account. A 4xx keeps its status with `AUTH_ERROR` and a generic message, or `AUTH_<CODE>` for the few codes on its `AUTH_CODES` list, each about the caller's own account. A 401, 403 or 404 becomes the guard's own 404, byte for byte, and a 5xx stays the bare 500.
- **The password rule has one home: `core/entities/Password`** (PLAN 011 phase 1). `PASSWORD_MIN_LENGTH` (12) and `PASSWORD_MAX_LENGTH` (128) go to Better Auth's `minPasswordLength`/`maxPasswordLength`, and the web forms read the same two numbers. Never spell a length anywhere else, and no composition rule. Lengths are `.length`, the way Better Auth counts — which is why `newPasswordSchema` is not `z.string().min().max()` (Zod 4 counts code points there).
  - **`hooks.before` (`modules/auth/services/PasswordPolicy.ts`) guards the three doors a password is set through**: `/sign-up/email`, `/reset-password`, `/change-password`. A password outside the lengths is left to Better Auth (`PASSWORD_TOO_SHORT`/`_TOO_LONG`). Otherwise the context words come first — the address's local part, the name's words, "nutria" (`passwordHasContext`), held against the body on sign-up, **the token's account** on a reset, and **the session's** on a change — then HIBP. Refusals are 400 `PASSWORD_HAS_CONTEXT` or `PASSWORD_COMPROMISED`, one code whichever word matched. An unknown or expired reset token, or no session on a change, skips the checks and Better Auth answers its own error. Sign-in is never checked: an older, shorter password still opens its account.
  - **What follows a password change, a closed session and a sign-in** (`modules/auth/services/AccountSecurity.ts`, PLAN 011 phase 2):
    - `hooks.before` forces `revokeOtherSessions: true` on `/change-password` whatever the body says. Better Auth deletes every session of the account and issues the caller a new one.
    - `hooks.after`, on a 2xx only:
      - `/change-password` and `onPasswordReset`: `UserController.passwordChanged` clears `password_compromised_at`, removes every passkey (one `auth.passkey_removed` each) and writes `auth.password_changed {via}` in one transaction, awaited so the next request is not still 409. Then the "password changed" mail runs in the background (`PasswordChangedMail.ts`: when, a browser and a system family from `core/domain/Device`, the `/recuperar` link, no word of health). A failure to record is logged as `password_change_unrecorded`, not a 500, because the password did change.
      - `/revoke-session`, `/revoke-other-sessions`, `/revoke-sessions`: `auth.sessions_revoked {scope: one|others|all}` for the session's own user. A `/revoke-session` for a token that is not the caller's is answered `{ status: true }` by `hooks.before`, which is what Better Auth answers anyway. Nothing is closed and no row is written.
      - `/sign-in/email`: `breachedOrPass` runs on the password just proved, through `BackgroundTaskService`, and sets the mark on a hit (once; the first instant stays). Sign-in never waits for it. A timeout or an error marks nothing. Off under `NODE_ENV=test`, where a suite seeds the column.
    - **An audit row's metadata is the closed word and nothing else**: never a token, an IP, a user agent or a session id.
    - **Better Auth's `/list-sessions` refuses a session older than `freshAge`** (one day) with 403 `SESSION_NOT_FRESH`. The revokes don't. The web app asks for a fresh sign-in there.
  - **The second factor is Better Auth's `twoFactor` plugin, used as it is** (`auth.config.ts` `plugins`, `services/TwoFactor.ts`, PLAN 011 phase 3): an authenticator app (TOTP, issuer `NutrIA`, six digits, thirty seconds) and ten backup codes, both stored encrypted in `two_factor` (one row per account, UNIQUE on `user_id`); `user.two_factor_enabled` rides the session.
    - **Routes the web uses**: `POST /auth/two-factor/enable {password}` → `{ totpURI, backupCodes }` and an **unverified** secret, the factor still off; `POST /auth/two-factor/verify-totp {code, trustDevice?}` — from a session, the first correct code turns it on (and rotates the session); from a challenge, it finishes a sign-in; `POST /auth/two-factor/verify-backup-code {code, trustDevice?}`; `POST /auth/two-factor/disable {password}`; `POST /auth/two-factor/generate-backup-codes {password}` → `{ backupCodes }`. `skipVerificationOnEnable` stays false. Codes the web maps: `INVALID_CODE` and `INVALID_BACKUP_CODE` (401), `TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE` (400, five in one challenge, which is then gone), `ACCOUNT_TEMPORARILY_LOCKED` (429, ten in a row on the account, fifteen minutes), `INVALID_TWO_FACTOR_COOKIE` (401, ten-minute challenge expired), `INVALID_PASSWORD` (400).
    - **A sign-in with the factor on** answers `{ twoFactorRedirect: true }` with no session cookie: the plugin deletes the session `/sign-in/email` created and leaves a signed ten-minute challenge cookie. A device trusted with `trustDevice: true` skips the code for thirty days, renewed at each sign-in from it; its `verification` row (`trust-device-*`, value = account id) is deleted for every device of the account when the factor goes off (`UserController.twoFactorChanged`), on `/revoke-other-sessions` and `/revoke-sessions` (`UserController.sessionsRevoked`, scope `others`/`all`; not `one`), and inside `UserRepository.passwordChanged`'s transaction on a change or a reset. Social sign-in never asks: the plugin only guards the password door, and a Google-only account's second factor is Google's. **So no provider is linked past the factor**: `databaseHooks.account.create.before` (`refusesLinkPastTheFactor`) refuses a non-`credential` account for a user with the factor on unless the request carries that user's own session, which closes Better Auth's implicit link at `/callback/:provider` — a mailbox holder making a Google account on the address would otherwise get a full session with no code. Better Auth answers "unable to link account". An Apple link from a session would be refused too (Apple's callback is a cross-site POST, no lax cookie); Apple is dark.
    - **The password-only rule**: `hooks.before` answers `/two-factor/enable` from an account with no credential account the guard's 404, byte for byte (`{"code":"NOT_FOUND","message":"Not Found","statusCode":404}`, a thrown `APIError` with that body). `/two-factor/send-otp`, `/two-factor/verify-otp` and `/two-factor/get-totp-uri` are the same 404 (`NOT_OFFERED`): no `otpOptions.sendOTP`, email OTP is not a second factor, and the secret leaves only in `/enable`'s answer — `/get-totp-uri` would clone the authenticator with no row and no mail.
    - **`hooks.after`, on a 2xx**: `auth.2fa_enabled` at the verify-totp that turned it on (session before the request, user's flag false before and true after) — never on `/enable`; `auth.2fa_disabled` on `/disable` when the session's user had it on (the plugin answers 2xx on an account without it, and that writes nothing); `auth.backup_codes_regenerated` (no metadata) on `/generate-backup-codes`, so the owner's codes cannot be swapped in silence; `auth.backup_code_used {remaining}` on `/verify-backup-code`, the count read by decrypting the plugin's row after it spent the code, which goes no further. Each row awaited (a failure is `two_factor_unrecorded`, not a 500), then its mail in the background (`TwoFactorMail.ts`, `email/templates/TwoFactorChanged.ts`: when, the device family, the `/recuperar` link, no word of health). The user's hook runs **before** the plugin's after-hook, which is why `/sign-in/email`'s HIBP check still sees the proved password of an account that will be challenged.
    - **`session_started` once per real sign-in.** `databaseHooks.session.create.after` skips (`startsAVisit`) `/sign-in/email` — its session may be the provisional one the plugin deletes before the challenge (two-factor/index.mjs:287-288) — and the plugin's rotations of a session somebody already had: `/two-factor/enable`, `/two-factor/disable`, and `/two-factor/verify-*` from a session. A password sign-in is counted by the `sessionStartedOnSignIn` plugin, listed after `twoFactor` so its after-hook sees what is left: `newSession` non-null (no factor, or a trusted device) is one visit; a challenge leaves null, and the challenge's own session is counted when verify-totp or verify-backup-code creates it. `/change-password`'s new session is still counted as before.
    - **A TOTP code is accepted once** (PLAN 011 phase 4, the 2026-10-01 amendment). `hooks.before` on `/two-factor/verify-totp` (`refuseReplayedCode`) finds the account — the session's, or the one the signed `two_factor` challenge cookie names, read as the plugin reads it — decrypts its secret with `symmetricDecrypt` as the plugin does, finds which step the code belongs to within two either side (`TOTP_SEARCH`: the plugin's window of −1, 0, +1, one wider, because the hook and the plugin read their clocks a moment apart and a code on a thirty-second boundary must still be claimed; six digits, thirty seconds) (`totpStepOf`, HOTP over `node:crypto`, constant-time compare), and claims it: `TwoFactorController.claimTotpStep`, one `UPDATE two_factor SET last_totp_step = $s WHERE user_id = $u AND (last_totp_step IS NULL OR last_totp_step < $s) RETURNING`. No row back — the same code again, on another challenge or from a session, or an older step — answers exactly the plugin's wrong-code answer, `APIError.from('UNAUTHORIZED', TWO_FACTOR_ERROR_CODES.INVALID_CODE)`, byte for byte. Left to the plugin: a code matching no step (it counts the failure), no account or row, and a sign-in the plugin refuses anyway (unverified secret, `lockedUntil` in the future), so a refusal never spends the step the next attempt needs. Covers the confirmation that turns it on; backup codes are untouched. **So a test that confirms with a code and then signs in within thirty seconds uses the next step's code** (`totp(uri, Date.now() + 30_000)`). Never log the code, the secret or the step.
    - **The owner removes a lost second factor, 48 hours later at the earliest** (PLAN 011 phase 4; the written procedure — the request from the account's own address, the headers checked for a lookalike — is `docs/legal/`'s). `POST /admin/accounts/:id/two-factor/removal` → 201 `{ dueAt }` (now + 48 h, `TWO_FACTOR_REMOVAL_DELAY_MS`), 409 `TWO_FACTOR_NOT_ENABLED` / `TWO_FACTOR_REMOVAL_PENDING` (`TwoFactorRemovalRefusedError`); `DELETE` the same → 204, or the guard's 404 when none is pending. Both `@Roles('admin')` (`AdminTwoFactorController`), an unknown id is the guard's 404 byte for byte, and the answer never carries the address. The row is `two_factor_removal` (one per account, UNIQUE `user_id`, cascade; `cancelled_at` set is history, and a new request revives it in one `INSERT … ON CONFLICT (user_id) DO UPDATE … WHERE cancelled_at IS NOT NULL`, so a pending one answers 409 with no read-then-insert race). Every step writes its row in the same transaction (`core/controllers/TwoFactor`): `auth.2fa_removal_requested {}` and `auth.2fa_removal_cancelled {by:'owner'}` with the owner as actor, `auth.2fa_removal_cancelled {by:'account'}` with the account as its own actor, `auth.2fa_removed_by_owner {}` with no actor — the account only in `actorId`/`subjectUserId`, no `entityId`, no `ipHash`. Every step mails the account's own address and nowhere else (`TwoFactorRemovalMail.ts`, `email/templates/TwoFactorRemoval.ts`: requested with its date and "as much as a day later", cancelled, removed; in the account's stored language; never who asked, a header, an IP or a word of health; a mail the provider refuses is the error line `two_factor_removal_unmailed {"kind":…,"userId":…}`, since the "requested" mail is the only automatic warning of a forged request) — in the background from a route, awaited in the cron.
      - **A correct code cancels it**: `hooks.after` on `/two-factor/verify-totp` and `/verify-backup-code`, on a 2xx — a sign-in, a check from a session, the confirmation that turns it on — calls `TwoFactorController.cancelRemovalByAccount`, awaited, then the "cancelled" mail. Nothing pending says nothing. A failure is the line `two_factor_removal_uncancelled {"userId":…}`, not a 500: the person did sign in, and their next correct code tries again.
      - **The removal is the daily `/cron/two-factor-removals`** (08:10 UTC, `CronSecretGuard`, `TwoFactorRemovalsService`, `cron_run` `job: 'twoFactorRemovals'` with `{ removed, failed }`), so "48 hours" is the first run at or after `dueAt`: 48 to 72 hours, as the mail says. Per due account, one transaction (`TwoFactorRepository.remove`) whose **first statement deletes the request only if it is still pending and `due_at <= now`** — that `WHERE`, not the list read before it, is what stops a removal sooner than 48 hours or after a cancel — then deletes the `two_factor` row, sets `two_factor_enabled = false`, forgets every trusted device and writes the row. A request whose account turned the factor off itself is closed with no row and no mail. Idempotent; one account failing is `two_factor_removal_failed {"userId":…}` and a count, and tomorrow retries it.
    - **A password change or reset never touches the factor**, and `TEST_AUTH_RULE` also covers `/two-factor/*` (the plugin's own rule is three in ten seconds) under `NODE_ENV=test`. `services/TwoFactor.spec.ts` drives all of it over HTTP on the real `createAuth`, including that no secret, backup code or TOTP code reaches any log.
  - **Passkeys are Better Auth's `passkey` plugin, a passwordless door as strong as a second factor** (`auth.config.ts` `plugins`, `services/Passkey.ts`, PLAN 011 phase 5, `0083` amending `0074`). `passkeyOptions(APP_URL)` gives the relying party: the web origin's host, named `NutrIA`, with no variable of its own. A new domain voids every passkey. The rows live in `passkey` (`credential_id` UNIQUE, `user_id` ON DELETE CASCADE). A second account offering an id already registered gets the plugin's 500 and nothing is stored, which is accepted.
    - **The person is verified, every time** (`PASSKEY_USER_VERIFICATION`): `userVerification: 'required'` in the registration options and, rewritten by `passkeyAfter`, in the sign-in options. The plugin's `afterVerification` hooks refuse an answer without the UV flag: registration 400 `FAILED_TO_VERIFY_REGISTRATION` (nothing stored), sign-in 401 `AUTHENTICATION_FAILED` (no session). **So a passkey sign-in opens a session with no second step, even for an account with TOTP on — on purpose** (`0083`). Phase 6's "TOTP on" rule for professionals and the admin accepts it. Never add a TOTP step after it, and never treat "no code in this sign-in" as "no second factor". The guards after sign-in apply to that session as to any other (`EMAIL_NOT_VERIFIED`, `ACCOUNT_NOT_ACTIVATED`, `PASSWORD_CHANGE_REQUIRED`).
    - **Adding one** (`passkeyBefore` → `mayAddPasskey`, on `/passkey/generate-register-options` and `/passkey/verify-registration`):
      - An unconfirmed address is refused 403 `EMAIL_CONFIRMATION_REQUIRED`.
      - A password account needs a live grant from `POST /auth/passkey/confirm-password { password }`: a `verification` row `passkey-grant-<sessionId>` with the account id as its value, valid for ten minutes, never anything of the password. Without it, the answer is 403 `PASSWORD_CONFIRMATION_REQUIRED`. The options step only reads the grant. The verify spends it **before the plugin runs**, in one `DELETE … RETURNING` (`UserController.spendGrant`), so two parallel verifies cannot share one confirmation. A verify the plugin then refuses has spent the grant too.
      - An account with no password needs a session under ten minutes old (403 `SESSION_NOT_FRESH`). `confirm-password` for that account is the guard's 404.
      - `createSession` is forced to `false` on the verify.
    - **Owned by the session**: `/passkey/delete-passkey` and `/passkey/update-passkey` for an id that is not the caller's are the guard's 404, byte for byte the answer for an id that does not exist.
    - **`hooks.after`, on a 2xx**:
      - `auth.passkey_added` (awaited), then the "you added a passkey" mail in the background.
      - `auth.passkey_removed` with no mail.
      - Both rows have empty metadata, no `entityId` and no `ipHash`.
      - On `/passkey/verify-authentication`: `cancelPendingRemoval`, the same as after a correct TOTP code.
    - **Any password change forgets them**, from Seguridad as well as by a reset (`UserRepository.passwordChanged`). They go in the transaction that clears the mark, one `auth.passkey_removed` per key, and the mail counts them. If that transaction fails, `UserController.forgetPasskeys` tries again on its own. If that fails too, the error line `passkeys_not_removed {"userId":…}` is written. A rollback to an API without this rule must `DELETE FROM passkey` before the next redeploy (`0059`'s header).
    - **No WebAuthn challenge in a log line.** Better Auth's `logger` is `authLogger()` (`services/AuthLogger.ts`). It formats each line and replaces every quoted value on any line that mentions a challenge, because `@simplewebauthn/server`'s error quotes both the challenge that was sent and the one expected. Never log a challenge, a credential id, a public key or a passkey's name.
    - Rate limits outside tests (`PASSKEY_SIGN_IN_RULES`): `confirm-password` and `verify-authentication` 3 in 10 s, `generate-authenticate-options` 20 a minute. `services/Passkey.spec.ts` drives all of it over HTTP on the real `createAuth`, with a P-256 authenticator built in the test.
  - **HIBP fails open.** `isPasswordCompromised` (the export, never the `haveIBeenPwned` plugin, which answers a 500 when HIBP is down) runs behind a 2 s timeout. A timeout or an error lets the request through and leaves one line, `hibp_unavailable {"reason":"timeout"|"error","route":…}`. **Never log the password, its SHA-1, its prefix or the error's own text.** Off under `NODE_ENV=test` — no suite reaches the network — while the context check stays on.
  - **`advanced.backgroundTasks` is `BackgroundTaskService`.** Whatever Better Auth sends through `runInBackgroundOrAwait` — the reset mail, the verification mails — runs after the response, so a reset answers in the same time whether or not the address has an account (`modules/auth/ResetInBackground.spec.ts`). Those mails can land after the HTTP response: a test that reads a logged link waits for it.
  - **`verification.disableCleanup` is `true`.** Better Auth's prune of expired rows ran inside a reset only for an unknown address, a round trip that told the two apart. The daily `/cron/sweep-verifications` (`UserController.forgetExpiredVerifications`, strictly `expires_at < now`) owns the pruning; never turn the cleanup back on.
  - **A brake per address on password sign-in** (`services/SignInBrake.ts`, `core/domain/SignInBrake`, PLAN 011 phase 7). Better Auth's limiter counts per IP; this counts per address, from however many IPs. `hooks.before` on `/sign-in/email` counts every attempt against `signInBrakeKey` — an HMAC of the lower-cased address with `BETTER_AUTH_SECRET`, labelled `sign-in-brake:` — in `sign_in_failure` (no address, no user FK), decided under the row's lock (`INSERT … ON CONFLICT DO UPDATE` then `UPDATE`, one transaction), so attempts fired at once from many IPs cannot all read the count before any writes it. The tenth attempt in fifteen minutes runs and leaves the next waiting 30 s, doubling to a cap of 15 min; while it waits the answer is 429 `{code:'TOO_MANY_ATTEMPTS'}` with `Retry-After` and `X-Retry-After`, before the password is checked, byte for byte the same for an address with an account and one without. The window is fixed from its first attempt until the waits begin; after that it restarts only once fifteen minutes pass with no attempt after the last wait ended. A 2xx sign-in (a second-factor challenge included) and a password reset delete the row. **No wait is longer than 15 min, but that is not a promise that the owner's password gets in during an attack**: the attempt at the end of each wait goes to whoever asks first, so somebody spending each one on a wrong password keeps the address braked, and a reset that clears it is braked again after ten more. Passkeys and Google are the owner's way in meanwhile. Clearing on success leaks, slowly, that an address has an account whose owner signed in between two probes; accepted (LOG, phase 7). It fails open: a brake that cannot read its row logs `sign_in_brake_unavailable` (never the address) and lets Better Auth's per-IP limit stand alone. Passkeys and Google never pass through it: no password to guess. On under `NODE_ENV=test`; a suite that fails sign-ins uses its own addresses. The daily `/cron/sweep-verifications` deletes rows a day quiet (`AuthRetentionService`), and **the `auth.*` audit rows older than twelve months, and no other action's** (`AuditRepository.forgetAuthRowsBefore`, `legal`'s retention).
- **A provider's message is scrubbed of the configured credentials by value, not only by shape.** `redactSecrets` (`modules/ai/clients/redact.ts`) is the one scrub between what a provider or gateway answers and the job row's `errorDetail`, which the job's owner reads back. Its patterns catch a key this process never held; `AI_SECRETS` — `providerCredentials(env)`, the set `*_API_KEY` values — catches ours in a phrasing no pattern knows ("Incorrect API key provided: <key>") and a gateway key with no prefix at all. Every caller passes it; a new caller that scrubs by pattern alone leaks the live key to whoever triggered the failing job.
- **`code` is stable, `message` is not.** The frontend switches on `code`; messages are free to be reworded.
- **Responses default to `no-store`.** Absent an explicit directive a shared cache may apply heuristic freshness to an authenticated body — here, someone's health data.
- **Roles come from the database row, never the request.**
- **Never log a request body, a cookie, an `Authorization` header or an email address.** The pino redaction list in `app.module.ts` covers the known carriers; new ones get added there.
- **The request log scrubs every token a URL carries.** `withoutSecrets` (`shared/logging/pino.ts`) runs over the `url`, the `referer` and the response's `location`, and replaces the invitation token, the reset token (`/auth/reset-password/<token>` and `?token=`) and the verification token (`/auth/verify-email?token=`), plain and percent-encoded. A new route or page that carries a secret in its URL is added there, with its `pino.spec.ts` case, in the same change.

## Allergy safety

Allergies are a hard constraint enforced in **code**, never by prompting a model.

- The validator is `findSafetyViolations` in `packages/core/domain/Safety`. It compares allergen **ids**, so nothing depends on spelling or on a model obeying an instruction.
- Load the profile with `SafetyController.getSafetyProfile(userId)`. It is a named method so the call site is greppable: **a code path that never calls it is a code path with no allergy check.**
- Anything that produces or shows food — generation, replacement, shopping lists — validates before it stores and before it returns.
- `contains` blocks anyone with that allergy or intolerance. `may_contain` blocks only users who set `crossContaminationSensitive`.
- **Free text is resolved once, deterministically, in `core/domain/Safety`.** A matched entry becomes an excluded ingredient id and goes through `findSafetyViolations` like everything else. An unmatched one becomes `SafetyProfile.unenforceableLabels`: shown as best-effort, and every catalogue row sharing a whole word with it is removed quietly beside the preferences (`bestEffortExclusions`, singular and plural folded), and a dish whose name or method names it is refused (`mentionsUnresolvedAllergy`). Never treat a label as a guarantee, and never add a second checker for one.
- **Nothing a person typed, and nothing that reveals a belief, reaches a model** (owner, 2026-09-25; prompt `4.0.0`). Not an unresolved allergy or dislike, not a check-in comment, not the breakfast, plate or working-week notes, not a way of eating that reveals a belief or a condition (halal, kosher, gluten-free, lactose-free). The prompt names a way of eating only from `NAMEABLE_PATTERNS` (vegetarian, vegan), a cuisine only from `NAMEABLE_CUISINES`, and a liked food only by its catalogue name. Those four are enforced in code instead (`PATTERN_EXCLUSIONS`, `PATTERN_SLUG_RUNS`, `PATTERN_ALLERGENS` over the allergy gate's tags, `breaksDishRule`). `modules/ai/health-boundary.spec.ts` drives a profile full of typed words through `promptPreferences` and `PoolBuilder` and fails if one comes out.

## Adding a module

Copy the folders of an existing one — `feedback` is the smallest complete example.

1. `src/modules/<name>/` with `<name>.module.ts`, `controllers/`, `services/`, the
   `dto/in` and `dto/out` it needs, and an `index.ts`; `app.module.ts` imports the
   barrel, never the module file.
2. Routes take `@CurrentUser()` and delegate to the module's own service; the service
   is what calls a `packages/core` controller.
3. Every body gets a DTO in `dto/in` naming a schema from `packages/core/entities`,
   bound with `@ZodBody`. Every answer gets a type in `dto/out` — core's view named,
   or, where this app composes the shape, declared.
4. `@ApiTags` / `@ApiOperation` and the response the route actually returns
   (`@ApiOkResponse`, `@ApiCreatedResponse`, `@ApiNoContentResponse`) on everything —
   Swagger is the API's documentation.
5. Public routes need an explicit `@Public()`, and a comment saying why.

## Environment

`src/config/Env.validation.ts` is the contract; `.env.example` is the inventory. The process refuses to boot on a bad environment and prints **every** problem at once, with no values echoed — a startup crash is often the most widely read log a service produces.

Production is stricter than development, by design: `ALLOWED_ORIGINS` is required and may not contain localhost, and `SWAGGER_ENABLED` must be false.

## Deployment

**This app deploys as a serverless function, and deploying applies migrations — treat it as high-stakes.**

- `src/config/CreateApp.ts` is the **one** place an application is assembled. There are
  two entry points — `main.ts` (owns a port) and `src/api/index.ts` (the deployed
  handler, reached through `vercel/index.js`) — and neither owns the configuration list. Anything added to one and
  forgotten in the other is a bug that exists in exactly one environment.
- It is deliberately **not** re-exported from `config/index.ts`: that barrel is imported
  by specs that want only the `Env` type, and reaching the whole application graph
  behind them breaks them under Jest's ESM interop with a require cycle naming
  neither file.
- `vercel.json` uses the legacy `builds` array pointed at **`vercel/index.js`**, a
  committed one-line re-export of `dist/api/index.js`. Two constraints meet there:
  the builder compiles any `.ts` it is handed with its own symlink-blind TypeScript
  pass (a wall of errors under pnpm's strict store, cosmetic but noisy, and a
  deployed artifact nothing had type-checked), and the `builds[].src` glob is matched
  against the tree *before* `vercel-build` runs, so a path under `dist/` matches
  nothing and silently emits no function. The shim is JavaScript, so nothing is
  compiled; it is committed, so the glob matches; `dist/` exists by the time the
  entry is traced because the builder runs `vercel-build` first. The function ships
  the artifact the gate passed. Never point `src` at `dist/` directly, and never
  quiet a builder error by hoisting (`shamefully-hoist`, `node-linker=hoisted`).
- `vercel-build` runs `turbo run build --filter=api...` **then** `database migrate`, so
  a type error stops the deploy before it touches the database. Every production
  deploy still applies pending migrations: review them as production changes.
- `ignoreCommand` deploys only `main`. Preview URLs would be in neither
  `ALLOWED_ORIGINS` nor `COOKIE_DOMAIN`, so authentication cannot work on them.
- `maxDuration` is 300s because generation runs *after* the response: `PlanJobRunner`
  hands its work to `BackgroundTaskService`, which calls `waitUntil` to keep the
  invocation alive. A bare `void promise` is frozen the moment the response is sent
  and leaves a job row `running` with no log line. Generation takes 30–45s, so a
  60s ceiling is not enough headroom.
- **The function runtime cannot `require()` an ES module.** Its own loader throws
  `ERR_REQUIRE_ESM`, while Node 22.12+ allows it by default — so a CommonJS dependency
  that `require()`s the ESM `@nestjs/*` passes every local run and every test, and
  kills the function on its first cold start with nothing else in the log. This is
  independent of the Node version setting: the throw comes from the platform's
  loader, not from Node. `nestjs-pino` was the live example and is gone; logging is
  `shared/logging`, plain `pino` + `pino-http`. `preflight` imports the deployed entry
  under `--no-experimental-require-module`, the rule the runtime applies, and runs as
  part of `build` — so a violating dependency fails the deploy at build time, before
  migrations, rather than at the first request. Every `@nestjs/*` package is ESM;
  before adding any Nest-adjacent third-party package, check it ships an ESM build.
- **`NODE_ENV` must be `production` on the deployed function, and the process checks.**
  The platform sets `VERCEL_ENV=production`; if `NODE_ENV` disagrees, every
  production-only rule in `Env.validation.ts` is silently skipped — cookies are not
  `secure`, `ALLOWED_ORIGINS` may contain localhost, Swagger is one flag from public.
  The first deploy ran that way and the only symptom was a crash on the development
  pretty-printer. Validation now refuses to boot on the mismatch and names the fix.
  `preflight` calls `validateEnv` explicitly at build time — it has to, because
  `ConfigModule.forRoot` is async and a validation failure at import is a rejected
  promise nothing observes until bootstrap — so the deploy fails there, before
  migrations.
- **The request log carries an allow-list of headers, never the whole object.** The
  first production log line held a platform bearer credential valid for hours
  (`x-vercel-oidc-token`), a proxy signature, and the caller's city, postal code and
  coordinates, because the default records every header. `LOGGED_REQUEST_HEADERS` in
  `shared/logging/pino.ts` names what is wanted; add to it deliberately, and never
  replace it with a block-list — the next header the platform adds is not one you
  will know about. The client IP is personal data and is deliberately absent;
  correlate on `x-vercel-id` with the platform's own access log if it is ever needed.
- **The pretty-printer degrades, it never crashes.** `pino-pretty` is a devDependency
  resolved at runtime, so a traced bundle never contains it; `createPino` checks it
  is resolvable and falls back to JSON with one warning line. Do not make any
  logging option able to stop the process.
- **A recipe records which prompt wrote its steps** (`recipes.steps_version`), and
  `RecipeRewriter` rewrites everything an older one wrote — bounded, on
  `GET /cron/rewrite-steps`. Only `instructions` changes: ingredients, grams and the
  macros every past plan computed from them are untouched, so a rewrite cannot alter
  what a plan says anyone ate, and cannot reach the allergy layer, which matches ids
  and never prose. Bump `STEPS_VERSION` when the standard for steps changes and the
  library re-sweeps itself — not `PROMPT_VERSION`, which moves with any wording and
  since [`0047`](../../docs/decisions/0047-dishes-are-designed-to-the-whole-split.md)
  no longer stamps recipes; the stamp is why a rewrite that comes back terse is not
  swept for ever. What it asks for scales in the same three bands `domain/Method`
  enforces — uncooked, briefly cooked, properly cooked — because a prompt that asks
  for more than the schema accepts just fails twice.
- **A plan is discarded only for structure or a safety bound**, never for missing a
  nutrition target — see [`0011`](../../docs/decisions/0011-nutrition-targets-are-advisory.md).
  `validatePlan` reports every violation, `isBlocking` says which are worth throwing
  fourteen days of food away for, and the rest ride along in
  `generation_metadata.advisories`. If you add a rule, decide which it is: the default
  is advisory, and a new blocking rule needs a reason a user would accept losing their
  plan over.
- **The model is a preference, not a dependency, once the library can serve.** A
  returning user's rotation holds back last fortnight and caps the rest, and the model
  fills the gap; with the model gone (quota, key, outage) the gap stayed open and only
  returning users failed — a new user has nothing to exclude and needs no model. Now
  the scheduler is offered the whole safe library once, without asking the failed
  provider again, and the plan records `fallback: full_library`. What still fails is
  a library that genuinely cannot fill a fortnight, which is `GENERATION_AI_UNAVAILABLE`
  when the provider failed and `POOL_TOO_SMALL` when there simply is none.
- **The rewrite sweep is off by default** (`AI_REWRITE_STEPS`), because a free-tier project's daily request cap is generation's. Turn it on with billing, or deliberately, for a while. Through the gateway the rewrite sweep runs on free models — `AI_REWRITE_MODEL` can keep it off a combo's Gemini step — and the daily cron in `vercel.json` calls it.
- **A sweep is bounded in time, not only in number** (`RewriteLimits`). One cron call is one invocation of the 300-second function, and through the gateway a rewrite takes 22–74 seconds: ten in a row outlived the function. Three lanes, no call started with under 90 seconds left, every call ended by 240 seconds with `untilAborted` — a transport that ignores its signal cannot keep the sweep past its deadline.
- **The sweep stops at the first exhausted quota** (`isQuotaExhausted`), and so does a picture's drawing. The provider's
  free tier caps *requests*, not only spend, and generation draws on the same allowance:
  a sweep that keeps going after a refusal attempted eighteen recipes three times each
  and emptied the day's budget, blocking plan generation. Treat "the sweep is free
  because the text tier is free" as false — it is bounded, and the bound is shared.
- **A dish's picture is drawn the first time its meal page is opened** ([`0066`](../../docs/decisions/0066-photograph-like-dish-pictures-drawn-on-first-view.md)),
  behind the `dishPictures` flag, off by default. `GET /meal-plans/meals/:id` is the only
  read that may start one: `PlanController.openMeal` asks `RecipeController.requestPicture`
  (the flag, no picture yet, nobody drawing, no failure in the last 7 days, the month's
  spend under `AI_IMAGE_MONTHLY_CAP_USD`), whose claim is one statement, so one view of
  many wins. `DishPictureService.draw` then runs after the response through
  `BackgroundTaskService`, and the page already says `pictureStatus: 'drawing'`; the web
  polls `GET /recipes/:id/picture-status` (session, only a dish on one of the caller's
  plans, else 404). Every other read — the plan, the card, a swap — only reads.
  - **Nothing about a person reaches the model or the path.** The prompt is built from
    the recipe alone (`core/domain/DishPicture/prompt.ts`), and the Blob path is
    `dish-pictures/<recipeId>/<promptVersion>-<random>.jpg`.
  - **Every image and judge request goes through `pictureTransport`**, whose provider
    block (`only`, no fallbacks, `zdr`, `data_collection: deny`) only `pinnedProvider`
    can make and which is written over the body last.
  - **The allergens come from the catalogue, never from the judge.** `judgePicture` gets
    the **whole** catalogue with `mayContain`; a picture showing an extra food with an
    allergen the dish lacks is rejected: no drawing, retry or cron ever publishes it. It reaches
    the public store and becomes a dish's picture only if the owner accepts it by hand (the second
    door, below). A judge that fails is a picture not kept.
  - **A dish's own form is not an extra food** ([`0073`](../../docs/decisions/0073-a-dishs-own-form-is-not-an-extra-food.md),
    project 010). A picture shows a form, not what it is made of. When the judge names a form —
    pancakes, bread, meatballs, milk — and the dish has its own version of it, that name brings no
    allergen of the form, whether the match call paired it or left it over. "Its own version" is read
    from the recipe in code, from the closed tables of `core/domain/DishPicture/forms.ts`: an
    ingredient whose slug *is* the form, or a word of the dish's title (Spanish or English) that names
    it. **The exemption is a whitelist**: once the serving words of `SERVING_WORDS` are set aside ("a
    glass of", "grated", "slice of"), the name must be word for word one row of the family's `seen`
    ("milk", "burger patty", "pizza base"). Any other name is read exactly as it was before the rule,
    notes and all: "cheese pancakes", "wheat noodles", "whole milk", "cow's milk", "goat cheese",
    "cream cheese", "milk roll", "cinnamon roll" are other foods. A name of the dish's own form is
    excused only of its family's closed set of allergens (`FormFamily.carries`, written in `forms.ts`,
    never read from the catalogue): "battered fish" is excused its batter and its fish is still
    weighed; a named filling ("walnut brownie", "tuna empanadas"), a vegetable nugget's soy are never a form's. **What
    bounds it besides**: families are narrow (bread does not excuse pancakes); breading and nuggets or
    croquettes are keyed by the title only; rice and corn cakes are crackers, never cakes, and a
    title's "tortitas" names no pancakes on a dish that holds them; a bare "burger" still rejects (its
    bun), "burger patty" does not; a title names a form only where it means it — not in the reach of
    a negation, which runs from "sin", "ni", "no", "without", "en vez de", "en lugar de", "instead
    of", "libre de" up to "con", "with", "y", "and", a comma or a closing parenthesis ("sin queso ni
    pan", "con lechuga en vez de pan"), not negated by its own suffix ("bread-free", "breadless",
    "crust-less"), not beside "bowl", "bol" or "cuenco" ("burrito bowl"), not in another sense
    ("pan rallado", "pan sauce", "migas de atún"), and the words of `TITLE_ONLY_AS_HEAD`
    (`tostadas`, `toast`, `tacos`, `wraps`, `sándwich`, `quesadilla`, `enchiladas`, `montadito`…) only
    as the title's first word and only before the end of the title or "con", "with", "y", "and"
    ("tostadas de boniato", "tostadas crujientes de boniato", "wraps frescos de lechuga", "sweet potato
    toast" name no bread and no tortilla; "tostadas con aguacate" does); "pan" and
    "pizza" name their form wherever they stand ("pan de coliflor"); a name of the same form seen beside
    another that says more ("milk" beside "soy milk") is a second food. A verdict whose exemption took an allergen away carries
    `own_form:<name>` in its notes — only then, so a verdict the old rule already accepted keeps its
    notes — stored with the picture like the others (`provenance.judge`, the drawings). Like
    `extra_food:`, it holds a model's word and never leaves. **Three vocabulary fixes go with it**: a
    word that is not a food ("base", "glass", "bowl"…) is not mapped on its own; a named plant before a
    dairy word ("soy yogurt", "coconut milk") maps the plant and not the dairy — "plant", "vegan",
    "vegetable" name no plant, so "plant milk" or "vegan butter" read as they always did (they could be
    soy or nuts), and "plant protein" is still soy; a sulphite a food only *may*
    contain never rejects (one it contains — dried apricots, wine — does). **The holes are closed**
    (phase 5): a name that carries an allergen is read as its usual recipe even where the catalogue has
    no row of that name — "pizza" and "crust" a dough's gluten, "crepe" a batter, "paneer" a fresh
    cheese, "meringue" egg white, "crayfish" a crustacean (`SEEN_SYNONYMS`); "hamburger" and "omelet"
    as "burger" and "omelette" (`SAME_WORD`); a plural through its singular ("croutons",
    "sandwiches"). A form's word alone is the form with nothing in it (`BARE_FORMS`): a bare
    "brownie", "crackers", "empanadas" or "sandwich" is not the catalogue's only filled product of
    that name. "tortilla" is read from the dish (`READINGS`): a potato omelette on a dish that is one
    (its title names "tortilla de patata(s)", "tortilla española", "omelette" or "frittata", or opens
    with "tortilla" on a dish that holds an egg, or it holds the packaged omelette; an egg and a potato
    alone make none), and a wheat wrap, with its gluten, everywhere else — a dish of
    corn tortillas excuses it as its own form, and a dish of egg with no gluten rejects it. Known
    misses, pinned: a wheat wrap called "tortilla" on a gluten-free potato omelette, and a potato
    omelette called "tortilla" on a wheat dish with no egg, pass. A bare form's word lets through, on
    purpose and pinned in `judge.forms.test.ts`, a filled product named by that word alone: a tuna
    empanada's fish, the nuts a brownie or the sesame crackers may contain. "sausages"
    and "patty" are left open, with the reason, in
    `judge.holes.test.ts`. Every row of the
    tables has its case in `forms.test.ts`; the pilot (`judge.pilot.test.ts`, 65 accepted with their
    notes, 3 controls rejected) is the floor and is never edited; `judge.reverse.test.ts` pins what
    the rule lets through beside twenty example dishes, and says why each food moved;
    `judge.catalogue.test.ts` draws every catalogue product whose name holds a form's word beside
    each example dish, and lists by family every one it accepts that carries an allergen the dish
    lacks — a new product or a new row shows up there first.
  - **The file is stored as the model returned it** — no `sharp`, no resize: any
    re-encode breaks Google's C2PA manifest, and a file without one is never kept.
  - **Every paid call is a row in `recipe_image_calls`**, and the cap is their sum; a
    cost OpenRouter never states is recorded at the floor, never at 0. A key refusal
    (402, 429) or the cap gives the claim back (`releasePicture`) instead of failing
    the dish. Three attempts, counted across a stale takeover, then `failed`.
  - **`AI_PROVIDER=stub` draws, judges and keeps with stubs** (`StubPictureClients.ts`)
    — nothing leaves the machine. Otherwise nothing is drawn without
    `OPENROUTER_IMAGE_API_KEY` and `BLOB_READ_WRITE_TOKEN` (`BLOB_CANDIDATES_READ_WRITE_TOKEN` is
    not needed to draw: only to keep a rejected picture). `/admin/pictures` shows the
    month's spend against the cap. Every screen that shows one carries `legal`'s AI mark.
  - **Why a picture failed, and the owner's retry** (`PictureReason` in `core/entities/DishPicture`): a
    closed set (`judge_allergen`, `judge_rejected`, `no_provenance`, `model_refused`, `payment_refused`,
    `call_failed`, `cap_reached`, `owner_removed`, `other`) — never the provider's words. New rows store
    `provenance.reason` (`DishPictureService`); older ones are derived from their notes by kind prefix or
    from `released` (`pictureReasonOf`). `GET /admin/pictures` adds `failedByReason` / `releasedByReason`
    (period, by when the row ended); recipe rows add `pictureReason` and `retryableAt` (null when
    retryable now). `POST /admin/catalogue/recipes/:id/picture/retry` (`@Roles('admin')`, 202
    `{status:'drawing'}`) claims a `failed` or released picture ignoring the cool-off, or a `drawing` one stuck past
    `PICTURE_STALE_MINUTES` (`RecipeRepository.retryPicture`, clears `provenance` but for `drawings`, audit
    `picture.retried` in the same transaction) and schedules through `DishPictureService.schedule`;
    rate-limited 30 an hour; recipe rows carry `id`, which it is addressed by; 404 unknown recipe
    (fixed `Recipe not found`), 409 `PICTURE_FLAG_OFF`,
    `PICTURE_UNAVAILABLE`, `PICTURE_CAP_REACHED`, `PICTURE_DRAWING` (never takes over a fresh drawing),
    `PICTURE_NOT_RETRYABLE` (ready, or never drawn). Plan failures by code already are
    `failuresByCode` on `GET /admin/generations/stats`.
  - **What the judge said is kept** (project 010, phase 3; `PictureJudgement` in
    `core/entities/DishPicture`). Every attempt that reached the judge — both calls answered and
    `judgePicture` ran — hands its two answers and the verdict to the drawing's end, and the row keeps
    them in `provenance.drawings`: oldest first, one entry per drawing, `{ recipe: { name,
    ingredients: { grams, name, slug }[], reduced }, attempts: { at, attempt, seen, match, verdict:
    { accepted, notes }, reduced }[], v: 1 }` — the recipe as it was judged, once per drawing, so a
    picture can be replayed through another rule after the recipe changed. **Bounded and closed**: the
    last `PICTURE_DRAWINGS_KEPT` (3) drawings, 3 attempts each; 16 foods, 16 extras, 30 ingredients, 4
    matched names, 16 notes, 60 UTF-16 units a name, 160 a note; control characters and lone
    surrogates removed (Postgres refuses them in `jsonb`), in the drawings and in every other string a
    drawing's end writes (`jsonbSafe`); what is cut or cleaned is marked `reduced`; an attempt still
    over 6 KB is not stored, and a recipe over 4 KB loses its last ingredients. So a row holds at most
    about 68 KB of drawings (3 × (3 × 6 KB + 4 KB)); a real drawing is about 6 KB, three about 19 KB.
    **Versioned**: what an end writes is checked against this version's strict shape (`v`), but the
    drawings a row already holds are carried as they are — an older shape, or a newer one a
    rolled-back deploy left, is never dropped; only an entry that is not an object is. Raise
    `PICTURE_DRAWING_VERSION` with any change to the shape. Storing never throws and never changes
    how a drawing ends.
    **Every writer keeps them**: `completePicture`, `failPicture` and `releasePicture` read the row
    under its lock and write it back with this drawing's after them (`keepingDrawings`); a view's claim
    leaves the row as it is; the retry keeps `drawings` alone (`null` when there are none); the removal
    keeps them beside `owner_removed`; `dropCandidate` (discard, cleanup, the acceptance's step 6)
    takes the pointer alone; the acceptance keeps them and the rejections' `notes`. **None of it
    leaves**: `AdminCatalogueRepository` and `AdminRepository.failedPictures` select
    `provenance - 'drawings'`, no view, answer, audit row or log line carries a name a model wrote,
    and a person's app reads `status` and `url` only. A drawing killed before its end stores nothing
    of its attempts. Nothing about a person is stored: a picture of a dish and a model's words on it.
  - **A rejected picture waits seven days where only the owner can see it**
    ([`0072`](../../docs/decisions/0072-a-rejected-picture-waits-for-the-owner.md), project 009, which
    amends `0066`'s "a rejected picture is never stored"). **No retry, cron or automatic code
    publishes a candidate**: the only thing that does is the owner's acceptance, the second door below.
    - **Two doors, and no third** (`0072`, PRD 009 criterion 8). A picture reaches a person only
      because (a) `judgePicture` accepted it inside a drawing (`DishPictureService.keep` →
      `RecipeRepository.completePicture`), or (b) the owner, with an admin session, accepted it by hand
      after seeing the allergens the judge flagged (`PictureCandidatesService.accept` →
      `RecipeController.acceptCandidate` → `RecipeRepository.acceptCandidate`), and that acceptance is
      a `picture.accepted` row written **in the same transaction** that makes the picture `ready`. In
      both, the published file carries its C2PA manifest — **carries**: `pictureMarks` looks for the
      manifest's segment in those same bytes and does not verify its signature, at either door. Those two
      repository methods are the only writes of `status: 'ready'`, and `RecipeRepository.ts` is the only
      file of `packages/core` that writes `recipe_images` at all — its one insert names its status, since
      the column still defaults to `'ready'` (a default to drop in a later migration) — and nothing
      under `apps/api/src` names the table (specs read the sources and pin all of it);
      `acceptCandidate` is reached only from `POST …/picture/candidate/accept`. **Adding a
      third caller of either, or a third write of `ready`, is changing this invariant**: it needs a
      decision record, not a pull request.
    - **What is kept.** One candidate per dish: the last picture of a drawing that carried its C2PA
      manifest and that the judge rejected, held in memory by `DishPictureService` and uploaded
      **only if the drawing ends failed** — an accepted or given-back drawing keeps none, and a
      picture the judge never got to judge is not one. A file without its manifest is never
      uploaded; its row stores a closed `provenance.diagnostic` instead (content type, size, the
      three marks of `pictureMarks`). The upload has its own 10 s and its own catch: it never changes
      how a drawing ends.
    - **Where.** `PictureCandidateStore` (put, get, del): a second Vercel Blob store, **private**, in
      fra1, on `BLOB_CANDIDATES_READ_WRITE_TOKEN`; `StubPictureCandidateStore` (in memory, `files`)
      with `AI_PROVIDER=stub`. Without the token it is unavailable, nothing is kept and drawing is
      exactly as before. The token may not be the public store's: `Env.validation.ts` refuses to
      boot when the two are equal. Path `dish-picture-candidates/<recipeId>/<promptVersion>-<random>.jpg`;
      nothing that is not such a path is ever asked of the store (`isPictureCandidatePath`).
    - **No state, no migration.** The pointer is `recipe_images.provenance.candidate`
      (`PictureCandidate` in `core/entities/DishPicture`: `path`, `model`, `promptVersion`, and
      `extras` — the judge's allergen keys and catalogue slugs, **never the vision model's words**),
      beside `reason` and `notes`, which the failed pictures' mail still reads untouched, and the
      judge's answers (`drawings`, above).
    - **The path never leaves the API**: not in a DTO, a log line or an error (the store's failures
      are scrubbed of it and carry no `cause`). Recipe rows carry
      `pictureCandidate: { allergens, ingredients: { name, slug }[], expiresAt } | null`.
      `GET /admin/catalogue/recipes/:id` (`@Roles('admin')`, 404 `Recipe not found` for an unknown
      id or one that is not a uuid) answers one such row plus `ingredients: { grams, name, slug }[]`
      — the dish's served ingredients, which the review page shows beside the picture. The console's
      catalogue names are Spanish (`FALLBACK_LOCALE`), here as on the table: no read takes a locale.
    - **One clock.** A candidate is reviewable while the row is `failed` and
      `now < lastAttemptAt + PICTURE_COOL_OFF_DAYS` (`reviewableCandidate`, the only reader of that
      rule): the table, the file's route and the discard all go through it, so an expired one the
      cleanup has not deleted yet is neither shown nor served. `PICTURE_CANDIDATE_CLOCK` is the
      provider an end-to-end test replaces to move it.
    - **A row with a pointer is not claimed for drawing** (`claimPicture`'s `WHERE`, `unclaimable`),
      cooled off or not, so no claim forgets where a file is. **The pointer is removed only after
      its file is deleted**, by a write that needs the row to still hold that very path
      (`RecipeRepository.dropCandidate`). `completePicture`, `failPicture` and `releasePicture`
      carry over a pointer the row still holds instead of overwriting it.
    - **Routes**, both `@Roles('admin')` (a 404 for anybody else, before anything is read).
      `GET /admin/catalogue/recipes/:id/picture/candidate` answers the bytes — the API's one
      answer that is not JSON, a `StreamableFile` — with `Content-Type: image/jpeg`,
      `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`; 404 `NOT_FOUND`
      (fixed `Picture candidate not found`) with none reviewable.
      `POST …/picture/candidate/discard` (200 `{status:'discarded'}`) deletes the file, then the
      pointer with `picture.discarded` in the same transaction; `status`, `attempts` and
      `lastAttemptAt` stay, so the dish keeps its cool-off and nothing is spent. 404 likewise.
    - **The retry discards the candidate**: checks → claim (which clears `provenance` but for `drawings`) → `del()`.
      A deletion that fails there leaves a private file with no pointer: known, accepted.
    - **Accept** — `POST …/picture/candidate/accept`, `@Roles('admin')`, 30 an hour, body
      `{ allergens: string[], expiresAt: string }` (`pictureAcceptanceSchema`, strict; 422
      `INVALID_INPUT` when it is missing or anything else), 200 `{ status: 'ready' }`. After the shared refusals — 404 `Recipe
      not found`, 409 `PICTURE_FLAG_OFF` (the `dishPictures` switch), 409 `PICTURE_UNAVAILABLE` (either
      store's token missing) — **six steps, in this order, and the order is the design**
      (`RecipeController.acceptCandidate`):
      1. the row is `failed`, holds a candidate and it has not expired (`reviewableCandidate`), else
         409 `PICTURE_NO_CANDIDATE`;
      2. the body repeats what the console showed — the second confirmation step, on the server.
         `expiresAt` is the `pictureCandidate.expiresAt` the page was rendered with, compared as
         instants (`repeatsExpiry`): it is what says **which** candidate was seen, since it ends the
         cool-off of the very drawing that left it, so a candidate a retry from another tab left on
         the same dish — maybe with the same flags, a picture nobody looked at — is refused 409
         `PICTURE_NO_CANDIDATE`. Then the allergen keys, as a set, are the ones the candidate stores
         (`repeatsFlaggedAllergens` against `candidateFlags`), else 409 `PICTURE_ALLERGENS_MISMATCH`; a candidate with nothing flagged needs the
         explicit empty list. **No refusal says which keys are stored**;
      3. the file is read from the private store and `pictureMarks` runs again on those bytes: not a
         JPEG with its C2PA manifest → 409 `PICTURE_NOT_ACCEPTABLE` (the mark the row stored is never
         enough); a file the store no longer has → `PICTURE_NO_CANDIDATE`;
      4. **those very bytes** — the same array, never re-encoded — are put in the public store at
         `dish-pictures/<recipeId>/<the candidate's promptVersion>-<random>.jpg`; a write that fails
         or outlasts its 10 s is followed by a deletion of that path, and answers 500;
      5. one transaction: the guarded `UPDATE` to `ready` (still `failed`, still that very path, the
         same `lastAttemptAt` that was read) with `model` and `promptVersion` from the candidate and
         `provenance { acceptedBy: 'owner', overriddenAllergens, c2pa, trainedAlgorithmicMedia }` and
         what the judge said about the dish, read with the row in step 1 (`pictureEvidenceOf`: the
         rejections' `notes` and the `drawings`, each only when the row held it — never a path),
         **and** `picture.accepted { allergens }`. Nothing updated (another tab, a retry, a discard,
         the cleanup) → the public file just written is deleted and 409 `PICTURE_NO_CANDIDATE`; the
         audit write failing rolls the update back, deletes the public file and answers 500. **Never a
         `ready` row without its audit row, nor the reverse** — and **the public file is deleted only
         once it is known that no row points to it**. A transaction that threw may still have committed
         (a lost answer to `COMMIT`), so the row is read back **under its lock**
         (`RecipeRepository.settledPicture`: `SELECT … FOR SHARE`, `lock_timeout` 3 s): a plain read
         could answer "not ready" a moment before an in-flight commit lands, while a locking read waits
         for the transaction that still holds the row and sees how it ended. `ready` at that very
         address is an acceptance that happened and goes on to step 6; any other settled state deletes
         the file; and when the row cannot be had within the timeout, or read at all, the outcome is
         unknown and the file stays. What is guaranteed: the file is never deleted while a transaction
         of this acceptance may still commit. What is not: a public file no row points to can be left
         behind (the unknown branch, a deletion that fails, a function that dies after step 4) —
         nothing collects it, and that is the accepted price of never leaving a `ready` picture
         without its file;
      6. the private file is deleted, then its pointer (`dropCandidate`, no second audit row). Step 5
         carries the pointer over on purpose, so when this fails the acceptance stands and the nightly
         cleanup — which takes rows that are no longer `failed` — deletes the file and the pointer.
      **Until step 6 is done the `ready` row still holds the pointer**: it shows no `pictureCandidate`,
      its file's route answers 404, and it can be neither accepted nor discarded again
      (`reviewableCandidate` needs a `failed` row; the owner's `dropCandidate` too); `remove` on it
      deletes that private file as well.
      It calls no model: **the month's cap does not hold it**. A person's app reads exactly what it
      reads of any picture (`toPictureStatus`: `ready` and the address). What is left if the function
      dies: after 4, a public file no row points to, at an unguessable path (known, like `keep`'s);
      after 5, a published picture whose private file waits for the cleanup.
    - **Remove** — `POST …/picture/remove`, `@Roles('admin')`, 30 an hour, no body, 200
      `{ status: 'removed', fileDeleted }`. **Any `ready` row, whichever door it came through**
      (project 010, phase 4: a picture the judge accepted wrongly has a way out that is not a
      migration; until then only a hand-accepted one could be removed) —
      `RecipeRepository.removeAcceptedPicture`'s `WHERE` is `status = 'ready'` alone. A dish with no
      published picture — `failed`, `drawing`, never drawn — is 409 `PICTURE_NOT_REMOVABLE` and nothing
      is written. One transaction reads the row under its lock, puts it `failed` with
      `provenance { reason: 'owner_removed' }` (and the `drawings` it held: a picture taken back is what a
      refinement of the judge reads; nothing else the judge's or the hand's door wrote is kept), no
      address and `lastAttemptAt = now` (a whole cool-off, so a view does not redraw it at once; the
      owner's retry still can) and writes `picture.removed { acceptedBy: 'judge' | 'owner' }` — the door
      the picture had come through, a closed word (`PICTURE_ACCEPTED_BY`, `pictureAcceptedByOf`: `owner`
      only for the hand's exact mark, `judge` for every other `ready` row), read from that locked row;
      never a path, an address or a model's words. Rows written before phase 4 carry `{}`. The removal
      publishes nothing and writes no `ready`: it is not a third door. **Then** the public file is deleted (`PictureStore.del`, which deletes nothing
      that is not a `dish-pictures/<uuid>/…jpg`; and before it, `PictureCandidatesService.unpublish` refuses
      an address under **another** recipe's folder, `isAnotherRecipesPicture` — whatever this dish's row
      says, taking it back never deletes another dish's file: the removal stands, `fileDeleted: false`).
      The row first, so no screen is ever given the address
      of a picture the row says is removed; a deletion that fails leaves the removal standing,
      `fileDeleted: false`, and a file in the public store no row points to — for the owner to delete
      by hand. `fileDeleted: true` means the store deleted the file, not that every copy is gone:
      Vercel's cache may serve it for up to a minute more, and a browser that already fetched it keeps
      its copy for the year `VercelBlobPictureStore` sets — what is immediate is that nothing hands
      the address out. A candidate's pointer the row still held is cleared with the rest and its private
      file deleted best effort; if that fails it is a private file nothing points to, the retry's own
      accepted case. It needs neither the switch nor the cap. `owner_removed` is counted on
      `/admin/pictures` (`failedByReason`) and **left out of the failed pictures' mail**: it is the
      owner's own act.
    - **What the console reads of it.** Recipe rows carry `pictureAcceptedByHand: boolean` (a `ready`
      picture accepted by hand; false on a `ready` row is the judge's — which door, not whether it can be
      removed: "Retirar" is offered on every `ready` picture; computed in SQL, the stored provenance is
      never sent), and `GET /admin/pictures` adds `acceptedByHand`, a count inside `ready`.
      `GET /admin/catalogue/recipes?picture=accepted_by_hand` lists exactly those rows — one more
      value on the picture filter (`RECIPE_PICTURE_FILTERS`), the same SQL expression as the flag.
      `GET /admin/catalogue/recipes/:id` — and only it, never a list row — adds `pictureUrl`: the
      public address of a `ready` picture, the one a person's app is given, null for any other state;
      never a candidate's, whose file has no address.
    - **The cleanup** runs inside `/cron/rewrite-steps`, after the watch and before the sweep, on
      its own 8 s (`PictureCandidatesService.clean`): it reads the rows whose candidate is no longer
      reviewable (expired, or the row is no longer `failed`) **from the database, never by listing
      the store**, deletes each file and then its pointer, and the `rewrite` `cron_run` records
      `candidatesDeleted`. So a dish with a candidate is drawn again after the first 03:30 past its
      seventh day, up to 24 h later than one without. It takes 100 rows a night, oldest first, and
      starts no deletion in its last 4 s: a backlog waits for the next night, so "7 days" is when a
      candidate stops being reviewable, not a promise of when its file is gone. **With the token
      removed while dishes hold pointers**, the cleanup still removes the pointers past review and
      deletes nothing — the dishes are not left waiting for ever, and the files stay in the private
      store with no pointer.
- `pnpm --filter api smoke:function` runs the deployed entry behind a plain Node
  server and checks it boots, denies with 404, and returns the JSON envelope for an
  unmatched route. Needs a live database, so it is not in the gate. Run it after any
  change to how the application is assembled.
- **`COOKIE_DOMAIN` is what makes sign-in work across subdomains.** The web app reads
  the session cookie itself — in `proxy.ts` and when forwarding it server-side — so a
  cookie scoped to the API's own host is invisible to it and every protected page
  redirects to sign-in. Sibling subdomains of one registrable domain are the same
  *site*, so `sameSite: 'lax'` is unchanged. Two `*.vercel.app` subdomains are **not**:
  that domain is on the Public Suffix List. Without a custom domain, leave it empty and
  proxy the API through the web app's origin instead (`apps/web/next.config.js`,
  `API_UPSTREAM_URL`); then `BETTER_AUTH_URL` and `ALLOWED_ORIGINS` are the **web**
  origin, because that is the only origin a browser ever sees.

- **Verdicts** (`0014`): `PUT /recipes/:id/verdict` with `{ verdict: 'liked' | 'disliked' | 'none' }`
  records what the session's user thinks of a recipe. Generation reads them: disliked
  slugs join the rotation's `avoidSlugs`, liked ones its `preferSlugs`, and both are named
  to the model. The verdict is on the recipe, never on the meal.
- **Allowances** (`0015`): `GET /meal-plans/allowances` says what the fortnight still allows;
  `POST /meal-plans/meals/:id/swap` replaces one meal of the active plan (library first, the
  model only when the library has nothing for the slot) and rebuilds the shopping list in the
  same transaction. A spent allowance is 429 `QUOTA_EXCEEDED`, with `retryAt` when it renews
  on a date. The redo check lives in `PlanJobController.start`, never in a route.
- **Two locks** (`0030`, `0031`): an account is usable when `email_verified` **and**
  `activated_at` are both set. `VerifiedEmailGuard` refuses on either — 409 `EMAIL_NOT_VERIFIED`
  first, because that is the half the person can fix themselves, then 409 `ACCOUNT_NOT_ACTIVATED`.
  Signing up is never refused. Opening an account is `UserController.activate({ email | id })`,
  by button from the owner's mail (a signed, expiring token, one account, nothing else) or from
  the list on `/admin`.
- **The terms' record** (`0071`, project 008 phase 7): `user.terms_version` / `terms_accepted_at`,
  written by `databaseHooks.user.create.before` in the `INSERT` that creates the account — email,
  Google and Apple alike — from `TERMS_VERSION` in `core/entities/User`. Both are Better Auth
  `additionalFields` with `input: false`: a body carrying either with a value is refused (400), on
  sign-up and on `/auth/update-user`; an empty one is dropped, and the hook's values always win. The
  version never travels from the browser. `null` means not recorded (the account predates the
  record, or was made during a rollback), never a version to fill in (no backfill). Only `/condiciones` is recorded; the privacy
  policy is informed, never accepted. **Bump rule:** any change of meaning in `terms`, in either
  dictionary, bumps `TERMS_VERSION` and `terms.updated` in the same commit; a typo fix bumps neither.
  `TermsRecord.spec.ts` pins the hook for both paths.
- **Providers** (`0058`): Google and Apple, each present only when its `GOOGLE_OAUTH_*` /
  `APPLE_OAUTH_*` set is whole (`modules/auth/services/SocialProviders.ts`); none by default.
  An account born through one has its address confirmed already, so
  `afterEmailVerification` never runs for it — `onAccountCreated`, on Better Auth's
  `user.create.after`, is what turns the second lock or tells the owner. **Linking is on only
  while a provider is, never into an account that has not confirmed its address, and no
  provider is ever listed as trusted**: loosen any of the three and signing up with a
  stranger's address becomes a way into their account. `GET /settings/sign-in-providers` is
  `@Public()` and is how the web app knows which buttons to draw. Apple's client secret is
  signed at boot; never add a variable for a pasted one.
- **The switches** (`0031` amended, `0042`): `app_settings` holds them, one row each, and
  **`core/domain/Flag` is the only place that says which exist**. Never invent a key at a call
  site and never rename one — the row *is* the state, so a renamed key reads as a switch nobody
  ever threw and silently restores the fallback somebody moved away from. Every flag declares
  which way it fails when no row exists (a product question, different per flag) and who may
  read it. `GET /settings` (`@AllowUnverified()`) carries only the `signed-in` ones; `/admin`
  gets all of them. `automatic_activation` decides what confirming an address does, read in
  Better Auth's `emailVerification.afterEmailVerification` at the moment of the click and never
  remembered from sign-up; automatic is its fallback, because a missing row must never start
  queueing people.
- **Events** (`0043`): `modules/events`, mirroring `vacations`. A day named by the person
  and the one to three days before it that eat for it — per macro *up / down / same*, never an
  amount; `LOAD_STEP` in `core/domain/Event` is the size. Read at generation only:
  `PlanGeneration.loadsFor` turns event dates into a `dayTargets` map for the scheduler, holds
  every loaded day to the profile's bounds via `targetViolations`, and records a refused load
  as an advisory. The plan day stores `targets` and `loadedFor` — history, not a lookup. No
  refusal keyed on a condition, per `0008`.
- **Tiers** (`0042`): `user.tier` is `free` or `premium`, moved by the owner from `/admin`.
  What an account may *actually* spend is `PlanController.tierOf` — **the `premium` flag first,
  then the column** — so turning the tier off is one click rather than a migration over
  everybody ever granted it. Never read a tier from the caller; it decides whether a model call
  may be spent. `allowancesFor` falls back to free for anything it does not recognise, because
  the failure that costs money is the one that grants too much.
- **Owner notice** (`0029`, amended): sent from `afterEmailVerification` when activation is
  manual — the only moment an account joins the queue. It never throws (a confirmation must not
  fail because a mailbox did). It says only that an account is waiting: **no address, no name, no
  id, no activation link**, because the mail outlives everything (no deletion deadline in the
  owner's inbox). It links to the console's `/admin/cuentas?activated=no`, where the owner sees who
  it is and activates. `GET /admin/activate` stays for mails already sent, until their tokens
  expire; no new mail issues one. Its log line carries no user id.
- **Admin** (`0028`, `0068`): the console's routes, all `@Roles('admin')` on the controller
  class so a new route is guarded by default — a non-admin and no session get 404, before any
  query parameter is read (guards run before pipes). Nothing selected is a person's own — no
  plan, no meal, no profile, no health value, no allergy; the catalogue's dishes and
  ingredients are shared reference data, unattributed (no `created_by`, no user id). Account
  rows carry milestones only (onboarded, plans, last activity, professional).
  The addressed generation log never carries a person's own rejection reasons (`allergen`,
  `unwanted`) or an invalid plan's figures; totals over everybody may (`/generations/stats`).
  Query conventions, for every admin read:
  - a Zod schema in `core/entities` (`AdminQuery`, `Period`), bound to one parameter with
    `ZodQuery` in the admin module (never `@UsePipes`); anything outside it is
    `422 INVALID_INPUT`, unknown keys are dropped, a repeated parameter is refused;
  - periods are `7 | 30 | 90` (30 by default), compared with the period before of the same
    length, grouped by **Madrid calendar day** (`core/domain/Period`; a quiet day is 0, never
    missing), weeks by their Madrid Monday;
  - sorts come from an allow-list mapped to columns (never a column name from the URL), nulls
    last in both directions, ties broken by id; free text is `q`, escaped as a literal
    `contains` (`repositories/Search`) and bound; `offset` / `size` (1–100) are strict;
  - in a correlated sub-select, name the outer row explicitly (`qualified`, `"user"."id"`):
    drizzle drops the table name on single-table columns, and a spec renders the real SQL.
- **The admin trail** (`0071`): **every admin mutation writes its `audit_logs` row in the
  same transaction as the action itself** — activating an account (console, the mail link
  and the automatic activation alike), moving a tier, granting or revoking a professional,
  marking or reopening a feedback message, throwing a switch, asking for or cancelling the
  removal of a lost second factor (PLAN 011 phase 4), and the owner's test push
  (which has no database write of its own to share a transaction with, so its row is
  written right after the send resolves — the one documented exception). The pattern is
  `core/repositories/*`'s own: each mutating repository method takes an optional `record`
  callback (`RecordAudit`, `core/repositories/Audit`) and calls it with its own `tx`, after
  checking the row it changed exists — exactly `CareRepository.logAccess`'s shape (`0059`),
  reused rather than reinvented. `actorId` is always the session's user
  (`@CurrentUser()`), or `null` for the mail link and the automatic activation; **never**
  a request body, and `ipHash` stays empty. A person acted on is `subjectUserId`, named
  from the changing `UPDATE`'s own `RETURNING` — never the id the caller matched by, which
  is absent when the match was by email — and is a foreign key `set null` on delete: the
  trail outlives the account without naming it. What is not a person (a setting's key, a
  feedback message's id) is `entityId`, plain text. `GET /admin/audit` reads it back,
  filtered by a closed action list, paged, newest first — `{ at, action, actor, subject,
  detail }`, `detail` being the closed metadata and nothing else. A mutation that changes
  nothing writes no row either: activating an already-active account, or moving a tier to
  the one it already holds, still answers as if it had, because a repeated click must not
  fail, but there is nothing there worth a line in the trail.
  - **`UserController.activate`, `UserController.setTier` and `SettingsController.setFlag`
    require their audit argument** — there is no optional-audit shortcut left to reach for
    by accident. `apps/api/src` always has a real one to give, because a route always has a
    session or a signed link. `core/entities/Audit` exports `UNAUDITED`, a sentinel a suite
    or a probe passes to skip the row when it moves state to set a scenario up rather than
    to exercise the console. **`UNAUDITED` must never appear in `apps/api/src`** — a
    grep-style spec enforces it mechanically
    (`apps/api/src/modules/admin/audit-boundary.spec.ts`), the same pattern as the health-data
    boundary (`health-boundary.spec.ts`). `ProfessionalController.grant`'s audit actor
    defaults to `grantedBy` — every route's case — so it stays untouched; only a caller with
    no session to name, such as `local-probe`'s `account.mjs`, passes `UNAUDITED` there to
    keep its own professional from being recorded as its own grantor while the stored
    `grantedBy` column still names it.
- **The console's watching pages** (`0071`, phase 3): read-only, `@Roles('admin')`, counts and
  versions only (`0028`); every response type is exported from `core/controllers/Admin` for the web.
  - **"Active"** is `ACTIVE_EVENTS` (`core/entities/Analytics`): `session_started` or `app_used`.
    `AdminSeriesRepository.activePeople*`, `AnalyticsRepository.activitySince`'s people and
    `UserRepository`'s `lastActiveAt` all read that one list; nothing else counts as activity
    (a swap request no longer moves "last active"). Before 2026-09-29 it was sign-ins only.
  - **`GET /admin/catalogue/quality?period=`** (`AdminQualityController`) judges every recipe with
    the app's own helpers (`composePerServing`, `isOversized`, `servingCap`, `fitSlots`,
    `stepsVersionAttempts`; `core/domain/CatalogueQuality`), read in the act (about 0.45 MB a call
    on the dev library — the nightly snapshot is not needed). "Should be zero": `overBound`,
    `uncosted`, `unserved`, `refusalLimit`, and `mealsOutsideServingBounds` (a count over `meals`,
    no row returned). "To look at": `overCapBySource`, `oversizedRejections` per Madrid day,
    `picturesFailed`. `sweep`: `current + pending + givenUp = recipes`. The API supplies
    `STEPS_VERSION`; `core` cannot import it.
  - **`GET /admin/catalogue/recipes?check=`** (`over_bound`, `uncosted`, `unserved`, `refusal_limit`,
    `over_cap`) narrows Recetas to exactly the recipes a quality count is made of, through the same
    `judged()` read, so a count and the table it links to cannot disagree.
  - **`GET /admin/consents`** — for the five versioned consents (profile, health, care, professional, terms), the version in force and how many
    accounts hold it, an older one, or (professional's agreement, terms of use) none yet. **`GET /admin/notifications?period=`**
    — push subscriptions and people, reminders per Madrid week and channel (one `notifications` row
    per channel a reminder left by, since phase 1), and distinct people who checked in within 3 days of
    one. **`GET /admin/system?period=`** — commit (only if it is a hash), prompt/steps/consent/terms versions,
    the caps, each integration as a boolean, each cron's last `cron_run` (`stale` past 26 h or never
    recorded) and mail sent/failed per template and Madrid day. `systemSnapshot(env, …)`
    (`admin/services/SystemSnapshot.ts`) is the only place the environment is read for it, and
    `SystemSnapshot.spec.ts` plus `AdminSystemController.test.ts` prove no configuration value reaches the
    answer. Mail and push "configured" come from `EmailService.configured` and `PushService.configured`.
- **Quality, retention and the sweep's history** (`0071`, phase 5): read-only, `@Roles('admin')` on `AdminController`,
  counts of people or plans and never a row of either; types exported from `core/controllers/Admin`.
  - **`GET /admin/plans/quality?period=`** (`AdminPlanQualityController`) sums `meal_plans.generation_metadata -> 'quality'`
    over plans made in the period, reading that key and `created_at` only: no `user_id`, no plan id, no group by
    a day or a person. Plans without `quality` (before 2026-09-29) are counted in `withoutQuality`, never scored.
    Below `MIN_PLANS_FOR_SHARES` (10) scored plans `fewData` is true and the answer is exactly
    `dataStart, fewData, minPlans, period, plans, window, withoutQuality` (every other key absent, not null; the type is
    a union narrowed on `fewData`). The period ends at today's Madrid midnight (`qualityWindow`), never `now`, so a plan
    made today is in no figure until tomorrow. The rule of 10 also applies to each disjoint stretch nested periods
    expose, `[−7,0)`, `[−30,−7)`, `[−90,−30)` days (scalar `count(*)` subselects in the same statement): `fewData`
    whenever a stretch inside the requested period has plans but fewer than 10, so two periods cannot be subtracted
    into a handful of plans (`0028`).
    `dataStart` is the Madrid day of the first plan carrying `quality`. The energy floor is two sums
    (`daysFloorNarrowed`, `daysFloorNarrowedOutOfBand`, `planQuality`): every sum is guarded by the JSON type, so plans
    stored before a key existed add 0, and `floor.base` holds the denominators of only the plans that carry the floor
    counts (`floor.since` says from when). `planQuality` needs `minimumKcal` again as input.
  - **`GET /admin/retention`** (`AdminRetentionController`, no query parameter: any key is a 422; monthly cohorts only,
    weekly cells could be subtracted from a month's): cohorts of sign-ups (last 6 months, Madrid days) and, for weeks 1, 2 and 4 after each person's own sign-up day, distinct people active in
    that week out of those whose week is already over (`eligible`). Two readings: `didSomething` (a `meal_completions`,
    `meal_swaps`, completed `check_ins` or `progress_entries` row, from day one) and `usedTheApp` (`ACTIVE_EVENTS`; only
    people who signed up on or after `eventsSince`, 2026-09-29). `enough` marks a cell of 20 or more eligible people
    (`MIN_COHORT_FOR_SHARES`); below it `active` is null (`size` and `eligible` stay), since with them it would name one person. The statement returns counts grouped by cohort and week: no id.
  - The rewrite sweep's history is `sweepHistory` inside `GET /admin/catalogue/quality` (one page, one route): per Madrid
    day, `runs`, `rewritten`, `skipped`, `unreached`, `heldByCap`, `pending` (the day's last run, null with none) from
    `cron_run` for `job: 'rewrite'`, and `calls` / `costUsd` from the `ai_call`s filed under `feature: 'rewrite'`.
- **The text-AI cap** (`0071`, phase 4): `AI_TEXT_MONTHLY_CAP_USD`, optional and positive; unset means no
  gauge, no warning and no held-back sweep. It shows and warns and never stops a plan; the wall that stops
  spending is the OpenRouter key's own limit (`0064`), and the cap is never set above it.
  - `AdminTextSpend` (`core/controllers/Admin`) is the one reader of the UTC month (`monthStart`, as the
    pictures' cap): the sum of `costUsd`, the calls with no cost (`uncostedCalls`, so the sum is a floor)
    and spend per feature (`plan`, `swap`, `rewrite`, and `unknown` for events before `feature` existed).
  - `GET /admin/ai` always carries `month`; `capUsd`, `share` and `sweepPaused` are inside it **only with
    the cap set** (absent keys, not null). `GET /admin/summary` puts `tiles.textAi.month` (cap, month
    spend, `monthStart`, `share`, `sweepPaused`) there under the same rule, and reads nothing extra without it.
  - `RecipeRewriter.rewriteOutdated` reads the month's spend only when the cap is set, and from
    80 % of it (`TEXT_SWEEP_STOP_SHARE`) claims nothing and returns `heldBy: 'cap'`; `/cron/rewrite-steps`
    records that `cron_run` with `skipped: 'cap'` (a string in the place of the recipes-skipped count).
    A plan or a swap is never held back here.
- **Professionals** (`0059`): an account is a professional because a `professionals` row
  says so, and only `POST /admin/accounts/:id/professional` (the collegiate number, nothing
  else) writes one; `DELETE` of the same takes it back and `GET /admin/professionals` lists
  them with link *counts*, never a client. `user.role` is untouched. `ProfessionalGuard`
  (`shared/guards`) is the door to the workspace — the `professional` switch on **and** the
  row, both read per request, anything else 404 — and it is **not global**: every workspace
  controller carries `@UseGuards(ProfessionalGuard)` on its class, and never
  `@RequiresOnboarding()` (its 409 would answer a non-professional before the guard's 404).
  Only an account with a confirmed address can be granted. A first grant mails the professional
  (`professional-granted`, `docs/legal/textos/06` § B); a re-grant does not.
- **The professional's agreement** (`docs/legal/textos/01`, `04`): `PROFESSIONAL_AGREEMENT_VERSION`
  in `core/entities/Professional`, stored as `professionals.agreementVersion` / `agreementAcceptedAt`,
  null on a new grant. `POST /care/practice/agreement { version }` (`z.literal`) accepts it.
  `ProfessionalGuard` refuses every route without the current version, like a practice not paid for,
  except those marked `@BeforePractice()` (the workspace's page and accepting); `CareRepository`'s
  `practising` join and `CareController.practises` are the second line. Practice checkout is a 404
  until it is accepted (`BillingService.agreed`). `GET /care/practice` says `agreementRequired`.
- **The link** (`0059`): `modules/care`. `POST /care/invitations` is the professional's
  (`CareInvitationsController`, `ProfessionalGuard` on the class); reading, accepting and
  declining an invitation are the client's (`CareAnswersController`, `ProfessionalSwitchGuard`
  on the class, so the switch is asked before any pipe); `GET /care/links/me` and
  `DELETE /care/links/:linkId` are `CareLinksController`, with no guard — a client sees and
  ends their own link whatever the switch says (a link stays revocable), and ending is also
  the professional's, which needs the switch and the grant, checked in `CareController.end`.
  Every other care route 404s while the `professional` switch is off. An invitation stores only the SHA-256 of its token; the token travels in one
  mail, queued with `BackgroundTaskService` so the answer is the same whether or not the
  address has an account, and nothing reads `user` by that address. It is read and answered
  only by a confirmed account whose address is the invited one — the session's address is the
  ownership boundary there — and every other case is one 404. `shared/logging` rewrites the
  token out of the logged URL and `referer`. Every expired invitation is deleted on the daily `/cron/reminders` run (`ExpiredInvitationsService`), so an address nobody answered is gone by the day after its 14 days, as the mail promises — which holds only while that cron runs daily. One open link per client is a partial unique
  index; accepting into it is 409 `CARE_LINK_EXISTS`, naming the link in the way.
- **Delegated reading** (`0059`): `GET /care/clients` and `GET /care/clients/:linkId` are
  `CareClientsController` (`ProfessionalGuard` on the class). A professional route takes a
  link id and hands it to a core method built on `CareController.withClient` — the only path
  from a professional's session to a client's id, and the one that writes the client's
  `care_access_log` row; a professional route whose service reaches any other core method
  with client data is a P0. The client page writes one `overview` row, plus one `health` row
  only when the link shares health, and has no `health` key otherwise; the list writes one
  `list` row per active client, in the same snapshot it reads their stages from.
  `GET /care/access-log` is the client's own trail, on `CareLinksController`: no switch, like
  their link, 100 rows a page (`?before=` the previous page's `next`).
  Every row carries the `linkId` it went through. `PATCH /care/links/me { sharesHealth }` is the
  client's own switch for the health line, no switch and no end of the link (`docs/legal/analisis.md`
  P0-1): each change writes a `health` row, `granted` or `withdrawn`, in the same transaction, and
  `withClient` reads the link afresh, so off closes the health read on the next request. The trail
  reader skips an action or kind it does not know, so a value added later survives a rollback.
- **Review before publishing** (`0060`): with the `professional` switch on, a client whose
  `active` link has `reviewBeforePublish` (the column's default) and whose professional's grant
  stands gets each new plan as `pending_review`; the active plan keeps running until the
  professional publishes (`POST /care/clients/:linkId/plan/publish`, one transaction). Every other
  case is today's path. **Every client read hides a pending plan** — `findActive` by construction,
  the rest through `PlanRepository`'s `visible()` (by id, history, the chain, a meal, a meal's
  status, a swap, a shopping item, a check-in) — and only the professional's reads, through
  `withClient`, pass `withPending`. A new plan read must do the same. The client's job answers
  `planId: null, pendingReview: true` for a plan under review. Any new generation replaces a
  pending plan (deleted, its job kept with no plan) and carries its redo as `replacedRedos`, so a
  regeneration costs what the client's own would — **but only while that plan can still be
  published** (active link, standing grant, switch on): a plan stranded by an ended, paused or
  revoked link costs the client nothing, and the client's allowance screen never takes `kind` or
  `nextAt` from it. The professional generates only for a client with no active plan, or to
  regenerate a pending plan (which lands pending again, review toggle or not) — anything else is a
  404 — and a professional's job that finds the link unable to publish when it saves, with an
  active plan in place, fails rather than replace the fortnight under way. The professional's generate and swap run in this
  app (the model is here) but are reached only through `CareController.generatePlan` /
  `swapPendingMeal`, which hand the runner and the swap service the client's id and the write's
  `record`; the job's trail row goes in the claim's transaction, the swap's in the swap's.
  `PATCH /care/clients/:linkId` toggles review; turning it off publishes nothing.
- **Country** (`0034`): `loadCatalogue(locale, country)` drops ingredients sold only
  elsewhere — `ingredients.countries`, where empty means everywhere. Null country filters
  nothing, which is what an account that never said where it is had before the column.
  `COUNTRIES` in `core/entities/Profile` is the list onboarding offers, and it is short
  because it is what the catalogue can serve.
- **Feedback** (`0037`): `POST /feedback` is signed-in and rate limited; `/admin/feedback` is
  the inbox, paged, with a reversible `handled` mark. It is the one admin read that carries a
  person's own words and address — allowed because the message was written to be read and
  answered. Nothing summarises it and it never reaches a model.
- **AI usage** (`0035`, `0071`): every provider request records an `ai_call` event from
  `StructuredAiClient` — the only place a request leaves the building, recorded with no user —
  carrying `feature: 'plan' | 'swap' | 'rewrite'`, which `AiRequest` requires of every caller
  (`PoolBuilder.build` takes it from the plan or the swap; `RecipeRewriter` sets `rewrite`).
  Events from before `0071` have none. `/admin/ai` sums them over a period: calls, failures,
  tokens, latency and `costUsd`, per day and per model. The free-Gemini daily quota readouts are gone (`0068`):
  paid OpenRouter has no daily allowance.
- **Analytics** (`0033`): the funnel on `/admin` is counted from state — `AdminRepository.funnel()`
  — never from events, so it is correct retroactively and cannot disagree with the rows it
  counts. `analytics_events` holds only what leaves no row, in two closed halves (`0071`):
  `PRODUCT_EVENTS` — `session_started`, `app_used`, `swap_requested`, the only ones Embudo
  charts — and `SYSTEM_EVENTS` — `ai_call`, `cron_run` (`CronController`, through
  `CronRunService`, after a run finished: `{ job, …its counts }`), `mail_sent` (`EmailService.send`,
  every mail handed to the provider: `{ kind, ok }`, the template, never the recipient) and
  `owner_alerted` — which never carry a user. `app_used` is written by the
  `session.update.after` hook, which runs when `SessionGuard`'s `getSession` renews a session
  (once a day of use, `updateAge`; `modules/auth/SessionRenewal.spec.ts` proves it), at most one a
  Madrid day per person: `AnalyticsController.recordUse` checks and writes under an advisory lock,
  because a server render renews one session from several parallel requests. No HTTP route
  writes an event, an event never carries content, and recording never throws.
- **The owner's alerts** (`0071`, `modules/owner-alerts`): `OwnerAlertsService` mails `OWNER_EMAIL`
  unasked, silent without it or without SMTP, never throwing into its caller.
  - The **digest** is the first statement of `/cron/reminders`, before the reminders switch:
    one a day (`owner_alerted { kind: 'digest' }`, claimed per Madrid day) and only when an
    item is non-zero or a spend is at 80 % of its cap. Its numbers come from the console's own
    readers through `AdminAlertController` (quality helpers, `cronStates`, the spend gauges).
  - **The two daily crons watch each other**, with no third cron and no external service: the
    digest reports the rewrite cron when silent > 26 h, and `/cron/rewrite-steps` (03:30 UTC)
    first calls `OwnerAlertsService.watchReminders`, which mails at once when the reminders
    cron's last `cron_run` is older than 26 h or absent (`AdminAlertController.silentCrons`, the
    console's own `cronStates` rule), claimed as `owner_alerted { kind: 'cron-silent-reminders' }`
    for 20 h (one a day, even when the cron fires a little early). It runs before the sweep, so a sweep held by the cap, empty or throwing still checks;
    it never throws and the route keeps its `.catch`. Numbers and a link to `/admin/ajustes/sistema` only.
  - **Three failed generations in a row** are checked in `PlanJobRunner.run` after the row says
    how it ended; **spend at 80 % / 100 %** of the text or picture cap is checked there too, at
    the end of the rewrite sweep and in the digest — per job, not per model call, which would put
    a query on every call. A spend threshold is once per UTC month, the streak once per 6 h.
  - **Dish pictures that failed** (project 009, `0072`): `OwnerAlertsService.pictureFailures` mails
    the dishes whose drawing failed — not the ones given back — counted by closed `PictureReason`
    since the last mail of its kind (`AdminAlertController.pictureFailures`; a day back without one),
    with one link to `/admin/catalogo?picture=failed`. Claimed as
    `owner_alerted { kind: 'picture-failed' }` for one hour, and the claim is dated at the instant the
    count ran up to, so what fails inside the hour is in the next mail and not lost. A drawing the
    provider turned away and gave back — `payment_refused` (a 402, a spent key) or `model_refused`
    (a rate limit, the only other refusal that gives a claim back; owner, 2026-09-30) — mails under
    its own claim, `picture-payment-refused`, once in 6 h, by reason; one given back by the cap mails
    nothing here. It is called when a drawing ends, however it ended, and
    by both crons. **The call hangs from `DishPictureService.schedule(claim, onEnd)` and is passed in
    by the two callers outside `modules/ai`** (`MealPlansService.meal`, `AdminCatalogueService.retryPicture`):
    the AI module never imports `owner-alerts` or `core/controllers/Admin` (`health-boundary.spec.ts`),
    and what `onEnd` throws is dropped. The mail names no dish, no id and nothing a model wrote; its
    `EmailKind` is `owner-picture-alert`.
  - The right to send is *claimed* first (`claimOwnerAlert`: advisory lock + check + insert), so
    two jobs failing together send one mail; a claim is given back when the send reports failure (the transport times out in
    seconds, well inside the function's 300 s).
  - **The mails carry numbers, closed-set codes and console links, never an address or anybody's
    text.** `OwnerDigest` has no free-text field, codes and template labels are reduced to
    `[A-Z_]` / `[a-z-]` in core, and `OwnerMail.spec.ts` refuses an `@`, an id or a sentinel.
    A new item is a number or a closed label, or it does not go in.
- **Plan quality** (`0071`): each new plan's `generation_metadata.quality` is `planQuality`
  (`core/domain/PlanValidation`) over the delivered plan's violations — counts only, never a
  target, a figure or an event's name. The generation log (`AdminGenerationsRepository`)
  selects only `planOf`'s keys from `generation_metadata` in SQL, so `quality` and the
  `advisories` sentences never leave the database on that path.
- **Vacations** (`0032`): `POST /vacations` moves every plan day at or after the trip forward
  by its length, in one transaction, so those dates hold no plan day at all. Nothing else was
  taught about holidays — skipping, adherence and the check-in mail all follow the dates.
  Cancelling gives back only the days not yet spent. Refused for a trip in the past, one that
  overlaps another, or one longer than ninety days.
- **Reminders** (`0027`): `/cron/reminders`, guarded by `CRON_SECRET` like the other two
  sweeps. `CheckInReminderService` sends one mail per fortnight to accounts whose plan reached
  its last day, and writes the `notifications` rows only after a channel accepted it — one row
  per channel that carried it (`0071`), and any row is what stops a second one. Never put plan or health content in a reminder; it is read on
  a lock screen. `PATCH /notifications/settings` is the switch. Vercel runs it daily at 08:00 UTC
  and `/cron/rewrite-steps` at 03:30 UTC (`apps/api/vercel.json` `crons`); each watches the
  other and tells the owner when it has been silent for more than 26 h. `/cron/sweep-verifications`
  (08:05) and `/cron/two-factor-removals` (08:10, PLAN 011 phase 4) are in the same schedule,
  and the console's `cronStates` and the digest watch all four.
- **Error reporting** (`0024`): `ErrorReporter` in `shared/observability` — off without
  `SENTRY_DSN`. The exception filter reports what it turns into a 5xx and `PlanJobRunner`
  reports a failed generation. A report carries the error (message cut at `\nparams:`, secrets
  redacted by value), its stack with source-code lines, the `where` tag (the route *pattern*),
  the release, the environment and the server's own runtime context. Nothing else: `beforeSend`
  deletes request, user, response context, breadcrumbs, extra and `transaction` (the raw path).
  Never add a body, a header or an id to a report. The one deliberate exception: the Billing
  service's error messages that carry a Stripe customer or subscription id (two ids, no health
  data). The SDK's own collection is explicitly off too: Sentry 11 collects by default
  (bodies, headers, cookies, query strings, user, DB query data, queue arguments, gen-AI text,
  stack-frame variables), so `DATA_COLLECTION` in `ErrorReporter.ts` turns every category off
  by name, as a literal that must satisfy the SDK's `ResolvedDataCollection` and so stops the
  type-check when a later SDK adds a field. Traces are off by **omitting** `tracesSampleRate`
  and `tracesSampler`, never by a zero: any rate loads the tracing integrations, and a
  `sentry-trace` header from a caller then sends span envelopes that skip `beforeSend`.
  `SENTRY_TRACES_SAMPLE_RATE` is deleted from the environment before `init`, trace headers
  are not propagated, logs and metrics are dropped, and the server name is not sent. The
  real-SDK spec (`ErrorReporter.sdk.spec.ts`) proves it.
- **Weights, not filters** (`0026`): `isPreferredDish` (core `domain/Variety`) decides what the
  library offers first — a liked dish, a chosen cuisine, a liked food. `rotatePool` partitions
  on it and `pickReplacement` ranks on it; neither ever removes a dish, so a preference here
  cannot leave a slot unfillable. Exclusions are `0023`'s job and stay separate.
- **Every answer changes something** (`0025`): before adding an onboarding field, decide which
  it is — a rule in code or a line in the prompt — and say so where it is read. The cooking-time
  limit is a rule (`withinTime`, applied in `PoolBuilder` and in reuse); the day
  (`dayShapeOf`) is a prompt line. A field that is neither does not get asked.
- **Preferences are enforced** (`0023`): `GenerationContext.preferences` carries the ingredient ids
  a way of eating or a dislike rules out, resolved once in `RecipeController.generationContext`.
  `PoolBuilder` filters the catalogue it shows the model and drops a dish that uses one anyway;
  reuse filters the library. An unresolved dislike is dropped, never sent to the model. Beside the safety profile,
  never inside it: a preference must never be reported as an allergy violation.
- **Swap axes** (`0022`): the swap body may name `axis` — `quicker`, `no_cooking`, `more_protein` —
  and `axisFilter` (core) is applied to the library pick and to the model's dishes alike; the
  model is told the wish in the prompt (`2.7.0`) but never trusted to honour it.
- **The past is read-only** (`0021`): `GET /meal-plans` lists every plan with `replaced` (the next
  lived plan began before it ended); `GET /meal-plans/:id` serves any plan of theirs; a meal's
  detail carries `planId` and `planStatus`. A status change or a swap on a meal of a plan that is
  not active is a 409 conflict, never silently applied.
- **Eaten or skipped**: `PATCH /meal-plans/meals/:id/status` with `{ status }` marks a meal;
  `meal_completions` keeps the day it was said. `planned` takes it back.
- **Activation** (`0017`): `VerifiedEmailGuard` is global; a signed-in account with
  `email_verified = false` gets 409 `EMAIL_UNVERIFIED` on every route not marked `@Public()`
  or `@AllowUnverified()`. Keep the allow-list to what an unactivated account needs: who am
  I, and leave.
- **A link into the web app names its language**: the web app serves Spanish at `/` and
  every other language behind its own segment (`/en/…`), so `APP_URL` plus a path is not an
  address — the same path is a different page in each language. `webUrl` (core
  `domain/WebUrl`) is the only place one is built: it takes the origin, a path and a locale,
  it is idempotent (a path that already names a language is left alone), and an unknown
  locale is Spanish. The locale is the **recipient's**, resolved by `recipientLocale`
  (`modules/email`) — the stored profile first, the request's `Accept-Language` only for the
  confirmation at sign-up, when no profile exists yet. Copy and link always agree, because
  they are one message. Never concatenate `APP_URL` and a path by hand.
- **Mail** (`0019`): `modules/email` is the one door mail leaves through — `EmailService.send`
  over SMTP (nodemailer), unconfigured without `SMTP_HOST` and then returning `false`. The only
  message today is the password-reset link, composed in `modules/email/templates` in the
  request's language and sent from Better Auth's hook (`modules/auth/PasswordResetMail.ts`),
  which never throws: the hook runs only for existing accounts, so an escaping error would tell
  a caller which addresses are registered. Verification links are logged, not mailed (`0017`).
  Addresses never reach the log.
- **Push** (`0054`): `modules/notifications` `PushService` is the one door a phone notification
  leaves through: Web Push signed with `VAPID_*`, and unconfigured without all three. Browsers
  subscribe at `PUT /notifications/push` and leave at `DELETE`. An endpoint is accepted only on a
  push service that browsers use (`pushSubscriptionSchema`), because the server POSTs to what
  is stored. A 404 or 410 from the push service drops the row. There are two senders. The
  check-in sweep sends nothing while the `checkInReminders` flag is off. The owner's
  `POST /admin/push-test` reaches only the caller's own browsers and records nothing. A
  message never carries health data.
- **Progress** (`0020`): `GET /progress/summary` — the weight line and one entry per fortnight
  lived, with meal marks counted only for days that have arrived and the check-in that closed
  it. Reads only; nothing is collected for it. `GET`/`POST /progress/weight` are the dashboard's.
- **Check-in** (`0018`): `GET /check-ins/status`, `POST /check-ins` — once per plan, from its last
  day. Weight → progress log (targets follow the latest weight); portions → a 5 % calorie nudge
  through the target override; the closed answers → the next plan's prompt. The comment is stored
  and shown, never sent to a model. Never a restriction.
- **Profile consent** (RGPD art. 9.2.a, `docs/legal/textos/05-consentimientos-cliente.md` § A):
  `PROFILE_CONSENT_VERSION` in `core/entities/Profile`, one row in `profile_data_consents`.
  `GET` / `PUT` / `DELETE /profile/consent`; `PUT` takes `{ version }` (`z.literal`). Without the
  current version, `requireProfileConsent` refuses with 409 `PROFILE_CONSENT_REQUIRED` every write
  of allergies, intolerances, way of eating, goal, height or weight (the onboarding steps `goal`,
  `body-activity`, `allergies`, the profile routes, a logged or check-in weight) and every
  generation, swap and event rebuild — the client's consent, also when their professional starts it. `RecipeController.generationContext` asks it *after* its reads, so a withdrawal cannot slip between the check and an emptied safety profile; the event rebuild also refuses while onboarding is incomplete.
  `OnboardingView.profileConsentRequired` is how the web knows to ask, before `/inicio` for an
  account that finished onboarding before the consent existed. Withdrawing deletes that data in
  one transaction and reopens those steps.
- **Minimum age** (owner, 2026-09-25): 18, `AGE_YEARS.min`. A birth date under it is 422
  `UNDER_MINIMUM_AGE`, from the onboarding step and the profile route alike (`assertOldEnough`).

## Commands

| Command | What it does |
| --- | --- |
| `pnpm --filter api dev` | Watch mode on :3001 |
| `pnpm --filter api build` | `nest build` → `dist/`, then `preflight` |
| `pnpm --filter api preflight` | Load the deployed entry under the function runtime's module rule and validate the environment as boot would (no database needed) |
| `pnpm --filter api test` | Unit specs (no database needed) |
| `pnpm --filter api test:e2e` | e2e specs — **needs a real database**: locally `NUTRIA_LOCAL_PG=1` against `pnpm db:local`, never Neon; see `test/README.md` |
| `pnpm --filter api ts:check` | Type-check, specs included |
| `pnpm --filter api smoke:function` | Serve the deployed entry locally — **needs a real database** |
| `NUTRIA_LOCAL_PG=1 node apps/api/scripts/evaluate-plans.mjs` | From the repository root, after a build, against `pnpm db:local` (never Neon): schedule and validate a fortnight for five fixed profiles over the **real dish library** — days inside 5 % on all four macros, every violation, any allergen on a plate (exit 2). `--json <file>` to keep a run, `--compare <file>` to set one against it. Refuses production, reads inside one read-only transaction, calls no model |
| `node --env-file-if-exists=.env scripts/catalogue-by-meal.mjs` | From `apps/api`, after a build of core, database and api: per meal, for an omnivore and a vegan, the catalogue rows the pool prompt shows — on 3.4.0 (every list empty), after the meal lists (`0062`), and after lunch's and dinner's second cut (`0063`, the same `mealCatalogue` the pool builder calls) — their estimated tokens (6 per row), the characters of each meal's standard prompt before and after with the ratio (PRD 005 § 2 wants lunch ≤ 55%), the library dishes still servable there against `DISHES_NEEDED_PER_SLOT`, and the ingredients that take the most dishes away. `--month 1-12` (default: this month) and `--seed <text>` fix the season and the sample; `--json <file>` keeps a run. Refuses production, reads inside one read-only transaction, calls no model |
| `node --env-file-if-exists=.env scripts/bench-models.mjs --models <id,…> --out <dir>` | From `apps/api`, after a build of core, database and api: **calls real models** through the gateway named by `AI_BASE_URL`. Builds the real pool prompt for fixed briefs (omnivore and vegan × breakfast, lunch, dinner, afternoon snack; `--briefs omnivoro:lunch,…` to choose; 2,400 kcal day, `--dishes` a request, default 6) over the dev catalogue cut as `PoolBuilder` cuts it, sends each as non-strict `json_schema`, and scores the answers — `generatedDishSchema`, unknown and not-shown slugs, `fitSlots` at the asked meal, `methodMentions`, per-serving macros against the brief — with status, seconds, tokens (cached, reasoning) and the `x-omniroute-*` headers. **Refuses any model not free** (only `…:free` or `groq/…`, never Gemini, never an OpenRouter router `openrouter/…`) **unless named in `--allow-paid id,…`** — each `vendor/model`, never `openrouter/…`, and only when `AI_BASE_URL` is on `https://openrouter.ai`, the one host bound by the block — and then every request carries the no-training `provider` block (`zdr`, `data_collection: 'deny'`) and records the answering provider and cost; `--reasoning-effort none|minimal|low|medium|high`, prints the call count and calls nothing without `--yes`, paces `groq/` models `--groq-gap` s apart (65) and others `--gap` (20), never retries. `--list` lists the gateway's models (free). `--key-env NAME` names the key's variable (default by host: `OPENROUTER_API_KEY` when `AI_BASE_URL` is on openrouter.ai, `OMNIROUTE_API_KEY` otherwise); the key is never printed. Raw answers, prompts and `summary.md` go to `--out` — outside the repo. Refuses production, reads inside one read-only transaction |
| `node --env-file-if-exists=.env scripts/clean-stored-steps.mjs [--yes] [--batch 200] [--json out.json]` | From `apps/api`, after a build of core, database and api: applies `cleanSteps` (`core/domain/Method/StepCleanup.ts`, PR #118) — the same clean-up a newly generated dish now gets — to every recipe **already stored**, whatever its `source` or `stepsVersion`. Its `ingredientNames` map is each recipe's **own** ingredients read against the current catalogue, never the whole catalogue (a bare common word that happens to be some other ingredient's slug would otherwise be rewritten too). Default is a dry run: counts recipes scanned and changed, steps changed by kind (backtick, placeholder word, slug→name, minutes filled, English cue dropped), a few before/after examples, and the recipes whose *method* itself reads as English — listed for the owner, never edited or deleted. `--yes` writes `instructions` back, batched (`--batch`, default 200), one transaction per batch, touching nothing else on the row (not `stepsVersion`, not ingredients, not names). Idempotent. Refuses to write against production unless it can prove this is not production, or `--i-know-this-is-production` is passed alongside `--yes` — run in production only by the owner, after reading the dry run |

## Traps

- **`@UsePipes` binds to every parameter, not just the body.** A handler-level
  `@UsePipes(new ZodValidationPipe(bodySchema))` also runs that schema over
  `@CurrentUser()`, which has none of the body's fields — so a valid request fails with a
  confusing validation error naming a field the client did send correctly. Bind the pipe to
  the parameter, which is what `@ZodBody(SomeDto)` does. Unit-testing the controller method
  directly cannot see this, because it bypasses the pipeline entirely; the specs that catch
  it (`onboarding/controllers/Onboarding.controller.spec.ts`,
  `profiles/controllers/Profiles.controller.spec.ts`) go through a real Nest application
  with supertest.
- **`@ZodBody` applies a method decorator from a parameter decorator.** That is unusual
  and deliberate: `@ApiBody` and the pipe have to come from the same DTO or they can
  disagree, and asking each route for two decorators is asking for one of them to be
  forgotten. It works because TypeScript runs parameter decorators before the method's
  own, on a prototype whose methods already exist. `ZodBody.decorator.spec.ts` pins both
  halves against one route; if that spec ever fails on a Nest or swagger upgrade, this
  is why.
- **Better Auth must receive an unread request body.** `CreateApp.ts` mounts `express.json()` *after* the auth path. Moving the parser earlier makes sign-in receive an empty body, and the failure looks like bad credentials.
- **A CommonJS package that `require()`s `@nestjs/*` works locally and dies on the platform.** See § Deployment. `preflight` catches it; run it after adding any dependency that touches Nest.
- **`emitDecoratorMetadata` is what makes DI work.** Without it every injection needs an explicit `@Inject`. It is on in `tsconfig.json`; `verbatimModuleSyntax` must stay off, or type-only imports stop producing metadata.
- **`HealthIndicatorService`, not `HealthCheckError`.** Terminus 12 removed the old error class; return `indicator.down()`.
- **A module that provides a Terminus indicator must import `TerminusModule` itself.** Importing it only in `HealthModule` leaves `DatabaseModule` unable to resolve the dependency.
- **`drizzle-orm` types differ between the ESM and CommonJS resolutions.** Do not build SQL here — add a helper to `packages/database` (as `ping()` does) and call that.
