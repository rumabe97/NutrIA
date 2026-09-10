import { AdminRepository } from '#repositories/Admin';
import { AnalyticsRepository } from '#repositories/Analytics';

import type { ActivityRow } from '#repositories/Analytics';
import type { Counts, Funnel, JobRow } from '#repositories/Admin';

/** A week is the window a failure is worth looking at in; older than that is history. */
const WINDOW_DAYS = 7;

/** Enough to see a pattern, few enough to read. */
const JOB_LIMIT = 25;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When Google's daily count starts again.
 *
 * Their day is Pacific, not the operator's and not UTC — so a Spanish owner
 * looking at a spent allowance at nine in the morning is looking at a counter
 * that resets at nine in the morning, and nobody would guess that from a
 * calendar. Offset rather than a timezone library: this is one number, and the
 * hour it lands on moves by one twice a year, which is close enough for a
 * countdown and honest about being an estimate.
 */
function nextPacificMidnight(now: Date = new Date()): Date {
  const offsetHours = 8;
  const pacific = new Date(now.getTime() - offsetHours * 60 * 60 * 1000);
  const midnight = Date.UTC(pacific.getUTCFullYear(), pacific.getUTCMonth(), pacific.getUTCDate() + 1);

  return new Date(midnight + offsetHours * 60 * 60 * 1000);
}

/** A fortnight, because that is the product's own unit: one plan, one check-in. */
const ACTIVITY_DAYS = 14;

export type AdminJobView = {
  id: string;
  attempts: number;
  /** The stable code — `GENERATION_POOL_TOO_SMALL` and its kin — never a stack. */
  code: string | null;
  /** The provider's own redacted message, when there was one. */
  detail: string | null;
  finishedAt: string | null;
  /** Wall-clock seconds the generation took, when it finished. */
  seconds: number | null;
  startedAt: string | null;
  status: string;
  step: string | null;
};

/**
 * What today has spent of the provider's allowance (`0035`).
 *
 * `limit` is what the operator configured, and null when they configured
 * nothing — the screen then shows a count with no bar rather than inventing a
 * ceiling. `refused` is the number that predicts tomorrow: a call the provider
 * turned down for quota still spent the request.
 */
export type AiUsageView = {
  /** Provider requests since midnight in the account's own day, whatever their outcome. */
  calls: number;
  inputTokens: number;
  /** Configured allowances, or null when nothing was configured. */
  limits: { readonly requestsPerDay: number | null; readonly tokensPerMinute: number | null };
  /** The model the calls named, when they all named the same one. */
  model: string | null;
  outputTokens: number;
  /** Calls the provider refused because the allowance was spent. */
  refused: number;
  /** When the daily count starts again, ISO. Pacific midnight, which is Google's day. */
  resetsAt: string;
};

export type AdminAnalyticsView = {
  /** How many of each recorded event in the window, and how many distinct people signed in. */
  activity: { readonly events: readonly ActivityRow[]; readonly people: number };
  funnel: Funnel;
  windowDays: number;
};

export type AdminOverviewView = {
  counts: Counts;
  jobs: readonly AdminJobView[];
  /** Days the job counts cover. */
  windowDays: number;
};

function present(row: JobRow): AdminJobView {
  const seconds = row.startedAt && row.finishedAt ? Math.round((row.finishedAt.getTime() - row.startedAt.getTime()) / 100) / 10 : null;

  return {
    id: row.id,
    attempts: row.attempts,
    code: row.error,
    detail: row.errorDetail,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    seconds,
    startedAt: row.startedAt?.toISOString() ?? null,
    status: row.status,
    step: row.step
  };
}

/**
 * What the owner needs to know about their own service, and nothing else.
 *
 * Deliberately not a user list, not a plan viewer, not a way to read anybody's
 * profile: those are the screens an admin surface grows by accident, and every
 * one of them turns "I run this" into "I can read your health data". The
 * questions here are whether generation is working, what it failed on, and how
 * big the catalogue is.
 */
export const AdminController = {
  /**
   * The provider's day, counted here.
   *
   * Ours, not theirs: Google publishes no endpoint for what is left, so this is
   * every request that went out through this service measured against the
   * number the operator wrote down. A difference from the console is calls that
   * did not come through here.
   */
  async aiUsage(limits: { readonly requestsPerDay?: number; readonly tokensPerMinute?: number } = {}): Promise<AiUsageView> {
    const resets = nextPacificMidnight();
    const calls = await AnalyticsRepository.aiCallsSince(new Date(resets.getTime() - DAY_MS));
    const models = new Set(calls.map(call => String(call.properties.model ?? '')).filter(Boolean));
    const number = (call: (typeof calls)[number], key: string) => (typeof call.properties[key] === 'number' ? (call.properties[key] as number) : 0);

    return {
      calls: calls.length,
      inputTokens: calls.reduce((total, call) => total + number(call, 'inputTokens'), 0),
      limits: { requestsPerDay: limits.requestsPerDay ?? null, tokensPerMinute: limits.tokensPerMinute ?? null },
      model: models.size === 1 ? [...models][0] : null,
      outputTokens: calls.reduce((total, call) => total + number(call, 'outputTokens'), 0),
      refused: calls.filter(call => call.properties.quotaExhausted === true).length,
      resetsAt: resets.toISOString()
    };
  },

  /**
   * Whether the product is working for the people using it.
   *
   * The funnel is counted from state and the activity from the event log, and
   * the split is the decision (`0033`): state answers "how many got this far",
   * which the rows already know, and events answer "did anybody come back",
   * which nothing else records.
   */
  async analytics(): Promise<AdminAnalyticsView> {
    const since = new Date(Date.now() - ACTIVITY_DAYS * 24 * 60 * 60 * 1000);
    const [funnel, activity] = await Promise.all([AdminRepository.funnel(), AnalyticsRepository.activitySince(since)]);

    return { activity: { events: activity.rows, people: activity.people }, funnel, windowDays: ACTIVITY_DAYS };
  },

  /** Only what failed, for when something is wrong and the list is long. */
  async failures(): Promise<readonly AdminJobView[]> {
    return (await AdminRepository.recentJobs(JOB_LIMIT, true)).map(present);
  },

  async overview(now = new Date()): Promise<AdminOverviewView> {
    const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [counts, jobs] = await Promise.all([AdminRepository.counts(since), AdminRepository.recentJobs(JOB_LIMIT, false)]);

    return { counts, jobs: jobs.map(present), windowDays: WINDOW_DAYS };
  }
};
