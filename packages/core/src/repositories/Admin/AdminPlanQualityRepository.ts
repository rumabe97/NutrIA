import { isNotNull, isNull, sql } from 'drizzle-orm';

import { database } from 'database';
import { mealPlans } from 'database/schema/plan';

import { ADVISORY_KINDS } from 'core/domain/PlanValidation';
import { DatabaseOperationError } from 'core/entities/Error';

import { within } from './AdminSql';

import type { SQL } from 'drizzle-orm';

const QUALITY = sql`${mealPlans.generationMetadata} -> 'quality'`;

/** A whole number at a path inside `quality`, summed; a plan without it (or with anything else there) adds 0. */
function summed(...path: readonly string[]): SQL<number> {
  const at = sql.raw(`'{${path.join(',')}}'`);

  return sql<number>`coalesce(sum(case when jsonb_typeof(${QUALITY} #> ${at}) = 'number' then (${QUALITY} #>> ${at})::int else 0 end), 0)`.mapWith(
    Number
  );
}

/** Only plans that carry the energy-floor counts (recorded from phase 5; earlier plans have no key). */
const HAS_FLOOR = sql`jsonb_typeof(${QUALITY} -> 'daysFloorNarrowed') = 'number'`;

/** `summed`, over the plans that carry the floor counts only. */
function summedWithFloor(...path: readonly string[]): SQL<number> {
  const at = sql.raw(`'{${path.join(',')}}'`);

  return sql<number>`coalesce(sum(case when ${HAS_FLOOR} and jsonb_typeof(${QUALITY} #> ${at}) = 'number' then (${QUALITY} #>> ${at})::int else 0 end), 0)`.mapWith(
    Number
  );
}

/** Plans whose `quality.fallback` is the named text. */
function fellBackTo(kind: 'full_library' | 'wider_rotation'): SQL<number> {
  return sql<number>`count(*) filter (where ${QUALITY} ->> 'fallback' = ${kind})`.mapWith(Number);
}

/**
 * What a period's plans were delivered with, summed: the shape
 * `generation_metadata.quality` was written in (`planQuality`), added up over
 * every plan that carries it. Never one plan's figures (`0071`, `0028`).
 */
export type PlanQualityTotals = {
  /** Per advisory kind, every kind present. */
  readonly advisoriesByKind: Readonly<Record<string, number>>;
  readonly days: number;
  /** Days whose band the energy floor narrowed, and of those the ones not in band. Plans stored before they were recorded add 0. */
  readonly daysFloorNarrowed: number;
  readonly daysFloorNarrowedOutOfBand: number;
  readonly daysInBand: number;
  readonly eventDays: number;
  readonly eventDaysInBand: number;
  readonly fallbackFullLibrary: number;
  readonly fallbackWiderRotation: number;
  /** The denominators for the floor's shares, over the plans that carry the floor counts only: their plans, days, and days in band. */
  readonly floorBase: { readonly days: number; readonly daysInBand: number; readonly plans: number };
  readonly loadsRefused: number;
  readonly misses: { readonly carbs: number; readonly fat: number; readonly kcal: number; readonly protein: number };
  /** Plans made in the period that carry `quality`. */
  readonly plans: number;
  /** Scored plans in each stretch asked for, in the order given: the counts the rule of 10 is applied to (`0028`). */
  readonly stretchPlans: readonly number[];
  /** Plans made in the period without it: written before the service recorded it. */
  readonly withoutQuality: number;
};

/**
 * Planes › Calidad (`0071`): one aggregate over `meal_plans`, reading only
 * `generation_metadata -> 'quality'` and `created_at`. No `user_id`, no plan id,
 * no `meals`, `plan_days` or `strategy` is selected, and there is no `group by`
 * on a person or on a day: nothing here can be turned into one plan's story.
 */
