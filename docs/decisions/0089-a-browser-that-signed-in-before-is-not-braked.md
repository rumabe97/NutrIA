# 0089 — Exempt a browser that signed in before from the per-address sign-in brake

- **Status**: accepted
- **Date**: 2026-10-09
- **Project**: [docs/projects/011-accounts-are-harder-to-take](../projects/011-accounts-are-harder-to-take/) (phase 7b)
- **Amends**: [`0074`](./0074-accounts-are-guarded-by-a-server-password-rule-and-an-optional-second-factor.md),
  whose "a per-account brake slows repeated failures" had no way for the owner of an
  address to get past a brake somebody else's guesses built.

## Context

Phase 7's brake counts failures per address, from any number of IPs, and answers 429
while the address waits. No wait is longer than fifteen minutes, but the attempt at the end
of each wait goes to whoever asks first. An attacker who knows an address and spends each
one on a wrong password keeps a password-only account braked for as long as they keep at
it, and the reset that clears the row can be raced (phase 7's invariant review, P1-a). A
passkey or Google was the only escape.

## Decision

- **A completed password sign-in sets a device cookie.** `sign_in_device` (Better Auth's
  `createAuthCookie`: `__Secure-`-prefixed and `Secure` in production, `HttpOnly`,
  `SameSite=Lax`, the session cookie's attributes), ninety days, renewed by the next
  sign-in from that browser. Its value is 256 random bits: opaque, no address, no account
  id, nothing to forge. An account with a second factor earns it when the factor is proved
  (the code, a backup code, or a trusted device skipping the code), not when only the
  password is right. A passkey or Google sign-in earns none: neither is braked.
- **The database keeps the digest, not the token.** One row in Better Auth's
  `verification` table per browser (`sign-in-device:<sha256 of the token>`, `value` = the
  account it was earned for), at most the newest ten per account, expired rows swept by the
  daily cron. No new table, so no migration.
- **`hooks.before` on `/sign-in/email` skips the brake for a valid cookie of the account
  that owns the typed address**: neither refused nor counted. A cookie for another account,
  for an address with no account, made up, expired or absent, or a lookup that fails, falls
  through to the brake, so the 429 is byte for byte the one a request with no cookie gets,
  for a known and an unknown address alike.
- **It waives the per-address brake and nothing else.** The per-IP limit, the password
  and the two-factor plugin's own lock stand.
- **A change or a reset of the password deletes every device cookie of the account**, in the
  transaction that clears the breach mark and removes the passkeys, and on its own if that
  transaction fails. Closing sessions does not.

## Alternatives considered

- **A signed stateless cookie** — rejected: a password change could not end it without a
  per-account version to store and read on every sign-in, which is the row anyway.
- **A dedicated table** — rejected: the `verification` table already holds trusted devices
  and the mail budget, with the same expiry and sweep; a table is a migration the old API
  runs beside during a deploy, for no property the existing rows lack.
- **Counting the cookie's attempts** — rejected: its typos would lengthen the wait of
  every client that has none, and its holder is the person the exemption is for.
- **Earning the cookie on a right password alone** — rejected: for an account with a
  second factor the sign-in is not complete, and the cookie should witness a completed one.
- **Email a "new device" link or a one-time unlock** — out of scope (PLAN 011 "Out of
  scope"): a second mail path to abuse.

## Consequences

- An attacker who knows an address can still brake it for every client without the cookie,
  the owner's phone or laptop that has signed in before excepted. A person on a new
  browser, or after a password change, still waits it out, or uses a passkey, Google or a
  reset.
- A stolen browser holding the cookie is braked only by the per-IP limit until the
  password changes. That is the trade-off of any remembered device.
- A new first-party cookie, strictly necessary to the sign-in's security; `/privacidad`'s
  cookie list should name it (the lead's, with `legal`).
- Rows of a deleted account stay until they expire (ninety days); they hold a digest and an
  id that no longer names anyone, and the join to `user` finds nothing.
- The known limit of phase 7 stays: clearing the row on success leaks slowly that an
  address has an account (P1-b).
