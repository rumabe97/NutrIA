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
});
