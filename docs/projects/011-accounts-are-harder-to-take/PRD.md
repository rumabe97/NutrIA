# PRD — Project 011: Accounts are harder to take

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project`, from the owner's request and decisions of 2026-10-01 and the architect's
> report [`0007`](../../reference/architecture/0007-seguridad-de-cuentas-2026-10-01.md) —
> approved by the owner before the plan is written.

- **Status**: approved — by the owner, 2026-10-01
- **Roadmap item**: [`docs/ROADMAP.md`](../../ROADMAP.md) § 10 — asked for by the owner on
  2026-10-01: "quiero mejorar la seguridad del usuario… contraseñas robustas… opcional
  segundo factor de autenticación"

## Problem

An account holds health data (RGPD art. 9), and nothing beyond a password guards it.

- **Weak passwords are accepted.** The minimum is 8 characters, written twice in the web
  and nowhere in `packages/core`; the server keeps Better Auth's default. Nothing checks
  for breached passwords: `Password123!` appears 295,389 times in Have I Been Pwned and is
  accepted today (report `0007` § 3.2, D2–D3, measured).
- **There is no second factor.** Whoever has the password, or the mailbox (through
  "forgot my password"), has the account.
- **A user cannot change their password, see their sessions or sign other devices out.**
  After a scare, the only way out is a reset (D4).
- **The sign-in limit may count everyone together.** Production reaches the API through
  the web's rewrite; if Better Auth cannot read a client IP it puts every request in one
  shared bucket, so 3 tries per 10 s would hold for the whole service — one attacker
  locks everyone out and stops no one (D1, **hypothesis**, not measured). There is no
  per-account limit either (D8).
- **Two doors say whether an address has an account**: sign-up answers "already
  registered" (D5), and the reset answers later for an address that exists, because it
  waits for the SMTP send (D6, estimated 0.3–2 s).
- **The web pages send no security headers** besides HSTS: no CSP, no `frame-ancestors`,
  no `nosniff`, no `Referrer-Policy` (D7, measured).
- **Privileged accounts need nothing more.** A professional sees the health of several
  patients (EIPD R8); the admin sees every account's email and holds the switches (D10).
- **No email tells a user that something about their security changed** (D9).

## Outcome

- **Passwords are strong, decided on the server.** At least 12 characters, at most 128,
  no composition rules; not a known breached password; not containing the email's local
  part, the user's name or "nutria". One constant in `packages/core`, read by the API and
  by both web forms. Enforced on sign-up, reset and change.
- **A breached password is caught at sign-in too**, in the background, and the user is
  asked to change it before going on. Short passwords set before the new rule keep
  working: NIST does not ask for a change because a rule changed.
- **The person who owns the account can manage it.** A "Seguridad" section in `/perfil`:
  change the password (which always signs the other devices out), see the open sessions
  and close one or all the others.
- **An optional second factor, for accounts with a password.** An authenticator app
  (TOTP) with 10 backup codes, and a device can be trusted for 30 days. Passkeys (Face ID
  / iCloud Keychain) can be added too. Accounts that only use Google are told their
  second factor is Google's, with a link to turn it on.
- **Losing everything has a way back that is not a back door.** If someone loses the phone
  and the codes, the owner removes the second factor from the console — only on a request
  from the account's own address, with that address told at once, and the removal taking
  effect **48 hours** later (owner, 2026-10-01). Audited.
- **Privileged accounts must have it.** A professional with a password cannot reach client
  data without a second factor, from before the `professional` switch is turned on in
  production. The admin too, once the owner has his own. An account that signs in only
  with Google relies on Google's two-step verification (owner, 2026-10-01).
- **The limits see each person.** The sign-in limit counts per client IP, measured in
  production, and on top of it a per-account brake slows repeated failures for one address
  (increasing wait, never a hard lock).
- **No door tells whether an address has an account.** Sign-up answers the same for a
  new and an existing address (the existing one gets an email instead), and the reset
  answers in the same time either way.
- **Security changes are told by email**: password changed or reset, second factor on,
  off or removed by the owner, a passkey added, a backup code used. No email has a word of
  health in it.
- **The web sends security headers**, and a Content Security Policy — first report-only,
  then enforcing once the reports are clean.
- **Every security event is in `audit_logs`**, without IP.

## Scope

**In**

- Phase 0 measure and, if needed, fix: which header Better Auth reads the client IP from
  behind the web's rewrite.
- Password rule (`packages/core` constant + Zod schema), our own breached-password hook
  over Better Auth's `isPasswordCompromised` with a ~2 s timeout that **lets the request
  through and logs when HIBP does not answer** (the architect's recommendation, taken by
  default — the owner can reverse it at approval), context words, a simple strength meter
  and `passwordrules` on the web. No zxcvbn.
- Reset no longer waits for SMTP: Better Auth's `backgroundTasks` wired to
  `BackgroundTaskService`.
- Simple web headers in `apps/web/next.config.js`; CSP report-only, then enforcing.
- "Seguridad" in `/perfil`: change password (`revokeOtherSessions` forced on the server),
  sessions list and revoke, the forced change after a breached sign-in.
- Better Auth `twoFactor` plugin: TOTP, 10 backup codes, trusted device 30 days, password
  accounts only; the challenge screen in the sign-in flow; the console's delayed removal.
- Passkeys via `@better-auth/passkey`, Better Auth upgraded to the version it requires,
  bound to the current web origin.
- Mandatory second factor in `ProfessionalGuard` and `AdminGuard` for accounts with a
  password.
- Per-account sign-in brake (HMAC of the email, increasing wait).
- Sign-up no longer reveals an existing address (`autoSignIn: false`, an
  "someone tried to create an account" email).
- Security emails, audit actions, the double `session_started` fix with 2FA.
- `legal`: EIPD R8/M13, whether the privacy policy names the HIBP check, the written
  procedure for removing a second factor, retention of security events.
- E2E suites for every new route, guard and flow.

**Out**

- SMS, magic links, push approval, email OTP as a factor (report `0007` § 4.4).
- Composition rules, periodic expiry, security questions, hard account lockout.
- Second factor for Google-only accounts (`allowPasswordless`): it would protect nothing.
- Cloudflare Turnstile: only if production data shows attacks the per-account brake does
  not stop; it would be a new processor and go through `legal` first.
- A "new device signed in" email: noise with 30-day sessions and the costliest in Gmail
  quota.
- Shorter sessions.
- A custom domain. **Passkeys are bound to `nutr-ia-web-phi.vercel.app`**: if a domain is
  bought later, every passkey made before it stops working and each person must add a new
  one (accepted by the owner, 2026-10-01). Password + TOTP keeps working through the move.

## Acceptance criteria

1. **The limit sees each person.** In production, sessions created after the phase carry
   distinct client IPs for distinct people (the count query of report `0007` § 9), and
   Better Auth logs no "could not determine a client IP". A spoofed `x-forwarded-for` from
   the client does not change the bucket.
2. **The password rule holds on every door.** `Password123!`, an 11-character password,
   one containing the email's local part, and one containing "nutria" are rejected on
   sign-up, reset and change, with a clear message in both languages; a 12-character
   unbreached password is accepted. The minimum is written once, in `packages/core`.
3. **HIBP down does not break sign-up.** With HIBP unreachable or slower than the timeout,
   sign-up succeeds and the miss is logged. No password or full hash leaves the API; the
   E2E suites never call HIBP.
4. **A breached password is caught at sign-in**, in the background (sign-in does not wait
   for HIBP), and the next request asks for a change before anything else; changing it
   clears the mark. The plain password and its SHA-1 are never stored.
5. **Reset takes the same time** for an existing and a non-existing address (measured
   locally, recorded in the LOG).
6. **Change password and sessions.** From `/perfil` a user changes the password (current
   one required) and every other session ends, whatever the client sends; they can list
   their sessions and close one or all the others. An email says the password changed —
   also after a reset.
7. **Optional TOTP.** A password account turns it on (password required), scans or taps
   the `otpauth://` link, confirms a code, and gets 10 backup codes shown once. Next
   sign-in asks for the code; a backup code also works, once. Turning it off needs the
   password and a fresh session. A Google-only account sees no switch, only the text
   pointing to Google's two-step verification. A password reset does not skip it.
