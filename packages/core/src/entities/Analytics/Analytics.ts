/**
 * The closed set of things worth recording (`0033`, extended by `0071`).
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
 *
 * Two halves (`0071`): what people do, which the console charts as activity,
 * and what the service does, which only the pages that account for the system
 * read. A system event never carries a user.
 */

/** What a person did. The only events Embudo charts as activity. */
export const PRODUCT_EVENTS = [
  /** Somebody signed in. Sessions expire and are deleted, so coming back leaves no other trace. */
  'session_started',
  /**
   * Somebody used a session they already had, at most once a Madrid day
   * (`0071`). A session lasts thirty days and renews with use, so without this
   * "active" meant "signed in", not "used". Written when Better Auth renews a
   * session; carries nothing but the fact.
   */
  'app_used',
  /** What somebody asked a swap for — quicker, no cooking, more protein, vegetarian, or nothing in particular. The answer is stored; the question was not. */
  'swap_requested'
] as const;

/**
 * The events that mean somebody is active (`0071`): they signed in, or used a
 * session they already had. Every "active people" and "last activity" figure
 * in the console reads exactly these, so the two cannot drift apart.
 */
export const ACTIVE_EVENTS = ['session_started', 'app_used'] as const satisfies readonly (typeof PRODUCT_EVENTS)[number][];

/** What the service did. Never a user; read only by the pages that account for the system. */
export const SYSTEM_EVENTS = [
  /**
   * One request to the model provider, whether it answered or refused, and
   * which part of the service made it (`feature`).
   *
   * Qualifies under the rule above: a call that fails leaves no row anywhere —
   * the plan it was for is never written — and a call that succeeds only leaves
   * its token counts inside a plan's metadata, which is unreachable for "how
   * many requests today".
   */
  'ai_call',
  /** One of the platform's crons finished: which job, and its counts. A run leaves no other row. */
  'cron_run',
  /** One mail handed to the provider: its template and whether it left — never its recipient. */
  'mail_sent',
  /** The owner was told something at once: only the kind of alert, so the next one can wait its turn. */
  'owner_alerted'
] as const;

export const ANALYTICS_EVENTS = [...PRODUCT_EVENTS, ...SYSTEM_EVENTS] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

/** Which part of the service spent a model call (`0071`): plan dishes, a meal swap, or the nightly step rewrite. */
export type AiFeature = 'plan' | 'rewrite' | 'swap';

/** The crons a `cron_run` names (`vercel.json`'s two). */
export const CRON_JOBS = ['reminders', 'rewrite'] as const;

export type CronJob = (typeof CRON_JOBS)[number];
