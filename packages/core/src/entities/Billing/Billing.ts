import { z } from 'zod';

/**
 * What checkout can open with: premium, monthly or yearly (`0056`) — yearly
 * exists only when the owner has set one — or a professional's practice
 * (`0061`), at one of the practice prices the owner configured.
 */
export const BILLING_PLANS = ['monthly', 'yearly', 'practice'] as const;

export type BillingPlan = (typeof BILLING_PLANS)[number];

/**
 * Which price to open checkout with. Monthly unless the person chose otherwise.
 *
 * A practice names its price, and only a practice does. For premium a `price`
 * is dropped before validation, as any unknown field was before practices
 * existed, so the premium checkout answers exactly as it always has. The price
 * is a choice among the configured ones and never the grant: what a practice
 * includes is read from configuration when the signed webhook arrives, so a
 * body cannot name its own number of clients.
 */
export const checkoutSchema = z.preprocess(
  dropPriceUnlessPractice,
  z
    .object({ plan: z.enum(BILLING_PLANS).default('monthly'), price: z.string().startsWith('price_').max(255).optional() })
    .superRefine((checkout, ctx) => {
      if (checkout.plan === 'practice' && checkout.price === undefined) {
        ctx.addIssue({ code: 'custom', message: 'is required for a practice', path: ['price'] });
      }
    })
);

function dropPriceUnlessPractice(input: unknown): unknown {
  if (typeof input !== 'object' || input === null || (input as { plan?: unknown }).plan === 'practice') {
    return input;
  }

  const { price: _price, ...rest } = input as Record<string, unknown>;

  return rest;
}

export type Checkout = z.infer<typeof checkoutSchema>;
