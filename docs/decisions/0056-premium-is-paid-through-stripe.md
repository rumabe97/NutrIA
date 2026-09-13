# 0056 — Premium is paid through Stripe, and the owner tries it first

**Status**: accepted · **Date**: 2026-09-13 · **Deciders**: owner, agent

## Context

`0042` built the entitlement half of premium: `user.tier`, the allowances per tier, the
owner granting it from `/admin`, and a `premium` switch that outranks the column. The
payments runbook (`docs/reference/payments.md`) listed what was left for an agent to
build, and the owner asked for it ("Continúa con el premium").

## Decision

- **Stripe's own pages do all the paying.** Checkout takes the card, and the Customer
  Portal is where somebody changes it or cancels. This service only hands out their
  addresses (`POST /billing/checkout`, `POST /billing/portal`), and no card detail passes
  through it. A cancellation flow written by hand is one with a bug in it.
- **The webhook is how the tier changes.**
  - `POST /billing/webhook` is public, and the signature over the raw body is its whole
    authority. `CreateApp` leaves that one route's body unparsed. An unsigned or badly
    signed request is a 404, like every other denial.
  - The webhook does not trust the subscription inside the event. It fetches it from
    Stripe, so an event that arrives late or twice sets the state Stripe has now, never
    an old one.
  - It writes the `subscriptions` row (migration `0031`) and `user.tier` in one
    transaction.
- **What a status means for the tier is decided in one place** (`paysForPremium`):
  - `active`, `trialing` and `past_due` pay; `past_due` still pays because Stripe is
    retrying the card;
  - everything else, including a status Stripe adds later, grants nothing.
- **Who sees it.** With test keys (`sk_test_`), only the owner, whatever the `premium`
  switch says. That lets the owner try the whole path on the real site while nobody else
  is ever offered a checkout that takes no real money. With live keys, everybody, once
  the switch is on.
- **The three `STRIPE_*` values are all or none**, because a checkout with no webhook
  secret would take a card and never grant what was paid for. A live key is refused on a
  preview deployment.
- **Checkout knows the account twice over.** The Stripe customer is created with the
  account id, and so is the subscription's metadata. The customer is the first way the
  webhook finds the account; the metadata is the fallback.
- **The profile has a premium card.** It shows what premium gives, what it costs and the
  one button that fits, and it says that food safety is the same with or without it.
  Coming back from checkout before the webhook has arrived, it says the payment was
  received.

## Alternatives considered

- **Payment Links.** Nothing to build, but nothing ties a payment to an account either,
  and matching them up afterwards is the manual work this removes.
- **Trusting the redirect back from checkout.** Anybody can request that address. Only
  the signed webhook proves a payment.
- **A merchant of record (Paddle, Lemon Squeezy).** They collect and file EU VAT
  themselves, for a higher fee than Stripe's. That is a real option, and one to weigh
  before live keys rather than after. The code here is built around one gateway
  (`StripeGateway`), so switching would be a contained change.

## Consequences

- Nothing changes for anybody until the owner sets the three keys: first test keys (the
  owner sees the card), then live keys and the `premium` switch.
- An account that pays and also had premium granted by the owner loses it when the
  subscription ends. Whatever Stripe says last is written, and the owner can grant it
  again.
- Before live keys, the non-code list in the runbook still stands: business
  verification, VAT, the legal pages, a domain.
