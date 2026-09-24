import { describe, expect, it } from '@jest/globals';
import Stripe from 'stripe';

import { StripeGateway } from './StripeGateway.js';

import type { Env } from '../../../config/index.js';

const SECRET = 'whsec_test_secret';
const ENV = { STRIPE_PRICE_ID: 'price_test', STRIPE_SECRET_KEY: 'sk_test_key', STRIPE_WEBHOOK_SECRET: SECRET } as Env;
const SIGNER = new Stripe('sk_test_key');

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
    const asked: unknown[] = [];
    const pages = [
      { data: [{ id: 'sub_1', status: 'active' }], has_more: true },
      { data: [{ id: 'sub_2', status: 'trialing' }], has_more: false }
    ];

    Object.assign(gateway, { client: { subscriptions: { list: (params: unknown) => (asked.push(params), Promise.resolve(pages[asked.length - 1])) } } });

    await expect(gateway.subscriptionsOf('cus_1')).resolves.toEqual([
      { id: 'sub_1', status: 'active' },
      { id: 'sub_2', status: 'trialing' }
    ]);
    expect(asked).toEqual([
      { customer: 'cus_1', limit: 100 },
      { customer: 'cus_1', limit: 100, starting_after: 'sub_1' }
    ]);
  });
});
