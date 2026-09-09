import { AdminRepository } from '#repositories/Admin';

import type { Counts, JobRow } from '#repositories/Admin';

/** A week is the window a failure is worth looking at in; older than that is history. */
const WINDOW_DAYS = 7;

/** Enough to see a pattern, few enough to read. */
const JOB_LIMIT = 25;

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
