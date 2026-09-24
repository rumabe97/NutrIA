import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import Stripe from 'stripe';

import { BillingController } from 'core/controllers/Billing';
import { database } from 'database';
import { SettingsController } from 'core/controllers/Settings';
import { UserController } from 'core/controllers/User';

import { completeOnboarding, httpServer, PREFIX, register } from './harness.js';
import { createApp as assemble } from '../src/config/CreateApp.js';
import { StripeGateway } from '../src/modules/billing/services/StripeGateway.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * Paying for premium (`0056`), over real HTTP and on the real tables.
 *
 * The application is the product's own assembly (`CreateApp`), not the
 * harness's: the webhook's raw-body mount, its 256 kB limit and the 404
 * fallback live there, and a suite that assembled its own would be testing a
 * webhook production does not have.
 *
 * Stripe is never called. The gateway's client — the one object that talks to
 * Stripe — is replaced by `FakeStripe`, whose answers each test decides,
 * throwing included. Everything around it is the product's: the gateway's own
 * mapping of what Stripe returns, and above all its signature check, which
 * runs Stripe's real verifier against bodies this suite signs with Stripe's
 * real test signer.
 *
 * Three deployments run side by side, one per configuration that changes who
 * may buy: none, test keys, and live keys with a yearly price.
 *
 * Requires a real database — see ./README.md.
 */
