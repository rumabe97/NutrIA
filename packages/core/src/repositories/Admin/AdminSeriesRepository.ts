import { and, count, countDistinct, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';

import { analyticsEvents, feedback } from 'database/schema/platform';
import { database } from 'database';
import { mealPlans, planGenerationJobs } from 'database/schema/plan';
import { recipeImageCalls } from 'database/schema/recipe';
import { user } from 'database/schema/auth';

import { CONSOLE_TIME_ZONE } from 'core/entities/Period';
import { DatabaseOperationError } from 'core/entities/Error';

import type { PeriodWindow } from 'core/entities/Period';
import type { SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/** One Madrid day and a count, as `YYYY-MM-DD`. */
export type DayCountRow = { readonly day: string; readonly n: number };

/** One Madrid day, one key — a job status, an event name — and its count. */
export type KeyedDayCountRow = DayCountRow & { readonly key: string };

/** One figure over the current period and over the one before it. */
export type PeriodCount = { readonly current: number; readonly previous: number };

/** A generation's two outcomes over one period. Queued and running jobs have none yet. */
export type Outcomes = { readonly failed: number; readonly succeeded: number };

/** Every job status there is, in the enum's order, so a chart has the same series whatever happened. */
export const JOB_STATUSES: readonly string[] = planGenerationJobs.status.enumValues;

/** Every plan state there is, in the enum's order. */
export const PLAN_STATUSES: readonly string[] = mealPlans.status.enumValues;

/**
 * The Madrid calendar day of a timestamp, as `YYYY-MM-DD` (`0068`).
 *
 * The zone is written into the SQL rather than bound as a parameter: the same
 * fragment is both selected and grouped by, and two bound copies would be two
 * different placeholders Postgres cannot tell are one expression. It is a
 * constant, never input.
 */
function madridDay(column: PgColumn): SQL<string> {
  return sql<string>`to_char(date_trunc('day', ${column} at time zone ${sql.raw(`'${CONSOLE_TIME_ZONE}'`)}), 'YYYY-MM-DD')`;
}

/** `[from, to)` on a timestamp column. The column encodes the values, so a `Date` is safe here. */
function within(column: PgColumn, from: Date, to: Date): SQL | undefined {
  return and(gte(column, from), lt(column, to));
}

/** How many rows fall in `[from, to)`, as one aggregate among several over the same scan. */
function countWithin(column: PgColumn, from: Date, to: Date, also?: SQL): SQL<number> {
  return sql<number>`count(*) filter (where ${also ? and(within(column, from, to), also) : within(column, from, to)})`.mapWith(Number);
}

function earliest(...dates: readonly Date[]): Date {
  return new Date(Math.min(...dates.map(date => date.getTime())));
}

/**
 * The console's figures over a period (`0068`): a count per Madrid day, and a
 * total for this period against the one before it.
 *
 * Every read here is a count, a distinct count or a sum. None selects a
 * column that carries a person or their content — no address, no plan, no
 * profile (`0028`) — so nothing here can be turned into a list of anybody.
 * Each series is one grouped query; each set of totals is one query over one
 * table with `FILTER`ed aggregates, so current and previous come from the
 * same scan and cannot drift apart.
 */
export const AdminSeriesRepository = {
  /** Every account, the ones not yet activated, and the ones created in each period. Mode: one scan of `user`. */
  async accountTotals(window: PeriodWindow): Promise<{ readonly created: PeriodCount; readonly total: number; readonly waiting: number }> {
    try {
      const [row] = await database()
        .select({
          current: countWithin(user.createdAt, window.from, window.to),
          previous: countWithin(user.createdAt, window.previousFrom, window.from),
          total: count(),
          waiting: sql<number>`count(*) filter (where ${isNull(user.activatedAt)})`.mapWith(Number)
        })
        .from(user);

      return { created: { current: row?.current ?? 0, previous: row?.previous ?? 0 }, total: row?.total ?? 0, waiting: row?.waiting ?? 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Distinct people who started a session, per Madrid day. Mode: one grouped query. */
  async activePeoplePerDay(from: Date, to: Date): Promise<readonly DayCountRow[]> {
    try {
      const day = madridDay(analyticsEvents.createdAt);

      return await database()
        .select({ day, n: countDistinct(analyticsEvents.userId) })
        .from(analyticsEvents)
        .where(and(eq(analyticsEvents.event, 'session_started'), within(analyticsEvents.createdAt, from, to)))
        .groupBy(day);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Distinct people who started a session in each period — one person, however many days. Mode: one aggregate. */
  async activePeopleTotals(window: PeriodWindow): Promise<PeriodCount> {
    try {
      const distinctWithin = (from: Date, to: Date) =>
        sql<number>`count(distinct ${analyticsEvents.userId}) filter (where ${within(analyticsEvents.createdAt, from, to)})`.mapWith(Number);
      const [row] = await database()
        .select({ current: distinctWithin(window.from, window.to), previous: distinctWithin(window.previousFrom, window.from) })
        .from(analyticsEvents)
        .where(and(eq(analyticsEvents.event, 'session_started'), within(analyticsEvents.createdAt, window.previousFrom, window.to)));

      return { current: row?.current ?? 0, previous: row?.previous ?? 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The named events per Madrid day. The caller names them — the tracked set
   * without `ai_call`, which is plumbing and has its own page — so the index on
   * `(event, created_at)` serves the filter. Mode: one grouped query.
   */
  async eventsPerDay(events: readonly string[], from: Date, to: Date): Promise<readonly KeyedDayCountRow[]> {
    if (events.length === 0) {
      return [];
    }

    try {
      const day = madridDay(analyticsEvents.createdAt);

      return await database()
        .select({ day, key: analyticsEvents.event, n: count() })
        .from(analyticsEvents)
        .where(and(inArray(analyticsEvents.event, [...events]), within(analyticsEvents.createdAt, from, to)))
        .groupBy(day, analyticsEvents.event);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Generations per Madrid day, by the status each is in now. Mode: one grouped query. */
  async generationsPerDay(from: Date, to: Date): Promise<readonly KeyedDayCountRow[]> {
    try {
      const day = madridDay(planGenerationJobs.createdAt);

      return await database()
        .select({ day, key: planGenerationJobs.status, n: count() })
        .from(planGenerationJobs)
        .where(within(planGenerationJobs.createdAt, from, to))
        .groupBy(day, planGenerationJobs.status);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Generations that succeeded and failed in each period, and the failures
   * since `failedSince` — the "needs you" count. By when the job was made, the
   * indexed column. Mode: one scan with filtered aggregates.
   */
  async generationTotals(
    window: PeriodWindow,
    failedSince: Date
  ): Promise<{ readonly current: Outcomes; readonly previous: Outcomes; readonly recentFailures: number }> {
    try {
      const status = (value: 'failed' | 'succeeded') => eq(planGenerationJobs.status, value);
      const [row] = await database()
        .select({
          currentFailed: countWithin(planGenerationJobs.createdAt, window.from, window.to, status('failed')),
          currentSucceeded: countWithin(planGenerationJobs.createdAt, window.from, window.to, status('succeeded')),
          previousFailed: countWithin(planGenerationJobs.createdAt, window.previousFrom, window.from, status('failed')),
          previousSucceeded: countWithin(planGenerationJobs.createdAt, window.previousFrom, window.from, status('succeeded')),
          recentFailures: sql<number>`count(*) filter (where ${and(gte(planGenerationJobs.createdAt, failedSince), status('failed'))})`.mapWith(
            Number
          )
        })
        .from(planGenerationJobs)
        .where(gte(planGenerationJobs.createdAt, earliest(window.previousFrom, failedSince)));

      return {
        current: { failed: row?.currentFailed ?? 0, succeeded: row?.currentSucceeded ?? 0 },
        previous: { failed: row?.previousFailed ?? 0, succeeded: row?.previousSucceeded ?? 0 },
        recentFailures: row?.recentFailures ?? 0
      };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Messages written to the owner per Madrid day (`0037`). A count; no message is read. Mode: one grouped query. */
  async messagesPerDay(from: Date, to: Date): Promise<readonly DayCountRow[]> {
    try {
      const day = madridDay(feedback.createdAt);

      return await database()
        .select({ day, n: count() })
        .from(feedback)
        .where(within(feedback.createdAt, from, to))
        .groupBy(day);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Picture spend in dollars over each period and since the month began
   * (`0066`): the month is what the cap is counted against. Mode: one scan
   * with filtered sums.
   */
  async pictureSpendTotals(window: PeriodWindow, monthStart: Date): Promise<PeriodCount & { readonly month: number }> {
    try {
      const spentWithin = (from: Date, to?: Date) =>
        sql<string>`coalesce(sum(${recipeImageCalls.costUsd}) filter (where ${
          to ? within(recipeImageCalls.createdAt, from, to) : gte(recipeImageCalls.createdAt, from)
        }), 0)`;
      const [row] = await database()
        .select({
          current: spentWithin(window.from, window.to),
          month: spentWithin(monthStart),
          previous: spentWithin(window.previousFrom, window.from)
        })
        .from(recipeImageCalls)
        .where(gte(recipeImageCalls.createdAt, earliest(window.previousFrom, monthStart)));

      // `numeric` arrives as text so no cent is lost on the way; a number from here on.
      return { current: Number(row?.current ?? 0), month: Number(row?.month ?? 0), previous: Number(row?.previous ?? 0) };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Every plan by the state it is in now. Mode: one grouped query. */
  async plansByState(): Promise<readonly { readonly n: number; readonly status: string }[]> {
    try {
      return await database().select({ n: count(), status: mealPlans.status }).from(mealPlans).groupBy(mealPlans.status);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Plans made per Madrid day. A plan row is written only when a generation succeeds. Mode: one grouped query. */
  async plansCreatedPerDay(from: Date, to: Date): Promise<readonly DayCountRow[]> {
    try {
      const day = madridDay(mealPlans.createdAt);

      return await database()
        .select({ day, n: count() })
        .from(mealPlans)
        .where(within(mealPlans.createdAt, from, to))
        .groupBy(day);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Plans made in each period. Mode: one scan with filtered counts. */
  async planTotals(window: PeriodWindow): Promise<PeriodCount> {
    try {
      const [row] = await database()
        .select({
          current: countWithin(mealPlans.createdAt, window.from, window.to),
          previous: countWithin(mealPlans.createdAt, window.previousFrom, window.from)
        })
        .from(mealPlans)
        .where(within(mealPlans.createdAt, window.previousFrom, window.to));

      return { current: row?.current ?? 0, previous: row?.previous ?? 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Accounts created per Madrid day. Mode: one grouped query. */
  async signUpsPerDay(from: Date, to: Date): Promise<readonly DayCountRow[]> {
    try {
      const day = madridDay(user.createdAt);

      return await database()
        .select({ day, n: count() })
        .from(user)
        .where(within(user.createdAt, from, to))
        .groupBy(day);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Messages nobody has marked dealt with yet (`0037`). A count; no message is read. Mode: one aggregate. */
  async unreadMessages(): Promise<number> {
    try {
      const [row] = await database().select({ n: count() }).from(feedback).where(isNull(feedback.handledAt));

      return row?.n ?? 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
