/**
 * How long premium is free before the first charge (`0056`, amended).
 *
 * Offered once per account: to somebody who has never subscribed. Somebody who
 * subscribed and cancelled has had theirs, so a trial cannot be chained into a
 * free tier. Stripe takes the card at the start and charges when the trial ends,
 * unless it is cancelled before.
 */
export const TRIAL_DAYS = 7;

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

/**
 * Whether a subscription in this state has ended for good. Stripe never
 * brings a `canceled` or `incomplete_expired` subscription back: paying again
 * is a new subscription, with a new id.
 */
export function hasEnded(status: string | null): boolean {
  return status === 'canceled' || status === 'incomplete_expired';
}

type Described = { readonly status: string | null; readonly subscriptionId: string | null };

/**
 * Whether what Stripe says now about a subscription may replace what is stored
 * for the account. The webhook already re-reads Stripe under a lock, so this is
 * the invariant that holds even if that ordering ever slips:
 *
 * - An ended subscription stays ended. A live status for the same id can only
 *   be an old answer arriving late.
 * - One subscription ending never displaces a different one. A retried
 *   `deleted` for last year's subscription must not take premium from this
 *   year's.
 */
export function replacesStored(stored: Described | null, incoming: Described): boolean {
  if (!stored?.subscriptionId) {
    return true;
  }

  if (stored.subscriptionId === incoming.subscriptionId) {
    return !hasEnded(stored.status) || hasEnded(incoming.status);
  }

  return !hasEnded(incoming.status);
}