const SECRET = 'whsec_e2e_billing_suite';
const MONTHLY = 'price_e2e_monthly';
const YEARLY = 'price_e2e_yearly';
const STRIPE_KEYS = ['STRIPE_PRICE_ID', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_YEARLY_PRICE_ID'] as const;
const TEST_KEYS = { STRIPE_PRICE_ID: MONTHLY, STRIPE_SECRET_KEY: 'sk_test_e2e_billing', STRIPE_WEBHOOK_SECRET: SECRET };
const LIVE_KEYS = {
  STRIPE_PRICE_ID: MONTHLY,
  STRIPE_SECRET_KEY: 'sk_live_e2e_billing',
  STRIPE_WEBHOOK_SECRET: SECRET,
  STRIPE_YEARLY_PRICE_ID: YEARLY
};
/** Stripe's own signer: local cryptography, no network. */
const SIGNER = new Stripe('sk_test_e2e_signer');
/** Stripe refuses a signature older than this, in seconds (the SDK's default tolerance). */
const TOLERANCE_SECONDS = 300;
const PERIOD_END = Math.floor(new Date('2026-12-01T00:00:00Z').getTime() / 1000);

type Checkout = Stripe.Checkout.SessionCreateParams;
type Portal = Stripe.BillingPortal.SessionCreateParams;

/** A subscription as `stripe.subscriptions.retrieve` returns it — the fields the gateway reads. */
type StripeSubscription = {
  readonly id: string;
  readonly cancel_at_period_end: boolean;
  readonly customer: string;
  readonly items: { readonly data: readonly { readonly current_period_end: number }[] };
  readonly metadata: Record<string, string>;
  readonly status: string;
};

/**
 * The Stripe client, as far as this product uses it. What it was asked is
 * kept, so a test can say what was bought and for whom; what it answers is set
 * per test. `webhooks` is Stripe's real verifier.
 */
class FakeStripe {
  readonly bought: Checkout[] = [];
  readonly cancelled: string[] = [];
  readonly madeCustomers: { readonly email?: string; readonly metadata?: Stripe.MetadataParam }[] = [];
  readonly portals: Portal[] = [];
  readonly refetched: string[] = [];
  /** What Stripe holds now, by subscription id. */
  readonly now = new Map<string, StripeSubscription>();
  /** Cancelling fails, as it does when Stripe cannot be reached. */
  failCancel = false;
  /** Answers a re-fetch instead of `now` — to fail, or to hold an answer back. */
  refetch: ((id: string) => Promise<StripeSubscription>) | null = null;

  readonly webhooks = SIGNER.webhooks;

  readonly billingPortal = {
    sessions: {
      create: (params: Portal) => {
        this.portals.push(params);

        return Promise.resolve({ url: `https://billing.stripe.test/${params.customer ?? ''}` });
      }
    }
  };

  readonly checkout = {
    sessions: {
      create: (params: Checkout) => {
        this.bought.push(params);

        return Promise.resolve({ url: `https://checkout.stripe.test/${this.bought.length}` });
      }
    }
  };

  readonly customers = {
    create: (params: { email?: string; metadata?: Stripe.MetadataParam }) => {
      this.madeCustomers.push(params);

      return Promise.resolve({ id: `cus_e2e_${Date.now()}_${this.madeCustomers.length}` });
    }
  };

  readonly prices = {
    retrieve: (id: string) =>
      Promise.resolve({ id, currency: 'eur', recurring: { interval: id === YEARLY ? 'year' : 'month' }, unit_amount: id === YEARLY ? 4990 : 499 })
  };

  readonly subscriptions = {
    cancel: (id: string) => {
      if (this.failCancel) {
        return Promise.reject(new Stripe.errors.StripeConnectionError({ message: 'Stripe is unreachable' }));
      }

      const held = this.now.get(id);

      this.cancelled.push(id);

      // As Stripe does: the subscription is cancelled from now on, so a retried deletion finds nothing to cancel.
      if (held) {
        this.now.set(id, { ...held, status: 'canceled' });
      }

      return Promise.resolve({ id, status: 'canceled' });
    },
    /** Stripe's default list leaves cancelled subscriptions out. */
    list: (params: { customer: string; limit?: number; starting_after?: string }) =>
      Promise.resolve({
        data: [...this.now.values()].filter(held => held.customer === params.customer && held.status !== 'canceled'),
        has_more: false
      }),
    retrieve: (id: string) => {
      this.refetched.push(id);

      if (this.refetch) {
        return this.refetch(id);
      }

      const found = this.now.get(id);

      return found ? Promise.resolve(found) : Promise.reject(new Error(`No such subscription: ${id}`));
    }
  };

  /** Stripe now holds this subscription, in this state. */
  hold(id: string, customer: string, status: string, extra: { cancelAtPeriodEnd?: boolean; userId?: string } = {}): StripeSubscription {
    const subscription: StripeSubscription = {
      id,
      cancel_at_period_end: extra.cancelAtPeriodEnd ?? false,
      customer,
      items: { data: [{ current_period_end: PERIOD_END }] },
      metadata: extra.userId ? { userId: extra.userId } : ({} as Record<string, string>),
      status
    };

    this.now.set(id, subscription);

    return subscription;
  }
}

type Deployment = { readonly app: INestApplication; readonly stripe: FakeStripe };

/**
 * One deployment with these Stripe values. The environment is read once, while
 * the application is built, and put back straight after so the next one starts
 * from the suite's own.
 */
async function deploy(values: Partial<Record<(typeof STRIPE_KEYS)[number], string>>): Promise<Deployment> {
  const saved = Object.fromEntries(STRIPE_KEYS.map(key => [key, process.env[key]]));

  for (const key of STRIPE_KEYS) {
    if (values[key]) {
      process.env[key] = values[key];
    } else {
      delete process.env[key];
    }
  }

  let app: INestApplication;

  try {
    app = await assemble();
  } finally {
    for (const key of STRIPE_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  }

  const stripe = new FakeStripe();
  const gateway = app.get(StripeGateway);

  Object.assign(gateway, { client: stripe });
  // The seam is the gateway's private client. If it ever moves, every call
  // below would go to the real Stripe — so prove it held before relying on it.
  expect((gateway as unknown as { stripe(): unknown }).stripe()).toBe(stripe);

  return { app, stripe };
}

function eventBody(type: string, object: Record<string, unknown>, id = `evt_e2e_${Math.random().toString(36).slice(2)}`): string {
  return JSON.stringify({
    id,
    api_version: '2025-01-01',
    created: Math.floor(Date.now() / 1000),
    data: { object },
    livemode: false,
    object: 'event',
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type
  });
}

function signature(payload: string, secret = SECRET, timestamp = Math.floor(Date.now() / 1000)): string {
  return SIGNER.webhooks.generateTestHeaderString({ payload, secret, timestamp });
}

/** A delivery from Stripe: the exact bytes, and a header over them unless one is given. */
function deliver(app: INestApplication, payload: string, header: string | null = signature(payload)) {
  const call = request(httpServer(app)).post(`/${PREFIX}/billing/webhook`).set('Content-Type', 'application/json');

  return (header === null ? call : call.set('Stripe-Signature', header)).send(payload);
}

/** An event about a subscription, whose body says `claimed` — which Stripe's re-fetch may contradict. */
function aboutSubscription(type: string, id: string, customer: string, claimed: string): string {
  return eventBody(type, { id, customer, metadata: {}, object: 'subscription', status: claimed });
}

/** A subscriptions row, as the table holds it. */
type Row = {
  readonly cancelAtPeriodEnd: boolean;
  readonly currentPeriodEnd: Date | null;
  readonly status: string | null;
  readonly stripeCustomerId: string;
  readonly stripeSubscriptionId: string | null;
  readonly userId: string;
};

/** The tagged-template client under the product's pool (postgres.js), as far as this suite uses it. */
type Sql = { <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>; (identifier: string): unknown };

/**
 * Plain SQL on the product's own pool. Drizzle's query builder is out of reach
 * here: the suite's module resolution finds a second copy of `drizzle-orm`
 * whose types do not meet the one `database` was built against, and the same
 * split hides `$client` from the type — it is there at runtime.
 */
function pool(): Sql {
  return (database() as unknown as { $client: Sql }).$client;
}

async function rowsWhere(column: 'stripe_customer_id' | 'stripe_subscription_id' | 'user_id', value: string): Promise<Row[]> {
  const sql = pool();

  const rows = await sql<(Omit<Row, 'currentPeriodEnd'> & { currentPeriodEnd: string | null })[]>`
    select cancel_at_period_end as "cancelAtPeriodEnd", current_period_end as "currentPeriodEnd", status,
           stripe_customer_id as "stripeCustomerId", stripe_subscription_id as "stripeSubscriptionId", user_id as "userId"
    from subscriptions where ${sql(column)} = ${value}`;

  // The pool hands timestamps back as text; the product reads them as dates.
  return rows.map(row => ({ ...row, currentPeriodEnd: row.currentPeriodEnd === null ? null : new Date(row.currentPeriodEnd) }));
}

/** What the database says about an account: its tier column, and every subscriptions row it owns. */
async function stateOf(userId: string): Promise<{ rows: Row[]; tier: string | null }> {
  const sql = pool();
  const [rows, [account]] = await Promise.all([rowsWhere('user_id', userId), sql<{ tier: string }[]>`select tier from "user" where id = ${userId}`]);

  return { rows, tier: account?.tier ?? null };
}

function rowsOfCustomer(customerId: string): Promise<Row[]> {
  return rowsWhere('stripe_customer_id', customerId);
}

function rowsOfSubscription(subscriptionId: string): Promise<Row[]> {
  return rowsWhere('stripe_subscription_id', subscriptionId);
}

describe('billing', () => {
  const stamp = Date.now();
  const made: { readonly app: INestApplication; readonly cookie: string }[] = [];
  let unconfigured: Deployment;
  let test: Deployment;
  let live: Deployment;
  let serial = 0;

  /** A fresh account, deleted in `afterAll`. Every id below carries the suite's stamp, so nothing collides with a run before. */
  async function account(on: Deployment, label: string, role: 'admin' | 'user' = 'user'): Promise<Account> {
    serial += 1;

    const registered = await register(on.app, `billing-${stamp}-${serial}-${label}@e2e.invalid`);

    made.push({ app: on.app, cookie: registered.cookie });

    if (role === 'admin') {
      await UserController.grantAdmin(registered.email);
    }

    return registered;
  }

  const ids = (label: string) => ({ customer: `cus_${stamp}_${label}`, subscription: `sub_${stamp}_${label}` });

  const checkout = (on: Deployment, who: Account, body: Record<string, unknown> = {}) =>
    request(httpServer(on.app)).post(`/${PREFIX}/billing/checkout`).set('Cookie', who.cookie).send(body);
  const portal = (on: Deployment, who: Account) => request(httpServer(on.app)).post(`/${PREFIX}/billing/portal`).set('Cookie', who.cookie);
  const status = (on: Deployment, who: Account) => request(httpServer(on.app)).get(`/${PREFIX}/billing`).set('Cookie', who.cookie);

  beforeAll(async () => {
    unconfigured = await deploy({});
    test = await deploy(TEST_KEYS);
    live = await deploy(LIVE_KEYS);
    // Every other suite assumes the switch off; this one starts from there too.
    await SettingsController.setFlag('premium', false);
  });

  afterAll(async () => {
    // The switch is global and every later suite assumes the free tier.
    await SettingsController.setFlag('premium', false);

    // These accounts are this suite's own, and the database may outlive it.
    // Their subscriptions rows go with them (the foreign key cascades).
    for (const { app, cookie } of made) {
      await request(httpServer(app)).delete(`/${PREFIX}/users/me`).set('Cookie', cookie);
    }

    const left = await pool()<{ email: string }[]>`select email from "user" where email like ${`billing-${stamp}-%`}`;

    await Promise.all([unconfigured, test, live].map(deployment => deployment?.app.close()));

    expect(left).toEqual([]);
  });

  describe('checkout, status and portal', () => {
    // 1
    it('offers nothing to buy without Stripe set up, and every route says so', async () => {
      const someone = await account(unconfigured, 'unconfigured', 'admin');
      const server = httpServer(unconfigured.app);
      const answer: Response = await status(unconfigured, someone).expect(200);

      expect(answer.body).toEqual({ available: false });
      await checkout(unconfigured, someone, { plan: 'monthly' }).expect(404);
      await checkout(unconfigured, someone, { plan: 'lifetime' }).expect(422);
      await portal(unconfigured, someone).expect(404);

      // No secret configured: even a well-formed signature is nobody's.
      const payload = eventBody('checkout.session.completed', { subscription: 'sub_none' });

      await request(server).post(`/${PREFIX}/billing/webhook`).send({ type: 'checkout.session.completed' }).expect(404);
      await deliver(unconfigured.app, payload).expect(404);
      expect(unconfigured.stripe.bought).toEqual([]);
      expect(unconfigured.stripe.refetched).toEqual([]);
    });

    // 2
    it.each([false, true])('with test keys, shows billing to the owner alone (premium switch %s)', async premium => {
      await SettingsController.setFlag('premium', premium);

      try {
        const owner = await account(test, `test-owner-${premium}`, 'admin');
        const ordinary = await account(test, `test-ordinary-${premium}`);
        const seen: Response = await status(test, owner).expect(200);

        expect(seen.body).toEqual({
          available: true,
          prices: { monthly: { amount: 499, currency: 'eur', interval: 'month' }, yearly: null },
          subscription: null,
          testMode: true,
          tier: 'free',
          trialDays: 7
        });

        const hidden: Response = await status(test, ordinary).expect(200);

        expect(hidden.body).toEqual({ available: false });

        const before = test.stripe.bought.length;

        await checkout(test, ordinary).expect(404);
        await portal(test, ordinary).expect(404);
        expect(test.stripe.bought).toHaveLength(before);
        expect(await stateOf(ordinary.id)).toEqual({ rows: [], tier: 'free' });
      } finally {
        await SettingsController.setFlag('premium', false);
      }
    });

    // 3
    it('with live keys, shows billing to nobody until the premium switch is on, and to everybody after', async () => {
      const owner = await account(live, 'live-owner', 'admin');
      const ordinary = await account(live, 'live-ordinary');

      try {
        for (const who of [owner, ordinary]) {
          const answer: Response = await status(live, who).expect(200);

          expect(answer.body).toEqual({ available: false });
          await checkout(live, who).expect(404);
        }

        expect(live.stripe.bought).toHaveLength(0);
        await SettingsController.setFlag('premium', true);

        for (const who of [owner, ordinary]) {
          const answer: Response = await status(live, who).expect(200);

          expect(answer.body).toMatchObject({
            available: true,
            prices: { monthly: { amount: 499, interval: 'month' }, yearly: { amount: 4990, interval: 'year' } },
            testMode: false
          });
          await checkout(live, who).expect(200);
        }
      } finally {
        await SettingsController.setFlag('premium', false);
      }
    });

    // 4
    it('buys the monthly price by default, for the account asking, and creates its customer once', async () => {
      const buyer = await account(test, 'monthly', 'admin');
      const answer: Response = await checkout(test, buyer).expect(200);
      const bought = test.stripe.bought.at(-1);
      const [row] = (await stateOf(buyer.id)).rows;

      expect((answer.body as { url: string }).url).toMatch(/^https:\/\/checkout\.stripe\.test\//);
      expect(test.stripe.madeCustomers.at(-1)).toEqual({ email: buyer.email, metadata: { userId: buyer.id } });
      expect(row).toMatchObject({ status: null, stripeSubscriptionId: null });
      expect(bought).toMatchObject({
        client_reference_id: buyer.id,
        customer: row?.stripeCustomerId,
        line_items: [{ price: MONTHLY, quantity: 1 }],
        mode: 'subscription',
        subscription_data: { metadata: { userId: buyer.id }, trial_period_days: 7 }
      });

      const customers = test.stripe.madeCustomers.length;

      await checkout(test, buyer, { plan: 'monthly' }).expect(200);
      expect(test.stripe.madeCustomers).toHaveLength(customers);
      expect(test.stripe.bought.at(-1)?.customer).toBe(row?.stripeCustomerId);
    });

    it('buys the yearly price only where one is set, and refuses a plan that does not exist', async () => {
      const buyer = await account(test, 'yearly', 'admin');
      const before = test.stripe.bought.length;

      await checkout(test, buyer, { plan: 'yearly' }).expect(404);
      await checkout(test, buyer, { plan: 'lifetime' }).expect(422);
      await checkout(test, buyer, { plan: 42 }).expect(422);
      expect(test.stripe.bought).toHaveLength(before);

      await SettingsController.setFlag('premium', true);

      try {
        const yearly = await account(live, 'yearly-live');

        await checkout(live, yearly, { plan: 'yearly' }).expect(200);
        expect(live.stripe.bought.at(-1)).toMatchObject({ client_reference_id: yearly.id, line_items: [{ price: YEARLY, quantity: 1 }] });
      } finally {
        await SettingsController.setFlag('premium', false);
      }
    });

    it('lets nothing in the body change what is bought or for whom', async () => {
      const buyer = await account(test, 'forger', 'admin');
      const victim = await account(test, 'forged');

      await BillingController.rememberCustomer(victim.id, ids('forged').customer);
      await checkout(test, buyer, {
        customer: ids('forged').customer,
        customerId: ids('forged').customer,
        plan: 'monthly',
        price: 'price_attacker',
        priceId: 'price_attacker',
        tier: 'premium',
        trialDays: 365,
        userId: victim.id
      }).expect(200);

      const bought = test.stripe.bought.at(-1);
      const [row] = (await stateOf(buyer.id)).rows;

      expect(bought).toMatchObject({
        client_reference_id: buyer.id,
        customer: row?.stripeCustomerId,
        line_items: [{ price: MONTHLY, quantity: 1 }],
        subscription_data: { metadata: { userId: buyer.id }, trial_period_days: 7 }
      });
      expect(row?.stripeCustomerId).not.toBe(ids('forged').customer);
      expect(await stateOf(buyer.id)).toMatchObject({ tier: 'free' });
      expect(await stateOf(victim.id)).toMatchObject({ rows: [{ status: null, stripeSubscriptionId: null }], tier: 'free' });
    });

    // 5
    it('gives the trial once per account: never subscribed has it, subscribed and ended does not', async () => {
      const buyer = await account(test, 'trial', 'admin');

      await checkout(test, buyer).expect(200);
      // An abandoned checkout is not a subscription: the next one still has the trial.
      await checkout(test, buyer).expect(200);
      expect(test.stripe.bought.at(-1)?.subscription_data?.trial_period_days).toBe(7);

      const customer = (await stateOf(buyer.id)).rows[0]?.stripeCustomerId ?? '';
      const { subscription } = ids('trial');

      test.stripe.hold(subscription, customer, 'trialing');
      await deliver(test.app, aboutSubscription('customer.subscription.created', subscription, customer, 'trialing')).expect(200);
      test.stripe.hold(subscription, customer, 'canceled');
      await deliver(test.app, aboutSubscription('customer.subscription.deleted', subscription, customer, 'canceled')).expect(200);
      expect(await stateOf(buyer.id)).toMatchObject({ rows: [{ status: 'canceled' }], tier: 'free' });

      const seen: Response = await status(test, buyer).expect(200);

      expect(seen.body).toMatchObject({ trialDays: null });
      await checkout(test, buyer).expect(200);
      expect(test.stripe.bought.at(-1)?.subscription_data).toEqual({ metadata: { userId: buyer.id } });
    });

    // 6
    it.each(['active', 'trialing', 'past_due'])('refuses a second checkout to somebody whose subscription is %s', async state => {
      const buyer = await account(test, `paying-${state}`, 'admin');
      const { customer, subscription } = ids(`paying-${state}`);

      await BillingController.rememberCustomer(buyer.id, customer);
      test.stripe.hold(subscription, customer, state);
      await deliver(test.app, aboutSubscription('customer.subscription.updated', subscription, customer, state)).expect(200);

      const before = test.stripe.bought.length;

      await checkout(test, buyer).expect(409);
      await checkout(test, buyer, { plan: 'yearly' }).expect(404);
      expect(test.stripe.bought).toHaveLength(before);
      expect(await stateOf(buyer.id)).toMatchObject({ rows: [{ status: state, stripeSubscriptionId: subscription }], tier: 'premium' });
    });

    // 7
    it('opens the portal only for a customer Stripe knows, and only on that account’s own customer', async () => {
      const stranger = await account(test, 'portal-stranger', 'admin');
      const mine = await account(test, 'portal-mine', 'admin');
      const theirs = await account(test, 'portal-theirs', 'admin');

      await portal(test, stranger).expect(404);
      expect(test.stripe.portals.filter(call => call.customer === undefined)).toEqual([]);

      await BillingController.rememberCustomer(mine.id, ids('portal-mine').customer);
      await BillingController.rememberCustomer(theirs.id, ids('portal-theirs').customer);

      const answer: Response = await portal(test, mine).expect(200);

      expect(answer.body).toEqual({ url: `https://billing.stripe.test/${ids('portal-mine').customer}` });
      expect(test.stripe.portals.at(-1)).toMatchObject({ customer: ids('portal-mine').customer });
      expect(test.stripe.portals.at(-1)?.return_url).toMatch(/\/perfil$/);
      expect(test.stripe.portals.some(call => call.customer === ids('portal-theirs').customer)).toBe(false);
    });

    // 8
    it('is a 404 on every route but the webhook without a session', async () => {
      const bought = [test.stripe.bought.length, live.stripe.bought.length];

      for (const on of [test, live]) {
        const server = httpServer(on.app);

        await request(server).get(`/${PREFIX}/billing`).expect(404);
        await request(server).post(`/${PREFIX}/billing/checkout`).send({ plan: 'monthly' }).expect(404);
        await request(server).post(`/${PREFIX}/billing/portal`).expect(404);
      }

      expect([test.stripe.bought.length, live.stripe.bought.length]).toEqual(bought);
    });
  });

  describe('webhook: only Stripe’s word is read', () => {
    /** An account whose Stripe subscription is active right now: any forged event that reached it would make it premium. */
    async function target(label: string) {
      const who = await account(test, label);
      const { customer, subscription } = ids(label);

      await BillingController.rememberCustomer(who.id, customer);
      test.stripe.hold(subscription, customer, 'active');

      return { customer, subscription, who };
    }

    async function expectUntouched(who: Account, customer: string) {
      expect(await stateOf(who.id)).toMatchObject({ rows: [{ status: null, stripeCustomerId: customer, stripeSubscriptionId: null }], tier: 'free' });
    }

    // 9
    it('answers 404 to a delivery with no signature, and writes nothing', async () => {
      const { customer, subscription, who } = await target('unsigned');
      const refetched = test.stripe.refetched.length;

      await deliver(test.app, aboutSubscription('customer.subscription.updated', subscription, customer, 'active'), null).expect(404);
      await deliver(test.app, aboutSubscription('customer.subscription.updated', subscription, customer, 'active'), '').expect(404);
      expect(test.stripe.refetched).toHaveLength(refetched);
      await expectUntouched(who, customer);
    });

    // 10
    it('answers 404 to a signature made with another secret, and writes nothing', async () => {
      const { customer, subscription, who } = await target('wrong-secret');
      const payload = aboutSubscription('customer.subscription.updated', subscription, customer, 'active');

      await deliver(test.app, payload, signature(payload, 'whsec_somebody_else')).expect(404);
      await deliver(test.app, payload, 'not a signature').expect(404);
      await expectUntouched(who, customer);
    });

    // 11
    it('answers 404 to a real signature over a different body, and writes nothing', async () => {
      const { customer, subscription, who } = await target('tampered');
      const genuine = eventBody('invoice.paid', { customer, subscription });
      const tampered = aboutSubscription('customer.subscription.updated', subscription, customer, 'active');

      await deliver(test.app, genuine).expect(200);
      await deliver(test.app, tampered, signature(genuine)).expect(404);
      // One byte is enough.
      await deliver(test.app, `${tampered} `, signature(tampered)).expect(404);
      await expectUntouched(who, customer);
    });

    // 12
    it('answers 404 to a signature older than Stripe’s tolerance — a replay — and writes nothing', async () => {
      const { customer, subscription, who } = await target('replayed');
      const payload = aboutSubscription('customer.subscription.updated', subscription, customer, 'active');
      const stale = Math.floor(Date.now() / 1000) - TOLERANCE_SECONDS - 60;

      await deliver(test.app, payload, signature(payload, SECRET, stale)).expect(404);
      await expectUntouched(who, customer);
    });

    // 13
    const oversized = (customer: string, subscription: string) =>
      eventBody('customer.subscription.updated', {
        id: subscription,
        customer,
        metadata: { padding: 'x'.repeat(300 * 1024) },
        object: 'subscription',
        status: 'active'
      });

    it('refuses a body over the 256 kB raw limit before reading it, and writes nothing', async () => {
      const { customer, subscription, who } = await target('oversized');
      const refetched = test.stripe.refetched.length;
      const answer: Response = await deliver(test.app, oversized(customer, subscription));

      expect(answer.status).toBeGreaterThanOrEqual(400);
      expect(test.stripe.refetched).toHaveLength(refetched);
      await expectUntouched(who, customer);
    });

    // A client's mistake is not reported, logged and retried as a server failure.
    it('answers an oversized body with 413, not a server error', async () => {
      const { customer, subscription } = ids('oversized');
      const answer: Response = await deliver(test.app, oversized(customer, subscription));

      expect(answer.status).toBe(413);
      expect(answer.body).toMatchObject({ code: 'REQUEST_ERROR', statusCode: 413 });
    });

    // 14
    it('grants premium to the account the customer belongs to, whatever the metadata names', async () => {
      const payer = await account(test, 'metadata-payer', 'admin');
      const named = await account(test, 'metadata-named');

      // The customer is made the product's way: by the payer's own checkout.
      await checkout(test, payer).expect(200);

      const customer = (await stateOf(payer.id)).rows[0]?.stripeCustomerId ?? '';
      const { subscription } = ids('metadata');

      test.stripe.hold(subscription, customer, 'active', { userId: named.id });
      await deliver(test.app, eventBody('checkout.session.completed', { customer, object: 'checkout.session', subscription })).expect(200);

      expect(await stateOf(payer.id)).toMatchObject({ rows: [{ status: 'active', stripeSubscriptionId: subscription }], tier: 'premium' });
      expect(await stateOf(named.id)).toEqual({ rows: [], tier: 'free' });
    });

    // 15a
    it('writes nothing, and acknowledges, for a customer nobody knows and no account named', async () => {
      const { customer, subscription } = ids('orphan');

      test.stripe.hold(subscription, customer, 'active');
      await deliver(test.app, aboutSubscription('customer.subscription.created', subscription, customer, 'active')).expect(200);
      expect(await rowsOfCustomer(customer)).toEqual([]);
    });

    // 15b. A 5xx here would be retried by Stripe for days, for a delivery that can never succeed.
    it('writes nothing, and acknowledges, when the metadata names an account that does not exist', async () => {
      const { customer, subscription } = ids('ghost');

      test.stripe.hold(subscription, customer, 'active', { userId: `ghost-${stamp}` });

      const answer: Response = await deliver(test.app, aboutSubscription('customer.subscription.created', subscription, customer, 'active'));

      expect(await rowsOfCustomer(customer)).toEqual([]);
      expect(answer.status).toBe(200);
    });
  });

  describe('webhook: Stripe’s state now, whatever the delivery', () => {
    async function subscriber(label: string) {
      const who = await account(test, label);
      const { customer, subscription } = ids(label);

      await BillingController.rememberCustomer(who.id, customer);

      return { customer, subscription, who };
    }

    // 16
    it.each([
      { claimed: 'incomplete', now: 'trialing', tier: 'premium', type: 'checkout.session.completed' },
      { claimed: 'incomplete', now: 'active', tier: 'premium', type: 'customer.subscription.created' },
      { claimed: 'active', now: 'past_due', tier: 'premium', type: 'customer.subscription.updated' },
      { claimed: 'active', now: 'canceled', tier: 'free', type: 'customer.subscription.deleted' }
    ])('applies $type as Stripe’s re-fetch has it ($now), not as the event says ($claimed)', async ({ claimed, now, tier, type }) => {
      const { customer, subscription, who } = await subscriber(`event-${type}`);
      const payload =
        type === 'checkout.session.completed'
          ? eventBody(type, { customer, object: 'checkout.session', status: claimed, subscription })
          : aboutSubscription(type, subscription, customer, claimed);

      test.stripe.hold(subscription, customer, now, { cancelAtPeriodEnd: true });
      await deliver(test.app, payload).expect(200);

      expect(test.stripe.refetched.at(-1)).toBe(subscription);
      expect(await stateOf(who.id)).toMatchObject({
        rows: [
          {
            cancelAtPeriodEnd: true,
            currentPeriodEnd: new Date(PERIOD_END * 1000),
            status: now,
            stripeCustomerId: customer,
            stripeSubscriptionId: subscription
          }
        ],
        tier
      });
    });

    // 17. One account a status: a stored terminal status is never overwritten
    // (Stripe cannot reactivate a subscription), so the cases cannot share one.
    // Each starts paying, so a free answer is a change and not a leftover.
    it.each([
      ['active', 'premium'],
      ['trialing', 'premium'],
      ['past_due', 'premium'],
      ['canceled', 'free'],
      ['unpaid', 'free'],
      ['incomplete', 'free'],
      ['incomplete_expired', 'free'],
      ['paused', 'free'],
      ['a_status_stripe_adds_later', 'free']
    ])('maps %s → %s', async (state, tier) => {
      const { customer, subscription, who } = await subscriber(`status-${state}`);

      test.stripe.hold(subscription, customer, 'active');
      await deliver(test.app, aboutSubscription('customer.subscription.created', subscription, customer, 'active')).expect(200);
      expect(await stateOf(who.id)).toMatchObject({ tier: 'premium' });

      test.stripe.hold(subscription, customer, state);
      await deliver(test.app, aboutSubscription('customer.subscription.updated', subscription, customer, 'active')).expect(200);
      expect(await stateOf(who.id)).toMatchObject({ rows: [{ status: state }], tier });
    });

    // 18
    it('acknowledges an event it does not handle and writes nothing', async () => {
      const { customer, subscription, who } = await subscriber('unhandled');
      const refetched = test.stripe.refetched.length;

      test.stripe.hold(subscription, customer, 'active');

      for (const type of ['invoice.paid', 'customer.updated', 'charge.succeeded']) {
        await deliver(test.app, eventBody(type, { id: subscription, customer, subscription })).expect(200);
      }

      expect(test.stripe.refetched).toHaveLength(refetched);
      expect(await stateOf(who.id)).toMatchObject({ rows: [{ status: null, stripeSubscriptionId: null }], tier: 'free' });
    });

    // 19
    it('ends in the same state, on one row, when the same event is delivered twice', async () => {
      const { customer, subscription, who } = await subscriber('duplicate');
      const payload = aboutSubscription('customer.subscription.created', subscription, customer, 'active');
      const header = signature(payload);

      test.stripe.hold(subscription, customer, 'active');
      await deliver(test.app, payload, header).expect(200);

      const first = await stateOf(who.id);

      await deliver(test.app, payload, header).expect(200);

      const second = await stateOf(who.id);

      expect(second.rows).toHaveLength(1);
      expect(await rowsOfSubscription(subscription)).toHaveLength(1);
      expect({ ...second.rows[0], updatedAt: null }).toEqual({ ...first.rows[0], updatedAt: null });
      expect(second.tier).toBe('premium');
    });

    // 20
    it('converges on what Stripe says now when an old event arrives after a newer one', async () => {
      const { customer, subscription, who } = await subscriber('out-of-order');
      const older = aboutSubscription('customer.subscription.created', subscription, customer, 'active');
      const newer = aboutSubscription('customer.subscription.deleted', subscription, customer, 'canceled');

      test.stripe.hold(subscription, customer, 'canceled');
      await deliver(test.app, newer).expect(200);
      await deliver(test.app, older).expect(200);

      expect(await stateOf(who.id)).toMatchObject({ rows: [{ status: 'canceled' }], tier: 'free' });
    });

    // 21
    it('ends consistent, on one row, when deliveries for one subscription arrive at once', async () => {
      const { customer, subscription, who } = await subscriber('simultaneous');

      test.stripe.hold(subscription, customer, 'active');

      const answers = await Promise.all(
        ['customer.subscription.created', 'customer.subscription.updated', 'checkout.session.completed', 'customer.subscription.updated'].map(type =>
          deliver(
            test.app,
            type === 'checkout.session.completed'
              ? eventBody(type, { customer, object: 'checkout.session', subscription })
              : aboutSubscription(type, subscription, customer, 'incomplete')
          )
        )
      );

      expect(answers.map(answer => answer.status)).toEqual([200, 200, 200, 200]);
      expect(await stateOf(who.id)).toMatchObject({ rows: [{ status: 'active', stripeSubscriptionId: subscription }], tier: 'premium' });
      expect(await rowsOfSubscription(subscription)).toHaveLength(1);
    });

    // 21b. A delivery whose re-fetch answered first but would write last must not
    // leave the older state standing: premium for a subscription Stripe has
    // cancelled, until an event that for a cancelled subscription never comes.
    it('ends on Stripe’s latest state when a slow re-fetch finishes after a newer one', async () => {
      const { customer, subscription, who } = await subscriber('slow-refetch');
      let release: (subscription: StripeSubscription) => void = () => undefined;
      const heldBack = new Promise<StripeSubscription>(resolve => {
        release = resolve;
      });
      const active = test.stripe.hold(subscription, customer, 'active');

      // The first re-fetch is held back until the second has written; the second answers at once.
      test.stripe.refetch = id => {
        const first = test.stripe.refetched.filter(seen => seen === id).length === 1;

        return first ? heldBack : Promise.resolve(test.stripe.now.get(id) as StripeSubscription);
      };

      try {
        const slow = deliver(test.app, aboutSubscription('customer.subscription.updated', subscription, customer, 'active')).then(answer => answer);

        while (!test.stripe.refetched.includes(subscription)) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }

        test.stripe.hold(subscription, customer, 'canceled');
        await deliver(test.app, aboutSubscription('customer.subscription.deleted', subscription, customer, 'canceled')).expect(200);
        release(active);
        expect((await slow).status).toBe(200);
      } finally {
        test.stripe.refetch = null;
      }

      expect(await stateOf(who.id)).toMatchObject({ rows: [{ status: 'canceled' }], tier: 'free' });
    });

    it('keeps a cancelled subscription cancelled, whatever a later re-fetch claims', async () => {
      const { customer, subscription, who } = await subscriber('stays-ended');

      test.stripe.hold(subscription, customer, 'active');
      await deliver(test.app, aboutSubscription('customer.subscription.created', subscription, customer, 'active')).expect(200);
      test.stripe.hold(subscription, customer, 'canceled');
      await deliver(test.app, aboutSubscription('customer.subscription.deleted', subscription, customer, 'canceled')).expect(200);
      expect(await stateOf(who.id)).toMatchObject({ rows: [{ status: 'canceled' }], tier: 'free' });

      // Stripe cannot reactivate a cancelled subscription; an answer saying so is not believed.
      test.stripe.hold(subscription, customer, 'active');
      await deliver(test.app, aboutSubscription('customer.subscription.updated', subscription, customer, 'active')).expect(200);
      expect(await stateOf(who.id)).toMatchObject({ rows: [{ status: 'canceled', stripeSubscriptionId: subscription }], tier: 'free' });
    });

    it('never lets an older subscription’s end replace the one the account pays for now', async () => {
      const { customer, who } = await subscriber('two-subscriptions');
      const older = `sub_${stamp}_two-subscriptions-older`;
      const newer = `sub_${stamp}_two-subscriptions-newer`;

      test.stripe.hold(older, customer, 'active');
      await deliver(test.app, aboutSubscription('customer.subscription.created', older, customer, 'active')).expect(200);
      test.stripe.hold(newer, customer, 'active');
      await deliver(test.app, aboutSubscription('customer.subscription.created', newer, customer, 'active')).expect(200);
      expect(await stateOf(who.id)).toMatchObject({ rows: [{ status: 'active', stripeSubscriptionId: newer }], tier: 'premium' });

      test.stripe.hold(older, customer, 'canceled');
      await deliver(test.app, aboutSubscription('customer.subscription.deleted', older, customer, 'canceled')).expect(200);
      expect(await stateOf(who.id)).toMatchObject({ rows: [{ status: 'active', stripeSubscriptionId: newer }], tier: 'premium' });
    });

    // 22
    it('answers a non-2xx when Stripe fails during the re-fetch, writes nothing, and applies the retry', async () => {
      const { customer, subscription, who } = await subscriber('stripe-down');
      const payload = aboutSubscription('customer.subscription.created', subscription, customer, 'active');

      test.stripe.hold(subscription, customer, 'active');
      test.stripe.refetch = () => Promise.reject(new Stripe.errors.StripeConnectionError({ message: 'Stripe is unreachable' }));

      try {
        const answer: Response = await deliver(test.app, payload);

        expect(answer.status).toBeGreaterThanOrEqual(500);
      } finally {
        test.stripe.refetch = null;
      }

      expect(await stateOf(who.id)).toMatchObject({ rows: [{ status: null, stripeSubscriptionId: null }], tier: 'free' });

      // Stripe retries the same event; this time it answers.
      await deliver(test.app, payload).expect(200);
      expect(await stateOf(who.id)).toMatchObject({ rows: [{ status: 'active' }], tier: 'premium' });
    });

    // 23
    it('grants the free allowances to a paid column while the premium switch is off', async () => {
      const payer = await account(live, 'switch-off');
      const { customer, subscription } = ids('switch-off');

      await completeOnboarding(live.app, payer);
      await BillingController.rememberCustomer(payer.id, customer);
      live.stripe.hold(subscription, customer, 'active');
      await deliver(live.app, aboutSubscription('customer.subscription.created', subscription, customer, 'active')).expect(200);
      expect(await stateOf(payer.id)).toMatchObject({ tier: 'premium' });

      const allowances = async () => {
        const answer: Response = await request(httpServer(live.app)).get(`/${PREFIX}/meal-plans/allowances`).set('Cookie', payer.cookie).expect(200);

        return (answer.body as { tier: string }).tier;
      };

      await expect(allowances()).resolves.toBe('free');
      await SettingsController.setFlag('premium', true);

      try {
        await expect(allowances()).resolves.toBe('premium');
      } finally {
        await SettingsController.setFlag('premium', false);
      }

      await expect(allowances()).resolves.toBe('free');
    });
  });

  describe('deleting an account that pays', () => {
    let deletedId = '';

    /** An account paying through `on`, with its subscription held at Stripe. */
    async function paying(on: Deployment, label: string) {
      const payer = await account(on, label);
      const { customer, subscription } = ids(label);

      await BillingController.rememberCustomer(payer.id, customer);
      on.stripe.hold(subscription, customer, 'active', { userId: payer.id });
      await deliver(on.app, aboutSubscription('customer.subscription.created', subscription, customer, 'active')).expect(200);
      expect(await stateOf(payer.id)).toMatchObject({ rows: [{ status: 'active' }], tier: 'premium' });

      return { customer, payer, subscription };
    }

    const remove = (on: Deployment, who: Account) => request(httpServer(on.app)).delete(`/${PREFIX}/users/me`).set('Cookie', who.cookie);

    // 24
    it('takes the account and its subscriptions row, and cancels its Stripe subscription — not the ones already ended', async () => {
      const { customer, payer, subscription } = await paying(test, 'deleted');
      const cancelled = `sub_${stamp}_deleted-cancelled`;
      const expired = `sub_${stamp}_deleted-expired`;

      deletedId = payer.id;
      test.stripe.hold(cancelled, customer, 'canceled');
      test.stripe.hold(expired, customer, 'incomplete_expired');

      await remove(test, payer).expect(204);

      expect(await stateOf(payer.id)).toEqual({ rows: [], tier: null });
      expect(await rowsOfCustomer(customer)).toEqual([]);
      await expect(BillingController.userOfCustomer(customer)).resolves.toBeNull();
      expect(test.stripe.cancelled).toContain(subscription);
      expect(test.stripe.cancelled).not.toContain(cancelled);
      expect(test.stripe.cancelled).not.toContain(expired);
      expect(test.stripe.now.get(subscription)?.status).toBe('canceled');
    });

    it('refuses the deletion while Stripe cannot cancel, keeps everything, and deletes on the retry', async () => {
      const { customer, payer, subscription } = await paying(test, 'deleted-stripe-down');

      test.stripe.failCancel = true;

      try {
        const answer: Response = await remove(test, payer);

        expect(answer.status).toBeGreaterThanOrEqual(500);
      } finally {
        test.stripe.failCancel = false;
      }

      expect(await stateOf(payer.id)).toMatchObject({ rows: [{ status: 'active', stripeCustomerId: customer }], tier: 'premium' });
      expect(test.stripe.now.get(subscription)?.status).toBe('active');

      await remove(test, payer).expect(204);
      expect(await stateOf(payer.id)).toEqual({ rows: [], tier: null });
      expect(test.stripe.cancelled).toContain(subscription);
    });

    it('deletes without asking Stripe anything where billing is not set up', async () => {
      const payer = await account(unconfigured, 'deleted-unconfigured');
      const { customer, subscription } = ids('deleted-unconfigured');

      await BillingController.rememberCustomer(payer.id, customer);
      unconfigured.stripe.hold(subscription, customer, 'active');
      await remove(unconfigured, payer).expect(204);

      expect(await stateOf(payer.id)).toEqual({ rows: [], tier: null });
      expect(unconfigured.stripe.cancelled).toEqual([]);
    });

    // A 5xx here would be retried by Stripe for days, for an account that is gone.
    it('acknowledges the deletion Stripe reports afterwards, and writes nothing', async () => {
      const { customer, subscription } = ids('deleted');

      expect(test.stripe.now.get(subscription)).toMatchObject({ metadata: { userId: deletedId }, status: 'canceled' });

      const answer: Response = await deliver(test.app, aboutSubscription('customer.subscription.deleted', subscription, customer, 'canceled'));

      expect(answer.status).toBe(200);
      expect(await rowsOfCustomer(customer)).toEqual([]);
    });

    it('acknowledges a renewal naming a deleted account, and writes nothing', async () => {
      const { customer } = ids('deleted');
      const renewed = `sub_${stamp}_deleted-renewed`;

      test.stripe.hold(renewed, customer, 'active', { userId: deletedId });

      const answer: Response = await deliver(test.app, aboutSubscription('customer.subscription.updated', renewed, customer, 'active'));

      expect(answer.status).toBe(200);
      expect(await rowsOfCustomer(customer)).toEqual([]);
    });
  });
});
