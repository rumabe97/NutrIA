/**
 * The closed set of things worth recording (`0033`).
 *
 * Closed, and small, on purpose. An event log that anything may write to grows
 * a name per feature and answers no question well; and in a product whose rows
 * are health data, every addition has to earn the sentence "this records that
 * something happened, never what it was about".
 *
 * Nothing here is derivable from the database. A fact the schema already holds
 * — an account was created, a plan was generated, a meal was marked — is
 * counted from the rows that hold it, because an event log that repeats state
 * is a second answer waiting to disagree with the first.
 */
export const ANALYTICS_EVENTS = [
  /**
   * One request to the model provider, whether it answered or refused.
   *
   * Qualifies under the rule above: a call that fails leaves no row anywhere —
   * the plan it was for is never written — and a call that succeeds only leaves
   * its token counts inside a plan's metadata, which is unreachable for "how
   * many requests today". The free tier counts requests per day, so that is the
   * number that decides whether the product works tomorrow.
   */
  'ai_call',
  /** Somebody signed in. Sessions expire and are deleted, so coming back leaves no other trace. */
  'session_started',
  /** What somebody asked a swap for — quicker, no cooking, more protein, vegetarian, or nothing in particular. The answer is stored; the question was not. */
  'swap_requested'
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];
