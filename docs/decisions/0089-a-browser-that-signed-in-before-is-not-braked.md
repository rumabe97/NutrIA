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
- **`hooks.before` on `/sign-in/email` exempts a valid cookie of the account that owns the
  typed address from the address's wait, and counts it apart.** Its attempts are counted
  by the same rule under a key of its own, an HMAC of the cookie's token labelled
  `sign-in-device-brake:`, in the same `sign_in_failure` table: ten wrong passwords in
  fifteen minutes, then the same 429 and waits, in its own bucket. A stolen cookie is a
  bearer token, so it is held to the brake's rate, and the owner's typos slow only that
  browser. The address's row is neither read, written nor cleared for it. A cookie for another account,
  for an address with no account, made up, expired or absent, or a lookup that fails, falls
  through to the brake, so the 429 is byte for byte the one a request with no cookie gets,
  for a known and an unknown address alike.
- **It waives the address's wait and nothing else.** The per-IP limit, the password and
  the two-factor plugin's own lock stand. A successful sign-in by an exempted request
  clears the device's count and leaves the address's row alone, so the owner's sign-in
  does not give an attacker a fresh window of ten.
- **A change or a reset of the password deletes every device cookie of the account**, in the
  transaction that clears the breach mark and removes the passkeys, and on its own if that
  transaction fails. Closing every other session, or all of them, ends them too
  (`/revoke-other-sessions`, `/revoke-sessions`; not `/revoke-session`), like trusted
  devices: a lost laptop's browser goes with its sessions. **Deleting the account** deletes
  them, and the trusted devices, in `beforeDelete`, best effort (a miss costs only the
  expiry).

## Alternatives considered

- **A signed stateless cookie** — rejected: a password change could not end it without a
  per-account version to store and read on every sign-in, which is the row anyway.
- **A dedicated table** — rejected: the `verification` table already holds trusted devices
  and the mail budget, with the same expiry and sweep; a table is a migration the old API
  runs beside during a deploy, for no property the existing rows lack.
- **Counting the cookie's attempts against the address** — rejected: its typos would
  lengthen the wait of every client that has none. (Not counting them at all was the first
  design and was rejected by the invariant review: a stolen cookie would guess at the
  per-IP rate, about 26,000 a day, against the brake's hundred.)
- **Earning the cookie on a right password alone** — rejected: for an account with a
  second factor the sign-in is not complete, and the cookie should witness a completed one.
- **Email a "new device" link or a one-time unlock** — out of scope (PLAN 011 "Out of
  scope"): a second mail path to abuse.

## Consequences

- An attacker who knows an address can still brake it for every client without the cookie,
  the owner's phone or laptop that has signed in before excepted. A person on a new
  browser, or after a password change, still waits it out, or uses a passkey, Google or a
  reset.
- A stolen cookie is held to the brake's rate in its own bucket, and ends with the password,
  a closing of sessions or the account. An attacker with a stolen cookie has one more
  bucket per cookie, never the address's.
- A new first-party cookie, strictly necessary to the sign-in's security; `/privacidad`'s
  cookie list should name it (the lead's, with `legal`).
- A deleted account takes its device rows with it, so `/privacidad`'s "al borrarla, todo lo
  que hay en ella se borra al momento" holds for them (`legal`, P2).
- The known limit of phase 7 stays: clearing the row on success leaks slowly that an
  address has an account (P1-b).
