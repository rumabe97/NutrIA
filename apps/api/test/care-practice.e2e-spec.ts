import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import Stripe from 'stripe';

import { BillingController } from 'core/controllers/Billing';
import { CARE_CONSENT_VERSION } from 'core/entities/Care';
import { CareController } from 'core/controllers/Care';
import { database } from 'database';
import { PROFESSIONAL_AGREEMENT_VERSION } from 'core/entities/Professional';
import { SettingsController } from 'core/controllers/Settings';
import { UNAUDITED } from 'core/entities/Audit';
import { UserController } from 'core/controllers/User';

import {
  completeOnboarding,
  deleteAccounts,
  earnBadge,
  enableTotp,
  httpServer,
  makePractitioner,
  openOwnPractice,
  PREFIX,
  register
} from './harness.js';
import { createApp as assemble } from '../src/config/CreateApp.js';
import { validateEnv } from '../src/config/Env.validation.js';
import { EmailService } from '../src/modules/email/services/index.js';
import { StripeGateway } from '../src/modules/billing/services/StripeGateway.js';

import type { Account } from './harness.js';
import type { CareLinkView } from 'core/controllers/Care';
import type { INestApplication } from '@nestjs/common';
import type { OutgoingEmail } from '../src/modules/email/services/index.js';
import type { ResolvedTargets } from 'core/domain/Nutrition';
import type { Response } from 'supertest';

/**
 * The practice is paid for (`0061`, project 004 Phase 7; PRD criteria 13, 14
 * and 17), over real HTTP and on the real tables.
 *
 * A professional's own subscription, at a practice price, sets how many
 * clients the practice includes — through the signed webhook alone, never a
 * request body. **Since project 025 phase 6 it no longer opens the door**: an
 * account opens its own practice, free, and reaches its clients with the free
 * `practiceClients` seats (ten); every open link — `paused` ones too — and every
 * live invitation takes a seat. A lapse pauses nothing and deletes nothing: the
 * links stay active and the clients return to their own tier; paying again
 * makes active only the links a 004 lapse had paused (written on the table: no
 * route pauses one now). A client with an active link to a practice **paid
 * for** has the paid allowances; a client of a free practice keeps their own.
 * Checkout for a practice is a 404 while a suspension or a close stands. When a
 * link ends, the targets the professional set stay and become the client's
 * own; a pause keeps the mark.
 *
 * The application is the product's own assembly (`CreateApp`), as in
 * `billing.e2e-spec.ts`, and Stripe's client is replaced at the same seam
 * (`StripeGateway`'s private client) by a fake whose re-fetch answers what
 * each test holds — the subscription's price included. Bodies are signed with
 * Stripe's real test signer and checked by Stripe's real verifier.
 *
 * Invitation mail is caught at `EmailService.send`, as `care.e2e-spec.ts`
 * does; nothing is sent.
 *
 * Requires a real database — see ./README.md.
 */
