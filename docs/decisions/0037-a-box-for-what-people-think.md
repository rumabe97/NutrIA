# 0037 — A box for what people think

**Status**: accepted · **Date**: 2026-09-10 · **Deciders**: owner, agent

## Context

Everything on the roadmap after this point is a guess about what people want
until one of them says so. The product has real accounts and no way for any of
them to tell the owner anything — the only signal is the funnel, which says
where people stop and never why.

## Decision

**A signed-in person can write to the owner, and the owner has an inbox.**

- `feedback` holds the message, a kind (`idea`, `problem`, `other`), and
  `handled_at`. Three kinds and no more: the field exists so a wall of text can
  be read as a queue, and a taxonomy with eight branches is one nobody fills in
  honestly.
- Signed in, because a reply needs somewhere to go and an anonymous box is a
  spam box. Rate limited to five an hour — far above what a person with
  something to say needs, far below what a script wants.
- `handled_at` is what makes it an inbox rather than a growing wall, and it is
  **reversible**: "handled" is a note the owner leaves themselves, and a note you
  cannot take back is one people stop making.

## The one admin read that carries a person

Every other read on `/admin` is careful to carry nothing about anybody — no
dish, no profile, and the account list is address, dates and role. This one
carries the message *and* the address, and that is not an exception being
smuggled in: **the message was written to be read, by a person, who is expected
to answer it.** The address is what makes answering possible.

Nothing summarises it, nothing infers from it, and it never reaches a model. It
is delivered as typed.

## Consequences

- Deleting an account takes its messages with it: the row is user-owned and
  cascades, like everything else that references a person.
- The form lives on the profile, which is where "about me and this app" already
  is. It is deliberately small — a kind, a box, a button. Every extra field is a
  reason not to bother, and somebody troubling to say what they think is fragile
  enough already.
- What is not built: replying from inside the product. The owner has the address
  and an email client, and a reply feature would be a mailbox with worse
  deliverability and a new place for private words to sit.
