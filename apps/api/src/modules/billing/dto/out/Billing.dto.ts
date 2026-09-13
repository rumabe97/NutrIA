import type { BillingStatusView } from 'core/controllers/Billing';

/** What the profile's premium card draws (`0056`). */
export type BillingStatusDto = BillingStatusView;

/** Where to send the browser next: a Stripe page, never one of ours. */
export type BillingUrlDto = { readonly url: string };
