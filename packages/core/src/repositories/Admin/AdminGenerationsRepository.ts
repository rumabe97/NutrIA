import { and, asc, count, desc, eq, gte, inArray, isNotNull, lt, sql } from 'drizzle-orm';

import { contains } from '#repositories/Search';
import { database } from 'database';
import { mealPlans, planGenerationJobs } from 'database/schema/plan';
import { user } from 'database/schema/auth';

import { DatabaseOperationError } from 'core/entities/Error';

import { madridDay, within } from './AdminSql';

import type { GenerationRow } from './AdminRepository';
import type { GenerationStatus } from 'core/entities/AdminQuery';
import type { SQL } from 'drizzle-orm';

/**
 * What the log is narrowed by, already turned into instants by the controller:
 * `after` is inclusive and `before` exclusive. Every filter given applies.
 */
export type GenerationFilter = {
  readonly after?: Date;
  readonly before?: Date;
  /** A failure code, matched exactly. */
  readonly code?: string;
  /** Text the account's address contains, matched literally. */
  readonly q?: string;
  readonly status?: GenerationStatus;
};

/** One Madrid day's durations of the generations that finished, in seconds. */
export type DurationDayRow = { readonly day: string; readonly p50: number; readonly p95: number };

/** How many generations failed with one code. `null` is a failure that recorded none. */
export type FailureCodeRow = { readonly code: string | null; readonly n: number };

/** Dishes rejected for one reason, summed over the calls of the period's generations. */
export type RejectionReasonRow = { readonly n: number; readonly reason: string };

/**
 * What the log selects: the job, the account's address and name — the one
 * thing of theirs it carries (`0028`, `0050`) — and what the plan recorded
 * about its own making. Exactly `recentGenerations`' row.
 */
const GENERATION_COLUMNS = {
  id: planGenerationJobs.id,
  aiCalls: planGenerationJobs.aiCalls,
  attempts: planGenerationJobs.attempts,
  email: user.email,
  error: planGenerationJobs.error,
  errorDetail: planGenerationJobs.errorDetail,
  finishedAt: planGenerationJobs.finishedAt,
  metadata: mealPlans.generationMetadata,
  name: user.name,
  planVersion: mealPlans.version,
  startedAt: planGenerationJobs.startedAt,
  status: planGenerationJobs.status,
  step: planGenerationJobs.step
};

/**
 * The log's `WHERE`. Every value is bound as a parameter; the only text is the
 * address search, escaped into a literal "contains". Exported for its spec.
 */
export function generationFilters(filter: GenerationFilter): SQL | undefined {
  return and(
    filter.status === undefined ? undefined : eq(planGenerationJobs.status, filter.status),
    filter.code === undefined ? undefined : eq(planGenerationJobs.error, filter.code),
    filter.q === undefined ? undefined : contains(user.email, filter.q),
    filter.after === undefined ? undefined : gte(planGenerationJobs.createdAt, filter.after),
    filter.before === undefined ? undefined : lt(planGenerationJobs.createdAt, filter.before)
  );
}

/** Seconds a finished job ran for, from its own two clocks. */
const SECONDS = sql`extract(epoch from (${planGenerationJobs.finishedAt} - ${planGenerationJobs.startedAt}))`;

/** A job that ended, either way, and recorded both its clocks. */
const FINISHED = and(
  inArray(planGenerationJobs.status, ['succeeded', 'failed']),
  isNotNull(planGenerationJobs.startedAt),
  isNotNull(planGenerationJobs.finishedAt)
);

/**
 * The generation log as a table (`0050`, `0068`): every generation, not only
 * the latest, filtered, searched and paged in SQL. The one read in the console
 * that names somebody — an address and a name per job — and only
 * `AdminGenerationsController` calls it. The address search narrows what is
 * shown; it cannot widen it: the row is the same row the log always showed.
 */
export const AdminGenerationsRepository = {
  /**
   * Durations per Madrid day of the generations made that day that finished,
   * the median and the 95th percentile in seconds. A day with none has no row.
   * Mode: one grouped query.
   */
  async durationsPerDay(from: Date, to: Date): Promise<readonly DurationDayRow[]> {
    try {
      const day = madridDay(planGenerationJobs.createdAt);
      const rows = await database()
        .select({
          day,
          p50: sql<number>`percentile_cont(0.5) within group (order by ${SECONDS})`.mapWith(Number),
          p95: sql<number>`percentile_cont(0.95) within group (order by ${SECONDS})`.mapWith(Number)
        })
        .from(planGenerationJobs)
        .where(and(within(planGenerationJobs.createdAt, from, to), FINISHED))
        .groupBy(day);

      return rows;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Generations made in `[from, to)` that failed, by code, the commonest first. Mode: one grouped query. */
  async failuresByCode(from: Date, to: Date): Promise<readonly FailureCodeRow[]> {
    try {
      const n = count();

      return await database()
        .select({ code: planGenerationJobs.error, n })
        .from(planGenerationJobs)
        .where(and(within(planGenerationJobs.createdAt, from, to), eq(planGenerationJobs.status, 'failed')))
        .groupBy(planGenerationJobs.error)
        .orderBy(desc(n), asc(planGenerationJobs.error));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * One page of the log, newest first, and how many generations match. The
   * tail of the order (the id) keeps a page boundary still when two jobs were
   * made in the same instant. Mode: one page and one count under the same
   * `WHERE`.
   */
  async page(filter: GenerationFilter, offset: number, size: number): Promise<{ readonly rows: readonly GenerationRow[]; readonly total: number }> {
    try {
      const db = database();
      const where = generationFilters(filter);
      const [rows, counted] = await Promise.all([
        db
          .select(GENERATION_COLUMNS)
          .from(planGenerationJobs)
          .innerJoin(user, eq(user.id, planGenerationJobs.userId))
          .leftJoin(mealPlans, eq(mealPlans.id, planGenerationJobs.planId))
          .where(where)
          .orderBy(desc(planGenerationJobs.createdAt), asc(planGenerationJobs.id))
          .limit(size)
          .offset(offset),
        db.select({ n: count() }).from(planGenerationJobs).innerJoin(user, eq(user.id, planGenerationJobs.userId)).where(where)
      ]);

      return { rows, total: counted[0]?.n ?? 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Dishes rejected per reason over the calls of the generations made in the period —
   * every reason, the person's own ones (`allergen`, `unwanted`) included, because
   * here they are totals over everybody and name nobody (`0028`). The addressed log
   * row never carries those two. One grouped query over each call's `rejected`
   * object; a call without one adds nothing.
   */
  async rejectionsByReason(from: Date, to: Date): Promise<readonly RejectionReasonRow[]> {
    try {
      const rows = await database().execute<{ n: number | string; reason: string }>(sql`
        select reason.key as reason, sum((reason.value)::numeric)::int as n
        from ${planGenerationJobs},
             jsonb_array_elements(case when jsonb_typeof(${planGenerationJobs.aiCalls}) = 'array' then ${planGenerationJobs.aiCalls} else '[]'::jsonb end) as call,
             jsonb_each(case when jsonb_typeof(call -> 'rejected') = 'object' then call -> 'rejected' else '{}'::jsonb end) as reason
        where ${within(planGenerationJobs.createdAt, from, to)} and jsonb_typeof(reason.value) = 'number'
        group by reason.key
        having sum((reason.value)::numeric) > 0
        order by n desc, reason.key asc`);

      return rows.map(row => ({ n: Number(row.n), reason: row.reason }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