8. **The sign-in flow handles the challenge.** `SignInForm` follows `twoFactorRedirect` to
   the challenge screen instead of pushing to `/inicio` without a session; the challenge
   works in the installed app on the owner's iPhone. `session_started` is counted once
   per sign-in with 2FA.
9. **Passkeys.** A signed-in user adds a passkey and later signs in with Face ID from the
   installed app on the owner's iPhone; they can list and remove their passkeys. An email
   says one was added.
10. **The owner's removal.** From the console the owner requests removing a user's second
    factor; the account's address is emailed at once; the removal happens 48 h later,
    unless the owner cancels; both steps are in `audit_logs`; the user gets a second
    email when it happens. `legal`'s written procedure exists.
11. **Privileged accounts.** A professional with a password and no second factor gets 404
    on client routes and is told on their workspace page what to do; with it, they work
    as today. The admin rule ships only after the owner has turned his own on and kept
    his codes; the owner still reaches `/admin`. A Google-only account in either role is
    not blocked.
12. **Per-account brake.** After ~10 failed sign-ins in 15 minutes for one address, the
    next tries wait longer each time; the right password still gets in after the wait;
    there is no hard lock. The address is stored only as an HMAC.
13. **Sign-up reveals nothing.** Sign-up answers identically for a new and an existing
    address; the existing one receives the "someone tried" email; a new user signs in by
    confirming the address. The web's copy says so, in both languages.