const SECRET = 'whsec_e2e_practice_suite';
const PREMIUM = 'price_e2e_practice_premium';
/** Three practice prices: a tiny one to count against, the first real plan, and the larger one. */
const TWO = 'price_e2e_practice_two';
const THIRTY = 'price_e2e_practice_thirty';
const SIXTY = 'price_e2e_practice_sixty';
/** A price the configuration does not list: checkout refuses it, and a subscription at it is premium's, as before practices existed. */
const UNKNOWN = 'price_e2e_practice_unknown';
const PRACTICE_PRICES = `${TWO}=2,${THIRTY}=30,${SIXTY}=60`;
const STRIPE_KEYS = ['STRIPE_PRACTICE_PRICES', 'STRIPE_PRICE_ID', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_YEARLY_PRICE_ID'] as const;
const KEYS = {
  STRIPE_PRACTICE_PRICES: PRACTICE_PRICES,
  STRIPE_PRICE_ID: PREMIUM,
  STRIPE_SECRET_KEY: 'sk_test_e2e_practice',
  STRIPE_WEBHOOK_SECRET: SECRET
};
const SIGNER = new Stripe('sk_test_e2e_practice_signer');
const PERIOD_END = Math.floor(new Date('2026-12-01T00:00:00Z').getTime() / 1000);

type Checkout = Stripe.Checkout.SessionCreateParams;

type StripeSubscription = {
  readonly id: string;
  readonly cancel_at_period_end: boolean;
  readonly customer: string;
  readonly items: { readonly data: readonly { readonly current_period_end: number; readonly price?: { readonly id: string } }[] };
  readonly metadata: Record<string, string>;
  readonly status: string;
};

/**
 * The Stripe client, as far as this product uses it — the billing suite's fake,
 * cut to what a practice needs, with the price on the subscription's item.
 */
class FakeStripe {
  readonly bought: Checkout[] = [];
  readonly now = new Map<string, StripeSubscription>();
  readonly webhooks = SIGNER.webhooks;

  readonly billingPortal = {
    sessions: { create: (params: { customer?: string }) => Promise.resolve({ url: `https://billing.stripe.test/${params.customer ?? ''}` }) }
  };

  readonly checkout = {
    sessions: {
      create: (params: Checkout) => {
        this.bought.push(params);

        return Promise.resolve({ id: `cs_e2e_practice_${this.bought.length}`, url: `https://checkout.stripe.test/${this.bought.length}` });
      },
      expire: (id: string) => Promise.resolve({ id, status: 'expired' }),
      list: () => Promise.resolve({ data: [], has_more: false }),
      retrieve: (id: string) => Promise.resolve({ id, status: 'expired' })
    }
  };

  readonly customers = {
    create: (_params: unknown, options?: Stripe.RequestOptions) =>
      Promise.resolve({ id: `cus_e2e_practice_${options?.idempotencyKey ?? Date.now()}` })
  };

  readonly prices = { retrieve: (id: string) => Promise.resolve({ id, currency: 'eur', recurring: { interval: 'month' }, unit_amount: 2900 }) };

  readonly subscriptions = {
    cancel: (id: string) => {
      const held = this.now.get(id);

      if (held) {
        this.now.set(id, { ...held, status: 'canceled' });
      }

      return Promise.resolve({ id, status: 'canceled' });
    },
    list: (params: { customer: string }) =>
      Promise.resolve({
        data: [...this.now.values()].filter(held => held.customer === params.customer && held.status !== 'canceled'),
        has_more: false
      }),
    retrieve: (id: string) => {
      const found = this.now.get(id);

      return found ? Promise.resolve(found) : Promise.reject(new Error(`No such subscription: ${id}`));
    }
  };

  /** Stripe now holds this subscription, at this price (`null`: none on the item), in this state. */
  hold(id: string, customer: string, status: string, price: string | null): void {
    this.now.set(id, {
      id,
      cancel_at_period_end: false,
      customer,
      items: { data: [{ current_period_end: PERIOD_END, ...(price === null ? {} : { price: { id: price } }) }] },
      metadata: {},
      status
    });
  }
}

type Deployment = { readonly app: INestApplication; readonly stripe: FakeStripe };

/** Builds the product with these Stripe values in the environment, and puts the environment back. */
async function withStripe<T>(values: Partial<Record<(typeof STRIPE_KEYS)[number], string>>, build: () => Promise<T>): Promise<T> {
  const saved = Object.fromEntries(STRIPE_KEYS.map(key => [key, process.env[key]]));

  for (const key of STRIPE_KEYS) {
    if (values[key]) {
      process.env[key] = values[key];
    } else {
      delete process.env[key];
    }
  }

  try {
    return await build();
  } finally {
    for (const key of STRIPE_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  }
}

async function deploy(): Promise<Deployment> {
  const app = await withStripe(KEYS, () => assemble());
  const stripe = new FakeStripe();
  const gateway = app.get(StripeGateway);

  Object.assign(gateway, { client: stripe });
  // The seam is the gateway's private client: prove it held before anything relies on it.
  expect((gateway as unknown as { stripe(): unknown }).stripe()).toBe(stripe);

  return { app, stripe };
}

function eventBody(type: string, object: Record<string, unknown>): string {
  return JSON.stringify({
    id: `evt_e2e_practice_${Math.random().toString(36).slice(2)}`,
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

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

/** Parameterised reads on the tables themselves, through the product's own pool (see `billing.e2e-spec.ts`). */
function tables(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

type Practice = { readonly includedClients: number; readonly practiceOpen: boolean };
type LinkRow = { readonly id: string; readonly endedAt: Date | null; readonly endedBy: string | null; readonly status: string };
type OverrideRow = {
  readonly carbsG: number | null;
  readonly fatG: number | null;
  readonly kcal: number | null;
  readonly proteinG: number | null;
  readonly setByProfessionalId: string | null;
};

describe('care-practice', () => {
  let on: Deployment;
  let owner: Account;
  let sent: OutgoingEmail[];
  const stamp = Date.now();
  const made: string[] = [];
  let serial = 0;

  function server() {
    return httpServer(on.app);
  }

  function address(label: string): string {
    serial += 1;

    return `practice-${label}-${serial}-${stamp}@e2e.invalid`;
  }

  async function account(label: string): Promise<Account> {
    const created = await register(on.app, address(label));

    made.push(created.cookie);

    return created;
  }

  function nameOf(who: Account): string {
    return who.email.split('@')[0] ?? '';
  }

  async function setSwitch(enabled: boolean): Promise<void> {
    await request(server()).patch(`/${PREFIX}/admin/settings`).set('Cookie', owner.cookie).send({ enabled, flag: 'professional' }).expect(200);
  }

  /**
   * An account that opened its own practice — free, nothing paid — and earned
   * the badge by its four steps (project 025 phase 6: the owner's grant, which
   * badged, is retired), TOTP on. `agree` defaults true — almost everything
   * below needs the agreement accepted (P1-1) to reach the routes it is about;
   * the one test of the gate itself passes `agree: false`.
   */
  async function professional(label: string, agree = true): Promise<Account> {
    const who = await account(label);

    if (agree) {
      await makePractitioner(on.app, who, { badgedBy: owner, number: `28/${String(stamp).slice(-6)}` });
    } else {
      await openOwnPractice(on.app, who);
      await earnBadge(on.app, who, owner, `28/${String(stamp).slice(-6)}`);
    }

    // A password account reaches no client route without TOTP on (PLAN 011 phase 6); the confirmation rotates the session.
    const enabled = await enableTotp(on.app, who);

    made.push(enabled.cookie);

    return enabled;
  }

  function restrict(who: Account, act: 'close' | 'lift' | 'suspension') {
    return request(server())
      .post(`/${PREFIX}/admin/professionals/${who.id}/${act}`)
      .set('Cookie', owner.cookie)
      .send(act === 'lift' ? {} : { facts: 'Revisión de la consulta.', source: 'own_review' });
  }

  async function practiceOf(who: Account): Promise<Practice | undefined> {
    const [row] = await tables()<Practice>`
      select practice_open as "practiceOpen", included_clients as "includedClients" from professionals where user_id = ${who.id}`;

    return row;
  }

  async function linksOf(professionalId: string): Promise<LinkRow[]> {
    return tables()<LinkRow>`
      select id, status::text as status, ended_by::text as "endedBy", ended_at as "endedAt"
        from care_links where professional_id = ${professionalId} order by created_at, id`;
  }

  async function linkRow(linkId: string): Promise<LinkRow | undefined> {
    const [row] = await tables()<LinkRow>`
      select id, status::text as status, ended_by::text as "endedBy", ended_at as "endedAt" from care_links where id = ${linkId}`;

    return row;
  }

  async function overrideRow(who: Account): Promise<OverrideRow | undefined> {
    const [row] = await tables()<OverrideRow>`
      select kcal, protein_g as "proteinG", carbs_g as "carbsG", fat_g as "fatG", set_by_professional_id as "setByProfessionalId"
        from target_overrides where user_id = ${who.id}`;

    return row;
  }

  /** The newest invitation token mailed to `to`, waiting for the background task that sends it. */
  async function tokenMailedTo(to: string, after: number): Promise<string> {
    const deadline = Date.now() + 10_000;

    while (Date.now() < deadline) {
      const token = sent
        .slice(after)
        .filter(message => message.to === to.toLowerCase())
        .at(-1)
        ?.text.match(/\/invitacion\/([A-Za-z0-9_-]{43})/)?.[1];

      if (token) {
        return token;
      }

      await new Promise(resolve => {
        setTimeout(resolve, 50);
      });
    }

    throw new Error('No invitation mail arrived');
  }

  function inviting(from: Account, email: string) {
    return request(server()).post(`/${PREFIX}/care/invitations`).set('Cookie', from.cookie).send({ email });
  }

  /** Links `client` to `pro` through the routes, as the two people do. */
  async function link(pro: Account, client: Account): Promise<string> {
    const before = sent.length;

    await inviting(pro, client.email).expect(201);

    const token = await tokenMailedTo(client.email, before);
    const accepted: Response = await request(server())
      .post(`/${PREFIX}/care/invitations/${token}/accept`)
      .set('Cookie', client.cookie)
      .send({ consentScope: 'full', consentVersion: CARE_CONSENT_VERSION, sharesHealth: false })
      .expect(200);

    return (accepted.body as CareLinkView).id;
  }

  function endLink(who: Account, linkId: string) {
    return request(server()).delete(`/${PREFIX}/care/links/${linkId}`).set('Cookie', who.cookie);
  }

  function overview(pro: Account, linkId: string) {
    return request(server()).get(`/${PREFIX}/care/clients/${linkId}`).set('Cookie', pro.cookie);
  }

  function setTargets(pro: Account, linkId: string, body: object) {
    return request(server()).patch(`/${PREFIX}/care/clients/${linkId}/targets`).set('Cookie', pro.cookie).send(body);
  }

  async function ownTargets(who: Account): Promise<ResolvedTargets> {
    const response: Response = await request(server()).get(`/${PREFIX}/profile`).set('Cookie', who.cookie).expect(200);

    return (response.body as { targets: ResolvedTargets }).targets;
  }

  async function tierOf(who: Account): Promise<string> {
    const response: Response = await request(server()).get(`/${PREFIX}/meal-plans/allowances`).set('Cookie', who.cookie).expect(200);

    return (response.body as { tier: string }).tier;
  }

  function checkout(who: Account, body: Record<string, unknown>) {
    return request(server()).post(`/${PREFIX}/billing/checkout`).set('Cookie', who.cookie).send(body);
  }

  /** Stripe's word, delivered signed: the subscription now holds `price` in `status`. */
  async function stripeSays(customer: string, subscription: string, status: string, price: string | null): Promise<void> {
    on.stripe.hold(subscription, customer, status, price);

    const payload = eventBody('customer.subscription.updated', { id: subscription, customer, metadata: {}, object: 'subscription', status });

    await request(server())
      .post(`/${PREFIX}/billing/webhook`)
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', SIGNER.webhooks.generateTestHeaderString({ payload, secret: SECRET }))
      .send(payload)
      .expect(200);
  }

  /** Delivers an event again, signed, for a subscription whose state Stripe keeps as it is: a retry, or a late one. */
  async function redeliver(customer: string, subscription: string, type = 'customer.subscription.updated'): Promise<void> {
    const payload = eventBody(type, { id: subscription, customer, metadata: {}, object: 'subscription', status: 'active' });

    await request(server())
      .post(`/${PREFIX}/billing/webhook`)
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', SIGNER.webhooks.generateTestHeaderString({ payload, secret: SECRET }))
      .send(payload)
      .expect(200);
  }

  /** Open links — `paused` ones too, since project 025 phase 6 — and unexpired invitations: what a practice's number counts. */
  async function seatsTaken(pro: Account): Promise<number> {
    const [row] = await tables()<{ count: number }>`
      select (select count(*) from care_links where professional_id = ${pro.id} and status in ('active', 'paused'))::int
           + (select count(*) from care_invitations where professional_id = ${pro.id} and expires_at > now())::int as count`;

    return row?.count ?? 0;
  }

  function accepting(client: Account, token: string) {
    return request(server())
      .post(`/${PREFIX}/care/invitations/${token}/accept`)
      .set('Cookie', client.cookie)
      .send({ consentScope: 'full', consentVersion: CARE_CONSENT_VERSION, sharesHealth: false });
  }

  /** Invites `client` through the route and returns the mailed token, unanswered. */
  async function invited(pro: Account, client: Account): Promise<string> {
    const before = sent.length;

    await inviting(pro, client.email).expect(201);

    return tokenMailedTo(client.email, before);
  }

  /** A professional whose practice Stripe has opened at `price`, with the ids its subscription lives under. */
  async function paying(label: string, price = THIRTY): Promise<{ customer: string; pro: Account; subscription: string }> {
    const pro = await professional(label);
    const customer = `cus_${stamp}_${label}`;
    const subscription = `sub_${stamp}_${label}`;

    await BillingController.customerFor(pro.id, () => Promise.resolve(customer));
    await stripeSays(customer, subscription, 'active', price);

    return { customer, pro, subscription };
  }

  /** A client with a finished profile — what allowances and targets need — linked to `pro`. */
  async function clientOf(pro: Account, label: string): Promise<{ client: Account; linkId: string }> {
    const client = await account(label);

    await completeOnboarding(on.app, client);

    return { client, linkId: await link(pro, client) };
  }

  beforeAll(async () => {
    on = await deploy();
    sent = [];

    // On the prototype, so whichever instance a module was handed is the one caught.
    jest.spyOn(EmailService.prototype, 'send').mockImplementation(message => {
      sent.push(message);

      return Promise.resolve(true);
    });

    owner = await account('owner');
    await UserController.grantAdmin(owner.email);
    owner = await enableTotp(on.app, owner);
    made.push(owner.cookie);
    await setSwitch(true);
    // Personal premium stays off: every premium below is the practice's.
    await SettingsController.setFlag('premium', false, UNAUDITED);
  });

  afterAll(async () => {
    try {
      if (owner) {
        await setSwitch(false);
      }

      await SettingsController.setFlag('premium', false, UNAUDITED);

      if (on) {
        await deleteAccounts(on.app, made);
      }

      const suffix = `%-${stamp}@e2e.invalid`;
      const accounts = await tables()<{ email: string }>`select email from "user" where email like ${suffix}`;
      const invitations = await tables()<{ id: string }>`select id from care_invitations where email like ${suffix}`;

      expect({ accounts, invitations }).toEqual({ accounts: [], invitations: [] });
    } finally {
      jest.restoreAllMocks();
      await on?.app.close();
    }
  });

  /*
   * Nest answers a refused environment with `process.exit`, so the refusal is
   * read from the one function the boot calls (`validateEnv`), fed this run's
   * own environment with the practice values over it. The cases of each rule
   * are the unit spec's; this proves the suite's configuration is one the
   * product accepts, and the same with one value wrong is not.
   */
  describe('configuration', () => {
    it('accepts this suite’s prices and refuses them alone, malformed, or naming the premium price', () => {
      const blank = Object.fromEntries(STRIPE_KEYS.map(key => [key, '']));

      expect(validateEnv({ ...process.env, ...KEYS }).STRIPE_PRACTICE_PRICES).toEqual([
        { includedClients: 2, priceId: TWO },
        { includedClients: 30, priceId: THIRTY },
        { includedClients: 60, priceId: SIXTY }
      ]);

      for (const values of [
        { ...blank, STRIPE_PRACTICE_PRICES: PRACTICE_PRICES },
        { ...KEYS, STRIPE_PRACTICE_PRICES: `${THIRTY}=thirty` },
        { ...KEYS, STRIPE_PRACTICE_PRICES: 'prod_e2e=30' },
        { ...KEYS, STRIPE_PRACTICE_PRICES: `${PREMIUM}=30` }
      ]) {
        expect(() => validateEnv({ ...process.env, ...values })).toThrow(/STRIPE_PRACTICE_PRICES/);
      }
    });
  });

  /*
   * Test keys sell to the owner alone (`0056`), so every buyer here is also an
   * admin — the non-professional included, so its 404 is about the grant.
   */
  describe('checkout', () => {
    it('sells a professional the practice at the price asked for, from the configured list, with a 14-day trial', async () => {
      const pro = await professional('checkout');
      await UserController.grantAdmin(pro.email);
      const answer: Response = await checkout(pro, { plan: 'practice', price: SIXTY }).expect(200);
      const bought = on.stripe.bought.at(-1);

      expect((answer.body as { url: string }).url).toMatch(/^https:\/\/checkout\.stripe\.test\//);
      expect(bought).toMatchObject({
        client_reference_id: pro.id,
        line_items: [{ price: SIXTY, quantity: 1 }],
        mode: 'subscription',
        subscription_data: { metadata: { userId: pro.id }, trial_period_days: 14 }
      });
      // Paying opens nothing: only Stripe's word, through the webhook, does.
      expect(await practiceOf(pro)).toEqual({ includedClients: 0, practiceOpen: false });
    });

    it('refuses a price the configuration does not list, and the premium price as a practice, and buys nothing', async () => {
      const pro = await professional('checkout-unlisted');
      await UserController.grantAdmin(pro.email);
      const before = on.stripe.bought.length;

      for (const price of [UNKNOWN, PREMIUM, 42]) {
        const refused = await checkout(pro, { plan: 'practice', price });

        expect([404, 422]).toContain(refused.status);
      }

      expect(on.stripe.bought).toHaveLength(before);
    });

    it('is a 404 for an account that is not a professional, and buys nothing', async () => {
      const ordinary = await account('checkout-ordinary');
      await UserController.grantAdmin(ordinary.email);
      const before = on.stripe.bought.length;

      await checkout(ordinary, { plan: 'practice', price: THIRTY }).expect(404);
      // A practice names its price; the schema refuses one without, before anything asks who is buying.
      await checkout(ordinary, { plan: 'practice' }).expect(422);
      expect(on.stripe.bought).toHaveLength(before);
    });

    it('drops a practice price sent with a premium plan, as before practices existed: premium is what is bought', async () => {
      const buyer = await account('checkout-premium-price');
      await UserController.grantAdmin(buyer.email);

      await checkout(buyer, { plan: 'monthly', price: THIRTY }).expect(200);
      expect(on.stripe.bought.at(-1)?.line_items).toEqual([{ price: PREMIUM, quantity: 1 }]);
    });

    it('lets nothing in the body set how many clients are included', async () => {
      const pro = await professional('checkout-body');
      await UserController.grantAdmin(pro.email);
      const before = on.stripe.bought.length;
      const answer = await checkout(pro, { includedClients: 500, plan: 'practice', practiceOpen: true, price: TWO });

      // Refused by the schema, or bought at the price and nothing else: either way the body sets no number.
      if (answer.status === 200) {
        expect(on.stripe.bought.at(-1)?.line_items).toEqual([{ price: TWO, quantity: 1 }]);
        // As a value, not a substring: the session's `expires_at` is a Unix time that can hold "500".
        expect(
          JSON.stringify(on.stripe.bought.at(-1), (_key, value: unknown) => (value === 500 || value === '500' ? 'SMUGGLED' : value))
        ).not.toContain('SMUGGLED');
      } else {
        expect(answer.status).toBe(422);
        expect(on.stripe.bought).toHaveLength(before);
      }

      expect(await practiceOf(pro)).toEqual({ includedClients: 0, practiceOpen: false });

      // And Stripe's word sets the configured number, whatever was asked for.
      // The customer is whichever the checkout made (`customerFor` keeps the first), or this one if the body was refused.
      const customer = (await BillingController.customerFor(pro.id, () => Promise.resolve(`cus_${stamp}_body`))) ?? '';

      await stripeSays(customer, `sub_${stamp}_body`, 'active', TWO);
      expect(await practiceOf(pro)).toEqual({ includedClients: 2, practiceOpen: true });
    });

    it('gives the trial once per account: never again after a practice subscription', async () => {
      const { customer, pro, subscription } = await paying('trial-once');
      await UserController.grantAdmin(pro.email);

      await stripeSays(customer, subscription, 'canceled', THIRTY);
      await checkout(pro, { plan: 'practice', price: THIRTY }).expect(200);

      expect(on.stripe.bought.at(-1)?.subscription_data?.trial_period_days).toBeUndefined();
    });

    /** P1-1 (`docs/legal/go-live-checklist.md` § 1): the grant alone is not enough to pay for the practice either. */
    it('refuses the practice checkout until the agreement is accepted — any other version refused too — and sells it once it is', async () => {
      const pro = await professional('agreement', false);
      await UserController.grantAdmin(pro.email);
      const before = on.stripe.bought.length;

      const refused = await checkout(pro, { plan: 'practice', price: THIRTY });

      expect(refused.status).toBe(404);

      await request(server()).post(`/${PREFIX}/care/practice/agreement`).set('Cookie', pro.cookie).send({ version: '0.9.0' }).expect(422);
      // The version in force before 2.0.0 (project 025 phase 8) is stale too, not merely a made-up one.
      await request(server()).post(`/${PREFIX}/care/practice/agreement`).set('Cookie', pro.cookie).send({ version: '1.1.0' }).expect(422);
      expect((await checkout(pro, { plan: 'practice', price: THIRTY })).status).toBe(404);
      expect(on.stripe.bought).toHaveLength(before);

      await request(server())
        .post(`/${PREFIX}/care/practice/agreement`)
        .set('Cookie', pro.cookie)
        .send({ version: PROFESSIONAL_AGREEMENT_VERSION })
        .expect(204);
      await checkout(pro, { plan: 'practice', price: THIRTY }).expect(200);
      expect(on.stripe.bought).toHaveLength(before + 1);
    });

    // Project 025 phase 6 (invariant review, P2-4): nothing is sold to a practice the owner has suspended or is closing.
    it('refuses the practice checkout while a suspension or a close stands, and sells it once lifted', async () => {
      const pro = await professional('checkout-restricted');
      await UserController.grantAdmin(pro.email);
      const before = on.stripe.bought.length;

      for (const act of ['suspension', 'close'] as const) {
        await restrict(pro, act).expect(200);
        await checkout(pro, { plan: 'practice', price: THIRTY }).expect(404);
        await restrict(pro, 'lift').expect(200);
      }

      expect(on.stripe.bought).toHaveLength(before);
      await checkout(pro, { plan: 'practice', price: THIRTY }).expect(200);
      expect(on.stripe.bought).toHaveLength(before + 1);
    });
  });

  describe('webhook: the price decides what is granted', () => {
    it('opens the practice with the configured number, in the subscriptions row’s write, and leaves the personal tier alone', async () => {
      const { customer, pro, subscription } = await paying('opens');

      expect(await practiceOf(pro)).toEqual({ includedClients: 30, practiceOpen: true });

      const [row] = await tables()<{ status: string; stripeSubscriptionId: string }>`
        select status, stripe_subscription_id as "stripeSubscriptionId" from subscriptions where user_id = ${pro.id}`;
      const [userRow] = await tables()<{ tier: string }>`select tier from "user" where id = ${pro.id}`;

      expect(row).toEqual({ status: 'active', stripeSubscriptionId: subscription });
      expect(userRow?.tier).toBe('free');
      expect(customer).toBeTruthy();
    });

    it('opens it exactly the same during the trial', async () => {
      const { customer, pro, subscription } = await paying('trial');

      await stripeSays(customer, subscription, 'trialing', THIRTY);
      expect(await practiceOf(pro)).toEqual({ includedClients: 30, practiceOpen: true });
    });

    it('raises the number when the subscription moves to the larger price, and lowers it back', async () => {
      const { customer, pro, subscription } = await paying('larger');

      await stripeSays(customer, subscription, 'active', SIXTY);
      expect(await practiceOf(pro)).toEqual({ includedClients: 60, practiceOpen: true });

      await stripeSays(customer, subscription, 'active', THIRTY);
      expect(await practiceOf(pro)).toEqual({ includedClients: 30, practiceOpen: true });
    });

    it.each([
      ['a price the configuration does not list', UNKNOWN],
      ['no price on the subscription at all', null]
    ])('makes %s premium, as before practices existed, and opens no practice with it', async (_label, price) => {
      const label = price === null ? 'no-price' : 'unlisted-price';
      const pro = await professional(label);
      const customer = `cus_${stamp}_${label}`;

      await BillingController.customerFor(pro.id, () => Promise.resolve(customer));
      await stripeSays(customer, `sub_${stamp}_${label}`, 'active', price);

      const [userRow] = await tables()<{ tier: string }>`select tier from "user" where id = ${pro.id}`;

      expect(userRow?.tier).toBe('premium');
      expect(await practiceOf(pro)).toEqual({ includedClients: 0, practiceOpen: false });
    });

    it('opens no practice for an account that is not a professional', async () => {
      const ordinary = await account('not-a-pro');
      const customer = `cus_${stamp}_ordinary`;

      await BillingController.customerFor(ordinary.id, () => Promise.resolve(customer));
      await stripeSays(customer, `sub_${stamp}_ordinary`, 'active', THIRTY);

      const [userRow] = await tables()<{ tier: string }>`select tier from "user" where id = ${ordinary.id}`;

      expect(await practiceOf(ordinary)).toBeUndefined();
      expect(userRow?.tier).toBe('free');
    });

    it('still makes a premium price premium, and opens no practice with it', async () => {
      const pro = await professional('premium-price');
      const customer = `cus_${stamp}_premium`;

      await BillingController.customerFor(pro.id, () => Promise.resolve(customer));
      await stripeSays(customer, `sub_${stamp}_premium`, 'active', PREMIUM);

      const [userRow] = await tables()<{ tier: string }>`select tier from "user" where id = ${pro.id}`;

      expect(userRow?.tier).toBe('premium');
      expect(await practiceOf(pro)).toEqual({ includedClients: 0, practiceOpen: false });
    });
  });

  describe('a practice beside a premium subscription', () => {
    it('closes the practice when its subscription ends while premium still pays, and keeps the account premium', async () => {
      const { customer, pro, subscription } = await paying('sibling');
      const premium = `sub_${stamp}_sibling_premium`;

      await stripeSays(customer, premium, 'active', PREMIUM);
      await stripeSays(customer, subscription, 'canceled', THIRTY);

      const [userRow] = await tables()<{ tier: string }>`select tier from "user" where id = ${pro.id}`;

      expect(await practiceOf(pro)).toMatchObject({ practiceOpen: false });
      expect(userRow?.tier).toBe('premium');

      // A retried or late delivery for the ended practice subscription reopens nothing.
      await redeliver(customer, subscription, 'customer.subscription.deleted');
      await redeliver(customer, subscription);
      expect(await practiceOf(pro)).toMatchObject({ practiceOpen: false });
    });
  });

  describe('the door: a practice of one’s own, paid for or not', () => {
    function practicePage(who: Account) {
      return request(server()).get(`/${PREFIX}/care/practice`).set('Cookie', who.cookie);
    }

    async function trailRows(client: Account): Promise<number> {
      const [row] = await tables()<{ count: number }>`select count(*)::int as count from care_access_log where user_id = ${client.id}`;

      return row?.count ?? 0;
    }

    // Inverted in project 025 phase 6 (PRD 025 criterion 7): no plan paid for, and the door is open; paying moves the seats.
    it('opens the client routes and invitations to a practice nobody pays for, and paying changes the seats, not the door', async () => {
      const pro = await professional('door');
      const client = await account('door-client');

      expect(await practiceOf(pro)).toEqual({ includedClients: 0, practiceOpen: false });

      const linkId = await link(pro, client);

      expect(await linkRow(linkId)).toMatchObject({ status: 'active' });
      await overview(pro, linkId).expect(200);
      await request(server()).get(`/${PREFIX}/care/clients`).set('Cookie', pro.cookie).expect(200);
      expect((await practicePage(pro).expect(200)).body).toMatchObject({ activeClients: 1, includedClients: 0, open: false, seats: 10 });

      const customer = `cus_${stamp}_door`;

      await BillingController.customerFor(pro.id, () => Promise.resolve(customer));
      await stripeSays(customer, `sub_${stamp}_door`, 'active', THIRTY);
      await overview(pro, linkId).expect(200);
      expect((await practicePage(pro).expect(200)).body).toMatchObject({ activeClients: 1, includedClients: 30, open: true, seats: 30 });
    });

    it('shows the workspace the way to pay while no plan is paid for, with the free seats, and only to a professional', async () => {
      const pro = await professional('door-page');
      const ordinary = await account('door-page-ordinary');

      await UserController.grantAdmin(pro.email);
      await UserController.grantAdmin(ordinary.email);

      const closed: Response = await practicePage(pro).expect(200);

      expect(closed.body).toMatchObject({
        activeClients: 0,
        billing: {
          available: true,
          plans: [
            { includedClients: 2, priceId: TWO },
            { includedClients: 30, priceId: THIRTY },
            { includedClients: 60, priceId: SIXTY }
          ],
          subscription: null,
          testMode: true,
          trialDays: 14
        },
        includedClients: 0,
        open: false,
        pendingInvitations: 0,
        restriction: null,
        seats: 10,
        secondFactorRequired: false
      });
      await practicePage(ordinary).expect(404);

      // The switch off hides it like every door of the workspace.
      await setSwitch(false);

      try {
        await practicePage(pro).expect(404);
      } finally {
        await setSwitch(true);
      }
    });

    it('says what is open and counted once Stripe opens it, and shows billing to the owner alone on test keys', async () => {
      const { pro } = await paying('door-open');
      const { client } = await clientOf(pro, 'door-open-client');

      await inviting(pro, address('door-open-invited')).expect(201);

      const rows = await trailRows(client);
      const page: Response = await practicePage(pro).expect(200);

      expect(page.body).toMatchObject({
        activeClients: 1,
        billing: { available: false },
        includedClients: 30,
        open: true,
        pendingInvitations: 1,
        seats: 30
      });
      // Reading it is not a read of any client.
      expect(await trailRows(client)).toBe(rows);
    });
  });

  describe('the included number', () => {
    /** The unexpired invitations a professional has out. */
    async function openInvitations(pro: Account): Promise<number> {
      const [row] = await tables()<{ count: number }>`
        select count(*)::int as count from care_invitations where professional_id = ${pro.id} and expires_at > now()`;

      return row?.count ?? 0;
    }

    it('counts active links and unexpired invitations, refuses the next with the way up, and writes nothing', async () => {
      const { pro } = await paying('two', TWO);
      const { linkId } = await clientOf(pro, 'two-client');
      const waiting = address('two-invited');

      const queued = sent.length;

      await inviting(pro, waiting).expect(201);
      // Its mail leaves in the background: wait for it, so nothing after this line is its.
      await tokenMailedTo(waiting, queued);

      const before = sent.length;
      const refused: Response = await inviting(pro, address('two-third')).expect(409);

      expect(refused.body).toMatchObject({
        code: 'PRACTICE_FULL',
        practice: { includedClients: 2, waysUp: ['larger_plan', 'end_link'] },
        statusCode: 409
      });
      expect(await openInvitations(pro)).toBe(1);

      // No mail queued for the refusal.
      await new Promise(resolve => {
        setTimeout(resolve, 300);
      });
      expect(sent.slice(before)).toEqual([]);

      // Inviting the address already invited again replaces its own seat, full or not.
      await inviting(pro, waiting).expect(201);
      expect(await openInvitations(pro)).toBe(1);

      // An expired invitation no longer counts — and of two sent at once into the last seat, one is refused.
      // A day, not a minute: this backdates with the DATABASE's `now()`, but liveness is judged by the API's
      // own JS clock (`CareRepository.invite`), and an unsynced machine clock has already closed that gap once.
      await tables()`update care_invitations set expires_at = now() - interval '1 day' where professional_id = ${pro.id}`;

      const raced = await Promise.all([inviting(pro, address('two-race-a')), inviting(pro, address('two-race-b'))]);

      expect(raced.map(answer => answer.status).sort()).toEqual([201, 409]);
      expect(await openInvitations(pro)).toBe(1);

      // Nor does an ended link.
      await endLink(pro, linkId).expect(204);
      await inviting(pro, address('two-after-end')).expect(201);
    });

    // Inverted in project 025 phase 6 (invariant review, P1-1): a paused link keeps its seat; ending it frees one.
    it('counts a paused link too, until it ends', async () => {
      const { pro } = await paying('paused-seat', TWO);
      const { client, linkId } = await clientOf(pro, 'paused-seat-a');

      await clientOf(pro, 'paused-seat-b');
      await inviting(pro, address('paused-seat-full')).expect(409);

      // No route pauses a link since phase 6; one paused by a 004 lapse is written on the table.
      await tables()`update care_links set status = 'paused' where id = ${linkId}`;
      await inviting(pro, address('paused-seat-still-full')).expect(409);
      expect(await seatsTaken(pro)).toBe(2);

      await endLink(client, linkId).expect(204);
      await inviting(pro, address('paused-seat-room')).expect(201);
    });

    it('never overshoots when an acceptance races an invitation into a full practice', async () => {
      const { pro } = await paying('race-full', TWO);

      await clientOf(pro, 'race-full-linked');

      const accepter = await account('race-full-accepter');
      const token = await invited(pro, accepter);

      expect(await seatsTaken(pro)).toBe(2);

      const [accepted, invitation] = await Promise.all([accepting(accepter, token), inviting(pro, address('race-full-new'))]);

      expect(accepted.status).toBe(200);
      expect(invitation.status).toBe(409);
      expect(await seatsTaken(pro)).toBe(2);
    });

    it('with one seat left, an acceptance racing an invitation leaves the practice at most full', async () => {
      const { pro } = await paying('race-one', TWO);
      const accepter = await account('race-one-accepter');
      const token = await invited(pro, accepter);

      expect(await seatsTaken(pro)).toBe(1);

      const [accepted, invitation] = await Promise.all([accepting(accepter, token), inviting(pro, address('race-one-new'))]);

      expect(accepted.status).toBe(200);
      expect([201, 409]).toContain(invitation.status);
      expect(await seatsTaken(pro)).toBeLessThanOrEqual(2);
    });

    it('refuses the 31st on a practice of 30, and the larger price makes room', async () => {
      const { customer, pro, subscription } = await paying('thirty', THIRTY);
      const session = { id: pro.id, email: pro.email, emailVerified: true, name: nameOf(pro) };

      await clientOf(pro, 'thirty-client');

      // 28 more straight through core, out of the route's rate limit (30 an hour), so the route's own answer is what the 30th and 31st meet.
      for (let index = 0; index < 28; index += 1) {
        await CareController.invite(session, { email: address(`thirty-${index}`) });
      }

      await inviting(pro, address('thirty-30th')).expect(201);

      const refused: Response = await inviting(pro, address('thirty-31st')).expect(409);

      expect(refused.body).toMatchObject({ code: 'PRACTICE_FULL', practice: { includedClients: 30 } });

      await stripeSays(customer, subscription, 'active', SIXTY);
      await inviting(pro, address('thirty-31st-again')).expect(201);
    });
  });

  describe('a linked client’s allowances', () => {
    // Project 025 phase 6 (PRD 025 criterion 8): a free practice grants no premium; the client keeps their own tier.
    it('are the client’s own while the practice is not paid for', async () => {
      const pro = await professional('tier-free');
      const { client } = await clientOf(pro, 'tier-free-client');

      expect(await tierOf(client)).toBe('free');
      await overview(pro, (await linksOf(pro.id))[0]?.id ?? '').expect(200);
    });

    it('are premium while the link is active and the practice open, behind the professional switch, and free after', async () => {
      const { customer, pro, subscription } = await paying('tier');
      const { client, linkId } = await clientOf(pro, 'tier-client');
      const loner = await account('tier-loner');

      await completeOnboarding(on.app, loner);

      expect(await tierOf(client)).toBe('premium');
      expect(await tierOf(loner)).toBe('free');

      await setSwitch(false);

      try {
        expect(await tierOf(client)).toBe('free');
      } finally {
        await setSwitch(true);
      }

      expect(await tierOf(client)).toBe('premium');

      await stripeSays(customer, subscription, 'unpaid', THIRTY);
      expect(await tierOf(client)).toBe('free');

      await stripeSays(customer, subscription, 'active', THIRTY);
      expect(await tierOf(client)).toBe('premium');

      await endLink(client, linkId).expect(204);
      expect(await tierOf(client)).toBe('free');
      // The column was never written: the premium was the link's.
      const [row] = await tables()<{ tier: string }>`select tier from "user" where id = ${client.id}`;

      expect(row?.tier).toBe('free');
    });
  });

  /*
   * Inverted in project 025 phase 6 (PRD 025 scope 2, invariant review P1-1): a
   * lapse pauses nothing — a practice nobody pays for works — and only returns
   * the clients to their own tier. Paying again makes active the links a 004
   * lapse left paused, which are written on the table here: no route pauses one.
   */
  describe('a lapse pauses nothing; paying again resumes what 004 had paused', () => {
    let pro: Account;
    let customer: string;
    let subscription: string;
    let otherPro: Account;
    const links: Record<'active' | 'ended' | 'other' | 'targets', string> = { active: '', ended: '', other: '', targets: '' };
    const clients: Partial<Record<'active' | 'ended' | 'other' | 'targets', Account>> = {};
    let supervisedTargets: OverrideRow | undefined;

    beforeAll(async () => {
      ({ customer, pro, subscription } = await paying('lapse'));
      ({ pro: otherPro } = await paying('lapse-other'));

      for (const name of ['active', 'ended', 'targets'] as const) {
        const { client, linkId } = await clientOf(pro, `lapse-${name}`);

        clients[name] = client;
        links[name] = linkId;
      }

      const other = await clientOf(otherPro, 'lapse-other-client');

      clients.other = other.client;
      links.other = other.linkId;

      await endLink(clients.ended as Account, links.ended).expect(204);
      await setTargets(pro, links.targets, { kcal: 2100 }).expect(200);
      supervisedTargets = await overrideRow(clients.targets as Account);
      expect(supervisedTargets?.setByProfessionalId).toBe(pro.id);
    });

    it('pauses nothing and deletes nothing on a lapse: the practitioner still reaches the clients, who return to their own tier', async () => {
      const endedBefore = await linkRow(links.ended);

      await stripeSays(customer, subscription, 'canceled', THIRTY);

      expect(await practiceOf(pro)).toMatchObject({ practiceOpen: false });
      expect(await linkRow(links.active)).toEqual({ id: links.active, endedAt: null, endedBy: null, status: 'active' });
      expect(await linkRow(links.targets)).toEqual({ id: links.targets, endedAt: null, endedBy: null, status: 'active' });
      expect(await linkRow(links.ended)).toEqual(endedBefore);
      expect(await linkRow(links.other)).toMatchObject({ status: 'active' });

      await overview(pro, links.active).expect(200);
      await request(server()).get(`/${PREFIX}/care/clients`).set('Cookie', pro.cookie).expect(200);

      const mine: Response = await request(server())
        .get(`/${PREFIX}/care/links/me`)
        .set('Cookie', (clients.active as Account).cookie)
        .expect(200);

      expect(mine.body).toMatchObject({ id: links.active, status: 'active' });
      expect(await tierOf(clients.active as Account)).toBe('free');
      expect(await tierOf(clients.other as Account)).toBe('premium');
    });

    it('keeps the targets’ mark and their numbers through the lapse', async () => {
      expect(await overrideRow(clients.targets as Account)).toEqual(supervisedTargets);
      expect((await ownTargets(clients.targets as Account)).setBy).toEqual({ kind: 'professional', name: nameOf(pro) });
    });

    it('reactivates the paused links when a new subscription pays, and only those', async () => {
      const again = `sub_${stamp}_lapse_again`;

      // Paused by a 004 lapse, before phase 6: no route pauses a link now.
      await tables()`update care_links set status = 'paused' where id in (${links.active}, ${links.targets})`;
      await stripeSays(customer, again, 'active', THIRTY);

      expect(await practiceOf(pro)).toEqual({ includedClients: 30, practiceOpen: true });
      expect(await linkRow(links.active)).toMatchObject({ endedAt: null, endedBy: null, status: 'active' });
      expect(await linkRow(links.targets)).toMatchObject({ status: 'active' });
      expect(await linkRow(links.ended)).toMatchObject({ status: 'ended' });
      await overview(pro, links.active).expect(200);
      expect(await tierOf(clients.active as Account)).toBe('premium');
      expect(await overrideRow(clients.targets as Account)).toEqual(supervisedTargets);
    });

    it('pauses nothing on a status that stops paying, and stays as it is when the same subscription pays again', async () => {
      const again = `sub_${stamp}_lapse_again`;

      await stripeSays(customer, again, 'unpaid', THIRTY);
      expect((await linksOf(pro.id)).map(row => row.status).sort()).toEqual(['active', 'active', 'ended']);
      expect(await tierOf(clients.active as Account)).toBe('free');

      await stripeSays(customer, again, 'active', THIRTY);
      expect((await linksOf(pro.id)).map(row => row.status).sort()).toEqual(['active', 'active', 'ended']);
      expect(await overrideRow(clients.targets as Account)).toEqual(supervisedTargets);
    });

    it('changes nothing on a delivery sent twice, or a late one for the subscription that ended', async () => {
      const again = `sub_${stamp}_lapse_again`;

      // Lapsed: the same delivery twice leaves the pause exactly as the first made it.
      await stripeSays(customer, again, 'unpaid', THIRTY);

      const paused = { links: await linksOf(pro.id), practice: await practiceOf(pro) };

      await redeliver(customer, again);
      await redeliver(customer, again, 'customer.subscription.deleted');
      expect({ links: await linksOf(pro.id), practice: await practiceOf(pro) }).toEqual(paused);
      expect(await overrideRow(clients.targets as Account)).toEqual(supervisedTargets);

      // Paying again, and then the first subscription's end delivered late: nothing closes.
      await stripeSays(customer, again, 'active', THIRTY);

      const open = { links: await linksOf(pro.id), practice: await practiceOf(pro) };

      await redeliver(customer, subscription, 'customer.subscription.deleted');
      await redeliver(customer, subscription);
      await redeliver(customer, again);
      expect({ links: await linksOf(pro.id), practice: await practiceOf(pro) }).toEqual(open);
      expect(open.practice).toEqual({ includedClients: 30, practiceOpen: true });
    });
  });

  // Inverted in project 025 phase 6: an acceptance always makes the link `active`; the lapse only takes the premium away.
  describe('an invitation accepted while the practice is lapsed', () => {
    it('makes the link active, the client on their own tier, until paying again makes them premium', async () => {
      const { customer, pro, subscription } = await paying('accept-lapsed');
      const client = await account('accept-lapsed-client');

      await completeOnboarding(on.app, client);

      const token = await invited(pro, client);

      await stripeSays(customer, subscription, 'canceled', THIRTY);

      const accepted: Response = await accepting(client, token).expect(200);
      const linkId = (accepted.body as CareLinkView).id;

      expect(await linkRow(linkId)).toEqual({ id: linkId, endedAt: null, endedBy: null, status: 'active' });

      const mine: Response = await request(server()).get(`/${PREFIX}/care/links/me`).set('Cookie', client.cookie).expect(200);

      expect(mine.body).toMatchObject({ id: linkId, status: 'active' });
      expect(await tierOf(client)).toBe('free');
      await overview(pro, linkId).expect(200);

      await stripeSays(customer, `sub_${stamp}_accept_lapsed_again`, 'active', THIRTY);
      expect(await linkRow(linkId)).toMatchObject({ status: 'active' });
      expect(await tierOf(client)).toBe('premium');
      await overview(pro, linkId).expect(200);
    });
  });

  describe('when a link ends, the targets become the client’s own', () => {
    it.each(['client', 'professional'] as const)('ended by the %s: the mark is cleared and the numbers are unchanged', async side => {
      const { pro } = await paying(`end-${side}`);
      const { client, linkId } = await clientOf(pro, `end-${side}-client`);

      await setTargets(pro, linkId, { kcal: 2050, proteinG: 130 }).expect(200);

      const before = await overrideRow(client);

      expect(before?.setByProfessionalId).toBe(pro.id);

      await endLink(side === 'client' ? client : pro, linkId).expect(204);

      const after = await overrideRow(client);

      expect(after).toEqual({ ...before, setByProfessionalId: null });
      expect(await linkRow(linkId)).toMatchObject({ endedBy: side, status: 'ended' });
      expect((await ownTargets(client)).setBy).toEqual({ kind: 'self' });

      // A second professional sees the client's own targets, and no earlier professional's name.
      const { pro: next } = await paying(`end-${side}-next`);
      const nextLink = await link(next, client);
      const page: Response = await overview(next, nextLink).expect(200);

      expect((page.body as { targets: ResolvedTargets }).targets.setBy).toEqual({ kind: 'self' });
      expect(JSON.stringify(page.body)).not.toContain(nameOf(pro));
    });

    it('lets a professional whose practice lapsed end a link — a way up — and clears the mark all the same', async () => {
      const { customer, pro, subscription } = await paying('end-lapsed');
      const { client, linkId } = await clientOf(pro, 'end-lapsed-client');

      await setTargets(pro, linkId, { kcal: 2020 }).expect(200);
      await stripeSays(customer, subscription, 'unpaid', THIRTY);
      // Inverted in project 025 phase 6: a lapse leaves the link active.
      expect(await linkRow(linkId)).toMatchObject({ status: 'active' });

      const before = await overrideRow(client);

      await endLink(pro, linkId).expect(204);
      expect(await linkRow(linkId)).toMatchObject({ endedBy: 'professional', status: 'ended' });
      expect(await overrideRow(client)).toEqual({ ...before, setByProfessionalId: null });

      // Paying again brings back nothing that was ended.
      await stripeSays(customer, subscription, 'active', THIRTY);
      expect(await linkRow(linkId)).toMatchObject({ status: 'ended' });
    });

    it('never touches another professional’s mark on the same client', async () => {
      const { pro } = await paying('end-foreign');
      const { pro: foreign } = await paying('end-foreign-other');
      const { client, linkId } = await clientOf(pro, 'end-foreign-client');

      await setTargets(pro, linkId, { kcal: 1990 }).expect(200);
      // A mark this link did not make, which no route can write today: the end must leave it standing.
      await tables()`update target_overrides set set_by_professional_id = ${foreign.id} where user_id = ${client.id}`;

      const before = await overrideRow(client);

      await endLink(client, linkId).expect(204);
      expect(await overrideRow(client)).toEqual(before);
      expect(before?.setByProfessionalId).toBe(foreign.id);
    });
  });

  it('deletes a professional who pays, keeping each client’s account and targets', async () => {
    const { pro } = await paying('leaving');
    const { client, linkId } = await clientOf(pro, 'leaving-client');

    await setTargets(pro, linkId, { kcal: 2010 }).expect(200);

    const before = await overrideRow(client);

    // The session TOTP's confirmation opened minutes ago is fresh enough to delete from; a password sign-in would now be challenged.
    await request(server()).delete(`/${PREFIX}/users/me`).set('Cookie', pro.cookie).expect(204);

    expect(await overrideRow(client)).toEqual({ ...before, setByProfessionalId: null });
    await request(server()).get(`/${PREFIX}/profile`).set('Cookie', client.cookie).expect(200);
  });
});
