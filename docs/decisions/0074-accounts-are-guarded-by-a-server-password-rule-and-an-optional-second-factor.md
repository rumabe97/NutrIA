# 0074 — Guard accounts with a server-side password rule and an optional second factor

- **Status**: accepted
- **Date**: 2026-10-01
- **Project**: [docs/projects/011-accounts-are-harder-to-take](../projects/011-accounts-are-harder-to-take/)
- Changes one choice that no earlier record holds, only a comment in
  `apps/api/src/modules/auth/auth.config.ts` (`requireEmailVerification`): sign-up no
  longer signs the person in (§ Decision, "Sign-up reveals nothing"). It sits beside
  [`0030`](./0030-a-confirmed-address-is-not-a-key.md), which it does not change.

## Context

An account holds health data (RGPD art. 9) and is guarded by a password alone: a minimum
of 8 characters, no breached-password check, no second factor, no way to change the
password or close other sessions from inside the app. Sign-up says whether an address
already has an account, and the reset answers later for one that does. The architect's
report [`0007`](../reference/architecture/0007-seguridad-de-cuentas-2026-10-01.md) read the
code and Better Auth 1.7.6's installed source. It found that almost everything needed is
already inside Better Auth, and that the sign-in limit may count every client in one
bucket behind the web's rewrite. That last finding is a hypothesis, not measured.

## Decision

- **Passwords.**
  - Minimum 12, maximum 128, no composition rules. The constant lives once, in
    `packages/core`, and is enforced by the API on sign-up, reset and change.
  - A breached password (Have I Been Pwned range API, k-anonymity) is refused by our own
    hook with a ~2 s timeout. **The hook fails open**: when HIBP does not answer, the
    request goes through and the miss is logged.
  - Passwords containing the email's local part, the name or "nutria" are refused.
  - Passwords set before the rule keep working. A breached one is caught at sign-in, in
    the background, and the person must change it before going on.
- **Second factor: optional, for accounts with a password.**
  - The methods are TOTP with 10 backup codes, and passkeys.
  - A Google- or Apple-only account relies on the provider's own second factor. Better
    Auth does not challenge provider sign-ins, so a switch for it would protect nothing.
- **Passkeys are bound to the current web origin.** Buying a domain later voids them, and
  each person adds a new one (accepted by the owner).
- **Removing a lost second factor** is an owner act in the console, taken only on a
  request from the account's own address. The address is told at once, and the factor is
  removed no sooner than 48 h later. The removal is cancelled if the owner cancels it, or
  if the factor is used successfully in the meantime. Both steps are audited.
- **Mandatory for privileged accounts with a password.**
  - Professionals: from before the `professional` switch goes on in production.
  - The admin: only once the owner has turned his own on.
  - The required factor is TOTP. Better Auth challenges only a password sign-in, so a
    passkey does not stand in for it. A Google-only account in either role is not blocked.
- **Sign-up reveals nothing.** It answers the same for a new and an existing address. The
  existing one gets an email instead, and a new person signs in by confirming the
  address, not at sign-up.
- **The limits.** The rate limit must see each client's IP, which is measured in
  production before anything else rests on it. A per-account brake slows repeated
  failures for one address, stored as an HMAC; it never locks an account hard.
- **Not done:** SMS, magic links, push approval, email OTP as a factor, composition
  rules, expiry, security questions and Turnstile (the last only with data, and through
  `legal`).

## Alternatives considered

- **Better Auth's `haveIBeenPwned` plugin as is**: it fails closed, so an HIBP outage
  becomes a 500 on sign-up.
- **15 characters, as NIST asks for a password-only account**: the breached-password check
  buys more than the three extra characters, and every character costs on a phone.
- **Passkeys only after a custom domain**: the owner prefers to have them now.
- **Removal of a lost factor at once**: a forged request from a lookalike address would be
  enough to strip someone's protection.
- **Email OTP as the factor**: whoever holds the mailbox already holds the account through
  the reset, and each sign-in would spend Gmail quota.

## Consequences

- The `user` table gains `two_factor_enabled` and `password_compromised_at`. New tables
  `two_factor`, `passkey` and the pending-removal record cascade on user deletion. The
  per-account counter has no user key on purpose — an unknown address must be braked
  exactly like a known one — and holds only an HMAC of the address, cleared within a day.
- Sign-up no longer opens a session. On iPhone, the confirmation link opens in Safari, not
  in the installed app.
- A future custom domain must plan for passkeys becoming void.
- The sign-in flow on the web must handle the second-factor challenge, and every E2E suite
  that signs in keeps working because none of them turns 2FA on.
