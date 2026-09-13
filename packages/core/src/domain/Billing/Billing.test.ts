import { describe, expect, it } from 'vitest';

import { paysForPremium } from 'core/domain/Billing';

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