export const AdminPlanQualityRepository = {
  /** When the first plan that carries `quality` (or, with `floor`, the floor counts too) was made, over all time; null while there is none. Mode: one aggregate. */
  async dataStart(floor = false): Promise<Date | null> {
    try {
      const [row] = await database()
        .select({ first: sql<Date | null>`min(${mealPlans.createdAt})`.mapWith(mealPlans.createdAt) })
        .from(mealPlans)
        .where(floor ? HAS_FLOOR : isNotNull(QUALITY));

      return row?.first ?? null;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The sums over `[from, to)`, and in the same statement the scored plans of each disjoint
   * `stretches` entry (scalar subselects, one snapshot). Mode: one scan of the period's plans
   * with filtered aggregates.
   */
  async totals(from: Date, to: Date, stretches: readonly { readonly from: Date; readonly to: Date }[] = []): Promise<PlanQualityTotals> {
    try {
      const stretchCounts: Record<string, SQL<number>> = Object.fromEntries(
        stretches.map((stretch, index) => [
          `stretch${index}`,
          sql<number>`(select count(*) from ${mealPlans} where ${isNotNull(QUALITY)} and ${within(mealPlans.createdAt, stretch.from, stretch.to)})`.mapWith(
            Number
          )
        ])
      );
      const advisories: Record<string, SQL<number>> = Object.fromEntries(ADVISORY_KINDS.map(kind => [kind, summed('advisoriesByKind', kind)]));
      const [row] = await database()
        .select({
          advisories,
          days: summed('days'),
          daysFloorNarrowed: summed('daysFloorNarrowed'),
          daysFloorNarrowedOutOfBand: summed('daysFloorNarrowedOutOfBand'),
          daysInBand: summed('daysInBand'),
          eventDays: summed('eventDays'),
          eventDaysInBand: summed('eventDaysInBand'),
          floorDays: summedWithFloor('days'),
          floorDaysInBand: summedWithFloor('daysInBand'),
          floorPlans: sql<number>`count(*) filter (where ${HAS_FLOOR})`.mapWith(Number),
          fullLibrary: fellBackTo('full_library'),
          loadsRefused: summed('loadsRefused'),
          missCarbs: summed('missesByMacro', 'carbs'),
          missFat: summed('missesByMacro', 'fat'),
          missKcal: summed('missesByMacro', 'kcal'),
          missProtein: summed('missesByMacro', 'protein'),
          plans: sql<number>`count(*) filter (where ${isNotNull(QUALITY)})`.mapWith(Number),
          stretchCounts,
          widerRotation: fellBackTo('wider_rotation'),
          withoutQuality: sql<number>`count(*) filter (where ${isNull(QUALITY)})`.mapWith(Number)
        })
        .from(mealPlans)
        .where(within(mealPlans.createdAt, from, to));

      return {
        advisoriesByKind: Object.fromEntries(ADVISORY_KINDS.map(kind => [kind, Number(row?.advisories[kind] ?? 0)])),
        days: row?.days ?? 0,
        daysFloorNarrowed: row?.daysFloorNarrowed ?? 0,
        daysFloorNarrowedOutOfBand: row?.daysFloorNarrowedOutOfBand ?? 0,
        daysInBand: row?.daysInBand ?? 0,
        eventDays: row?.eventDays ?? 0,
        eventDaysInBand: row?.eventDaysInBand ?? 0,
        fallbackFullLibrary: row?.fullLibrary ?? 0,
        fallbackWiderRotation: row?.widerRotation ?? 0,
        floorBase: { days: row?.floorDays ?? 0, daysInBand: row?.floorDaysInBand ?? 0, plans: row?.floorPlans ?? 0 },
        loadsRefused: row?.loadsRefused ?? 0,
        misses: { carbs: row?.missCarbs ?? 0, fat: row?.missFat ?? 0, kcal: row?.missKcal ?? 0, protein: row?.missProtein ?? 0 },
        plans: row?.plans ?? 0,
        stretchPlans: stretches.map((_, index) => Number(row?.stretchCounts[`stretch${index}`] ?? 0)),
        withoutQuality: row?.withoutQuality ?? 0
      };
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
