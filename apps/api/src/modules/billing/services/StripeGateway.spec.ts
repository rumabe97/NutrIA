import { describe, expect, it } from '@jest/globals';
import Stripe from 'stripe';

import { StripeGateway } from './StripeGateway.js';

import type { Env } from '../../../config/index.js';

const SECRET = 'whsec_test_secret';
const ENV = {
  BETTER_AUTH_URL: 'https://api.nutria.example',
  DATABASE_URL: 'postgresql://app@ep-calm-sea-123-pooler.eu-central-1.aws.neon.tech/nutria?sslmode=require',
  STRIPE_PRICE_ID: 'price_test',
  STRIPE_SECRET_KEY: 'sk_test_key',
  STRIPE_WEBHOOK_SECRET: SECRET
} as Env;
const SIGNER = new Stripe('sk_test_key');

/** A subscription as Stripe returns it, with the fields the gateway reads. */
function stripeSubscription(id: string, status: string, metadata: Record<string, string> = {}) {
  return { id, cancel_at_period_end: false, customer: 'cus_1', items: { data: [{ current_period_end: 1_790_000_000 }] }, metadata, status };
}

function signed(payload: string, secret = SECRET): string {
  return SIGNER.webhooks.generateTestHeaderString({ payload, secret });
}

describe('StripeGateway', () => {
  const payload = JSON.stringify({ id: 'evt_1', data: { object: {} }, object: 'event', type: 'invoice.paid' });

  /* The signature is the webhook's whole authority. Nothing here goes near the network. */
  it('trusts only a payload signed with the webhook secret, byte for byte', () => {
    const gateway = new StripeGateway(ENV);

    expect(gateway.event(Buffer.from(payload), signed(payload))?.id).toBe('evt_1');
    expect(gateway.event(Buffer.from(payload), signed(payload, 'whsec_somebody_else'))).toBeNull();
    expect(gateway.event(Buffer.from(payload.replace('evt_1', 'evt_2')), signed(payload))).toBeNull();
    expect(gateway.event(Buffer.from(payload), 'not a signature')).toBeNull();
  });

  it('is configured only with all three values, and knows a test key when it sees one', () => {
    expect(new StripeGateway(ENV)).toMatchObject({ configured: true, testMode: true });
    expect(new StripeGateway({ ...ENV, STRIPE_WEBHOOK_SECRET: undefined } as Env).configured).toBe(false);
    expect(new StripeGateway({ ...ENV, STRIPE_SECRET_KEY: 'sk_live_key' } as Env).testMode).toBe(false);
  });

  it('lists every subscription of a customer, page after page', async () => {
    const gateway = new StripeGateway(ENV);
    const asked: unknown[][] = [];
    const pages = [
      { data: [stripeSubscription('sub_1', 'active')], has_more: true },
      { data: [stripeSubscription('sub_2', 'trialing')], has_more: false }
    ];

    Object.assign(gateway, {
      client: { subscriptions: { list: (...args: unknown[]) => (asked.push(args), Promise.resolve(pages[asked.length - 1])) } }
    });

    await expect(gateway.subscriptionsOf('cus_1')).resolves.toMatchObject([
      { status: 'active', subscriptionId: 'sub_1' },
      { status: 'trialing', subscriptionId: 'sub_2' }
    ]);
    expect(asked).toEqual([
      [{ customer: 'cus_1', limit: 100 }, undefined],
      [{ customer: 'cus_1', limit: 100, starting_after: 'sub_1' }, undefined]
    ]);
  });

  /* A call made with an account's row locked holds that lock for as long as it takes. */
  it('asks Stripe once, for five seconds at most, with an account’s row locked', async () => {
    const gateway = new StripeGateway(ENV);
    const options: unknown[] = [];

    Object.assign(gateway, {
      client: {
        customers: { create: (_params: unknown, given: unknown) => (options.push(given), Promise.resolve({ id: 'cus_new' })) },
        subscriptions: {
          list: (_params: unknown, given: unknown) => (options.push(given), Promise.resolve({ data: [], has_more: false })),
          retrieve: (id: string, _params: unknown, given: unknown) => (options.push(given), Promise.resolve(stripeSubscription(id, 'active')))
        }
      }
    });

    await gateway.createCustomer('ana@example.invalid', 'usr-ana');
    await gateway.subscription('sub_1', { underLock: true });
    await gateway.subscriptionsOf('cus_1', { underLock: true });
    await gateway.subscription('sub_1');

    const underLock = { maxNetworkRetries: 0, timeout: 5000 };

    expect(options).toEqual([{ ...underLock, idempotencyKey: 'customer-usr-ana' }, underLock, underLock, undefined]);
  });

  it('reads back the account and the deployment checkout wrote into a subscription', async () => {
    const gateway = new StripeGateway(ENV);

    Object.assign(gateway, {
      client: {
        subscriptions: {
          retrieve: (id: string) =>
            Promise.resolve(
              id === 'sub_marked' ? stripeSubscription(id, 'active', { deployment: 'dep_1', userId: 'usr-ana' }) : stripeSubscription(id, 'active')
            )
        }
      }
    });

    await expect(gateway.subscription('sub_marked')).resolves.toMatchObject({ customerId: 'cus_1', deploymentHint: 'dep_1', userIdHint: 'usr-ana' });
    await expect(gateway.subscription('sub_plain')).resolves.toMatchObject({ deploymentHint: null, userIdHint: null });
  });

  /* Local development and production share one Stripe test account: this is how each tells its own apart. */
  it('names its deployment by the database it writes to, pooled or direct, whatever the credentials', () => {
    const here = new StripeGateway(ENV).deployment;
    const at = (url: string) => new StripeGateway({ ...ENV, DATABASE_URL: url } as Env).deployment;

    expect(here).toMatch(/^[0-9a-f]{16}$/);
    expect(at('postgresql://owner@ep-calm-sea-123.eu-central-1.aws.neon.tech/nutria')).toBe(here);
    expect(at('postgresql://app@ep-calm-sea-123-pooler.eu-central-1.aws.neon.tech/nutria_dev')).not.toBe(here);
    expect(at('postgresql://app@ep-other-lake-456-pooler.eu-central-1.aws.neon.tech/nutria')).not.toBe(here);
    expect(at('postgres://postgres:postgres@localhost:5432/nutria')).not.toBe(here);
  });

  describe('cancelling', () => {
    function gatewayWith(cancel: (id: string) => Promise<unknown>, statusNow: string) {
      const gateway = new StripeGateway(ENV);

      Object.assign(gateway, { client: { subscriptions: { cancel, retrieve: (id: string) => Promise.resolve(stripeSubscription(id, statusNow)) } } });

      return gateway;
    }

    /* A second delivery for an orphan the first one already cancelled: nothing left to do. */
    it('carries on when the subscription had already ended', async () => {
      await expect(gatewayWith(() => Promise.reject(new Error('No such subscription')), 'canceled').cancel('sub_1')).resolves.toBeUndefined();
    });

    it('fails when a subscription that has not ended could not be cancelled', async () => {
      await expect(gatewayWith(() => Promise.reject(new Error('Stripe is unreachable')), 'active').cancel('sub_1')).rejects.toThrow(
        'Stripe is unreachable'
      );
    });
  });

  it('opens a checkout that expires in 31 minutes and marks the subscription with the account and the deployment', async () => {
    const gateway = new StripeGateway(ENV);
    const created: Record<string, unknown>[] = [];

    Object.assign(gateway, {
      client: {
        checkout: { sessions: { create: (params: Record<string, unknown>) => (created.push(params), Promise.resolve({ url: 'https://checkout' })) } }
      }
    });

    const before = Math.floor(Date.now() / 1000);

    await gateway.checkoutUrl({
      cancelUrl: 'https://nutria.example/perfil',
      customerId: 'cus_1',
      locale: 'es-ES',
      plan: 'monthly',
      successUrl: 'https://nutria.example/perfil?premium=gracias',
      trialDays: null,
      userId: 'usr-ana'
    });

    expect(created[0]).toMatchObject({ subscription_data: { metadata: { deployment: gateway.deployment, userId: 'usr-ana' } } });
    expect(created[0]?.expires_at).toBeGreaterThanOrEqual(before + 31 * 60);
    expect(created[0]?.expires_at).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 31 * 60);
  });

  describe('expiring open checkouts', () => {
    function gatewayWith(expire: (id: string) => Promise<unknown>, statusNow: string) {
      const gateway = new StripeGateway(ENV);
      const listed: unknown[] = [];

      Object.assign(gateway, {
        client: {
          checkout: {
            sessions: {
              expire,
              list: (params: unknown) => (listed.push(params), Promise.resolve({ data: [{ id: 'cs_1' }, { id: 'cs_2' }], has_more: false })),
              retrieve: (id: string) => Promise.resolve({ id, status: statusNow })
            }
          }
        }
      });

      return { gateway, listed };
    }

    it('expires every open checkout of the customer', async () => {
      const expired: string[] = [];
      const { gateway, listed } = gatewayWith(id => (expired.push(id), Promise.resolve({})), 'expired');

      await gateway.expireOpenCheckouts('cus_1');

      expect(listed).toEqual([{ customer: 'cus_1', limit: 100, status: 'open' }]);
      expect(expired).toEqual(['cs_1', 'cs_2']);
    });

    /* Completed or expired meanwhile: not open any more, which is all the expiry was for. */
    it('carries on past a checkout that stopped being open before its expiry', async () => {
      const { gateway } = gatewayWith(() => Promise.reject(new Error('This session is not open')), 'complete');

      await expect(gateway.expireOpenCheckouts('cus_1')).resolves.toBeUndefined();
    });

    it('fails when a checkout that is still open could not be expired', async () => {
      const { gateway } = gatewayWith(() => Promise.reject(new Error('Stripe is unreachable')), 'open');

      await expect(gateway.expireOpenCheckouts('cus_1')).rejects.toThrow('Stripe is unreachable');
    });
  });
});

