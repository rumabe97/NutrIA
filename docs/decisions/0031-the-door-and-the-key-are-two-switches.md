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
