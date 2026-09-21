# 0058 — Somebody can arrive through Google or Apple, and an unconfirmed address is never joined

**Status**: accepted · **Date**: 2026-09-21 · **Deciders**: owner, agent

## Context

Signing up meant a name, an address, a password, and then a confirmation link before the
account did anything. The owner asked whether people could sign in "con google, con
icloud, con alguna más". On a phone, where this product is used, a password typed once and
a mail opened in another app is the longest part of the first ten minutes.

Three things in the existing design made it more than adding a provider to a list.
An account has **two locks** (`0030`, `0031`): the address confirmed, and the account
opened — by itself when registration is open, by the owner when it is not — and the second
is turned by a hook that runs when the confirmation link is clicked. Account linking was
**off**, so a second way in with the same address was an error. And the sign-in pages are
**static**, so they cannot ask an environment variable what to draw.

## Decision

- **Google and Apple, each behind its own credentials, and none by default.** A provider
  exists when its variables do: `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`;
  `APPLE_OAUTH_CLIENT_ID`, `APPLE_OAUTH_TEAM_ID`, `APPLE_OAUTH_KEY_ID` and
  `APPLE_OAUTH_PRIVATE_KEY`. Each set is whole or absent — half of one is refused at boot,
  because it draws a button that ends in an error page. With none, nothing changed: no
  button, no linking, no new route that does anything.
- **Apple's client secret is signed here, at boot.** Apple has no secret to paste: it wants
  an ES256 JWT, signed with the key from the developer account, and a new one at least
  every six months. `SocialProviders.ts` signs it from the four values when the process
  starts, with `node:crypto` and no JWT library. A secret pasted by hand is a calendar
  reminder that ends in an outage.
- **Only an identity is asked for.** The default scopes — the address and a name. No
  offline access, no provider API called on anybody's behalf, and what the provider hands
  back is stored encrypted (`encryptOAuthTokens`).
- **An account born through a provider passes the first lock and meets the second like
  everybody else.** It is created with its address already confirmed, because the provider
  vouched for it, so no verification link is ever sent and the hook behind that link never
  runs. `onAccountCreated` is that moment for them: it runs after the row is committed, and
  does what confirming an address does — opens the account when registration is open, tells
  the owner one is waiting when it is not. A provider that does *not* vouch for the address
  produces an unconfirmed account and the ordinary link.
- **Linking is on only while a provider is, and only in one shape.** Somebody who signed up
  with a password and later arrives through Google with the same address is the same
  person. Two conditions, both Better Auth's, both left strict:
  - the provider must itself say the address is verified — no provider is listed as
    *trusted*, which would waive that;
  - the local account must already have confirmed its address
    (`requireLocalEmailVerified`).

  The second is the one that matters. Without it, anybody could sign up with a stranger's
  address and a password of their own, wait, and be handed the account — health data
  included — the day the stranger arrived through Google. Refused, the person is sent back
  to the sign-in page, which says the account exists, is unconfirmed, and that the way in is
  the password or a reset.
- **A password reset ends every session of that account** (`revokeSessionsOnPasswordReset`).
  It is what makes that advice safe: a reset is somebody proving the address is theirs,
  often because somebody else got there first and still holds a session.
- **The API says which buttons to draw.** `GET /settings/sign-in-providers` is public and
  lists the configured providers in display order; it says nothing the page does not give
  away by drawing them. The web app asks it on the server and keeps the answer five minutes
  (`lib/sign-in-providers.ts`), so the pages stay static, the buttons are in the first
  paint, and a provider switched on needs no deploy. Any failure is no buttons.
- **The buttons are secondary, identical in size, and follow their owners' rules.** The
  form's submit stays the one primary action (`0057`). Google's mark keeps its four colours
  on every background — the one hex value in the app that is not a token, because it is not
  ours to theme; Apple's is one shape in the label's colour. Neither is drawn louder than
  the other, which Apple requires wherever its button sits beside somebody else's.
- **A tab that left for a provider finishes signing in when it comes back.** The password
  form clears the last person's offline copies (`0053`) and reconciles the language before
  it navigates. A provider round trip lands straight on a signed-in screen, so the copies
  are cleared before leaving, and a note in `sessionStorage` tells the app shell to
  reconcile the language once (`ArrivalSync`).

## Alternatives considered

- **A `NEXT_PUBLIC_` list of providers on the web app.** No request and no revalidation, and
  two places that must agree: a button the API cannot honour is the failure it invites.
- **Listing the providers as trusted.** Links even when the provider does not assert the
  address. It buys nothing with Google and Apple, which always assert it, and it is the
  setting that turns a provider's mistake into an account takeover.
- **Linking into an unconfirmed account and deleting its password.** Friendlier to the
  person whose address was squatted, and it means writing credential surgery by hand in the
  one part of the app where that was deliberately never done (`auth.config.ts`).
- **A pasted Apple client secret.** Two variables fewer, and sign-in with Apple stops
  working every six months until somebody remembers why.
- **Microsoft, Facebook.** Microsoft is a registry entry and a mark away, and worth adding
  when somebody asks with an Outlook address. Facebook needs an app review and brings a
  tracker's reputation to a product that holds health data.
- **Passkeys.** The better answer to "no password", and a different project: they replace
  the credential rather than delegate it. Nothing here is in their way.

## Consequences

- Nothing changes in production until the owner creates a Google OAuth client and sets two
  variables. Apple needs the developer programme (99 USD a year) — the same membership the
  App Store step of the roadmap needs, where offering Google without Apple is refused in
  review.
- The redirect to register with each provider is `{BETTER_AUTH_URL}/{API_PREFIX}/auth/callback/{provider}`
  — the **web** origin in the deployed shape, since the browser only ever talks to it.
- An account may now have no password. Password reset still works for it (it sets one);
  deleting the account is unchanged.
- `social-sign-in.e2e-spec.ts` proves the locks and the linking rules on the real tables
  with the provider's token exchange answered by the test; nothing in the suites calls
  Google. The exchange itself can only be tried with real credentials.
- A third provider is: its variables and their rule in `Env.validation`, an entry in
  `SocialProviders.ts`, a mark and a name in the web app. `parseProviders` drops a provider
  the web app cannot draw, so the API may go first.
