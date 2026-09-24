import { describe, expect, it } from 'vitest';

import { hasEnded, paysForPremium, replacesStored } from 'core/domain/Billing';

describe('paysForPremium', () => {
  it('pays while the subscription is running', () => {
    expect(paysForPremium('active')).toBe(true);
    expect(paysForPremium('trialing')).toBe(true);
  });

  /* Stripe is still retrying the card: the tier stays until it gives up. */
  it('keeps paying while a failed payment is being retried', () => {
    expect(paysForPremium('past_due')).toBe(true);
  });

  it('stops when Stripe gives up, or the subscription ends', () => {
    expect(paysForPremium('unpaid')).toBe(false);
    expect(paysForPremium('canceled')).toBe(false);
    expect(paysForPremium('incomplete_expired')).toBe(false);
  });

  /* The failure that costs money is the one that grants too much. */
  it('grants nothing for a checkout never finished, a paused subscription, none at all, or a status it does not know', () => {
    expect(paysForPremium('incomplete')).toBe(false);
    expect(paysForPremium('paused')).toBe(false);
    expect(paysForPremium(null)).toBe(false);
    expect(paysForPremium('a_status_stripe_added_later')).toBe(false);
  });
});

describe('hasEnded', () => {
  it('is true only for the states Stripe never leaves', () => {
    expect(hasEnded('canceled')).toBe(true);
    expect(hasEnded('incomplete_expired')).toBe(true);
    expect(hasEnded('unpaid')).toBe(false);
    expect(hasEnded('past_due')).toBe(false);
    expect(hasEnded(null)).toBe(false);
  });
});

describe('replacesStored', () => {
  const ended = { status: 'canceled', subscriptionId: 'sub_1' };

  it('writes over nothing, and over a customer that never subscribed', () => {
    expect(replacesStored(null, { status: 'active', subscriptionId: 'sub_1' })).toBe(true);
    expect(replacesStored({ status: null, subscriptionId: null }, ended)).toBe(true);
  });

  it('follows a live subscription wherever Stripe takes it', () => {
    expect(replacesStored({ status: 'active', subscriptionId: 'sub_1' }, { status: 'past_due', subscriptionId: 'sub_1' })).toBe(true);
    expect(replacesStored({ status: 'active', subscriptionId: 'sub_1' }, ended)).toBe(true);
  });

  /* A late answer must not bring back premium Stripe has already ended. */
  it('never brings an ended subscription back', () => {
    expect(replacesStored(ended, { status: 'active', subscriptionId: 'sub_1' })).toBe(false);
    expect(replacesStored(ended, { status: 'incomplete_expired', subscriptionId: 'sub_1' })).toBe(true);
  });

  it('lets a new subscription replace an old one, and never an old one ending replace a new one', () => {
    expect(replacesStored(ended, { status: 'trialing', subscriptionId: 'sub_2' })).toBe(true);
    expect(replacesStored({ status: 'active', subscriptionId: 'sub_2' }, ended)).toBe(false);
  });
});
