import { AdminRetentionRepository, RETENTION_WEEKS } from '#repositories/Admin';
import { madridDayKey, madridMidnight } from 'core/domain/Period';

import type { RetentionRow } from '#repositories/Admin';

/** Below this many people in a cell a percentage is a handful of individuals: counts only (`0028`, architect § 4.6). */
export const MIN_COHORT_FOR_SHARES = 20;

/** The first Madrid day the events `session_started` + `app_used` count "used the app" (`0071`); people who signed up earlier have no such history. */
export const EVENTS_SINCE = '2026-09-29';

/** How many monthly cohorts are returned, the current one included. */
const COHORTS = 6;

/** One cohort read at one week after sign-up. */
export type RetentionCell = {
  /** Of `eligible`, the distinct people active in that week; null below `MIN_COHORT_FOR_SHARES` eligible people (`0028`): next to `size` and `eligible` it would name one person. */
  readonly active: number | null;
  /** People in the cohort whose week is already over — the others cannot have done it yet. */
  readonly eligible: number;
  /** True from `MIN_COHORT_FOR_SHARES` eligible people: a share of it may be shown. Otherwise the counts only. */
  readonly enough: boolean;
  /** Weeks after sign-up: the seven days that begin 7 × weeks days after the person's own sign-up day. */
  readonly weeks: number;
};

export type RetentionCohort = {
  readonly cells: readonly RetentionCell[];
  /** People who signed up in it (for the events version, those who signed up on or after `eventsSince`). */
  readonly size: number;
  /** The first Madrid day of the month, or the Monday of the week, `YYYY-MM-DD`. */
  readonly start: string;
};

/**
 * Personas › Retención (`GET /admin/retention`, `0071`):
 * monthly cohorts of sign-ups and how many of them were active one, two and four weeks
 * later — counts of distinct people, never who. No id, no link (`0028`).
 *
 * Two readings of "active":
 * - `didSomething` — from the first day, with rows that already exist: a meal
 *   completion, a swap, a completed check-in or a progress entry. Approximate,
 *   and labelled so.
 * - `usedTheApp` — a sign-in or the use of a session (`ACTIVE_EVENTS`), for
 *   people who signed up on or after `eventsSince` only.
 */
export type AdminRetentionView = {
  /** Cohorts oldest first, the current one last. A cohort nobody signed up in is present with size 0. */
  readonly didSomething: readonly RetentionCohort[];
  /** When the events version starts to exist; its cohorts count only people who signed up on or after. */
  readonly eventsSince: string;
  /** The threshold behind each cell's `enough`. */
  readonly minCohort: number;
  readonly usedTheApp: readonly RetentionCohort[];
  /** The weeks after sign-up each cohort is read at. */
  readonly weeks: readonly number[];
};

/** The first day of each of the last six months, oldest first. */
export function cohortStarts(today: string): readonly string[] {
  const [year = 1970, month = 1] = today.split('-').map(Number);

  return Array.from({ length: COHORTS }, (_, index) => new Date(Date.UTC(year, month - 1 - (COHORTS - 1 - index), 1)).toISOString().slice(0, 10));
}

function present(starts: readonly string[], rows: readonly RetentionRow[]): readonly RetentionCohort[] {
  return starts.map(start => {
    const mine = rows.filter(row => row.cohort === start);

    return {
      cells: RETENTION_WEEKS.map(weeks => {
        const row = mine.find(candidate => candidate.weeks === weeks);
        const eligible = row?.eligible ?? 0;

        const enough = eligible >= MIN_COHORT_FOR_SHARES;

        return { active: enough ? (row?.active ?? 0) : null, eligible, enough, weeks };
      }),
      size: mine[0]?.size ?? 0,
      start
    };
  });
}

export const AdminRetentionController = {
  async retention(now = new Date()): Promise<AdminRetentionView> {
    const today = madridDayKey(now);
    const starts = cohortStarts(today);
    const from = madridMidnight(starts[0] ?? today).toISOString();
    const to = now.toISOString();
    const [did, used] = await Promise.all([
      AdminRetentionRepository.cohorts({ from, source: 'did_something', to, today }),
      AdminRetentionRepository.cohorts({ from, since: EVENTS_SINCE, source: 'events', to, today })
    ]);

    return {
      didSomething: present(starts, did),
      eventsSince: EVENTS_SINCE,
      minCohort: MIN_COHORT_FOR_SHARES,
      usedTheApp: present(starts, used),
      weeks: RETENTION_WEEKS
    };
  }
};
