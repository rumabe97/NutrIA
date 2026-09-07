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

export type TargetInput = {
  readonly activityLevel: ActivityLevel;
  readonly ageYears: number;
  readonly goal: GoalType;
  readonly heightCm: number;
  /** kg per week. Negative loses, positive gains. Ignored for non-directional goals. */
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
  const directional = input.goal === 'weight_loss' || input.goal === 'muscle_gain';
  const pace = directional ? (input.paceKgPerWeek ?? (input.goal === 'weight_loss' ? -0.5 : 0.25)) : 0;
  const dailyDelta = (pace * KCAL_PER_KG_OF_BODY_MASS) / DAYS_PER_WEEK;

  const floor = MINIMUM_DAILY_KCAL[input.sex === 'male' ? 'male' : 'female'];
  const requested = maintenance + dailyDelta;
  const kcal = Math.max(requested, floor);

  const proteinG = round(input.weightKg * PROTEIN_G_PER_KG[input.goal]);
  const fatG = round((kcal * FAT_FRACTION_OF_KCAL) / KCAL_PER_G.fat);
  const remainingKcal = kcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat;
  const carbsG = round(Math.max(remainingKcal, 0) / KCAL_PER_G.carbs);
  const fiberG = round((kcal / 1000) * FIBER_G_PER_1000_KCAL);

  return { carbsG, fatG, fiberG, kcal: round(kcal), proteinG, wasClamped: requested < floor };
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