/*
 * What a price grants (`0061`). Premium stays exactly as it was before
 * practices: every subscription is premium's — an older premium price the
 * owner has since replaced, or none to read at all — unless its price is a
 * listed practice price. Only the list opens a practice, with its number.
 */
describe('StripeGateway.grantOf', () => {
  const gateway = new StripeGateway({
    ...ENV,
    STRIPE_PRACTICE_PRICES: [
      { includedClients: 30, priceId: 'price_practice_30' },
      { includedClients: 60, priceId: 'price_practice_60' }
    ]
  } as Env);

  it('opens a practice of the configured number for a listed practice price', () => {
    expect(gateway.grantOf('price_practice_30')).toEqual({ includedClients: 30, kind: 'practice' });
    expect(gateway.grantOf('price_practice_60')).toEqual({ includedClients: 60, kind: 'practice' });
  });

  it('is premium for the configured premium price, as today', () => {
    expect(gateway.grantOf(ENV.STRIPE_PRICE_ID ?? '')).toEqual({ kind: 'premium' });
  });

  /* A subscriber stranded on a replaced price keeps premium until the owner decides otherwise. */
  it('is premium for a price no longer configured, and for a subscription with no price to read', () => {
    expect(gateway.grantOf('price_premium_of_last_year')).toEqual({ kind: 'premium' });
    expect(gateway.grantOf(null)).toEqual({ kind: 'premium' });
  });

  it('opens no practice without the list, whatever the price', () => {
    expect(new StripeGateway(ENV).grantOf('price_practice_30')).toEqual({ kind: 'premium' });
  });
});
