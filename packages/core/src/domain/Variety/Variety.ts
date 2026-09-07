import type { MealSlot, PlanDayAssignment } from 'core/entities/Plan';

/**
 * What "varied" means, as numbers rather than as a hope expressed to a model.
 *
 * Three appearances across a fortnight is roughly once every five days — often
 * enough to reuse something the user liked, rare enough that the plan does not
 * read as a loop. The consecutive-day rule matters more than the cap: the same
 * lunch two days running is the thing people actually notice.
 */
export const VARIETY_RULES = { maxOccurrencesPerPlan: 3, minDaysBetweenSameSlot: 2 } as const;

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

  if (occurrences >= VARIETY_RULES.maxOccurrencesPerPlan) {return false;}

  return !placed.some(
    placement =>
      placement.dishSlug === dishSlug &&
      placement.slot === slot &&
      Math.abs(placement.dayIndex - dayIndex) < VARIETY_RULES.minDaysBetweenSameSlot
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
