import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BillingController } from './BillingController';

import type { Grants, SubscriptionRecord } from '#repositories/Billing';
import type { PricedSubscription, SubscriptionGrant } from './BillingController';

type Decide = (stored: SubscriptionRecord | null) => Promise<({ readonly record: SubscriptionRecord } & Grants) | null>;

/** The row the fake repository holds, or `undefined` for an account that does not exist. */
let stored: SubscriptionRecord | null | undefined;
const written: ({ record: SubscriptionRecord } & Grants)[] = [];

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

const PREMIUM = 'price_premium';
const PRACTICE_30 = 'price_practice_30';
const PRACTICE_60 = 'price_practice_60';

/** The configuration, as the gateway reads it (`StripeGateway.grantOf`): two practice plans, and premium for every other price. */
function grantOf(priceId: string | null): SubscriptionGrant {
  switch (priceId) {
    case PRACTICE_30:
      return { includedClients: 30, kind: 'practice' };
    case PRACTICE_60:
      return { includedClients: 60, kind: 'practice' };
    default:
      return { kind: 'premium' };
  }
}

function row(status: string | null, subscriptionId: string | null = 'sub_1', priceId: string | null = PREMIUM): PricedSubscription {
  return { cancelAtPeriodEnd: false, currentPeriodEnd: null, customerId: 'cus_1', priceId, status, subscriptionId };
}

/** What premium writes: the tier, and no practice (the number left as it is). */
function premium(tier: 'free' | 'premium'): Grants {
  return { practice: { includedClients: null, open: false }, tier };
}

async function noSiblings(): Promise<PricedSubscription[]> {
  return [];
}

describe('BillingController.applySubscription', () => {
  beforeEach(() => {
    stored = null;
    written.length = 0;
  });

  it('writes what Stripe says now, with the tier it decides', async () => {
    stored = row(null, null);

    await expect(BillingController.applySubscription('usr-1', async () => row('active'), noSiblings, grantOf)).resolves.toBe('premium');
    expect(written).toEqual([{ ...premium('premium'), record: row('active') }]);
  });

  /* A deleted account, or one Stripe's metadata invented: nothing written, Stripe not asked. */
  it('asks Stripe nothing and writes nothing for an account that does not exist', async () => {
    stored = undefined;

    const latest = vi.fn(async () => row('active'));

    await expect(BillingController.applySubscription('usr-gone', latest, noSiblings, grantOf)).resolves.toBe('absent');
    expect(latest).not.toHaveBeenCalled();
    expect(written).toEqual([]);
  });

  it('keeps an ended subscription ended when a late answer says it is live', async () => {
    stored = row('canceled');

    await expect(BillingController.applySubscription('usr-1', async () => row('active'), noSiblings, grantOf)).resolves.toBe('kept');
    expect(written).toEqual([]);
  });

  /* Two tabs, two subscriptions: one ending must not drop the tier while the other charges. */
  it('writes the customer’s other paying subscription when the stored one ends', async () => {
    stored = row('active');

    const siblings = vi.fn(async () => [row('canceled'), row('incomplete_expired', 'sub_old'), row('active', 'sub_2')]);

    await expect(BillingController.applySubscription('usr-1', async () => row('canceled'), siblings, grantOf)).resolves.toBe('premium');
    expect(siblings).toHaveBeenCalledWith('cus_1');
    expect(written).toEqual([{ ...premium('premium'), record: row('active', 'sub_2') }]);
  });

  it('writes the ended subscription, and the free tier, when nothing else of the customer’s pays', async () => {
    stored = row('active');

    await expect(
      BillingController.applySubscription(
        'usr-1',
        async () => row('canceled'),
        async () => [row('incomplete', 'sub_2')],
        grantOf
      )
    ).resolves.toBe('free');
    expect(written).toEqual([{ ...premium('free'), record: row('canceled') }]);
  });

  /* One account, one customer: the stored customer is never replaced by another. */
  it('writes nothing for a subscription of another customer than the account’s', async () => {
    stored = row('active');

    await expect(
      BillingController.applySubscription('usr-1', async () => ({ ...row('trialing', 'sub_2'), customerId: 'cus_2' }), noSiblings, grantOf)
    ).resolves.toBe('mismatch');
    expect(written).toEqual([]);
  });

  it('does not list the customer’s subscriptions while the answer pays', async () => {
    stored = row(null, null);

    const siblings = vi.fn(noSiblings);

    await BillingController.applySubscription('usr-1', async () => row('trialing'), siblings, grantOf);
    expect(siblings).not.toHaveBeenCalled();
  });
});

/*
 * One row, and the price decides what it grants (`0061`). The number is the
 * configuration's, read at the webhook: nothing else can say it.
 */
describe('BillingController.applySubscription — a practice', () => {
  beforeEach(() => {
    stored = null;
    written.length = 0;
  });

  it('opens a practice with the number its price includes, and leaves the tier free', async () => {
    stored = row(null, null);

    await expect(BillingController.applySubscription('usr-1', async () => row('trialing', 'sub_1', PRACTICE_30), noSiblings, grantOf)).resolves.toBe(
      'practice'
    );
    expect(written).toEqual([{ practice: { includedClients: 30, open: true }, record: row('trialing', 'sub_1', PRACTICE_30), tier: 'free' }]);
  });

  /* Moving between plans in the portal is the same subscription on another price. */
  it('takes the larger plan’s number when the subscription moves to its price', async () => {
    stored = row('active', 'sub_1');

    await BillingController.applySubscription('usr-1', async () => row('active', 'sub_1', PRACTICE_60), noSiblings, grantOf);
    expect(written[0]?.practice).toEqual({ includedClients: 60, open: true });
  });

  /* A lapse pauses, never deletes: the number stays for the day it resumes. */
  it('closes the practice, keeping its number, when the subscription stops paying', async () => {
    stored = row('active', 'sub_1');

    await expect(BillingController.applySubscription('usr-1', async () => row('canceled', 'sub_1', PRACTICE_30), noSiblings, grantOf)).resolves.toBe(
      'free'
    );
    expect(written).toEqual([{ practice: { includedClients: 30, open: false }, record: row('canceled', 'sub_1', PRACTICE_30), tier: 'free' }]);
  });

  /* Whatever the row follows decides everything: a grant nothing pays for never stays behind. */
  it('closes the practice when the row moves to a premium subscription, and drops premium when it moves to a practice', async () => {
    stored = row('active', 'sub_1', PRACTICE_30);

    await BillingController.applySubscription(
      'usr-1',
      async () => row('canceled', 'sub_1', PRACTICE_30),
      async () => [row('active', 'sub_2')],
      grantOf
    );
    expect(written[0]).toEqual({ ...premium('premium'), record: row('active', 'sub_2') });

    written.length = 0;
    stored = row('active', 'sub_2');

    await BillingController.applySubscription(
      'usr-1',
      async () => row('canceled', 'sub_2'),
      async () => [row('active', 'sub_3', PRACTICE_30)],
      grantOf
    );
    expect(written[0]).toEqual({ practice: { includedClients: 30, open: true }, record: row('active', 'sub_3', PRACTICE_30), tier: 'free' });
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