14. **Headers and CSP.** `HEAD /` in production shows `X-Frame-Options`/`frame-ancestors`,
    `nosniff`, `Referrer-Policy` and `Permissions-Policy`; a CSP runs report-only first,
    and enforcing once a week of reports shows no legitimate violation. The landing page
    still comes from the cache.
15. **Every security email** (password changed, 2FA on/off/removed, passkey added, backup
    code used, existing-address sign-up) is in Spanish and English, carries no word of
    health, and each event is an `audit_logs` row without IP.
16. **Across the project.**
    - Authentication runs at `quality-max` (`AGENTS.md` § Model routing), reviewed by
      `invariant-reviewer`; every new table cascades on user deletion; every new denial
      is a 404, except the documented "change your password" 409; no P0 or P1.
    - Every migration is additive and reviewed by `migration-reviewer`.
    - `legal` has updated the EIPD and, if needed, the privacy policy.
    - 0 € of new spend; no new environment variable.
    - The workspace gate and the E2E suites are green at every phase boundary.

## Open questions

- None for the owner before the plan. His decisions of 2026-10-01:
  - minimum length 12;
  - Google-only accounts in privileged roles rely on Google's two-step verification;
  - removing a lost second factor: request from the account's address, 48 h wait;
  - in this project too: per-account brake, CSP, sign-up enumeration, passkeys (on the
    current Vercel origin).
- Taken from the architect's recommendation, for the owner to change at approval if he
  wishes: HIBP failing **open**; no zxcvbn; no "new device" email; Turnstile out.
- **Owner action before phase 0 can close:** run the read-only count query of report
  `0007` § 9 on the production branch (returns counts, no IP) and paste the three numbers.
- Unknown until measured: HIBP latency from `fra1`; whether `otpauth://` and WebAuthn work
  inside the installed app on the owner's iPhone; the real Gmail daily limit.
