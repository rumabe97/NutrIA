import { varietyViolations } from 'core/domain/Variety';
import { MINIMUM_DAILY_KCAL, PROTEIN_CEILING_G_PER_KG } from 'core/entities/Nutrition';
import type { MealSlot, PlanAssignment } from 'core/entities/Plan';
import type { NutritionTargets } from 'core/entities/Nutrition';
import type { VarietyViolation } from 'core/domain/Variety';

/**
 * How far a day may drift from target before the plan is rejected.
 *
 * **Energy is symmetric**: a calorie goal is missed by overshooting as surely as by
 * undershooting, so both directions are held to 10%.
 *
 * **Protein is not**, and its ceiling is not a percentage at all.
 *
 * The floor is what the goal depends on: too little and a deficit costs muscle. But
 * the *ceiling* is a safety question, and safety is a function of body mass, not of
 * a target that itself shifts with the goal — 1.6 g/kg for maintenance, 1.9 for
 * muscle gain. Expressing the ceiling as "+35% of target" made it stricter for
 * someone maintaining than for someone bulking, which is precisely backwards.
 *
 * `PROTEIN_CEILING_G_PER_KG` — defined in `core/entities/Nutrition`, because the
 * same ceiling has to bound a *target* before a plan is built around it — is a
 * sanity bound, not a recommendation. Intakes
 * around 2 g/kg are ordinary for trained people and well above target by design;
 * 3 g/kg is where a plan stops looking like food and starts looking like a bug.
 *
 * This was a symmetric ±15% until a plan carrying 204 g against a 171 g target was
 * discarded, then a percentage ceiling until one carrying 233 g was. Both were
 * nutritionally unremarkable. The rule was wrong twice because it measured the
 * wrong thing.
 */
export const PLAN_TOLERANCE = { kcal: 0.1, proteinUnder: 0.15 } as const;

export type PlanViolation =
  | { readonly actual: number; readonly dayIndex: number; readonly kind: 'below_minimum_kcal'; readonly minimum: number }
  | { readonly actual: number; readonly dayIndex: number; readonly kind: 'kcal_out_of_band' | 'protein_out_of_band'; readonly target: number; readonly tolerance: number }
  | { readonly actual: number; readonly expected: number; readonly kind: 'wrong_day_count'; }
  | { readonly dayIndex: number; readonly kind: 'empty_day' }
  | { readonly dayIndex: number; readonly kind: 'missing_slot'; readonly slot: MealSlot }
  | { readonly kind: 'variety'; readonly violation: VarietyViolation };

export type ValidationInput = {
  readonly assignment: PlanAssignment;
  readonly expectedDays: number;
  readonly expectedSlots: readonly MealSlot[];
  readonly sex: 'female' | 'male' | 'other' | 'prefer_not_to_say';
  readonly targets: NutritionTargets;
  /** Body mass, because the protein ceiling is a function of it. */
  readonly weightKg: number;
};

/**
 * The gate a plan passes before anything is written.
 *
 * Returns every violation rather than the first, for the same reason the allergy
 * validator does: a generation that fails on three counts should surface three,
 * not send the pipeline round the loop three times.
 */
export function validatePlan(input: ValidationInput): readonly PlanViolation[] {
  const violations: PlanViolation[] = [];
  const { days } = input.assignment;
  const floor = MINIMUM_DAILY_KCAL[input.sex === 'male' ? 'male' : 'female'];

  if (days.length !== input.expectedDays) {
    violations.push({ actual: days.length, expected: input.expectedDays, kind: 'wrong_day_count' });
  }

  for (const day of days) {
    if (day.meals.length === 0) {
      violations.push({ dayIndex: day.dayIndex, kind: 'empty_day' });
      continue;
    }

    for (const slot of input.expectedSlots) {
      if (!day.meals.some(meal => meal.slot === slot)) {violations.push({ dayIndex: day.dayIndex, kind: 'missing_slot', slot });}
    }

    if (day.totals.kcal < floor) {
      violations.push({ actual: day.totals.kcal, dayIndex: day.dayIndex, kind: 'below_minimum_kcal', minimum: floor });
    }

    if (outOfBand(day.totals.kcal, input.targets.kcal, PLAN_TOLERANCE.kcal)) {
      violations.push({ actual: day.totals.kcal, dayIndex: day.dayIndex, kind: 'kcal_out_of_band', target: input.targets.kcal, tolerance: PLAN_TOLERANCE.kcal });
    }

    if (day.totals.proteinG < input.targets.proteinG * (1 - PLAN_TOLERANCE.proteinUnder) || day.totals.proteinG > input.weightKg * PROTEIN_CEILING_G_PER_KG) {
      violations.push({
        actual: day.totals.proteinG,
        dayIndex: day.dayIndex,
        kind: 'protein_out_of_band',
        target: input.targets.proteinG,
        tolerance: PLAN_TOLERANCE.proteinUnder
      });
    }
  }

  for (const violation of varietyViolations(days)) {violations.push({ kind: 'variety', violation });}

  return violations;
}

function outOfBand(actual: number, target: number, tolerance: number): boolean {
  return Math.abs(actual - target) > target * tolerance;
}

