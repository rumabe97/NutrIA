# 0042 — What a paid account may spend, and one switch that decides it exists

**Status**: accepted · **Date**: 2026-09-10 · **Deciders**: owner, agent

## Context

The roadmap has said for weeks that the honest line to charge for is the one
that costs money: AI generations beyond a free allowance. It also said the
machinery was half-built, and it was right. `ALLOWANCES` has held two numbers in
one place since [`0015`](./0015-one-redo-a-fortnight-five-swaps-a-plan.md), with
a comment saying a paid tier would raise them — which is exactly the reason they
were two numbers in one place rather than rules spread over the routes.

Separately, `app_settings` has been a feature-flag table since
[`0031`](./0031-the-door-and-the-key-are-two-switches.md) — a key, a boolean, a
timestamp — with one key in it, read through a method named after that key.

## Decision

### The switches are a registry

`core/domain/Flag` is the one place that says which switches exist. Each entry
carries its row key, what an absent row means, and who may read it.

**A flag must say which way it fails**, because the answer differs per flag and
the day it matters is the day the table is empty — a fresh deploy, or a
migration that ran before a seed. `automaticActivation` falls back to **on**: a
service that starts queueing everybody because a row went missing fails shut for
the wrong reason. `premium` falls back to **off**: a missing row must never be
what puts a price in front of somebody or raises what an account may spend.

**A flag must say who may read it.** `GET /settings` answers any signed-in
caller, and reasoned carefully about that when there was one switch to expose.
With several the reasoning stops holding: an operational switch is nobody's
business but the owner's. Each flag declares its audience; the signed-in read
carries only the ones that decide what a screen shows.

**A key is never renamed.** The row *is* the state. A renamed key reads as a
switch nobody ever threw, silently restoring the fallback that somebody
deliberately moved away from.

### The tier is a column, and the switch outranks it

`user.tier` is `free` or `premium`, and the owner moves an account between them
from `/admin`. What an account may actually spend is
`PlanController.tierOf`: **the flag first, then the column**.

With `premium` off, every account is on the free allowances no matter what its
row says. That ordering is the whole point — turning the tier off is one click
rather than a migration over everybody who was ever granted it, and turning it
back on returns them without touching a row. Granting a tier is deliberately
*not* gated on the flag, so the owner can set up who should have it before
turning it on; gating both would make the two settings depend on the order they
were used in, which is a rule nobody remembers a week later.

The tier is never taken from the caller. It decides whether somebody may spend a
model call, so it is read server-side on every request that asks, like every
other authorisation here.

### What premium raises

Redos go from one a fortnight to three; swaps from five a plan to twenty. A redo
is a model call, which is the cost, and it is the limit people actually ask
about — a plan you cannot re-roll is a plan you are stuck with for a fortnight.
A swap is usually served from the library and costs nothing; its limit exists so
a plan stays a plan rather than becoming a menu, and twenty is generous without
removing the shape.

**Nothing about safety is behind this, and nothing ever will be.** A free
account gets the same allergy gate, the same catalogue and the same nutrition
maths. What is sold is more of the thing that costs money to produce, which is
the only honest thing to sell in a health product.

## Consequences

Payment capture is not here. It needs an account with a payment processor,
its keys and a webhook that can only be exercised against it — and a payment
path that cannot be tested end to end is the "partial data" this codebase
refuses everywhere else. The tier works today with the owner granting it, which
is what the first paying people need anyway. When billing arrives it will bring
a subscription table carrying its own periods, and `user.tier` will say what
that table decided rather than trying to hold the decision itself. That is also
why the column has no dates: while a human grants it, there is nothing to
expire.

An unknown tier resolves to free rather than throwing. The failure that costs
money is the one that grants too much, so the fallback is always the smaller
number.
