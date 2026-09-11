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
 *
 * **Carbs and fat have bands too, since `0045`, and every band is 5%.** They
 * had none: a plan could miss its carbohydrate target by 46% on every day of
 * the fortnight and pass, which is what a real plan did, because nothing here
 * asked. The scheduler now fits all four macros and lands inside 5% on nearly
 * every day of a real library, so 5% is the bar this product holds itself to —
 * the owner's word for it was "perfect, or it is no use". These bands are
 * advisory (see `isBlocking`): a day at 7% on fat is delivered and written
 * down, not thrown away, because the person with no plan eats worse still.
 *
 * **Protein gained a band above the target too, in `0048`.** Above it there
 * was only the safety ceiling, so a day 17% over its protein passed as though
 * it had hit it — and a real plan did that on nine days of fourteen, because
 * the library's dishes carry more protein than a high-carbohydrate day wants.
 * The ceiling still blocks and still measures body mass; the band above the
 * target is advice, like the others, and the scheduler prices both.
 */
export const PLAN_TOLERANCE = { carbs: 0.05, fat: 0.05, kcal: 0.05, proteinOver: 0.05, proteinUnder: 0.05 } as const;

export type PlanViolation =
  | { readonly actual: number; readonly ceiling: number; readonly dayIndex: number; readonly kind: 'protein_above_ceiling' }
  | { readonly actual: number; readonly dayIndex: number; readonly kind: 'below_minimum_kcal'; readonly minimum: number }
  | {
      readonly actual: number;
      readonly dayIndex: number;
      readonly kind: 'carbs_out_of_band' | 'fat_out_of_band' | 'kcal_out_of_band' | 'protein_above_target' | 'protein_below_target';
      readonly target: number;
      readonly tolerance: number;
    }
  | { readonly actual: number; readonly expected: number; readonly kind: 'wrong_day_count' }
  | { readonly dayIndex: number; readonly kind: 'empty_day' }
  | { readonly dayIndex: number; readonly kind: 'missing_slot'; readonly slot: MealSlot }
  | { readonly kind: 'variety'; readonly violation: VarietyViolation };

/**
 * Whether a violation is a reason to throw the plan away.
 *
 * Three kinds of thing were being treated as one, and only one of them justifies
 * discarding fourteen days of food:
 *
 * - **Structural** — a missing day, an empty day, a missing meal. The plan is not
 *   a plan. Blocking.
 * - **Safety** — a day under the minimum energy a body needs, or protein above the
 *   sanity ceiling. These are not targets, they are bounds, and the project's rule
 *   is that safety is never softened for convenience. Blocking.
 * - **Guidance** — a day outside the protein band on either side of the
 *   target, or outside the calorie, carbohydrate or fat band. **Advisory.** The targets are an estimate the profile screen already
 *   calls an estimate; missing one by a few per cent on two days out of fourteen
 *   is information, not a fault, and discarding a good plan over it leaves the
 *   user with no plan at all — which serves their nutrition strictly worse than
 *   the plan we threw away.
 *
 * Variety is advisory too: `canPlace` prevents it by construction, so a violation
 * here means a scheduler bug worth logging, not a plan worth destroying.
 */
export function isBlocking(violation: PlanViolation): boolean {
  return BLOCKING_KINDS.has(violation.kind);
}

const BLOCKING_KINDS = new Set<PlanViolation['kind']>([
  'below_minimum_kcal',
  'empty_day',
  'missing_slot',
  'protein_above_ceiling',
  'wrong_day_count'
]);

