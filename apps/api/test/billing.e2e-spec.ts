import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { BillingController } from 'core/controllers/Billing';

import { createApp, httpServer, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * Paying for premium (`0056`), asserted where it touches the database.
 *
 * The suite has no Stripe keys, which is also how every environment ships: with
 * nothing set up, nothing is for sale and every route says so. The webhook's
 * signature is tested in the unit spec against Stripe's own signer. Here, the
 * write it makes — the tier and the subscription behind it — runs on the real
 * tables.
 *
 * Requires a real database — see ./README.md.
 */
describe('billing', () => {
  let app: INestApplication;
  let account: Account;
  const stamp = Date.now();

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient([]));
    account = await register(app, `billing-${stamp}@e2e.invalid`);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('offers nothing to buy without Stripe set up, and every route says so', async () => {
    const server = httpServer(app);
    const status: Response = await request(server).get(`/${PREFIX}/billing`).set('Cookie', account.cookie).expect(200);

    expect(status.body).toEqual({ available: false });
    await request(server).post(`/${PREFIX}/billing/checkout`).set('Cookie', account.cookie).expect(404);
    await request(server).post(`/${PREFIX}/billing/portal`).set('Cookie', account.cookie).expect(404);
    // No session and no signature: the webhook answers like any other denial.
    await request(server).post(`/${PREFIX}/billing/webhook`).send({ type: 'checkout.session.completed' }).expect(404);
  });

  it('writes the tier Stripe’s word decides, with the subscription behind it, and takes it back when it ends', async () => {
    const customerId = `cus_e2e_${stamp}`;
    const subscription = {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date('2026-12-01T00:00:00Z'),
      customerId,
      status: 'active',
      subscriptionId: `sub_e2e_${stamp}`
    };

    await BillingController.rememberCustomer(account.id, customerId);
    await expect(BillingController.userOfCustomer(customerId)).resolves.toBe(account.id);
    await expect(BillingController.standing(account.id)).resolves.toEqual({ subscription: null, tier: 'free' });

    await expect(BillingController.applySubscription(account.id, subscription)).resolves.toBe('premium');
    await expect(BillingController.standing(account.id)).resolves.toEqual({
      subscription: { cancelAtPeriodEnd: false, currentPeriodEnd: '2026-12-01T00:00:00.000Z', status: 'active' },
      tier: 'premium'
    });

    await expect(BillingController.applySubscription(account.id, { ...subscription, status: 'canceled' })).resolves.toBe('free');
    await expect(BillingController.standing(account.id)).resolves.toMatchObject({ subscription: { status: 'canceled' }, tier: 'free' });
  });
});
