import {
  KCAL_PER_G,
  MACRO_SUM_TOLERANCE,
  MAX_PROTEIN_KCAL_SHARE,
  MIN_FAT_KCAL_SHARE,
  MINIMUM_DAILY_KCAL,
  PROTEIN_CEILING_G_PER_KG,
  PROTEIN_FLOOR_G_PER_KG
} from 'core/entities/Nutrition';
import type { NutritionTargets, TargetOverride } from 'core/entities/Nutrition';
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

/** Default pace when the user has not chosen one, in kg per week. */
const DEFAULT_PACE = { gain: 0.25, loss: 0.5 } as const;

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
 * Where a calorie figure came from.
 *
 * Returned alongside the number so a screen can show its basis rather than
 * presenting it as a fact. The 4,099 kcal defect survived a review and a live
 * onboarding pass because a number in a box looks settled; a number next to
 * "2,999 maintenance, minus 1 kg/week" would have looked wrong immediately.
 */
export type TargetDerivation = {
  readonly activityFactor: number;
  readonly basalMetabolicRateKcal: number;
  readonly ceilingKcal: number;
  /** Which bound moved the requested figure, if either did. */
  readonly clampedBy: 'ceiling' | 'floor' | null;
  readonly equation: 'mifflin-st-jeor';
  readonly floorKcal: number;
  readonly goal: GoalType;
  readonly maintenanceKcal: number;
  /** Magnitude in kg per week, after defaulting — never signed. */
  readonly paceKgPerWeek: number;
  /** What the goal and pace asked for, before the bounds were applied. */
  readonly requestedKcal: number;
};

/** A target set that no plan could satisfy, and the reason it could not. */
export type TargetViolation =
  | { readonly ceiling: number; readonly kind: 'kcal_above_ceiling'; readonly value: number }
  | { readonly ceiling: number; readonly kind: 'protein_above_ceiling'; readonly value: number }
  | { readonly floor: number; readonly kind: 'fat_below_floor'; readonly value: number }
  | { readonly floor: number; readonly kind: 'kcal_below_floor'; readonly value: number }
  | { readonly floor: number; readonly kind: 'protein_below_floor'; readonly value: number }
  | { readonly kcal: number; readonly kind: 'macros_do_not_sum'; readonly macroKcal: number };

/** The bounds a target set — computed or corrected by hand — has to sit inside. */
export type TargetBounds = {
  readonly ceilingKcal: number;
  readonly floorKcal: number;
  readonly maintenanceKcal: number;
  readonly proteinCeilingG: number;
  readonly proteinFloorG: number;
};

export type ResolvedTargets = {
  readonly bounds: TargetBounds;
  /** What the equations produce from the profile alone. */
  readonly computed: NutritionTargets;
  readonly derivation: TargetDerivation;
  /** What generation and every screen must use. */
  readonly effective: NutritionTargets;
  /**
   * `stale` means an override is stored but no longer sits inside the bounds —
   * the profile moved under it. It is set aside rather than applied or deleted,
   * and `overrideViolations` says why.
   */
  readonly overrideStatus: 'applied' | 'none' | 'stale';
  readonly overrideViolations: readonly TargetViolation[];
};

/**
 * Thrown when the numbers this module produced are ones no plan could satisfy.
 *
 * This is an assertion on our own arithmetic, not a rejection of user input: a
 * profile that passes onboarding must yield reachable targets. It exists so that
 * class of bug surfaces here, where the equations are, instead of three stages
 * later as a generation that "did not meet your nutritional goals".
 */
export class TargetsUnreachableError extends Error {
  constructor(public readonly violations: readonly TargetViolation[]) {
    super(`Computed targets are unreachable: ${violations.map(violation => violation.kind).join(', ')}`);
    this.name = 'TargetsUnreachableError';
  }
}

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
 * The bounds for one profile.
 *
 * The single definition of "how far from maintenance is allowed", used by the
 * computed path and by the hand-correction path alike. Two copies of this would
 * be two different products: one where an override can go where the calculator
 * may not.
 */
