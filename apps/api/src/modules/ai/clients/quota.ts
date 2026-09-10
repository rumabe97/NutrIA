/**
 * Whether a provider failure means "no budget left" rather than "try again".
 *
 * The difference is expensive. A sweep that treats an exhausted quota as a
 * transient error keeps going: eighteen recipes were each attempted three times
 * against a provider that had already said no, turning three wasted calls into
 * fifty-four — and every one of those counts against the same daily allowance
 * that plan generation needs.
 *
 * Matched on the provider's own words, because the SDK flattens the status code
 * into a message by the time a caller sees it. Deliberately broad: a false
 * positive costs one paused sweep, a false negative costs the day's quota.
 */
export function isQuotaExhausted(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  return ['exceeded your current quota', 'resource_exhausted', 'quota exceeded', 'insufficient_quota', 'billing'].some(phrase =>
    message.includes(phrase)
  );
}
