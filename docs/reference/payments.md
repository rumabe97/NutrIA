# Payments runbook

> **Purpose**: what the owner must do, in order, to turn the tier from
> [`0042`](../decisions/0042-what-a-paid-account-may-spend.md) into something that
> takes money — and which of those steps an agent can do for them.
> **Audience**: humans and agents. **Committed**: yes. **Maintained by**: agents draft,
> owner approves. Update it in the same change that invalidates it.

## Where this starts

The entitlement half is already built and in production, switched off. `user.tier`
is a column, the owner grants it from `/admin`, and `PlanController.tierOf` reads
the `premium` flag first and the column second. **Nothing below changes any of
that.** Billing, when it arrives, is a new writer of the same column.

That ordering is what makes this safe to do in stages: at every point below, the
product works, and the worst case of stopping halfway is that the owner keeps
granting the tier by hand.

## What only the owner can do, and what an agent can

| Step | Who |
| --- | --- |
| Open a Stripe account, get **test** keys | Owner (5 minutes, no verification) |
| Build checkout, the webhook, the portal, the screens | Agent |
| Exercise it with test cards | Agent |
| Business verification, bank account, tax registration | Owner |
| Write the legal pages | Owner, with an agent drafting |
| Switch to live keys | Owner |

The important line is the first one: **test keys need nothing but an email
address**. They are not the same as being able to take money, and they are enough
for everything an agent has to do.

---

## 1. A Stripe account, in test mode

Sign up at `dashboard.stripe.com`. Do not fill in the business details yet — the
dashboard opens in **test mode** and hands out test keys immediately.

Take three values from *Developers → API keys*:

- `pk_test_…` — publishable. Safe in a browser, and only ever used there.
- `sk_test_…` — secret. **Never leaves the API.** It is the one key on this page
  that can move money.
- The webhook signing secret (`whsec_…`) comes later, in step 3, because it is
  created with the endpoint.

The rule this codebase already applies to AI keys applies unchanged here: the
secret key lives in `apps/api`'s environment and never crosses the network to a
browser.

## 2. A product and a price

*Product catalogue → Add product*. One product, one recurring price, in euros,
monthly.

Two decisions worth making before clicking, because changing them later means
migrating people who already subscribed:

- **The amount.** It should be defensible against what the tier grants — three
  redos a fortnight instead of one, twenty swaps instead of five — and against
  what a redo costs to serve.
- **Monthly or yearly, or both.** Two prices on one product is fine and is the
  usual answer; a yearly price is a discount you cannot easily take back.

Copy the price id (`price_…`). It goes in the environment, not in the code: the
same build has to work against a test price and a live one.

## 3. The environment

On the **`nutria-api`** Vercel project, not the web one:

| Variable | Value | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_…` | Secret. Rotate it if it is ever pasted anywhere it should not be. |
| `STRIPE_PRICE_ID` | `price_…` | Which price checkout opens with. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | From step 3b. Without it, every webhook is rejected — which is correct. |

All three are optional in `Env.validation.ts`, in the same way `SENTRY_DSN` is:
**unset, payments are off and nothing about them is reachable.** That is what
lets this ship before the account exists.

### 3b. The webhook endpoint

*Developers → Webhooks → Add endpoint*, pointing at
`https://<api origin>/api/v1/billing/webhook`, subscribed to:

- `checkout.session.completed` — somebody paid.
- `customer.subscription.updated` — a plan changed, or a payment failed and the
  subscription went `past_due`.
- `customer.subscription.deleted` — a subscription ended.

Stripe shows the signing secret once, when the endpoint is created.

**Why the webhook and not the redirect back from checkout:** the browser
returning from Stripe proves nothing — anybody can request that URL. The webhook
is signed, and its signature is verified against the secret above before a single
byte of it is trusted. This is the same rule as everywhere else here: never trust
state that arrives from a client.

## 4. What gets built (agent)

- A `subscriptions` table: the Stripe customer and subscription ids, the status,
  and the period end. `user.tier` stays the one thing the product reads, and the
  webhook is what writes it. Two writers of one column — the owner and the
  webhook — with the flag still outranking both.
- `POST /billing/checkout` — creates a Checkout Session for the signed-in account
  and answers with its URL. No card details ever touch this service.
- `POST /billing/webhook` — `@Public()`, because Stripe has no session, with the
  signature as the only authority. Unsigned or badly signed is a 404 like every
  other denial.
- `POST /billing/portal` — a link to Stripe's own customer portal, which is where
  somebody cancels or changes their card. Not rebuilt here: a cancellation flow
  written by hand is a cancellation flow with a bug in it, and the one thing worse
  than not selling is not letting somebody stop paying.
- The screens, in both languages, behind the `premium` flag.

Exercised with Stripe's test cards, including the ones that fail: `4242…4242`
succeeds, `4000…0341` fails after attaching, `4000…3155` requires
authentication. A payment path is not tested until the failures are.

## 5. Before live keys — the part that is not code

None of this is advice, and none of it is something an agent should decide. It is
the list of things that will otherwise stop the account being activated, or cause
a problem after it is.

- **Business verification.** Stripe asks for identity, an address and a bank
  account before it will pay out.
- **VAT.** Selling a digital subscription to consumers in the EU means VAT at the
  customer's rate, not the seller's. Stripe Tax will calculate and collect it;
  registering and filing is still the seller's. Worth an accountant's hour before
  the first sale rather than after.
- **The legal pages a subscription needs**: terms, a privacy policy that says what
  is collected (this one is health data, which is a special category under GDPR
  Article 9 and is already treated as such in the architecture), and a
  cancellation and refund policy. EU consumers have a 14-day withdrawal right on
  distance contracts; for a service that starts immediately it can be waived, but
  only with express consent recorded at the point of sale. An agent can draft
  these; somebody who knows Spanish consumer law should read them.
- **A domain.** Checkout works from a `*.vercel.app` origin, but a payment page on
  a hostname that is not yours is a payment page people abandon.

## 6. The switch order, going live

1. Live keys and the live price id replace the test ones on `nutria-api`.
2. A second webhook endpoint, in live mode, with its own signing secret.
3. Buy something, once, with a real card. Refund it from the dashboard.
4. Only then, turn the `premium` flag on in `/admin`.

Step 4 last, on purpose: the flag is what makes the tier exist for anybody, so
until it is thrown, a broken payment path is invisible to every user rather than
visible to all of them.

## 7. What to do if it goes wrong after launch

Turn the `premium` flag off. Everybody returns to the free allowances
immediately, no rows change, and every grant is still there when it goes back on.
Subscriptions keep running at Stripe — that is a separate decision, made in the
dashboard, and it should be made deliberately rather than as part of an
emergency.
