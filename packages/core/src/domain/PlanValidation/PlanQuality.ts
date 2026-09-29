import { isBlocking, PLAN_TOLERANCE } from './PlanValidation';

import type { NutritionTargets } from 'core/entities/Nutrition';
import type { PlanViolation } from './PlanValidation';

/** The four macros the owner's bar holds every day to (`0045`, `0048`). */
type Macro = 'carbs' | 'fat' | 'kcal' | 'protein';

/** A violation's kind that is advice, not a reason to discard the plan (see `isBlocking`). */
export type AdvisoryKind = Exclude<
  PlanViolation['kind'],
  'below_minimum_kcal' | 'empty_day' | 'missing_slot' | 'protein_above_ceiling' | 'wrong_day_count'
>;

/** Every advisory kind, in a stable order: the console lists them all, zeros included. Typed against `AdvisoryKind`, so a new kind does not compile until it is here. */
export const ADVISORY_KINDS = [
  'carbs_out_of_band',
  'fat_out_of_band',
  'kcal_out_of_band',
  'protein_above_target',
  'protein_below_target',
  'variety'
] as const satisfies readonly AdvisoryKind[];

/**
 * Every advisory kind at zero, so a plan that had none of one still says 0 and
 * a sum over plans needs no key it lacks. A literal of the whole `Record`: a
 * new advisory kind in `PlanViolation` does not compile until it is here.
 */
function noAdvisories(): Record<AdvisoryKind, number> {
  return { carbs_out_of_band: 0, fat_out_of_band: 0, kcal_out_of_band: 0, protein_above_target: 0, protein_below_target: 0, variety: 0 };
}

/** Which macro a violation says a day missed; none for a kind that is not about one macro's band. */
const MACRO_OF: Partial<Record<PlanViolation['kind'], Macro>> = {
  carbs_out_of_band: 'carbs',
  fat_out_of_band: 'fat',
  kcal_out_of_band: 'kcal',
  // Over the ceiling is over the target's band as well; `validatePlan` names only the worse.
  protein_above_ceiling: 'protein',
  protein_above_target: 'protein',
  protein_below_target: 'protein'
};

export type PlanQualityInput = {
  /** The days the plan was built with, by index — its length is the plan's. */
  readonly dayIndexes: readonly number[];
  /** Days that eat for an event (`0043`), with the targets they were built to. */
  readonly dayTargets: ReadonlyMap<number, NutritionTargets>;
  /** How the plan came to be scheduled from something other than its first pool. */
  readonly fallback: 'full_library' | 'wider_rotation' | null;
  /** Event loads the bounds refused, which were built as ordinary days. */
  readonly loadsRefused: number;
  /** The energy floor the plan was built against (`minimumDailyKcal`): a day whose band would start below it is narrowed by it. */
  readonly minimumKcal: number;
  /** The plan's own targets, for every day that is not an event's. */
  readonly targets: NutritionTargets;
  /** What `validatePlan` said of the plan as delivered. */
  readonly violations: readonly PlanViolation[];
};

/**
 * A plan's quality against the owner's bar, as counts only (`0071`): stored
 * in `generation_metadata.quality` and read by the console only summed over a
 * period, never per plan, never per day, never on an addressed row.
 *
 * Nothing in it is a target, a figure or an event's name — those are the
 * person's (`0028`). A count of days says how well the service did without
 * saying what anybody eats.
 */
export type PlanQuality = {
  /** How many advisories of each kind the plan was delivered with. Every kind is present. */
  readonly advisoriesByKind: Readonly<Record<AdvisoryKind, number>>;
  readonly days: number;
  /**
   * Days whose band minimum (the day's kcal target × 0.95, event days by their own
   * loaded target) falls below the energy floor, so the floor narrows the band; says
   * nothing about whether the day was missed. Absent on plans stored before phase 5.
   */
  readonly daysFloorNarrowed: number;
  /**
   * Of `daysFloorNarrowed`, the days not inside 5 % on all four macros; counts any macro
   * and does not attribute cause. Absent on plans stored before phase 5.
   */
  readonly daysFloorNarrowedOutOfBand: number;
  /** Days inside the band on all four macros at once — the owner's bar. */
  readonly daysInBand: number;
  /** Event days, and of those, how many landed inside their own band on all four macros. */
  readonly eventDays: number;
  readonly eventDaysInBand: number;
  readonly fallback: 'full_library' | 'wider_rotation' | null;
  readonly loadsRefused: number;
  /** Days outside the band, per macro. A day can miss several. */
  readonly missesByMacro: Readonly<Record<Macro, number>>;
};

/**
 * Counts a delivered plan's days against its bands, from what validation
 * already said — never a second judgement of the same days.
 *
 * Pure: the same violations, days and targets always give the same counts.
 * A violation naming a day outside the plan is not counted.
 */
export function planQuality(input: PlanQualityInput): PlanQuality {
  const planDays = new Set(input.dayIndexes);
  const missedBy: Record<Macro, Set<number>> = { carbs: new Set(), fat: new Set(), kcal: new Set(), protein: new Set() };
  const advisoriesByKind = noAdvisories();

  for (const violation of input.violations) {
    const macro = MACRO_OF[violation.kind];

    if (macro && 'dayIndex' in violation && planDays.has(violation.dayIndex)) {
      missedBy[macro].add(violation.dayIndex);
    }

    if (!isBlocking(violation)) {
      advisoriesByKind[violation.kind as AdvisoryKind] += 1;
    }
  }

  const missed = new Set([...missedBy.carbs, ...missedBy.fat, ...missedBy.kcal, ...missedBy.protein]);
  const eventDays = [...planDays].filter(day => input.dayTargets.has(day));
  const narrowed = [...planDays].filter(day => (input.dayTargets.get(day) ?? input.targets).kcal * (1 - PLAN_TOLERANCE.kcal) < input.minimumKcal);

  return {
    advisoriesByKind,
    days: planDays.size,
    daysFloorNarrowed: narrowed.length,
    daysFloorNarrowedOutOfBand: narrowed.filter(day => missed.has(day)).length,
    daysInBand: [...planDays].filter(day => !missed.has(day)).length,
    eventDays: eventDays.length,
    eventDaysInBand: eventDays.filter(day => !missed.has(day)).length,
    fallback: input.fallback,
    loadsRefused: input.loadsRefused,
    missesByMacro: { carbs: missedBy.carbs.size, fat: missedBy.fat.size, kcal: missedBy.kcal.size, protein: missedBy.protein.size }
  };
}
