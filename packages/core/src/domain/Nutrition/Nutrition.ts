import { MINIMUM_DAILY_KCAL } from 'core/entities/Nutrition';
import type { NutritionTargets } from 'core/entities/Nutrition';
import type { ACTIVITY_LEVELS, GOAL_TYPES, SEXES } from 'core/entities/Profile';

type Sex = (typeof SEXES)[number];
type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];
type GoalType = (typeof GOAL_TYPES)[number];

/** Mifflin-St Jeor multipliers. */
const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  athlete: 1.9,
  high: 1.725,
  light: 1.375,
  moderate: 1.55,
  sedentary: 1.2
};

/** Grams of protein per kg of body weight, by goal. */
const PROTEIN_G_PER_KG: Record<GoalType, number> = {
  custom: 1.6,
  healthy_eating: 1.4,
  maintenance: 1.6,
  muscle_gain: 1.9,
  performance: 1.8,
  weight_loss: 1.8
};

const KCAL_PER_G = { carbs: 4, fat: 9, protein: 4 } as const;
const FAT_FRACTION_OF_KCAL = 0.28;
const FIBER_G_PER_1000_KCAL = 14;
const KCAL_PER_KG_OF_BODY_MASS = 7700;
const DAYS_PER_WEEK = 7;

/**
 * The largest share of maintenance a deficit may take.
 *
 * A floor in absolute calories is not enough on its own: 1,899 kcal clears the
 * 1,500 floor and is still a 37% deficit for someone maintaining at 3,000, which
 * is not a plan anyone should follow unsupervised.
 */
const MAX_DEFICIT_FRACTION = 0.25;

/** And the fastest sensible gain, for the same reason in the other direction. */
const MAX_SURPLUS_FRACTION = 0.2;

export type TargetInput = {
  readonly activityLevel: ActivityLevel;
  readonly ageYears: number;
  readonly goal: GoalType;
  readonly heightCm: number;
  /**
   * kg per week, as a **magnitude**. The direction comes from the goal.
   *
   * It used to be signed, and a positive value with a weight-loss goal produced a
   * surplus: a real profile asking to lose 1 kg a week was given 4,099 kcal
   * against a 2,999 maintenance. The sign was redundant information that could
   * contradict the goal, so it no longer exists — `Math.abs` is applied here and
   * the goal decides.
   */
  readonly paceKgPerWeek?: number | null;
  readonly sex: Sex;
  readonly weightKg: number;
};

/**
 * Basal metabolic rate — Mifflin-St Jeor, the equation with the best validated
 * accuracy for non-athlete adults.
 *
 * `other` and `prefer_not_to_say` take the midpoint of the two sex constants
 * rather than defaulting to male, which would systematically over-feed.
 */
export function basalMetabolicRate({ ageYears, heightCm, sex, weightKg }: Pick<TargetInput, 'ageYears' | 'heightCm' | 'sex' | 'weightKg'>): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  const offset = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;

  return base + offset;
}

/** BMR scaled by activity — total daily energy expenditure. */
export function totalDailyEnergyExpenditure(input: Pick<TargetInput, 'activityLevel' | 'ageYears' | 'heightCm' | 'sex' | 'weightKg'>): number {
  return basalMetabolicRate(input) * ACTIVITY_FACTOR[input.activityLevel];
}

/**
 * Daily kcal + macro split for a plan cycle.
 *
 * Computed here, in code, and never asked of a model — this is the number every
 * downstream safety check compares against, and a hallucinated one would be
 * invisible until it had already shaped fourteen days of food.
 *
 * The floor in `MINIMUM_DAILY_KCAL` is hard: an aggressive pace is clamped, not
 * honoured. `wasClamped` is returned so the caller can tell the user their
 * requested pace was reduced rather than silently ignoring them.
 */
export function nutritionTargets(input: TargetInput): NutritionTargets & { readonly wasClamped: boolean } {
  const maintenance = totalDailyEnergyExpenditure(input);
  const losing = input.goal === 'weight_loss';
  const gaining = input.goal === 'muscle_gain';

  // Magnitude only. The goal is the single source of direction, so a pace typed
  // without a minus sign can no longer invert the plan.
  const pace = Math.abs(input.paceKgPerWeek ?? (losing ? 0.5 : 0.25));
  const magnitude = (pace * KCAL_PER_KG_OF_BODY_MASS) / DAYS_PER_WEEK;
  const requested = losing ? maintenance - magnitude : gaining ? maintenance + magnitude : maintenance;

  // Three bounds, whichever binds first: an absolute floor, a share of
  // maintenance, and a ceiling on the surplus.
  const floor = Math.max(MINIMUM_DAILY_KCAL[input.sex === 'male' ? 'male' : 'female'], maintenance * (1 - MAX_DEFICIT_FRACTION));
  const ceiling = maintenance * (1 + MAX_SURPLUS_FRACTION);
  const kcal = Math.min(Math.max(requested, floor), ceiling);

  const proteinG = round(input.weightKg * PROTEIN_G_PER_KG[input.goal]);
  const fatG = round((kcal * FAT_FRACTION_OF_KCAL) / KCAL_PER_G.fat);
  const remainingKcal = kcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat;
  const carbsG = round(Math.max(remainingKcal, 0) / KCAL_PER_G.carbs);
  const fiberG = round((kcal / 1000) * FIBER_G_PER_1000_KCAL);

  return { carbsG, fatG, fiberG, kcal: round(kcal), proteinG, wasClamped: requested < floor || requested > ceiling };
}

/** Whole years between `birthDate` and `on`. */
export function ageInYears(birthDate: string, on: Date = new Date()): number {
  const born = new Date(birthDate);
  let age = on.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = on.getUTCMonth() - born.getUTCMonth();

  if (monthDelta < 0 || (monthDelta === 0 && on.getUTCDate() < born.getUTCDate())) {age -= 1;}

  return age;
}

function round(value: number): number {
  return Math.round(value);
}
