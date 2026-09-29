import { sql } from 'drizzle-orm';

import { database } from 'database';

import { ACTIVE_EVENTS } from 'core/entities/Analytics';
import { CONSOLE_TIME_ZONE } from 'core/entities/Period';
import { DatabaseOperationError } from 'core/entities/Error';

import type { SQL } from 'drizzle-orm';

/** The weeks after sign-up a cohort is read at: the week that starts 7 × n days after the person's own sign-up day. */
export const RETENTION_WEEKS = [1, 2, 4] as const;

/**
 * One cohort at one week: how many people signed up in it, how many of them
 * are old enough for that week to be over (`eligible`), and how many of those
 * were active in it (`active`). Counts of distinct people, nothing else.
 */
export type RetentionRow = {
  readonly active: number;
  readonly cohort: string;
  readonly eligible: number;
  readonly size: number;
  readonly weeks: number;
};

/** What counts as doing something. */
export type RetentionSource =
  /** Any of a meal completion, a swap, a completed check-in or a progress entry — from the first day, with rows that already exist. */
  | 'did_something'
  /** A sign-in or the use of a session (`ACTIVE_EVENTS`) — only for people who signed up on or after `since`. */
  | 'events';

const ZONE = sql.raw(`'${CONSOLE_TIME_ZONE}'`);
const WEEKS = sql.raw(RETENTION_WEEKS.map(weeks => `(${weeks})`).join(', '));

/** The Madrid day of a timestamp column written as text, so the SQL below is one fixed string. */
function madridDate(column: string): string {
  return `(${column} at time zone '${CONSOLE_TIME_ZONE}')::date`;
}

/** Rows of `(user_id, d)`: one per thing a person did, on the Madrid day they did it. Only those made on or after `from`. */
function didSomething(from: string): SQL {
  return sql`
    select "user_id", ${sql.raw(madridDate('"created_at"'))} as d from "meal_completions" where "created_at" >= ${from}::timestamptz
    union all
    select "user_id", ${sql.raw(madridDate('"created_at"'))} from "meal_swaps" where "created_at" >= ${from}::timestamptz
    union all
    select "user_id", "completed_at" from "check_ins" where "completed_at" is not null and "completed_at" >= (${from}::timestamptz at time zone ${ZONE})::date
    union all
    select "user_id", ${sql.raw(madridDate('"created_at"'))} from "progress_entries" where "created_at" >= ${from}::timestamptz`;
}

/** The same, from the events that mean somebody is active. */
function usedTheApp(from: string): SQL {
  const events = sql.join(
    ACTIVE_EVENTS.map(event => sql`${event}`),
    sql`, `
  );

  return sql`
    select "user_id", ${sql.raw(madridDate('"created_at"'))} as d from "analytics_events"
    where "event" in (${events}) and "user_id" is not null and "created_at" >= ${from}::timestamptz`;
}

/**
 * Retention cohorts (`0071`): for people who signed up in `[from, to)`, cut by
 * month of the Madrid sign-up day, and for each of
 * `RETENTION_WEEKS`, how many were active in the seven days that begin that
 * many weeks after their own sign-up day.
 *
 * The statement reads `"user"."created_at"` and `user_id` to join, and returns
 * only `count(...)` per cohort and week — no id, no address, no date of a
 * person. Activity tables are content (`0028`); nothing of them leaves but a
 * distinct count. Mode: one statement; the activity is a correlated `exists`
 * on each table's `user_id` index.
 */
export const AdminRetentionRepository = {
  /**
   * @param today the Madrid day now, `YYYY-MM-DD`: a week is counted only once it is over.
   * @param since for `events`, the first sign-up day whose activity was recorded; earlier people are left out of the cohort's counts.
   */
  async cohorts(input: {
    readonly from: string;
    readonly since?: string;
    readonly source: RetentionSource;
    readonly to: string;
    readonly today: string;
  }): Promise<readonly RetentionRow[]> {
    try {
      const activity = input.source === 'events' ? usedTheApp(input.from) : didSomething(input.from);
      const sinceFilter = input.since ? sql`and ${sql.raw(madridDate('u."created_at"'))} >= ${input.since}::date` : sql``;
      const rows = await database().execute<{
        active: number | string;
        cohort: string;
        eligible: number | string;
        size: number | string;
        weeks: number | string;
      }>(sql`
        with people as (
          select u."id", ${sql.raw(madridDate('u."created_at"'))} as d0
          from "user" u
          where u."created_at" >= ${input.from}::timestamptz and u."created_at" < ${input.to}::timestamptz ${sinceFilter}
        ),
        acts as (${activity})
        select to_char(date_trunc('month', p.d0), 'YYYY-MM-DD') as cohort,
               k.weeks as weeks,
               count(*) as size,
               count(*) filter (where p.d0 + 7 * (k.weeks + 1) <= ${input.today}::date) as eligible,
               count(*) filter (
                 where p.d0 + 7 * (k.weeks + 1) <= ${input.today}::date
                   and exists (
                     select 1 from acts a
                     where a."user_id" = p."id" and a.d >= p.d0 + 7 * k.weeks and a.d < p.d0 + 7 * (k.weeks + 1)
                   )
               ) as active
        from people p cross join (values ${WEEKS}) as k(weeks)
        group by 1, 2`);

      return [...rows].map(row => ({
        active: Number(row.active),
        cohort: row.cohort,
        eligible: Number(row.eligible),
        size: Number(row.size),
        weeks: Number(row.weeks)
      }));
    } catch (error: unknown) {
      throw error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
    }
  }
};
