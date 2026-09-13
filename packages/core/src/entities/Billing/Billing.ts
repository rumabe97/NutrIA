import { z } from 'zod';

/** The prices checkout can open with (`0056`). Yearly exists only when the owner has set one. */
export const BILLING_PLANS = ['monthly', 'yearly'] as const;

export type BillingPlan = (typeof BILLING_PLANS)[number];

/** Which price to open checkout with. Monthly unless the person chose otherwise. */
export const checkoutSchema = z.object({ plan: z.enum(BILLING_PLANS).default('monthly') });

export type Checkout = z.infer<typeof checkoutSchema>;