export function targetBounds(input: TargetInput): TargetBounds {
  const maintenanceKcal = totalDailyEnergyExpenditure(input);

  return {
    ceilingKcal: maintenanceKcal * (1 + MAX_SURPLUS_FRACTION),
    floorKcal: Math.max(MINIMUM_DAILY_KCAL[input.sex === 'male' ? 'male' : 'female'], maintenanceKcal * (1 - MAX_DEFICIT_FRACTION)),
    maintenanceKcal,
    proteinCeilingG: input.weightKg * PROTEIN_CEILING_G_PER_KG,
    proteinFloorG: input.weightKg * PROTEIN_FLOOR_G_PER_KG
  };
}

/**
 * Every way a target set fails to describe one achievable day of eating.
 *
 * Returns all of them rather than the first, so a refused correction can name
 * every bound it crossed instead of sending the user round the loop.
 */
export function targetViolations(targets: NutritionTargets, bounds: TargetBounds): readonly TargetViolation[] {
  const violations: TargetViolation[] = [];
  const fatFloorG = (targets.kcal * MIN_FAT_KCAL_SHARE) / KCAL_PER_G.fat;
  const macroKcal = targets.proteinG * KCAL_PER_G.protein + targets.carbsG * KCAL_PER_G.carbs + targets.fatG * KCAL_PER_G.fat;

  if (targets.kcal < Math.floor(bounds.floorKcal)) {violations.push({ floor: bounds.floorKcal, kind: 'kcal_below_floor', value: targets.kcal });}

  if (targets.kcal > Math.ceil(bounds.ceilingKcal)) {violations.push({ ceiling: bounds.ceilingKcal, kind: 'kcal_above_ceiling', value: targets.kcal });}

  if (targets.proteinG < bounds.proteinFloorG) {violations.push({ floor: bounds.proteinFloorG, kind: 'protein_below_floor', value: targets.proteinG });}

  if (targets.proteinG > bounds.proteinCeilingG) {violations.push({ ceiling: bounds.proteinCeilingG, kind: 'protein_above_ceiling', value: targets.proteinG });}

  if (targets.fatG < fatFloorG) {violations.push({ floor: fatFloorG, kind: 'fat_below_floor', value: targets.fatG });}

  // Last, because it is the one that makes the set incoherent rather than
  // merely aggressive: macros that do not add up to the calorie figure mean the
  // scheduler is chasing two different days at once.
  if (Math.abs(macroKcal - targets.kcal) > targets.kcal * MACRO_SUM_TOLERANCE) {
    violations.push({ kcal: targets.kcal, kind: 'macros_do_not_sum', macroKcal });
  }

  return violations;
}

/**
 * The macro split for a calorie figure.
 *
 * Protein is capped by `MAX_PROTEIN_KCAL_SHARE` before carbohydrate takes the
 * remainder, and that ordering is the fix for a real hole: carbohydrate used to
 * be `max(remaining, 0)`, so when protein and fat together exceeded the calorie
 * figure the shortfall vanished into a clamp and the macros silently stopped
 * summing to the target. Capping protein means the remainder is never negative,
 * so nothing needs clamping and the set always adds up.
 */
export function macrosForKcal(kcal: number, weightKg: number, goal: GoalType): NutritionTargets {
  const proteinG = Math.round(Math.min(weightKg * PROTEIN_G_PER_KG[goal], (kcal * MAX_PROTEIN_KCAL_SHARE) / KCAL_PER_G.protein));
  const fatG = Math.round((kcal * FAT_FRACTION_OF_KCAL) / KCAL_PER_G.fat);
  const carbsG = Math.round((kcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat) / KCAL_PER_G.carbs);

  return { carbsG, fatG, fiberG: Math.round((kcal / 1000) * FIBER_G_PER_1000_KCAL), kcal: Math.round(kcal), proteinG };
}

/**
 * Daily kcal + macro split for a plan cycle.
 *
 * Computed here, in code, and never asked of a model — this is the number every
 * downstream safety check compares against, and a hallucinated one would be
 * invisible until it had already shaped fourteen days of food.
 *
 * The floor in `MINIMUM_DAILY_KCAL` is hard: an aggressive pace is clamped, not
 * honoured. The derivation says which bound bound, so the caller can tell the
 * user their pace was reduced rather than silently ignoring them.
 *
 * Throws `TargetsUnreachableError` if the result is not something a plan could
 * satisfy. That should be unreachable — the split is coherent by construction —
 * which is exactly why it is an assertion and not a returned error: if it fires,
 * the equations above are wrong and no plan built on them would be worth having.
 */
