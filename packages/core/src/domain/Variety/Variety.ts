import type { MealSlot, PlanDayAssignment } from 'core/entities/Plan';

/**
 * What "varied" means, as numbers rather than as a hope expressed to a model.
 *
 * **At most twice in a fortnight, and never within four days.** That is: no dish
 * comes round more than once a week, and never in the same part of the week.
 *
 * These were three and two, and the arithmetic of that is worse than it sounds:
 * three appearances with a two-day floor puts the same lunch on Monday,
 * Wednesday and Friday and calls it varied. The owner's report — "certain meals
 * are repeated each week" — was not a scheduling accident, it was this rule
 * working as written.
 *
 * The cost is real and worth naming: the minimum distinct dishes per slot goes
 * from `ceil(14/3)` = 5 to `ceil(14/2)` = 7, so every generation asks the model
 * for more, and a thin reuse library makes `GENERATION_POOL_TOO_SMALL` likelier.
 * Variety is the thing the user notices; pool size is the thing the operator
 * notices, and `PoolBuilder` carries slack over the floor for exactly this.
 */
export const VARIETY_RULES = { maxOccurrencesPerPlan: 2, minDaysBetweenSameSlot: 4 } as const;

export type VarietyViolation = {
  readonly dayIndex: number;
  readonly dishSlug: string;
  readonly kind: 'repeated_in_slot_too_soon' | 'too_many_occurrences';
  readonly slot: MealSlot;
};

/** Placements made so far, in the order the scheduler made them. */
export type Placement = { readonly dayIndex: number; readonly dishSlug: string; readonly slot: MealSlot };

/**
 * Whether a dish may go in this slot on this day, given what is already placed.
 *
 * The scheduler asks this before every placement, so violations are prevented
 * rather than detected — `varietyViolations` exists to prove that, not to drive it.
 */
export function canPlace(dishSlug: string, slot: MealSlot, dayIndex: number, placed: readonly Placement[]): boolean {
  const occurrences = placed.filter(placement => placement.dishSlug === dishSlug).length;

  if (occurrences >= VARIETY_RULES.maxOccurrencesPerPlan) {
    return false;
  }

  return !placed.some(
    placement =>
      placement.dishSlug === dishSlug && placement.slot === slot && Math.abs(placement.dayIndex - dayIndex) < VARIETY_RULES.minDaysBetweenSameSlot
  );
}

/** Audits a finished assignment. Used by `validatePlan` and by tests. */
export function varietyViolations(days: readonly PlanDayAssignment[]): readonly VarietyViolation[] {
  const violations: VarietyViolation[] = [];
  const placed: Placement[] = [];

  for (const day of days) {
    for (const meal of day.meals) {
      const placement = { dayIndex: day.dayIndex, dishSlug: meal.dish.slug, slot: meal.slot };

      if (placed.filter(other => other.dishSlug === placement.dishSlug).length >= VARIETY_RULES.maxOccurrencesPerPlan) {
        violations.push({ ...placement, kind: 'too_many_occurrences' });
      } else if (!canPlace(placement.dishSlug, placement.slot, placement.dayIndex, placed)) {
        violations.push({ ...placement, kind: 'repeated_in_slot_too_soon' });
      }

      placed.push(placement);
    }
  }

  return violations;
}
