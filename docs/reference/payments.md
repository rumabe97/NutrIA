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
| Write the legal pages | Drafted by an agent and live since 2026-09-21 (`/privacidad`, `/condiciones`); the owner still owes them a reading by somebody who knows Spanish consumer law |
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

Copy the price id (`price_…`) — the **price's**, not the product's (`prod_…`), which
the API refuses. It goes in the environment, not in the code: the same build has to
work against a test price and a live one.

**Give the product a tax code.** New Stripe accounts have *Managed Payments* on by
default, and with it checkout refuses a product with no tax code: `Invalid
line_items[0]: the product tax code is missing` — a 500 from `POST /billing/checkout`.
Set the product's tax code to the one for a software subscription (SaaS / electronically
supplied service) under *Product → Tax code*. Whether to keep Managed Payments on at
all is a decision for § 5, not for this step.

## 3. The environment

On the **`nutria-api`** Vercel project, not the web one:

| Variable | Value | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_…` | Secret. Rotate it if it is ever pasted anywhere it should not be. |
| `STRIPE_PRICE_ID` | `price_…` | Which price checkout opens with. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | From step 3b. Without it, every webhook is rejected — which is correct. |
| `STRIPE_YEARLY_PRICE_ID` | `price_…` | Optional: a second, yearly price on the same product. With it, the card offers monthly and yearly; without it, monthly alone. |

Checkout opens with a **seven-day free trial** for somebody who has never subscribed
(`TRIAL_DAYS`, `0056` amended). Stripe takes the card at the start and charges when
the trial ends. Nothing needs setting for it.

All three are optional in `Env.validation.ts`, in the same way `SENTRY_DSN` is:
**unset, payments are off and nothing about them is reachable.** That is what
lets this ship before the account exists. They are **all three or none**: the API
refuses to boot with only some of them, because a checkout without the webhook
secret would take a card and never grant what was paid for. Create the webhook
(3b) before setting any of them.

Each one checks its prefix, because that is the half that goes wrong. A
publishable key pasted where the secret belongs fails every call at Stripe with a
message about key types, and an `sk_live_` key reaching a preview deployment is
the mistake that charges somebody real money from a test.

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

### 3c. The customer portal, once, in test mode

*Settings → Billing → Customer portal*: save the settings once, even unchanged. Until
they are saved, Stripe refuses to open a portal session in test mode, and "Gestionar la
suscripción" answers with an error.

### 3d. Trying it

With the test keys set and the API redeployed, the premium card appears on **your**
profile, and on nobody else's: test keys open billing to the owner alone, whatever the
`premium` switch says (`0056`). Pay with `4242 4242 4242 4242`, any future date and any
CVC. You come back to the profile, and within seconds the webhook has made you premium.
"Gestionar la suscripción" opens the portal, where cancelling shows the end date on the
card.

**Locally**, Stripe cannot reach `localhost`, so without a forwarder the payment
succeeds and the account never turns premium. `pnpm dev` runs one beside the apps
(`scripts/stripe-listen.sh`, the `stripe:listen` pane): `stripe listen` forwarding the
four events the webhook acts on to `localhost:<PORT>/<API_PREFIX>/billing/webhook`. It
needs the Stripe CLI installed and `stripe login` done once; without either, or without
`STRIPE_SECRET_KEY` in `apps/api/.env`, it says so and steps aside. The `whsec_…` it
prints is the **local** `STRIPE_WEBHOOK_SECRET` — the same on every run on one machine,
and different from the dashboard endpoint's. The CLI exits when its connection to Stripe
drops, so the script restarts it after five seconds; an event sent while it was down is
lost, and the way to recover one is any change to the subscription in the dashboard
(a metadata key will do) — the webhook re-reads the subscription, whatever the event.

## 4. What gets built (agent) — built 2026-09-13 (`0056`)

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

### 4a. What the webhook and account deletion guarantee — 2026-09-24

The end-to-end suite `apps/api/test/billing.e2e-spec.ts` pins each of these.

- **Stripe's state now, one account at a time.** Every handled event re-fetches the
  subscription. The write locks the account's row, fetches once more under the lock, then
  writes, so a slow delivery cannot leave an older state standing. Stripe calls made under the
  lock take one attempt of at most 5 s per request.
- **Ended stays ended.**
  - `canceled` and `incomplete_expired` are never overwritten by a live status for the same
    subscription.
  - A subscription that doesn't pay never takes the row from one that does.
  - When the stored subscription ends and the customer has another paying one, that other one
    is written instead.
- **One customer per account.** Checkout creates the Stripe customer under the account's row
  lock, and reuses a stored one.
- **Stripe is never told to retry what cannot succeed.** An event whose account no longer
  exists is answered 200 with nothing written, and so is a body the parser refuses (413 or
  415, never a 500).
- **Deleting an account stops the charges first.** Before the account goes:
  1. every open Checkout Session of its customer is expired (sessions are also created to
     expire after 31 minutes);
  2. every subscription that has not ended is cancelled immediately.

  If Stripe fails, the deletion is refused and can be retried.
- **Each deployment only cancels its own orphans.** Local development and production (in test
  mode) share one Stripe account, and both receive its events. So checkout stamps
  `metadata.deployment`, a hash of the database host and name, not a secret. When the
  account is gone:
  - the webhook cancels a live subscription only if the marker is its own;
  - with another deployment's marker, it writes nothing;
  - with no marker (subscriptions opened before the marker existed), it writes nothing
    and reports an error.

  A subscription whose customer differs from the one stored for the account is not written,
  and is reported.
- **Not closed:** a subscription created by hand in the dashboard for a customer this product
  doesn't know is left alone. It isn't ours.

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
  only with express consent recorded at the point of sale. Both pages exist since
  2026-09-21, at `/privacidad` and `/condiciones`, written from what the code does.
  The terms do **not** use the waiver: they give the 14 days from the first charge,
  in full, because checkout records no such consent. Somebody who knows Spanish
  consumer law should still read them before the first real sale.
- **Managed Payments, on or off.** Stripe turns it on by default for new accounts; it
  changes who sells to the customer and so who deals with the VAT above, and it is why
  a product needs a tax code (§ 2). It can be switched off per account in Stripe's
  settings. Decide it with the VAT question, before the first real sale, not by
  default.
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

## 6b. A professional's practice — a second product, its own switch order

Project 004 (`0061`) adds a second thing to sell on the same Stripe account: a
professional's practice, priced by how many active clients it includes. Nothing above
changes — one Stripe account, one webhook, the same test-then-live progression — this is
what is different about it.

**One product, two prices.** *Product catalogue → Add product*, same as § 2: one product
("Consulta" / "Practice"), two recurring monthly prices, each naming how many active
clients it includes (for instance 30 and 60). **This product needs its own tax code**
too, for the same reason as § 2's: Managed Payments refuses a checkout for a product with
none.

**`STRIPE_PRACTICE_PRICES`**, on the `nutria-api` Vercel project, same as the other
`STRIPE_*` variables:

| Variable | Value | Notes |
| --- | --- | --- |
| `STRIPE_PRACTICE_PRICES` | `price_…=30,price_…=60` | The practice's prices and how many active clients each includes, comma-separated `price_…=N` pairs. **Optional** — the API boots without it, exactly as it boots without payments at all — but if it is set, `STRIPE_SECRET_KEY` and the rest of the core three must be too. It **must not name a premium price** (`STRIPE_PRICE_ID` or `STRIPE_YEARLY_PRICE_ID`): one price grants one thing, and a price that were both would grant whichever the code happened to read first. |

`Env.validation.ts` refuses to boot on either mistake, naming which. A price *not* in
this list is read as premium (`0061`, amended) — so **never remove a practice price
while it still has subscribers**: their next event turns them premium and closes their
practice, pausing every link.

**The portal's plan switching.** *Settings → Billing → Customer portal*, the same save
that § 3c already asks for once: turn on "Customers can switch plans" and list the
practice's two prices as the ones they may switch between. Nothing else in the portal
changes — cancelling still goes through the same page.

**The trial.** Checkout opens a practice subscription with a **14-day** free trial for a
professional who has never had one (`PRACTICE_TRIAL_DAYS`) — longer than premium's seven,
and tracked separately, because a practice is a bigger decision to try. Nothing needs
setting for it.

**The switch order, going live.** Distinct from § 6 because it ends in a flag rather than
a tier, and needs a granted professional to prove it against:

1. Create the product and its two prices in Stripe — test mode first, then live, as
   § 6 does for premium.
2. Allow switching between the two prices in the customer portal (above), in both modes.
3. Set `STRIPE_PRACTICE_PRICES` on the `nutria-api` Vercel project, **Production**, with
   the live price ids.
4. Before the switch, as `docs/legal/checklist-activacion.md` § 1 lists: the
   professional's agreement screen live, a read-only count of care links accepted under
   `CARE_CONSENT_VERSION` 1.0.0 (the owner ends and re-invites any live one), Gemini out of
   the models that generate for a professional's clients.
5. Turn the `professional` flag on in `/admin`. With no professional granted, it shows
   nothing to anybody.
6. **Then** grant professionals from `/admin`, one at a time, each collegiate number
   checked in its college's public register. The grant e-mail links to `/consulta`, which
   only opens with the flag on — that is why the flag comes first (amended 2026-09-25; it
   used to come last). Each professional accepts the agreement and the practice
   conditions before anything else opens; have the first buy a practice for real once —
   the same "buy something, refund it" step § 6 asks for premium.

Also see [`deployment.md`](./deployment.md) § 2 for `STRIPE_PRACTICE_PRICES`'s row in the
API's full environment table.

## 7. What to do if it goes wrong after launch

Turn the `premium` flag off. Everybody returns to the free allowances
immediately, no rows change, and every grant is still there when it goes back on.
Subscriptions keep running at Stripe — that is a separate decision, made in the
dashboard, and it should be made deliberately rather than as part of an
emergency.
