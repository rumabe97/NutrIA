# 0007 — Account security: strong passwords, a second factor and the rest

> **Purpose**: the `architect` agent's answer to the owner's request of 2026-10-01: require strong
> passwords (sign-up, change and reset), offer an optional second factor, and review every
> second-factor option and every other measure that would raise account security, with a ranked
> recommendation: what ships first as a project, what comes after and what is not done and why. It
> is the basis of the PRD of whatever project comes out of it.
> **Audience**: the owner and the agents. **Committed**: yes. **Maintained by**: the `architect`
> agent; once merged it is not edited — a later review is a new report.
>
> Base: `main` at `09ed8323` (#181). Every number carries its label: **measured** (where),
> **estimated** (with the hypothesis) or **unknown**. What was read: the code of `apps/api` (the
> `auth` module, the guards, `CreateApp.ts`), of `apps/web` (the sign-in forms, `proxy.ts`,
> `next.config.js`, `/perfil`), `packages/database`'s schema, the deployment documentation and the
> legal parts it touches (`eipd.md`, the privacy policy), and **the installed code of Better Auth
> 1.7.6** (`apps/api/node_modules/better-auth/dist`), because what each plugin does was read in its
> source, not in its documentation.
> What was measured: production's HTTP headers (two `HEAD`s, like any visit), four queries to the
> Have I Been Pwned range API from the owner's machine (none with a real password) and the
> published version of `@better-auth/passkey` on npm.
> **No database was read, neither production's nor development's, Vercel's environment was not
> read, no model call was made and nothing was spent.**

---

## 1. Verdict

**Yes, on conditions.** Both requests can be done **without spending a euro** and nearly everything
needed already comes inside Better Auth 1.7.6, which is installed: the `two-factor` plugin
(authenticator app code, backup codes, attempt locking, trusted device), the breached-password one
(`haveibeenpwned`), the CAPTCHA one and the routes to list and revoke sessions. What has to be
written is the screen, a few rules of our own and a couple of configuration settings.

The conditions:

1. **Before anything else, measure whether the rate limiter sees each person's IP.** It is the only
   thing that can change the order. Production comes in through the web's *proxy*
   (`docs/reference/deployment.md` § Shape A) and Better Auth 1.7.6, if the `x-forwarded-for`
   header carries more than one IP or none it trusts, **puts everybody in a single counter**
   (`@better-auth/core/dist/utils/ip.mjs`, `getIPFromHeader`;
   `better-auth/dist/api/rate-limiter/index.mjs:242`). If so, three sign-in attempts every ten
   seconds apply to **the whole service**: an attacker blocks everybody's entry with one request
   every three seconds. It is checked with a read-only query that returns only counts (§ 9). If it
   comes out badly, fixing it is phase 0 and comes before everything else.
2. **The second factor protects password sign-in, and only that.** Better Auth asks for it only on
   `/sign-in/email` (`two-factor/index.mjs:246`). Whoever comes in through Google never sees it,
   and cannot: their second factor is Google's. It is offered to accounts with a password. Google
   accounts are told to switch on Google's two-step verification.
3. **The password rule lives on the server**, in a constant of `packages/core` that the web reads
   too. The breached-password check is written by us over the function Better Auth exports, **with
   a timeout and without blocking sign-up if the external service goes down**. The plugin as it
   stands fails closed and would return a 500 on sign-up.
4. **Every new mail goes out through the owner's Gmail.** The security alerts fit in it. A second
   factor by mail does not: a mail on every sign-in is the way to exhaust that quota and it does
   not protect against somebody who already has the mailbox.

**Recommended order** (detail in § 8):

| # | What | Why in this position |
| --- | --- | --- |
| 0 | Measure the rate limiter and, if needed, fix which header the IP comes from | Everything else leans on that limit |
| 1 | Passwords: minimum 12, a breached list, the service's name and the email forbidden, a simple meter. Along the way, the reset stops giving itself away by response time | It is the first thing the owner asked for and it is cheap |
| 2 | "Security" in `/perfil`: change the password (which revokes the other sessions), see and revoke sessions, a mail alert when the password changes | Today **changing the password does not exist** and the second factor needs somewhere to live |
| 3 | An optional second factor: authenticator app + 10 backup codes | The owner's second request |
| 4 | A mandatory second factor for professionals (before switching `professional` on) and for the admin | The DPIA's R8 risk is a professional's account with several patients |
| 5 | Later: the web's headers, a per-account brake on sign-in, enumeration at sign-up, passkeys once there is a domain | They are worth less, or they depend on a decision that has not been taken |

**Do not do:** SMS, magic links, push approval, a second factor by mail as the main method,
composition rules ("one capital and a symbol"), periodic password expiry, hard account lockout and
security questions (§ 4.4).

**The owner's decisions** (§ 5.1): a minimum of 12 or 15 characters; whether the admin may sign in
with Google; whether sign-up keeps failing open when the breached-password service is down; what he
does when somebody loses their phone and their codes; whether a domain is bought before passkeys;
Turnstile only if the data asks for it (it is a new processor, it goes through `legal`).

---

## 2. Premises checked

| # | Premise | Status | Evidence |
| --- | --- | --- | --- |
| P1 | Authentication is Better Auth, in `apps/api/src/modules/auth` | **confirmed** | `auth.config.ts:52` `betterAuth({…})`; installed version **1.7.6** (`apps/api/node_modules/better-auth/package.json`) |
| P2 | Email + password exists | **confirmed** | `auth.config.ts:147-173` |
| P3 | Google in production, Apple built and off | **confirmed in code**; production's state from `0058` and memory (I did not read the environment) | `SocialProviders.ts`: each provider exists only if its set of variables is complete |
| P4 | Account linking is strict | **confirmed** | `auth.config.ts:67` links only where there is a provider; no `trustedProviders`; `requireLocalEmailVerified` at its default (on), explained at `:53-66` |
| P5 | Mail goes out through Gmail SMTP with an app password | **confirmed in the documentation**, not in the environment | `apps/api/AGENTS.md` § Mail; `0019` |
| P6 | `BETTER_AUTH_URL` is the web's origin | **confirmed in the documentation** | `docs/reference/deployment.md` § Shape A |
| P7 | Migrations run against production in the API's *build* | **confirmed** | `apps/api/AGENTS.md:163` (`vercel-build` → `database migrate`) |
| P8 | Strong passwords have to be enforced "when the password is changed" | **partly wrong**: **there is no password change**. Better Auth has the route (`/change-password`, `api/routes/update-user.mjs:76`), but nothing in the web calls it; `/perfil` has no security section (`app/(app)/perfil/page.tsx:1-40`, the imports). Today the password is set at sign-up (`RegisterScreen.tsx:49`) and at reset (`ResetPasswordForm.tsx:64`). Changing it from inside is a new feature | — |
| P9 | Reauthentication exists for deleting the account (#179) | **confirmed** | `apps/api/AGENTS.md:99`: a `freshAge` of one day, 409 `REAUTHENTICATION_REQUIRED` |
| P10 | Taking over a privileged account is especially serious | **confirmed, with a nuance**. The **admin** reads nobody's health (`0028`, `0068`): taking their account gives the account list with emails, the switches and the professional grant, but not health data directly. The **professional** does see the health of their linked patients: the DPIA has it as **R8** ("session or account theft, including a professional's with several patients", `docs/legal/eipd.md:131`, residual 3 with M13) | — |
| P11 | (implicit) Better Auth's rate limiter protects sign-in | **hypothesis**. It is on and stores the counters in the database (`auth.config.ts:213-217`; default rules in `rate-limiter/index.mjs:302-315`: sign-up and sign-in 3 every 10 s, reset 3 a minute). **By IP**, and the IP may not be arriving (condition 1). It is checked as § 9 says | — |
| P12 | (implicit) A second factor covers everybody | **wrong**: only password sign-in (`two-factor/index.mjs:246`). Google, Apple and, in the future, passkeys do not pass through it | — |

---

## 3. What is there today

### 3.1 What is right and stays

- **Hashed passwords** (scrypt, Better Auth's) and a **128 maximum length** by default
  (`create-context.mjs:186-187`; the long rule meets NIST, which asks for at least 64 to be
  accepted).
- **One message on sign-in**: a bad password and a non-existent account answer the same, and Better
  Auth computes a hash even when there is no account, to even out the time (`sign-in.mjs:319-322`;
  the web, `SignInForm.tsx:67-79`).
- **The reset answers the same** whether the account exists or not (`password.mjs:60-71`), the
  token is single-use (`consumeVerificationValue`, `:155`), lasts an hour and **revokes every
  session** (`auth.config.ts:161`).
- **Cookies**: `httpOnly`, `secure` in production, `sameSite: 'lax'` (`auth.config.ts:85-86`).
  Better Auth checks the origin on requests that change anything (`trustedOrigins`, `:223-226`).
- **The session is re-read on every request** (`Session.guard.ts`) and denied with a 404; it lasts
  30 days and is renewed once per day of use (`auth.config.ts:35-36, 219`).
- **A confirmed address and an opened account**: the two locks (`0030`, `0031`).
- **The API** serves `helmet` (`CreateApp.ts:63`). **Measured** on `/api/v1/health`: CSP,
  `X-Frame-Options`, `nosniff`, `Referrer-Policy: no-referrer`, a one-year HSTS.
- **Deleting the account requires a session less than a day old** (#179).
- The privacy policy **already says** that each session's IP and browser are stored "so it can be
  revoked" (`docs/legal/textos/02-politica-privacidad.md:82`). A session list in `/perfil` needs no
  policy change.

### 3.2 What is weak

| # | Finding | Where | Severity |
| --- | --- | --- | --- |
| D1 | The rate limiter may be counting everybody together (condition 1) | `rate-limiter/index.mjs:236-245`; `ip.mjs` `getIPFromHeader`; the *proxy* in `apps/web/next.config.js` | **High if confirmed** (everybody's sign-in blocked and a useless limit); **hypothesis** |
| D2 | A minimum password of **8**, with no other rule; the 8 is **written twice** in the web and never in `core` | `RegisterScreen.tsx:25`, `ResetPasswordForm.tsx:18`; the server, by default (`create-context.mjs:186`) | Medium |
| D3 | It is not checked whether the password is breached | `auth.config.ts` loads no plugin | Medium. **Measured**: `Password123!` appears **295,389** times in HIBP and is accepted today (12 characters) |
| D4 | The password cannot be changed, sessions cannot be seen, other devices' sessions cannot be revoked | `/perfil` (`page.tsx`) | Medium: after a scare, the only way out is "I forgot my password" |
| D5 | **Sign-up says whether an address already has an account**: Better Auth answers 422 and the web turns it into "that email is already registered" | `sign-up.mjs:204`; `RegisterScreen.tsx:58` | Medium-low: it reveals that somebody uses a diet app. The 3-every-10-s per-IP limit only slows down somebody trying many addresses |
| D6 | **The reset gives the account away by timing**: for an address that exists it waits for the SMTP send; for one that does not, it does not | `password.mjs:82` (`runInBackgroundOrAwait`, which **waits** because there is no `advanced.backgroundTasks.handler`, `create-context.mjs:212-218`); `PasswordResetMail.ts:85` waits for `mailer.send` | Medium-low. The magnitude is **estimated** at 0.3–2 s (an SMTP send to Gmail); it is measured locally. The fix already exists in the repository: `shared/services/BackgroundTask.service.ts:30-41` wraps `waitUntil` |
| D7 | The web's pages have no CSP, no `frame-ancestors`/`X-Frame-Options`, no `nosniff`, no `Referrer-Policy`. Only HSTS, which Vercel sets | **Measured** with `HEAD /` in production: only `strict-transport-security: max-age=63072000; includeSubDomains; preload`. `next.config.js` defines no `headers()` | Low-medium. `sameSite: 'lax'` already stops another site putting `/perfil` in an `iframe` with the session. `/restablecer?token=…` carries the token in the URL |
| D8 | There is no per-account brake: the limit is per IP only | Better Auth's design (key `ip|route`) | Medium against credential stuffing from many IPs |
| D9 | No mail alert when something about security changes | — | Low today; it rises with the second factor |
| D10 | No extra requirement for the admin or for a professional | `Admin.guard.ts`, `Professional.guard.ts` | Medium; high once `professional` is switched on |

---

## 4. Proposal

### 4.1 Passwords

**What NIST SP 800-63B-4 says (the final version, August 2025):** if the password is the **only**
factor, a minimum of **15** characters; if it is part of a two-factor sign-in, a minimum of **8**.
Accept at least 64, with spaces and Unicode. Do **not** impose composition rules. Do compare against
a list of breached, dictionary and service-specific passwords. Do not force periodic changes, but
do force one when there is evidence of a breach. Allow pasting, so password managers work.

**Recommendation:**

- **A minimum of 12, a maximum of 128, with no composition rules.** NIST's 15 is for passwords that
  are the only factor, and here nearly all of them will be, because the second factor is optional.
  I propose 12 knowingly. On an iPhone, with `autocomplete="new-password"` (already on both forms),
  the keychain proposes a much longer generated password and most people accept it. Whoever types
  one by hand on a phone suffers every extra character. The breached list is worth more than the
  three characters between 12 and 15. **It is the owner's decision** (§ 5.1). Both figures cost the
  same to build.
- **One constant in `packages/core`** (`PASSWORD_MIN_LENGTH`, beside a Zod schema for a new
  password). It is read by `auth.config.ts` (`emailAndPassword.minPasswordLength`) and by both
  forms, which today each hold their own `8`. It is `ARCHITECTURE.md`'s rule: a rule is written
  once.
- **Raising the minimum shuts nobody out.** Sign-in only checks the maximum length
  (`sign-in.mjs:316`). An 8-character password created earlier still gets in.
- **Breached (HIBP, ranges with k-anonymity).** Measured on 2026-10-01: the API is **free and
  without a key**. The first 5 hex characters of the SHA-1 are sent and a list of suffixes comes
  back, **1,959–2,115 lines per prefix with padding** (4 queries). The password does not leave. The
  prefix is shared by some two thousand and identifies nobody. The request goes out from the Vercel
  function, so the person's IP does not travel either. Latency **measured from the owner's machine
  in Spain: 158–1,281 ms**; from `fra1`, **unknown** (I estimate similar or less: it is served by
  Cloudflare's edge).
  - **I do not use the plugin as it stands.** If HIBP does not answer, it throws
    `INTERNAL_SERVER_ERROR` (`haveibeenpwned/index.mjs:37-41`) and sign-up gives a 500. I propose a
    hook of our own (`hooks.before` on `/sign-up/email`, `/reset-password` and `/change-password`)
    using `isPasswordCompromised`, which the same module exports, with a timeout of about 2 s and
    which, if it fails, **lets it through and logs it**. The risk of letting a breached password
    through during an HIBP outage is small. A sign-up that does not work is a failure the user
    sees. **The owner's decision** (§ 5.1).
  - In tests nothing hits the network: the hook is off with `NODE_ENV=test`, like the suites' limit
    (`auth.config.ts:34`). **Measured**: every suite's password,
    `correct-horse-battery-staple-9`, has **0** appearances in HIBP. No suite would need changing
    even if the hook were on.
  - **Legal**: no personal data leaves. Even so, `legal` should confirm whether the policy names
    the check. It is one line, not a processor.
- **A list of our own** (code, no network): reject a password containing the local part of the
  email, the name or "nutria". It is what NIST calls "context words". It is ten lines.
- **A meter on the web: simple, not zxcvbn for now.** A bar that grows with length and a line
  saying "a phrase of several words is better". The decision is taken by the server. zxcvbn-ts with
  the Spanish dictionary weighs **unknown** (I estimate hundreds of KB) on a screen opened over 4G
  in a shop. If it is wanted later, it is loaded only on those two screens and measured with the
  *build*. Add `passwordrules="minlength: 12;"` to the field, so Safari's generator respects the
  minimum.
- **Users with a weak password:**
  - **Short ones**: they are not forced. NIST does not ask for a password change because the rule
    changed.
  - **Breached ones**: yes, because NIST requires it when there is evidence. On a successful
    sign-in, an `after` hook on `/sign-in/email` checks the password against HIBP in the background
    (`BackgroundTaskService`) and, if it appears, marks the account (`password_compromised_at`).
    The web then shows a screen asking for it to be changed before going on. It needs phase 2,
    because today there is nowhere to change it.
  - **Do not store the password or the SHA-1 hash** to do this check later: it is done with the
    plaintext password at the moment of sign-in, and forgotten.

### 4.2 The second factor: every option

| Option | Cost | On an iPhone | Phishing-resistant | Recovery | Better Auth 1.7.6 | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| **Authenticator app (TOTP)** | €0 | Good: since iOS 15 the keychain stores codes; tapping an `otpauth://` link on the same iPhone enrols it without scanning (**hypothesis**, tested on the owner's iPhone). Also Google Authenticator, 1Password… | No (the code can be asked for on a fake site) | Backup codes | **Native**: `twoFactor()` — an encrypted secret, 10 encrypted backup codes (`backup-codes/index.mjs:15`), 5 attempts per challenge (`totp/index.mjs:185`) and per-account locking (`failedVerificationCount`, `lockedUntil`, `schema.mjs`), a trusted device for 30 days | **Yes, first** |
| **Backup codes** | €0 | They have to be kept (the keychain or a note) | — | They are the recovery | **Native**, with TOTP | **Yes, with TOTP, mandatory** |
| **Passkeys (WebAuthn)**, as passwordless sign-in or as a second factor | €0 | **The best**: Face ID and the iCloud keychain. In the installed app (`manifest.ts:29`, `display: 'standalone'`) WebAuthn should work (**hypothesis**, iOS 16+) | **Yes**, the only one on the list | Another key, or password + TOTP | **A separate package**: `@better-auth/passkey@1.7.7`, which requires `better-auth ^1.7.7` (**measured** on npm; today there is 1.7.6). A new table | **Yes, but after the domain** (below) |
| A code by mail (OTP) | €0, but it spends Gmail on **every** sign-in | Fair: switch to Mail and back | No | The mailbox | Native (`otpOptions.sendOTP`) | **No as the main method**: whoever has the mailbox already has the account through "I forgot my password", and every sign-in is a mail |
| SMS | **A cost per message** (estimated €0.05–0.10 in Spain with Twilio or similar) | Good | No; and SIM swapping | The number | The `phone-number` plugin, not as pure 2FA | **No**: it costs money, SIM swapping breaks it, NIST restricts it and it forces storing a new personal datum (the phone) |
| A magic link | €0, one mail per sign-in | **Bad**: the link opens in Safari, and the installed app has **a different cookie store**. You end up signed in to Safari, not to the app | No | The mailbox | The `magic-link` plugin | **No**: it is a single factor (the mailbox) and on an iPhone it leaves the session in the wrong place |
| Push approval | It needs a native app or a system of our own | — | No (notification fatigue) | — | Does not exist | **No** |

**Passkeys depend on a decision about the domain.** A passkey is tied to the web's domain (the *RP
ID*), which today is `nutr-ia-web-phi.vercel.app`. Moving to a domain of our own
(`deployment.md`'s Shape B) **makes every passkey created before it useless**, and everybody would
have to create another. If the owner is going to buy a domain, passkeys come afterwards. If not,
they can go on Vercel's. It is the best long-term option: the only one that resists phishing and
the most comfortable on an iPhone.

**Google and Apple.** Better Auth does not ask for the second factor on provider sign-in, and we
have no reliable way of knowing whether Google asked for one: Google's token does not guarantee to
say how the person authenticated (**hypothesis**, not checked against a real token). So:

- A **Google-only** account is not offered TOTP. It is explained that its security is its Google
  account's, and linked to Google's two-step verification. Allowing it to be switched on with no
  password (`allowPasswordless`) would give a checkbox that protects nothing: Google sign-in still
  would not ask for it.
- An account with a password **and** Google linked is as secure as the weaker of the two: password
  + TOTP, or the Google account. That is acceptable, and it has to be said.
- A password reset **does not bypass** the second factor: after resetting, signing in with the new
  password asks for it again (the hook looks at `twoFactorEnabled`, `two-factor/index.mjs:251`).
  With the second factor on, somebody who only has the mailbox no longer gets in. That is what the
  second factor buys most here.

**Recovery.** If somebody loses their phone, they sign in with a backup code. If they lose the
phone and the codes, there is no automatic way out, on purpose: an automatic way out by mail would
undo the second factor. The way out is the owner. A console action, "Remove the second factor",
audited in `audit_logs`, that sends a mail to the account's address. The owner uses it only when
the request reaches him **from that same address**. It is the door social engineering would come
through. `legal` should write the procedure, and it is **the owner's decision** how much he asks
for before pressing it.

**Mandatory for privileged accounts.**

- **Professionals**: `ProfessionalGuard` requires, on top of what it already checks, that the
  account has `twoFactorEnabled` if it has a password. If not, a 404 on the client routes, like any
  denial, and the workspace page (`@BeforePractice()`) explains how to switch it on. It has to be
  done **before switching `professional` on** in production. That way there are no professionals
  mid-flight to cut off, and it closes R8's residual.
- **Admin**: the same in `AdminGuard`, **after** the owner has switched his own on and saved the
  codes. Otherwise he locks himself out of `/admin`. If the owner signs in with Google, the rule
  asks him for nothing (Google is his second factor). **The owner's decision** (§ 5.1).
- If a privileged account is Google-only, the rule asks for nothing either. It is the same
  decision.

### 4.3 The other measures, one by one

| Measure | What it needs | What it can break | Cost | Recommendation |
| --- | --- | --- | --- | --- |
| **Knowing the client's IP** in Better Auth's limiter | Measure (§ 9). If it comes out badly: `advanced.ipAddress.ipAddressHeaders` and/or `trustedProxies` in `auth.config.ts`, depending on what Vercel puts in `x-forwarded-for` / `x-vercel-forwarded-for` behind the *proxy* (Vercel's documentation, **not checked**). And review `trust proxy 1` in `CreateApp.ts:61` with the same datum, which `RateLimitGuard` uses for signed-out callers | If it is configured wrongly, anybody fakes their IP by setting the header. That is why it is configured on what was measured, not on what was assumed | €0 | **Phase 0** |
| **A per-account brake** on sign-in | A `before`/`after` hook on `/sign-in/email` with a counter per HMAC of the email (in `rate_limit` or in a table of its own): after ~10 failures in 15 min, a growing delay. **Never** a hard lock | A hard lock would let an attacker close anybody's account. With a growing delay, the owner still gets in with a small wait | €0, one write per failed attempt | **Phase 5**, or earlier if § 9 shows attempts |
| **The second factor's limit** | Already there: 3 every 10 s on `/two-factor/*` (`two-factor/index.mjs:338`) plus 5 attempts per challenge and per-account locking | It depends on phase 0, like the whole limiter | €0 | With phase 3 |
| **CAPTCHA (Cloudflare Turnstile)** | The native `captcha` plugin; a secret key in the API and a public key in the web (a third `NEXT_PUBLIC_` variable); a script from `challenges.cloudflare.com` (the future CSP has to allow it) | The suites use Cloudflare's test keys. `legal` is needed: **Cloudflare would be a new processor**, with a transfer to the US and device signals | Free, **estimated** (Turnstile's free plan to my knowledge; check its terms) | **Only if the data asks for it** (attempts the per-account brake does not stop) |
| **Sessions: duration** | Today, 30 days renewed on each day of use. It is right for somebody opening the app in the kitchen | Shortening it forces more sign-ins and more reset mails | €0 | **It stays**. For professionals and the admin, the second factor is worth more than a short session |
| **Sessions: see and revoke** | Native routes: `/list-sessions`, `/revoke-session`, `/revoke-sessions`, `/revoke-other-sessions` (`api/routes/session.mjs:347-450`). What is missing is the screen in `/perfil`, with the device (from the user agent) and the date. The IP only if phase 0 fixes it; otherwise `""` will do (`internal-adapter.mjs:263`) | Revoking another device's session leaves the offline copy on it (`0053`) until it talks to the API again | €0 | **Phase 2** |
| **Changing the password** revokes the other sessions | A new screen; a `before` hook on `/change-password` that **forces** `revokeOtherSessions: true`, so the client does not decide it (`update-user.mjs:92, 174`) | Nothing; it is new | €0 | **Phase 2** |
| **Reauthentication for sensitive actions** | Already there for deleting the account. Better Auth asks for the password to enable and disable the second factor, and also a fresh session to disable it (`sensitiveSessionMiddleware`, `two-factor/index.mjs:195`). Changing the password asks for the current one | — | €0 | What exists plus the second factor is enough. For the admin, mandatory 2FA plays the step-up role |
| **Alert mails** | Password changed or reset (`onPasswordReset` exists; an `after` on `/change-password`); second factor enabled or disabled; a passkey added; a backup code used. One template in `modules/email/templates`, with not a word of health (M14) | **Gmail's quota**: ~500 recipients a day (**estimated**: the limit Google publishes for personal accounts; not measured, and Google may cut earlier). These are rare events: with 100 accounts, a few mails a month (**estimated**) | €0 | **Phase 2** (password) and **phase 3** (2FA). Do **not** alert on every "sign-in from a new device" for now: with 30-day sessions it is noise, and it is the alert that spends the most mail |
| **Email verification** | Already mandatory: the guard answers 409 `EMAIL_NOT_VERIFIED` (`0030`) | — | — | **It stays** |
| **Enumeration at sign-up** (D5) | `emailAndPassword.autoSignIn: false`: Better Auth answers the same for an address that already exists (`sign-up.mjs:155-157, 193-201`) and calls `onExistingUserSignUp`, which can send "somebody tried to create an account with your email; if it was you, sign in or reset" | **It changes sign-up**: you are no longer signed in on registering, you are signed in on pressing the link (`autoSignInAfterVerification: true` is already set). On an iPhone the link opens in Safari, not in the installed app. And one more mail per attempt | €0, mails | **Phase 5**, decided with `frontend` and `accessibility` because of the journey change |
| **Timing enumeration on reset** (D6) | `advanced.backgroundTasks.handler` wired to `BackgroundTaskService` (`waitUntil`), so the response does not wait for SMTP | If `waitUntil` is unavailable (outside Vercel), the service already handles it (`BackgroundTask.spec.ts:42`) | €0 | **Phase 1** |
| **The web's headers** (D7) | `headers()` in `apps/web/next.config.js`: `frame-ancestors 'none'` / `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` (or `no-referrer`), `Permissions-Policy` | Nothing visible | €0 | **Phase 1** for the simple ones |
| **A CSP on the web** | With *nonces*, Next forces every page to render on the server, and the landing page stops coming from the cache (**measured**: today `x-vercel-cache: HIT`). Without a nonce, `'unsafe-inline'` is needed in `script-src`, which empties it of meaning | It breaks scripts with no warning if it goes into blocking mode at once | €0, a little more function time per visit | **Phase 5**: `Content-Security-Policy-Report-Only` first |
| **A log of security events** | Reuse `audit_logs` (`platform.schema.ts:81-100`, already with `actorId`/`subjectUserId`) with actions `auth.password_changed`, `auth.2fa_enabled`, `auth.2fa_disabled`, `auth.2fa_removed_by_owner`, `auth.sessions_revoked`. With no IP (`AuditRepository`'s rule) | More rows; `legal` sets how long they are kept | €0 | **Phases 2–4**, each event with its phase |
| **Mandatory 2FA for admin and professionals** | § 4.2 | Locking yourself out of `/admin` if it is switched on before your own | €0 | **Phase 4** |

### 4.4 What is not done

- **SMS**: it costs money per message, SIM swapping breaks it and it forces storing everybody's
  phone number.
- **A magic link**: it is a single factor (the mailbox) and on an iPhone it leaves the session in
  Safari, not in the installed app.
- **Push approval**: there is no native app and it is the way to fatigue the user until they
  accept.
- **A second factor by mail as the main method**: it does not protect against somebody who already
  has the mailbox, and it spends a mail on every sign-in.
- **Composition rules, periodic expiry, security questions**: NIST advises against them; they make
  passwords worse.
- **A hard account lock**: it turns the brake into a weapon against the victim.
- **`allowPasswordless` on the second factor**: it would give a Google account a checkbox that
  protects nothing.
- **`freshAge: 0`, trusted providers (`trustedProviders`), accepting the password on
  `DELETE /users/me`**: already forbidden (`apps/api/AGENTS.md:99`, `0058`), and repeated here.

### 4.5 Alternatives considered

| Alternative | Why it lost |
| --- | --- |
| Passkeys first, before TOTP | They would be useless if a domain is bought afterwards |
| The `haveIBeenPwned` plugin as it is | It fails closed: an HIBP outage takes sign-up down |
| zxcvbn on the web and on the server | **Unknown** weight on mobile; HIBP and length cover nearly all it adds |
| Turnstile from the start | It is a new processor, with its legal review, for a problem that has not been seen |
| A shorter session for everybody | It makes somebody who uses the app daily sign in more, and the second factor attacks the same risk better |
| A 2FA-only project | 2FA needs the security section, which does not exist today, and its attempt limit leans on phase 0 |

---

## 5. Requirements

### 5.1 The owner's decisions

1. **Minimum length: 12 (recommended) or 15 (what NIST says for a single factor).**
2. **If HIBP does not answer, is sign-up let through (recommended) or stopped?**
3. **Can the admin sign in with Google and rely on Google's two-step verification, or only with
   password + TOTP?** And the same for a professional who is Google-only.
4. **What the owner asks for before removing somebody's second factor** when they have lost the
   phone and the codes (minimum: that they ask from the account's address; `legal` writes the
   procedure).
5. **A domain of our own, yes or no, and when**: passkeys come afterwards.
6. **Turnstile**, only if phase 0 or the per-account brake show attacks. Cloudflare would be a new
   processor.
7. **Enumeration at sign-up**: whether it is acceptable that registering no longer signs you in
   (phase 5).

### 5.2 Code

- `apps/api/src/modules/auth/auth.config.ts`: `minPasswordLength` from `core`;
  `advanced.backgroundTasks`; `advanced.ipAddress` (if phase 0 asks for it); `hooks` (breached,
  context words, forced `revokeOtherSessions`, the per-account brake, audit events); the
  `twoFactor({ issuer: 'NutrIA', … })` plugin; mail alerts.
- `BackgroundTaskService` is injected into `createAuth` from `auth.module.ts`, as `mailer` and
  `billing` already are. It is used by `advanced.backgroundTasks.handler` (phase 1) and by the
  breached check on sign-in (phase 2). Nobody calls `waitUntil` directly.
- In tests, `TEST_AUTH_RULE` (`auth.config.ts:214`) today raises only `/sign-in/*` and
  `/sign-up/*`. Phase 3's suites need the same rule on `/two-factor/*`, or each suite's second
  challenge will give a 429 (the plugin sets 3 every 10 s).
- `apps/api/src/modules/email/templates`: "your password has changed", "second factor
  enabled/disabled/removed".
- `apps/api/src/shared/guards/Professional.guard.ts` and `Admin.guard.ts`: the 2FA requirement.
  `SessionGuard` must pass `twoFactorEnabled` in `request.user` (`Session.guard.ts:48-55`).
- `apps/api` → the console: "Remove the second factor", audited.
- `packages/core`: `PASSWORD_MIN_LENGTH`, the new-password schema and the new audit actions in
  `AUDIT_ACTIONS`.
- `apps/web`: `twoFactorClient` in `lib/auth-client.ts`. **`SignInForm.tsx:63-80` must handle
  `twoFactorRedirect`**: today a 200 response with `twoFactorRedirect: true` and no error would
  fall into `router.push('/inicio')` with no session, and `proxy.ts` would send the person back to
  `/acceder` without saying anything. A verification screen, a "Security" section in `/perfil`, the
  meter, `passwordrules` and `headers()` in `next.config.js` are also needed. All of it with the
  design skill and an `accessibility` review.
- **A finding for `backend`** (to the lead, for whoever builds phase 3; nobody is working on `auth`
  today): with 2FA, `databaseHooks.session.create.after` (`auth.config.ts:100-102`) records
  `session_started` for the session the plugin creates and deletes before the challenge
  (`two-factor/index.mjs:287-288`), and again for the real one. Every 2FA sign-in would count twice
  in `0033`'s funnel.

### 5.3 Data (migrations)

- `user.two_factor_enabled boolean default false` and the `two_factor` table (`secret`,
  `backup_codes`, `user_id`, `verified`, `failed_verification_count`, `locked_until`; the plugin's
  `schema.mjs`), copied into `auth.schema.ts`. **`user_id` with `ON DELETE CASCADE`**: it is
  `ARCHITECTURE.md`'s deletion invariant, and Better Auth does not add it for us in a hand-written
  Drizzle schema.
- `user.password_compromised_at timestamp null` (a breached password found on sign-in).
- Later, the `passkey` plugin's table, also with a cascade.
- All of them are additive and backfill nothing. They run against production in the *build* (`P7`):
  one column with a default and one empty table.

### 5.4 Infrastructure and money

- **New variables: none** in phases 0–4 (the TOTP secret is encrypted with
  `BETTER_AUTH_SECRET`). Turnstile, if it arrives, adds two.
- **Money: €0.** HIBP is free and keyless (measured); TOTP and passkeys cost nothing; Gmail, inside
  its quota (estimated).
- **Neon**: a few rows per account with 2FA; the per-account brake's writes only on failures.
  Negligible transfer (**estimated**).
- **Vercel**: 0.2–1.3 s more on sign-up, reset and password change because of HIBP (**measured**
  from Spain; **unknown** from `fra1`). Sign-in does not wait for HIBP, because that check runs in
  the background.
- **Better Auth**: upgrade to 1.7.7 only when passkeys arrive.

### 5.5 The owner's time

Run phase 0's query (5 minutes). Take § 5.1's decisions. Switch on his own 2FA and save the codes
before the admin's phase 4. Test on his iPhone that an `otpauth://` enrolment and 2FA sign-in work
from the installed app.

### 5.6 Who else

- **`legal`**: update the DPIA (R8/M13: the second factor, breached passwords, the alert). Confirm
  whether the policy names the HIBP check. Write the "remove the second factor" procedure. Set the
  retention of the security events. Turnstile, if it arrives.
- **`invariant-reviewer`**: the cascade on the new tables; that no new denial stops being a 404;
  that the "change your password" 409 follows `ONBOARDING_INCOMPLETE`'s documented exception (it is
  the person's own account and they have to be told what to do); that no security mail carries a
  health word.

---

## 6. Risks

Safety, privacy and quota first.

| Risk | To whom | Likelihood | How it would show | How to undo it |
| --- | --- | --- | --- | --- |
| The rate limiter already counts everybody together (D1) | Everybody | **Unknown**: it is what phase 0 measures | Several 429s in a row on legitimate sign-ins; Better Auth's warning in the logs (§ 9) | Configure the IP header on what was measured |
| Fixing the IP with the wrong header allows faking an IP | Everybody | Low if it is measured first | `rate_limit` keys with invented IPs | Go back to the previous value; it is configuration |
| The owner locks himself out of `/admin` | The owner | Low with the proposed order | A 404 on `/admin` | Backup codes; failing that, the owner sets `two_factor_enabled = false` in Neon himself |
| Somebody loses their phone and their codes | Anybody with 2FA | Low, but it will happen | They write to the owner | The audited "remove the second factor" action. The danger is social engineering: `legal`'s procedure closes it |
| HIBP goes down | Whoever signs up or changes their password | Low | A "HIBP did not answer" log line | With fail-open, nothing to undo |
| Security mails exhaust Gmail | Everybody (reset shares the quota) | Low with these events; high if the "new device" alert or mail OTP were added | `mail_sent` in the console (`0071`) | Do not add those two; move SMTP to a transactional provider the day there is a domain |
| Somebody with 2FA does not know how to use it on an iPhone | Users | Medium | Messages to the owner; half-finished sign-ins | It is optional: they switch it off with their password |
| The funnel double-counts 2FA sign-ins | The owner | **Certain** if not fixed | An inflated `session_started` | The fix sent to `backend` |
| The E2E suites break | CI | Low: 2FA is optional and nobody switches it on in them; HIBP is off in tests; the suites' password has 29 characters | A red CI | New suites for the 2FA challenge and the per-role requirement (the guards change) |
| Google users feel left out | Google users | Medium | Questions | The wording that sends them to Google's two-step verification |
| Passkeys made useless by a domain change | Whoever created them | Certain if they are done before the domain | — | Which is why they come afterwards |

---

## 7. Cost and effort

Money: **€0** in every recommended phase (§ 5.4). Effort **estimated** in agent-team PRs, assuming
each phase is one PR with a review:

| Phase | Effort | What moves it |
| --- | --- | --- |
| 0 — measure / the IP | 5 min of the owner's; 0.5–1 day if it has to be fixed | Whatever the measurement says; testing the header in a deploy |
| 1 — passwords + reset timing + headers | 1–2 days | The meter and its wording in two languages |
| 2 — the Security section, the change, sessions, the alert, breached on sign-in | 2–3 days | The screen, the "you must change it" and its suites |
| 3 — TOTP + backup + recovery by the owner | 2–4 days | The iPhone journey (enrolment, challenge, codes) and the console action |
| 4 — mandatory by role | 1 day | Making sure nobody is locked out; the Google decision |
| 5 — CSP, per-account brake, sign-up enumeration, passkeys | 1–2 days each | The CSP depends on what the web loads; the passkeys, on the domain |

---

## 8. Plan

One project, "Safer accounts", in phases that ship one at a time.

**Phase 0 — Does the limiter see each person?** The owner runs § 9's query. If the result is A,
nothing is touched. If it is B, `advanced.ipAddress` is configured on what was measured, deployed,
and the query is repeated.
*Success*: on new sessions, different IPs for different people.
*Stop if*: Vercel does not deliver the client's IP through the *proxy*. Then the alternative (the
web adding a signed header of its own) is measured in a separate report.

**Phase 1 — Passwords.** The constant in `core` (12 or 15); the breached hook with a timeout and
fail-open; context words; a simple meter and `passwordrules`; the reset stops waiting for SMTP;
simple headers on the web.
*Success*: `Password123!` is rejected at sign-up and at reset, with a clear message in both
languages; the reset takes the same time for an address that exists and one that does not (measured
locally); `HEAD /` shows the new headers.
*Stop if*: HIBP from `fra1` routinely passes 2 s. Then it is only consulted in the background and
the person is warned afterwards.

**Phase 2 — "Security" in `/perfil`.** Change the password (which revokes the other sessions); a
session list with "revoke" and "revoke all others"; a "your password has changed" mail (after a
reset too); a breached password found on sign-in → a screen asking for it to be changed; events in
`audit_logs`.
*Success*: changing the password on the iPhone revokes the computer's session; the mail arrives.
*Stop if*: the mandatory screen collides with the sign-up or `/pendiente` journey. It is redesigned
before going on.

**Phase 3 — An optional second factor.** The `twoFactor` plugin (TOTP, 10 backup codes, a trusted
device for 30 days); only for accounts with a password; the challenge screen; enabled and disabled
mails; the owner's "remove the second factor" action; the double `session_started` fix.
*Success*: the owner switches it on from his iPhone with the keychain, signs in from the installed
app with the code and with a backup code, and switches it off.
*Stop if*: the challenge does not work inside the installed app on an iPhone.

**Phase 4 — Mandatory by role.** Professionals in `ProfessionalGuard`, before go-live; the admin in
`AdminGuard`, after the owner has his; the Google decision applied.
*Success*: a professional with no 2FA gets a 404 on the client routes and sees on their page what
to do; the owner still gets into `/admin`.
*Stop if*: there are already active professionals in production this would cut off. They are warned
first.

**Phase 5 — Later, each when its turn comes.** A CSP in report mode and then blocking; the
per-account brake on sign-in; sign-up enumeration (if the owner accepts the journey change);
passkeys (after deciding the domain; Better Auth 1.7.7); Turnstile only with data.

---

## 9. What I do not know

- **Whether Better Auth's limiter sees each person's IP in production.** I read neither the
  database nor the logs. Two ways to find out, both read-only:
  - In Neon's SQL editor, the `production` branch, a query that returns only counts and no IP:
    ```sql
    SELECT count(*) AS sessions,
           count(*) FILTER (WHERE ip_address IS NULL OR ip_address = '') AS without_ip,
           count(DISTINCT ip_address) AS distinct_ips
    FROM session
    WHERE created_at > now() - interval '30 days';
    ```
    Better Auth stores in `session.ip_address` the same IP the limiter uses
    (`db/internal-adapter.mjs:263`), and an empty string when it does not know it. **A**: many
    distinct IPs → the limiter works. **B1**: `without_ip` ≈ `sessions` → everybody shares the
    `no-trusted-ip` counter. **B2**: one or two IPs for many people → the counter is Vercel's
    egress, shared too.
  - Or search the API's Vercel logs for the phrase "Rate limiting could not determine a client IP".
- What Vercel puts in `x-forwarded-for` and `x-vercel-forwarded-for` when the web rewrites to the
  API. It has to be checked in Vercel's documentation or with the datum above.
- HIBP's latency from `fra1`.
- Gmail's real limit for this account (I estimate ~500 recipients a day).
- Whether `otpauth://` enrolment and WebAuthn work inside the installed app on the owner's iPhone
  (iOS version **unknown**).
- Whether Google's token says anything reliable about how the person authenticated (I have not seen
  it in a real token).
- How many accounts have a password and how many are Google-only, and whether `professional` is on
  in production: I did not read production. It affects the impact of phases 2–4, not their design.
- How much zxcvbn-ts with the Spanish dictionary weighs in the web's *build*.

External sources: NIST SP 800-63B-4 (the final version of August 2025, summarised at
<https://www.sakimura.org/en/2025/10/7710/> and <https://www.enzoic.com/blog/nist-sp-800-63b-rev4/>);
the Pwned Passwords range API, <https://api.pwnedpasswords.com/range/{prefix}> (measured);
`npm view @better-auth/passkey` (measured).
