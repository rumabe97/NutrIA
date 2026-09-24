import { describe, expect, it } from 'vitest';

import { checkoutSchema } from './Billing';

describe('checkoutSchema', () => {
  it('buys monthly premium when nothing is chosen', () => {
    expect(checkoutSchema.parse({})).toEqual({ plan: 'monthly' });
  });

  /* Premium answers as it did before practices existed: a stray price is dropped, whatever it holds. */
  it('drops a price sent with premium instead of refusing it', () => {
    expect(checkoutSchema.parse({ plan: 'monthly', price: 'price_attacker' })).toEqual({ plan: 'monthly' });
    expect(checkoutSchema.parse({ plan: 'yearly', price: 42 })).toEqual({ plan: 'yearly' });
    expect(checkoutSchema.parse({ price: 'price_practice_30' })).toEqual({ plan: 'monthly' });
  });

  it('requires a practice to name its price', () => {
    expect(checkoutSchema.safeParse({ plan: 'practice' }).success).toBe(false);
    expect(checkoutSchema.safeParse({ plan: 'practice', price: 'not_a_price' }).success).toBe(false);
    expect(checkoutSchema.parse({ plan: 'practice', price: 'price_practice_30' })).toEqual({ plan: 'practice', price: 'price_practice_30' });
  });
});
