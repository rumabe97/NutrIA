# 0031 — The door and the key are two switches

- **Status**: accepted
- **Date**: 2026-09-09
- **Project**: none (task, at the owner's decision)

## Context

`0030` separated confirming an address from opening an account. That left the
owner with one control — activation — and no way to stop accounts being
created in the first place. On a free tier those are different worries: a rush
of sign-ups costs nothing until each one is opened, but every one of them is an
email address this product now holds, and a burst of them is a burst of notices.

The owner asked for registration to be open, and for a way to close it.

## Decision

**Two switches, and they answer different questions.**

- **The door** — `app_settings.registration_open`, thrown from `/admin`.
  Closed, `POST /auth/sign-up` is refused with 403 and the form says the door is
  shut rather than apologising for a failure. Checked in Better Auth's
  `user.create.before` hook, which is the last moment before the write: an
  account created and then refused is still an account, and an address held for
  nothing.
- **The key** — `activated_at`, unchanged from `0030`. Only an admin sets it,
  by the button in their mail or from the queue on the screen. Confirming an
  address does not and cannot.
- Open is the default when no row exists. A service that starts refusing new
  accounts because a settings row went missing fails closed for the wrong
  reason; closing is a deliberate act and it leaves a row saying so.

## Consequences

- Registration is open to everyone, and everyone who signs up waits for the
  owner. Those are now two independent facts rather than one policy.
- The setting is a table rather than an environment variable because a variable
  needs a redeploy, and "stop letting people in" is a decision made on a phone
  while something is going wrong.
- `app_settings` holds a key, a boolean and a timestamp, and should stay that
  small. Anything needing more shape than a switch is a feature.

## Amendment — 2026-09-09 — the door also decides who turns the key

Two switches, still. What changes is that the first one now says how the second
is turned:

| `registration_open` | Signing up | Confirming the address |
| --- | --- | --- |
| **true** | Anyone | Opens the account — self-service |
| **false** | Refused, 403 `REGISTRATION_CLOSED` | Confirms the address and nothing else; an admin opens it |

`afterEmailVerification` reads the door and, when it is open, writes
`activated_at` for that account. Before this, confirming an address opened
nothing under any setting, so "open registration" meant a queue that the owner
had to work through by hand — a door with nobody allowed through it.

Three details worth keeping:

- **The door is read when the link is clicked, not when the account was
  created.** Somebody who signs up while it is open and confirms after it shuts
  is waiting. Closing the door is meant to stop people arriving, and someone who
  has not finished arriving has not arrived.
- **The write never fails the verification.** The address is confirmed by then;
  a settings read that breaks leaves the account waiting, which an admin can
  still open. The opposite — an error page on a link that worked — would lose
  the confirmation too.
- **`activated_at` still means one thing**: the account is open. Who wrote it,
  the person or the owner, is not a distinction any guard makes, and adding one
  would be a second door pretending to be a fact.

The screens follow the same split. `/pendiente` asks the API which wait this is
and says so — "confirm your email" when it is one click, "we will open your
account" when it is a person. The switch on `/admin` says what each position
means now, and the owner's notice says whether the account will open itself.

The trade this makes explicit: with the door open, the only thing standing
between a stranger and a generated plan is a confirmed mailbox. That is the
point of being able to shut it in one click, and the reason the roadmap keeps
provider quota next to it.