export function nutritionTargets(input: TargetInput): NutritionTargets & { readonly derivation: TargetDerivation } {
  const bounds = targetBounds(input);
  const losing = input.goal === 'weight_loss';
  const gaining = input.goal === 'muscle_gain';

  // Magnitude only. The goal is the single source of direction, so a pace typed
  // without a minus sign can no longer invert the plan.
  const paceKgPerWeek = Math.abs(input.paceKgPerWeek ?? (losing ? DEFAULT_PACE.loss : DEFAULT_PACE.gain));
  const magnitude = (paceKgPerWeek * KCAL_PER_KG_OF_BODY_MASS) / DAYS_PER_WEEK;
  const requestedKcal = losing ? bounds.maintenanceKcal - magnitude : gaining ? bounds.maintenanceKcal + magnitude : bounds.maintenanceKcal;
  const kcal = Math.min(Math.max(requestedKcal, bounds.floorKcal), bounds.ceilingKcal);
  const targets = macrosForKcal(kcal, input.weightKg, input.goal);

  const violations = targetViolations(targets, bounds);

  if (violations.length > 0) {throw new TargetsUnreachableError(violations);}

  return {
    ...targets,
    derivation: {
      activityFactor: ACTIVITY_FACTOR[input.activityLevel],
      basalMetabolicRateKcal: Math.round(basalMetabolicRate(input)),
      ceilingKcal: Math.round(bounds.ceilingKcal),
      clampedBy: requestedKcal < bounds.floorKcal ? 'floor' : requestedKcal > bounds.ceilingKcal ? 'ceiling' : null,
      equation: 'mifflin-st-jeor',
      floorKcal: Math.round(bounds.floorKcal),
      goal: input.goal,
      maintenanceKcal: Math.round(bounds.maintenanceKcal),
      paceKgPerWeek,
      requestedKcal: Math.round(requestedKcal)
    }
  };
}

/**
 * The computed targets, the user's correction, and which of them is in effect.
 *
 * A stored override is re-checked against the *current* bounds on every read,
 * not only when it was written. Someone can set a target and then change their
 * weight or activity, and an override that was reasonable in June is not
 * automatically reasonable in September. When that happens the override is set
 * aside rather than applied or deleted — deleting would lose a deliberate
 * choice, applying would honour a number we no longer stand behind.
 *
 * An override that names only calories has its macros re-derived from that
 * figure, so the set stays coherent. That is what a null column means: not
 * "leave the old macros", but "compute this one from whatever is in effect".
 */
export function resolveTargets(input: TargetInput, override: TargetOverride | null): ResolvedTargets {
  const bounds = targetBounds(input);
  const computed = nutritionTargets(input);
  const { derivation, ...computedTargets } = computed;

  if (!override || (override.kcal === null && override.proteinG === null && override.carbsG === null && override.fatG === null)) {
    return { bounds, computed: computedTargets, derivation, effective: computedTargets, overrideStatus: 'none', overrideViolations: [] };
  }

  const kcal = override.kcal ?? computedTargets.kcal;
  const derived = macrosForKcal(kcal, input.weightKg, input.goal);
  const proteinG = override.proteinG ?? derived.proteinG;
  const fatG = override.fatG ?? derived.fatG;
  // Carbohydrate absorbs the remainder unless the user named it, so a corrected
  // calorie figure stays consistent with the macros without three more inputs.
  const carbsG = override.carbsG ?? Math.round((kcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat) / KCAL_PER_G.carbs);
  const candidate: NutritionTargets = { carbsG: Math.max(carbsG, 0), fatG, fiberG: derived.fiberG, kcal, proteinG };
  const overrideViolations = targetViolations(candidate, bounds);

  return {
    bounds,
    computed: computedTargets,
    derivation,
    effective: overrideViolations.length > 0 ? computedTargets : candidate,
    overrideStatus: overrideViolations.length > 0 ? 'stale' : 'applied',
    overrideViolations
  };
}

/** Whole years between `birthDate` and `on`. */
export function ageInYears(birthDate: string, on: Date = new Date()): number {
  const born = new Date(birthDate);
  let age = on.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = on.getUTCMonth() - born.getUTCMonth();

  if (monthDelta < 0 || (monthDelta === 0 && on.getUTCDate() < born.getUTCDate())) {age -= 1;}

  return age;
}
