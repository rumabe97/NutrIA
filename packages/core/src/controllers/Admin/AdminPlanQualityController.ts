import { AdminPlanQualityRepository } from '#repositories/Admin';
import { madridDayKey, madridMidnight, shiftDay } from 'core/domain/Period';

import { presentWindow } from './AdminSeriesController';

import type { PeriodWindowView } from './AdminSeriesController';
import type { Period, PeriodWindow } from 'core/entities/Period';

/** Below this many plans in the period a percentage is one or two people's plans: the counts are returned and `fewData` is true. */
export const MIN_PLANS_FOR_SHARES = 10;

/**
 * The disjoint stretches nested periods expose, as days back from today's Madrid midnight:
 * `[−7, 0)`, `[−30, −7)`, `[−90, −30)`. Any two periods' figures subtract into one of them
 * (or a sum of them), so each stretch inside the requested period must itself hold
 * `MIN_PLANS_FOR_SHARES` scored plans or none (`0028`).
 */
const STRETCHES: readonly (readonly [number, number])[] = [
  [7, 0],
  [30, 7],
  [90, 30]
];

/**
 * The period ends at today's Madrid midnight, never `now`: a plan made this morning is not in
 * any figure until tomorrow, so two reads a minute apart cannot subtract into it.
 */
function qualityWindow(period: Period, now: Date): PeriodWindow {
  const today = madridDayKey(now);

  return { from: madridMidnight(shiftDay(today, -period)), previousFrom: madridMidnight(shiftDay(today, -2 * period)), to: madridMidnight(today) };
}

/** A share of days between 0 and 1, or null when there is nothing to divide by. */
function share(part: number, whole: number): number | null {
  return whole > 0 ? Math.min(1, Math.max(0, part / whole)) : null;
}

/**
 * Planes › Calidad (`GET /admin/plans/quality?period=`, `0071`): how the plans
 * made in the period were delivered against the owner's bar, summed over every
 * plan. Read from `generation_metadata -> 'quality'` and `created_at` only, and
 * never per plan, per day or per person (`0028`): the counts below are sums.
 *
 * Plans made before 2026-09-29 carry no `quality` and are counted in
 * `withoutQuality`, never scored after the fact. Nothing about the energy floor
 * is a series: it is two sums.
 */
export type AdminPlanQualityFullView = {
  /** How many advisories of each kind the period's plans were delivered with; every kind present, zeros included. */
  readonly advisoriesByKind: readonly { readonly kind: string; readonly n: number }[];
  /** The Madrid day of the first plan that carries `quality`, over all time; null while there is none. The page says "desde". */
  readonly dataStart: string | null;
  /** Days in the period's scored plans, and how many were inside the band on all four macros at once. */
  readonly days: number;
  readonly daysInBand: number;
  /** Event days (`0043`) in those plans, and how many landed inside their own band on all four macros. */
  readonly eventDays: number;
  readonly eventDaysInBand: number;
  /** Plans that were scheduled from something other than their first pool, by how. Both kinds present. */
  readonly fallbacks: readonly { readonly kind: 'full_library' | 'wider_rotation'; readonly n: number }[];
  /**
   * False here: the period has `minPlans` scored plans or more, and every stretch inside it
   * has none or `minPlans` or more.
   */
  readonly fewData: false;
  /**
   * Days whose band the energy floor narrowed (`daysFloorNarrowed`: the day's kcal
   * target × 0.95, event days by their own target, below the floor; says nothing about
   * a miss), and of those the days not inside 5 % on all four macros
   * (`daysFloorNarrowedOutOfBand`; counts any macro, attributes no cause). Recorded
   * only on plans made from `since`; `since` is null while no plan carries them, and
   * `base` is the plans, days and days in band of only those plans, the denominators
   * of `shares.floor`.
   */
  readonly floor: {
    readonly base: { readonly days: number; readonly daysInBand: number; readonly plans: number };
    readonly daysNarrowed: number;
    readonly daysNarrowedOutOfBand: number;
    readonly since: string | null;
  };
  /** Event loads the bounds refused, summed. */
  readonly loadsRefused: number;
  /** The `fewData` threshold, so the page and the API agree. */
  readonly minPlans: number;
  /** Days outside the band, per macro; a day can miss several. */
  readonly missesByMacro: { readonly carbs: number; readonly fat: number; readonly kcal: number; readonly protein: number };
  readonly period: Period;
  /** Plans made in the period that carry `quality`, and those that do not (made before it was recorded). */
  readonly plans: number;
  /**
   * Fractions between 0 and 1, or null when a figure's denominator is zero.
   */
  readonly shares: {
    /** Event days inside their own band on all four macros ÷ event days. */
    readonly eventInBand: number | null;
    readonly floor: {
      /** Of the days the floor narrowed, the share not in band. */
      readonly narrowedOutOfBand: number | null;
      /** Of the days it did not narrow, the share not in band: (days − in band − narrowed out of band) ÷ (days − narrowed). */
      readonly restOutOfBand: number | null;
    } | null;
    /** Days in band on all four macros ÷ days. */
    readonly inBand: number | null;
    /** Per macro: days inside the band on that macro ÷ days (1 − misses ÷ days). */
    readonly inBandByMacro: {
      readonly carbs: number | null;
      readonly fat: number | null;
      readonly kcal: number | null;
      readonly protein: number | null;
    };
  };
  readonly window: PeriodWindowView;
  readonly withoutQuality: number;
};

