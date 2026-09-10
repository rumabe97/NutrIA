import { AdminRepository } from '#repositories/Admin';
import { AnalyticsRepository } from '#repositories/Analytics';

import type { ActivityRow } from '#repositories/Analytics';
import type { Counts, Funnel, JobRow } from '#repositories/Admin';

/** A week is the window a failure is worth looking at in; older than that is history. */
const WINDOW_DAYS = 7;

/** Enough to see a pattern, few enough to read. */
const JOB_LIMIT = 25;

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
