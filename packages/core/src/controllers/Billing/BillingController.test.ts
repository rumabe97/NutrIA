import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BillingController } from './BillingController';

import type { SubscriptionRecord } from '#repositories/Billing';

type Decide = (stored: SubscriptionRecord | null) => Promise<{ readonly record: SubscriptionRecord; readonly tier: 'free' | 'premium' } | null>;

/** The row the fake repository holds, or `undefined` for an account that does not exist. */
let stored: SubscriptionRecord | null | undefined;
const written: { record: SubscriptionRecord; tier: 'free' | 'premium' }[] = [];

vi.mock('#repositories/Billing', () => ({
  BillingRepository: {
    recordSubscription: async (_userId: string, decide: Decide) => {
      if (stored === undefined) {
        return 'absent';
      }

      const decision = await decide(stored);

      if (!decision) {
        return 'kept';
      }

      written.push(decision);

      return 'written';
    }
  }
}));

function row(status: string | null, subscriptionId: string | null = 'sub_1'): SubscriptionRecord {
  return { cancelAtPeriodEnd: false, currentPeriodEnd: null, customerId: 'cus_1', status, subscriptionId };
}

describe('BillingController.applySubscription', () => {
  beforeEach(() => {
    stored = null;
    written.length = 0;
  });

  it('writes what Stripe says now, with the tier it decides', async () => {
    stored = row(null, null);

    await expect(BillingController.applySubscription('usr-1', async () => row('active'))).resolves.toBe('premium');
    expect(written).toEqual([{ record: row('active'), tier: 'premium' }]);
  });

  /* A deleted account, or one Stripe's metadata invented: nothing written, Stripe not asked. */
  it('asks Stripe nothing and writes nothing for an account that does not exist', async () => {
    stored = undefined;

    const latest = vi.fn(async () => row('active'));

    await expect(BillingController.applySubscription('usr-gone', latest)).resolves.toBe('absent');
    expect(latest).not.toHaveBeenCalled();
    expect(written).toEqual([]);
  });

  it('keeps an ended subscription ended when a late answer says it is live', async () => {
    stored = row('canceled');

    await expect(BillingController.applySubscription('usr-1', async () => row('active'))).resolves.toBe('kept');
    expect(written).toEqual([]);
  });
});