/**
 * What is returned while `fewData` (fewer than `minPlans` scored plans in the period, or any
 * stretch inside it with some but fewer than that): these seven keys and no other. Every
 * other key of the full view is absent, not null.
 */
export type AdminPlanQualityFewView = Pick<AdminPlanQualityFullView, 'dataStart' | 'minPlans' | 'period' | 'plans' | 'window' | 'withoutQuality'> & {
  readonly fewData: true;
};

/** Narrow on `fewData`. */
export type AdminPlanQualityView = AdminPlanQualityFewView | AdminPlanQualityFullView;

export const AdminPlanQualityController = {
  async quality(period: Period, now = new Date()): Promise<AdminPlanQualityView> {
    const window = qualityWindow(period, now);
    const today = madridDayKey(now);
    const stretches = STRETCHES.map(([back, until]) => ({
      from: madridMidnight(shiftDay(today, -back)),
      inPeriod: back <= period,
      to: madridMidnight(shiftDay(today, -until))
    }));
    const [totals, start, floorStart] = await Promise.all([
      AdminPlanQualityRepository.totals(window.from, window.to, stretches),
      AdminPlanQualityRepository.dataStart(),
      AdminPlanQualityRepository.dataStart(true)
    ]);
    const thinStretch = stretches.some((stretch, index) => {
      const plans = totals.stretchPlans[index] ?? 0;

      return stretch.inPeriod && plans > 0 && plans < MIN_PLANS_FOR_SHARES;
    });

    if (totals.plans < MIN_PLANS_FOR_SHARES || thinStretch) {
      return {
        dataStart: start ? madridDayKey(start) : null,
        fewData: true,
        minPlans: MIN_PLANS_FOR_SHARES,
        period,
        plans: totals.plans,
        window: presentWindow(window),
        withoutQuality: totals.withoutQuality
      };
    }

    const { days } = totals;
    const byMacro = (misses: number) => share(days - misses, days);
    const narrowed = totals.daysFloorNarrowed;
    const narrowedOut = totals.daysFloorNarrowedOutOfBand;
    const base = totals.floorBase;

    return {
      advisoriesByKind: Object.entries(totals.advisoriesByKind).map(([kind, n]) => ({ kind, n })),
      dataStart: start ? madridDayKey(start) : null,
      days,
      daysInBand: totals.daysInBand,
      eventDays: totals.eventDays,
      eventDaysInBand: totals.eventDaysInBand,
      fallbacks: [
        { kind: 'full_library', n: totals.fallbackFullLibrary },
        { kind: 'wider_rotation', n: totals.fallbackWiderRotation }
      ],
      fewData: false,
      floor: { base, daysNarrowed: narrowed, daysNarrowedOutOfBand: narrowedOut, since: floorStart ? madridDayKey(floorStart) : null },
      loadsRefused: totals.loadsRefused,
      minPlans: MIN_PLANS_FOR_SHARES,
      missesByMacro: totals.misses,
      period,
      plans: totals.plans,
      shares: {
        eventInBand: share(totals.eventDaysInBand, totals.eventDays),
        floor:
          base.plans === 0
            ? null
            : {
                narrowedOutOfBand: share(narrowedOut, narrowed),
                restOutOfBand: share(base.days - base.daysInBand - narrowedOut, base.days - narrowed)
              },
        inBand: share(totals.daysInBand, days),
        inBandByMacro: {
          carbs: byMacro(totals.misses.carbs),
          fat: byMacro(totals.misses.fat),
          kcal: byMacro(totals.misses.kcal),
          protein: byMacro(totals.misses.protein)
        }
      },
      window: presentWindow(window),
      withoutQuality: totals.withoutQuality
    };
  }
};