export type ValidationInput = {
  readonly assignment: PlanAssignment;
  /**
   * Days that eat for something (`0043`), by day index, with the targets they
   * were built to. A loaded day is judged against those, not the plan's: the
   * band asks whether a day hit what it was aiming at, and a day aiming higher
   * on purpose has not drifted. Absent, or absent for a day, the plan's `targets`.
   */
  readonly dayTargets?: ReadonlyMap<number, NutritionTargets>;
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
 *
 * It does not decide what to *do* about them — see `isBlocking`. A caller
 * discards a plan for a broken structure or a broken safety bound, and delivers
 * one that merely drifted from a target it already describes as an estimate.
 */
export function validatePlan(input: ValidationInput): readonly PlanViolation[] {
  const violations: PlanViolation[] = [];
  const { days } = input.assignment;
  const floor = MINIMUM_DAILY_KCAL[input.sex === 'male' ? 'male' : 'female'];

  if (days.length !== input.expectedDays) {
    violations.push({ actual: days.length, expected: input.expectedDays, kind: 'wrong_day_count' });
  }

  for (const day of days) {
    const targets = input.dayTargets?.get(day.dayIndex) ?? input.targets;

    if (day.meals.length === 0) {
      violations.push({ dayIndex: day.dayIndex, kind: 'empty_day' });
      continue;
    }

    for (const slot of input.expectedSlots) {
      if (!day.meals.some(meal => meal.slot === slot)) {
        violations.push({ dayIndex: day.dayIndex, kind: 'missing_slot', slot });
      }
    }

    if (day.totals.kcal < floor) {
      violations.push({ actual: day.totals.kcal, dayIndex: day.dayIndex, kind: 'below_minimum_kcal', minimum: floor });
    }

    if (outOfBand(day.totals.kcal, targets.kcal, PLAN_TOLERANCE.kcal)) {
      violations.push({
        actual: day.totals.kcal,
        dayIndex: day.dayIndex,
        kind: 'kcal_out_of_band',
        target: targets.kcal,
        tolerance: PLAN_TOLERANCE.kcal
      });
    }

    // Symmetric like energy: a carbohydrate target is missed by a day that eats
    // its energy as fat as surely as by one that eats too little, and it was
    // the first of those that went unnoticed for a whole fortnight (`0045`).
    if (outOfBand(day.totals.carbsG, targets.carbsG, PLAN_TOLERANCE.carbs)) {
      violations.push({
        actual: day.totals.carbsG,
        dayIndex: day.dayIndex,
        kind: 'carbs_out_of_band',
        target: targets.carbsG,
        tolerance: PLAN_TOLERANCE.carbs
      });
    }

    if (outOfBand(day.totals.fatG, targets.fatG, PLAN_TOLERANCE.fat)) {
      violations.push({
        actual: day.totals.fatG,
        dayIndex: day.dayIndex,
        kind: 'fat_out_of_band',
        target: targets.fatG,
        tolerance: PLAN_TOLERANCE.fat
      });
    }

    // Three questions, not one: under the band is a goal missed, over the band a
    // goal overshot (`0048`), over the ceiling a bound broken. Only the last is a
    // reason to discard the plan, and it is asked first.
    if (day.totals.proteinG > input.weightKg * PROTEIN_CEILING_G_PER_KG) {
      violations.push({
        actual: day.totals.proteinG,
        ceiling: input.weightKg * PROTEIN_CEILING_G_PER_KG,
        dayIndex: day.dayIndex,
        kind: 'protein_above_ceiling'
      });
    } else if (day.totals.proteinG > targets.proteinG * (1 + PLAN_TOLERANCE.proteinOver)) {
      violations.push({
        actual: day.totals.proteinG,
        dayIndex: day.dayIndex,
        kind: 'protein_above_target',
        target: targets.proteinG,
        tolerance: PLAN_TOLERANCE.proteinOver
      });
    } else if (day.totals.proteinG < targets.proteinG * (1 - PLAN_TOLERANCE.proteinUnder)) {
      violations.push({
        actual: day.totals.proteinG,
        dayIndex: day.dayIndex,
        kind: 'protein_below_target',
        target: targets.proteinG,
        tolerance: PLAN_TOLERANCE.proteinUnder
      });
    }
  }

  for (const violation of varietyViolations(days)) {
    violations.push({ kind: 'variety', violation });
  }

  return violations;
}

function outOfBand(actual: number, target: number, tolerance: number): boolean {
  return Math.abs(actual - target) > target * tolerance;
}
