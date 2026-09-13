/**
 * Whether a subscription in this state pays for premium (`0056`).
 *
 * The status is Stripe's word, stored as it arrives. What it means for the tier
 * is decided here, once, so the webhook and anything that reads a subscription
 * cannot disagree about it.
 *
 * - `active` and `trialing` pay, obviously.
 * - `past_due` pays too. Stripe is retrying the card, and taking the tier away
 *   while a bank takes its time punishes the person for their bank. The tier
 *   goes when Stripe gives up, which is `unpaid` or `canceled`.
 * - Everything else — `incomplete`, `paused`, a status added after this was
 *   written — grants nothing. The failure that costs money is the one that
 *   grants too much, so the unknown answer is the smaller one.
 */
export function paysForPremium(status: string | null): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}
