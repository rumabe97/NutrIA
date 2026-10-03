# 0083 — Treat a user-verified passkey as a passwordless door as strong as a second factor

- **Status**: accepted
- **Date**: 2026-10-03
- **Project**: [docs/projects/011-accounts-are-harder-to-take](../projects/011-accounts-are-harder-to-take/) (phase 5)
- **Amends**: [`0074`](./0074-accounts-are-guarded-by-a-server-password-rule-and-an-optional-second-factor.md),
  which lists passkeys among "the methods" of the second factor and says a passkey does
  not stand in for the TOTP that professionals and the admin must have.

## Context

Phase 5 added Better Auth's passkey plugin. A passkey sign-in (`/passkey/verify-authentication`)
opens a full session at once. The two-factor plugin challenges only `/sign-in/email`, so
it never asks for a TOTP code there. That happens whether or not the account has TOTP on.

`0074` called passkeys a second-factor method. In code, a passkey is something else: a
**separate door** that needs no password. The invariant review of phase 5 asked us to
state that on purpose, along with the rules that make the door safe. Those rules were
decided across the phase (the lead, delegated by the owner on 2026-10-03).

## Decision

- **A passkey is a passwordless door with the strength of a second factor.** Every
  registration and every sign-in must verify the person (WebAuthn user verification:
  Face ID, a fingerprint or the device's code). The options ask for it
  (`userVerification: 'required'`), and the plugin's `afterVerification` hooks refuse an
  answer without the UV flag. A passkey sign-in is therefore two factors in one gesture:
  the device held and the person who unlocked it. A key used on possession alone never
  signs in.
- **An account with TOTP on that adds a passkey signs in with it without a TOTP code, on
  purpose.** The person had to pass the TOTP door, or prove their password from a
  session, to add the key in the first place (below).
- **Adding one is gated:**
  - The address must be confirmed. Otherwise both steps answer 403
    `EMAIL_CONFIRMATION_REQUIRED`.
  - A password account confirms its password at `/passkey/confirm-password`. That leaves
    a single-use grant for that session, valid for ten minutes (`passkey-grant-<sessionId>`
    in `verification`). The options step only reads the grant. The verify spends it in
    one `DELETE … RETURNING` before the plugin runs, so two parallel verifies cannot share
    one confirmation. A verify the plugin then refuses has spent the grant all the same.
    Without a live grant, both steps answer 403 `PASSWORD_CONFIRMATION_REQUIRED`.
  - An account with no password adds one only from a session less than ten minutes old.
    Otherwise it gets 403 `SESSION_NOT_FRESH`.
- **Any password change forgets every passkey**, whether from Seguridad or by a reset. The
  passkeys go in the same transaction that clears the breach mark and writes
  `auth.password_changed`, with one `auth.passkey_removed` row per key, and the mail
  says how many went. If that transaction fails, the passkeys are deleted again on their
  own. If that fails too, the error line `passkeys_not_removed {"userId"}` is written.
  This follows the trusted devices (`0074`, phase 3): a key added from a stolen session
  must not outlive the password that throws its holder out.
- **Another account's passkey is the guard's 404**, byte for byte the answer for an id
  that does not exist, on delete and on rename.
- **A passkey sign-in cancels the owner's pending removal of the second factor**, as a
  correct code does. Whoever can unlock one of the account's keys has not lost the account.
- **No WebAuthn challenge reaches a log line.** Better Auth's `logger` goes through
  `withoutChallenges`.

## Alternatives considered

- **Ask for the TOTP code after a passkey sign-in**: Better Auth has no hook for it on that
  route. It would also turn the phishing-resistant factor into a weaker step in front of a
  weaker one, which NIST SP 800-63B does not ask for, since a verified, device-bound or
  synced passkey is a multi-factor authenticator by itself.
- **Refuse passkeys on accounts with TOTP on**: this takes Face ID away from exactly the
  people who care about their security.
- **Forget passkeys only on a reset**, as phase 5 first did: a change from Seguridad is
  just as much "somebody else may know it", and the trusted devices already go on both.

## Consequences

- **Professionals and the admin (phase 6).** Phase 6 requires `twoFactorEnabled` for a
  privileged account with a password. That rule looks at whether TOTP is turned on, not
  at how the session was opened. A professional or the admin with TOTP on who adds a
  passkey will reach health data through a passkey sign-in with no TOTP code. This is
  accepted: user verification makes that sign-in two factors. Phase 6's guards must not
  read "no TOTP code in this sign-in" as "no second factor", and its copy must not promise
  that every sign-in asks for the code. The admin should know that a passkey on his
  account is as good as his TOTP for whoever holds his unlocked phone.
- Changing the password now costs the person their passkeys. Seguridad, the reset page and
  the mail say so, and `/privacidad` says "al cambiar o restablecer la contraseña".
- A rollback of the API to before phase 5 leaves passkeys that the old API never removes
  on a change or reset. Redeploying after a rollback must first run `DELETE FROM passkey`,
  or delete the rows of the accounts that changed or reset their password in the meantime
  (`0059`'s header).
- The web must handle `EMAIL_CONFIRMATION_REQUIRED`. It must also handle a confirmation
  that is spent by a refused verify: the next attempt answers
  `PASSWORD_CONFIRMATION_REQUIRED`, and the person confirms again.
- A second account that offers a credential id already registered meets the UNIQUE
  constraint inside the plugin's insert. That answers a 500 that says nothing about whose
  id it is, which is accepted.
