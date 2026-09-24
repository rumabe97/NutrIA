import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BillingController } from './BillingController';

import type { SubscriptionRecord } from '#repositories/Billing';

type Decide = (stored: SubscriptionRecord | null) => Promise<{ readonly record: SubscriptionRecord; readonly tier: 'free' | 'premium' } | null>;

/** The row the fake repository holds, or `undefined` for an account that does not exist. */
let stored: SubscriptionRecord | null | undefined;
const written: { record: SubscriptionRecord; tier: 'free' | 'premium' }[] = [];

/** Customers the fake repository keeps, by account, as the lock would leave them. */
const customers = new Map<string, string>();

vi.mock('#repositories/Billing', () => ({
  BillingRepository: {
    customerFor: async (userId: string, create: () => Promise<string>) => {
      if (stored === undefined) {
        return null;
      }

      const known = customers.get(userId) ?? (await create());

      customers.set(userId, known);

      return known;
    },
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

async function noSiblings(): Promise<SubscriptionRecord[]> {
  return [];
}

describe('BillingController.applySubscription', () => {
  beforeEach(() => {
    stored = null;
    written.length = 0;
  });

  it('writes what Stripe says now, with the tier it decides', async () => {
    stored = row(null, null);

    await expect(BillingController.applySubscription('usr-1', async () => row('active'), noSiblings)).resolves.toBe('premium');
    expect(written).toEqual([{ record: row('active'), tier: 'premium' }]);
  });

  /* A deleted account, or one Stripe's metadata invented: nothing written, Stripe not asked. */
  it('asks Stripe nothing and writes nothing for an account that does not exist', async () => {
    stored = undefined;

    const latest = vi.fn(async () => row('active'));

    await expect(BillingController.applySubscription('usr-gone', latest, noSiblings)).resolves.toBe('absent');
    expect(latest).not.toHaveBeenCalled();
    expect(written).toEqual([]);
  });

  it('keeps an ended subscription ended when a late answer says it is live', async () => {
    stored = row('canceled');

    await expect(BillingController.applySubscription('usr-1', async () => row('active'), noSiblings)).resolves.toBe('kept');
    expect(written).toEqual([]);
  });

  /* Two tabs, two subscriptions: one ending must not drop the tier while the other charges. */
  it('writes the customer’s other paying subscription when the stored one ends', async () => {
    stored = row('active');

    const siblings = vi.fn(async () => [row('canceled'), row('incomplete_expired', 'sub_old'), row('active', 'sub_2')]);

    await expect(BillingController.applySubscription('usr-1', async () => row('canceled'), siblings)).resolves.toBe('premium');
    expect(siblings).toHaveBeenCalledWith('cus_1');
    expect(written).toEqual([{ record: row('active', 'sub_2'), tier: 'premium' }]);
  });

  it('writes the ended subscription, and the free tier, when nothing else of the customer’s pays', async () => {
    stored = row('active');

    await expect(
      BillingController.applySubscription(
        'usr-1',
        async () => row('canceled'),
        async () => [row('incomplete', 'sub_2')]
      )
    ).resolves.toBe('free');
    expect(written).toEqual([{ record: row('canceled'), tier: 'free' }]);
  });

  it('does not list the customer’s subscriptions while the answer pays', async () => {
    stored = row(null, null);

    const siblings = vi.fn(noSiblings);

    await BillingController.applySubscription('usr-1', async () => row('trialing'), siblings);
    expect(siblings).not.toHaveBeenCalled();
  });
});

describe('BillingController.customerFor', () => {
  beforeEach(() => {
    stored = null;
    customers.clear();
  });

  it('makes a customer once, and hands every later caller the one it kept', async () => {
    const create = vi.fn(async () => 'cus_made');

    await expect(BillingController.customerFor('usr-1', create)).resolves.toBe('cus_made');
    await expect(BillingController.customerFor('usr-1', create)).resolves.toBe('cus_made');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('makes nothing for an account that does not exist', async () => {
    stored = undefined;

    const create = vi.fn(async () => 'cus_made');

    await expect(BillingController.customerFor('usr-gone', create)).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
