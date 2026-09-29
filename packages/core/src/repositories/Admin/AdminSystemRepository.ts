import { and, count, eq, sql } from 'drizzle-orm';

import { analyticsEvents } from 'database/schema/platform';
import { database } from 'database';

import { DatabaseOperationError } from 'core/entities/Error';

import { madridDay, within } from './AdminSql';

/** The last time a cron finished, by the job it named. */
export type CronRunRow = { readonly at: Date; readonly job: string };

/** Mail handed to the provider on one Madrid day: one template, one outcome, and how many. The controller never lets these per-day-per-template rows out. */
export type MailDayRow = { readonly day: string; readonly failed: boolean; readonly kind: string; readonly n: number };

/**
 * One job's runs on one Madrid day, summed (`0071`): how many times it ran and
 * its counts. `pending` is the last run's, since it is a state and not a flow;
 * a run held back by the cap (`skipped: 'cap'`) is counted in `heldByCap` and
 * adds nothing else, so its recorded zeros are not read as "nothing left".
 */
export type CronDayRow = {
  readonly day: string;
  readonly heldByCap: number;
  readonly pending: number | null;
  readonly rewritten: number;
  readonly runs: number;
  readonly skipped: number;
  readonly unreached: number;
};

/** A JSON string property read as text, and only when it is a string. */
function text(key: string) {
  return sql<
    string | null
  >`case when jsonb_typeof(${analyticsEvents.properties} -> ${key}::text) = 'string' then ${analyticsEvents.properties} ->> ${key}::text end`;
}

/**
 * What the service records about itself (`0071`): the last run of each cron
 * and the mail it sent. Both are system events and carry no user, no recipient
 * and no content (`0033`, `0028`).
 */
export const AdminSystemRepository = {
  /** The latest `cron_run` of each job. Mode: one grouped query over the event's index. */
  async lastCronRuns(): Promise<readonly CronRunRow[]> {
    try {
      const job = text('job');
      const rows = await database()
        .select({ at: sql<Date>`max(${analyticsEvents.createdAt})`.mapWith(analyticsEvents.createdAt), job })
        .from(analyticsEvents)
        .where(eq(analyticsEvents.event, 'cron_run'))
        // By position (`job` is the second column): the same expression bound twice is two parameters, and Postgres does not equate them.
        .groupBy(sql`2`);

      return rows.flatMap(row => (row.job === null ? [] : [{ at: row.at, job: row.job }]));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Mail per Madrid day, template and outcome (`ok: false` is a failure). Mode: one grouped query. */
  async mailPerDay(from: Date, to: Date): Promise<readonly MailDayRow[]> {
    try {
      const day = madridDay(analyticsEvents.createdAt);
      const kind = text('kind');
      const failed = sql<boolean>`coalesce(${analyticsEvents.properties} -> 'ok' = 'false'::jsonb, false)`.mapWith(Boolean);
      const rows = await database()
        .select({ day, failed, kind, n: count() })
        .from(analyticsEvents)
        .where(and(eq(analyticsEvents.event, 'mail_sent'), within(analyticsEvents.createdAt, from, to)))
        .groupBy(sql`1`, sql`2`, sql`3`);

      return rows.map(row => ({ ...row, kind: row.kind ?? 'unknown' }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** A job's `cron_run`s per Madrid day, in the rewrite sweep's counts. Mode: one grouped query over the event's index. */
  async rewriteRunsPerDay(from: Date, to: Date): Promise<readonly CronDayRow[]> {
    try {
      const day = madridDay(analyticsEvents.createdAt);
      const props = analyticsEvents.properties;
      const held = sql`(jsonb_typeof(${props} -> 'skipped') = 'string' and ${props} ->> 'skipped' = 'cap')`;
      // The number under a key, for the runs that are not held back by the cap.
      const counted = (key: string) =>
        sql`case when not ${held} and jsonb_typeof(${props} -> ${key}::text) = 'number' then (${props} ->> ${key}::text)::int else 0 end`;
      const rows = await database()
        .select({
          day,
          heldByCap: sql<number>`count(*) filter (where ${held})`.mapWith(Number),
          pending: sql<
            number | null
          >`(array_agg((${props} ->> 'pending')::int order by ${analyticsEvents.createdAt} desc) filter (where not ${held} and jsonb_typeof(${props} -> 'pending') = 'number'))[1]`,
          rewritten: sql<number>`coalesce(sum(${counted('rewritten')}), 0)`.mapWith(Number),
          runs: count(),
          skipped: sql<number>`coalesce(sum(${counted('skipped')}), 0)`.mapWith(Number),
          unreached: sql<number>`coalesce(sum(${counted('unreached')}), 0)`.mapWith(Number)
        })
        .from(analyticsEvents)
        .where(and(eq(analyticsEvents.event, 'cron_run'), sql`${props} ->> 'job' = 'rewrite'`, within(analyticsEvents.createdAt, from, to)))
        .groupBy(day);

      return rows.map(row => ({ ...row, pending: row.pending === null ? null : Number(row.pending) }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
