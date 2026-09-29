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

/** Dishes rejected for one reason on one Madrid day, summed over the calls of that day's generations. */
export type RejectionDayRow = { readonly day: string; readonly n: number };

/** Dishes rejected for one reason, summed over the calls of the period's generations. */
export type RejectionReasonRow = { readonly n: number; readonly reason: string };

type PlanLogMetadata = Record<string, unknown> | null;

/**
 * The keys of a plan's `generation_metadata` the log shows (`planOf`), and the
 * only ones it reads. The rest never leaves the database on this path: the
 * advisories are sentences with an event's name and a plan's figures in them,
 * and `quality` is read only summed over a period (`0071`, `0028`). Constants,
 * written into the SQL rather than bound.
 */
const PLAN_LOG_KEYS = ['backfilled', 'fallback', 'model', 'promptVersion', 'rejected', 'reused'] as const;

/** Each allowed key beside its value: `'model', "meal_plans"."generation_metadata" -> 'model', …`. */
const PLAN_LOG_PAIRS = sql.join(
  PLAN_LOG_KEYS.map(key => sql`${sql.raw(`'${key}'`)}, ${mealPlans.generationMetadata} -> ${sql.raw(`'${key}'`)}`),
  sql`, `
);

/** `generation_metadata` cut down to `PLAN_LOG_KEYS` in SQL; null when the job produced no plan. */
const PLAN_LOG_METADATA = sql<PlanLogMetadata>`case when ${mealPlans.generationMetadata} is null then null else jsonb_build_object(${PLAN_LOG_PAIRS}) end`;

/**
 * What the log selects: the job, the account's address and name — the one
 * thing of theirs it carries (`0028`, `0050`) — and what the plan recorded
 * about its own making, as far as the log shows it. Exactly `GenerationRow`'s
 * shape.
 */
const GENERATION_COLUMNS = {
  id: planGenerationJobs.id,
  aiCalls: planGenerationJobs.aiCalls,
  attempts: planGenerationJobs.attempts,
  email: user.email,
  error: planGenerationJobs.error,
  errorDetail: planGenerationJobs.errorDetail,
  finishedAt: planGenerationJobs.finishedAt,
  metadata: PLAN_LOG_METADATA.mapWith(mealPlans.generationMetadata),
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
   * The outcome of the last `size` generations that finished, newest first
   * (`succeeded` or `failed`, and the failure's code). Across every account:
   * the owner's alert asks whether the service is failing, not who for.
   * Mode: one small page, ordered by `finished_at`, which has no index of its own: the
   * table holds a few thousand jobs, and this runs once a job ends.
   */
  async lastOutcomes(size: number): Promise<readonly { readonly code: string | null; readonly status: string }[]> {
    try {
      return await database()
        .select({ code: planGenerationJobs.error, status: planGenerationJobs.status })
        .from(planGenerationJobs)
        .where(and(isNotNull(planGenerationJobs.finishedAt), inArray(planGenerationJobs.status, ['failed', 'succeeded'])))
        .orderBy(desc(planGenerationJobs.finishedAt))
        .limit(size);
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
  },

  /**
   * Dishes rejected for one `reason` per Madrid day of the generation that
   * asked for them: `rejectionsByReason`'s own SQL narrowed to one reason and
   * grouped by day. A total over everybody, naming nobody (`0028`). The reason
   * is bound, never spliced. Mode: one grouped query.
   */
  async rejectionsPerDay(reason: string, from: Date, to: Date): Promise<readonly RejectionDayRow[]> {
    try {
      const day = madridDay(planGenerationJobs.createdAt);
      const rows = await database().execute<{ day: string; n: number | string }>(sql`
        select ${day} as day, sum((reason.value)::numeric)::int as n
        from ${planGenerationJobs},
             jsonb_array_elements(case when jsonb_typeof(${planGenerationJobs.aiCalls}) = 'array' then ${planGenerationJobs.aiCalls} else '[]'::jsonb end) as call,
             jsonb_each(case when jsonb_typeof(call -> 'rejected') = 'object' then call -> 'rejected' else '{}'::jsonb end) as reason
        where ${within(planGenerationJobs.createdAt, from, to)} and reason.key = ${reason} and jsonb_typeof(reason.value) = 'number'
        group by 1
        having sum((reason.value)::numeric) > 0`);

      return rows.map(row => ({ day: row.day, n: Number(row.n) }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
