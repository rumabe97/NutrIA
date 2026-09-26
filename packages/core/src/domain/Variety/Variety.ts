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
 *
 * **And never on the same day or the next, whatever the meal.** The four-day
 * gap was per slot, so a dish that suits both lunch and dinner could be dinner
 * on Tuesday and lunch on Wednesday — a real plan served the same tuna salad
 * back to back that way, twice at two and a quarter servings.
 */
export const VARIETY_RULES = { maxOccurrencesPerPlan: 2, minDaysBetween: 2, minDaysBetweenSameSlot: 4 } as const;

/**
 * The meals a repeat reads strongest in — a person notices "chicken again" at
 * lunch or dinner far more than at a snack (`0051`'s own reasoning for why a
 * main protein's cap is priced, not a snack's). Named exactly as the owner
 * did, 2026-09-26: "a repeat of a main (lunch/dinner)".
 */
export const MAIN_SLOTS: ReadonlySet<MealSlot> = new Set(['lunch', 'dinner']);

/**
 * How far apart a repeated main should land, when the pool has the dishes to
 * put there — not a wall like `minDaysBetweenSameSlot`: the owner's own
 * words were "as far apart as possible (at least seven days where the pool
 * allows)", which is a preference the scheduler pays to fall short of
 * (`MAIN_GAP_SHORTFALL_WEIGHT` in `core/domain/Scheduler`), the same way
 * every variety rule since `0009` is a cost, never a refusal that leaves a
 * thin pool with no plan at all.
 */
export const PREFERRED_MAIN_GAP = 7;

export type VarietyViolation =
  | {
      readonly dayIndex: number;
      readonly dishSlug: string;
      readonly kind: 'repeated_in_slot_too_soon' | 'repeated_too_soon' | 'too_many_occurrences';
      readonly slot: MealSlot;
    }
  | {
      readonly dayIndex: number;
      readonly kind: 'identical_day';
      /** The earlier day whose exact set of dishes this one repeats. */
      readonly matchesDayIndex: number;
    };

/** The days that must separate two servings of one dish: the slot's own gap, or the plan-wide one. */
function gapBetween(slot: MealSlot, other: MealSlot): number {
  return slot === other ? VARIETY_RULES.minDaysBetweenSameSlot : VARIETY_RULES.minDaysBetween;
}

/** Placements made so far, in the order the scheduler made them. */
export type Placement = { readonly dayIndex: number; readonly dishSlug: string; readonly slot: MealSlot };

/**
 * How many days separate this day from this dish's nearest placement so far —
 * `null` when it has none yet, which is the case a repeat cost must leave at
 * zero: the first use of a dish is never a repeat.
 */
export function nearestGap(dishSlug: string, dayIndex: number, placed: readonly Placement[]): number | null {
  const gaps = placed.filter(placement => placement.dishSlug === dishSlug).map(placement => Math.abs(placement.dayIndex - dayIndex));

  return gaps.length === 0 ? null : Math.min(...gaps);
}

/**
 * A day's set of dishes, as a single key — what "the same day" means (owner,
 * 2026-09-26): the dish set, not which slot each sits in. Paella at lunch and
 * lentils at dinner is the same day as lentils at lunch and paella at dinner —
 * a person served the same two plates either way.
 */
function daySignature(day: PlanDayAssignment): string {
  return [...day.meals]
    .map(meal => meal.dish.slug)
    .sort()
    .join('|');
}

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

  return !placed.some(placement => placement.dishSlug === dishSlug && Math.abs(placement.dayIndex - dayIndex) < gapBetween(slot, placement.slot));
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
        const inSlot = placed.some(
          other =>
            other.dishSlug === placement.dishSlug &&
            other.slot === placement.slot &&
            Math.abs(other.dayIndex - placement.dayIndex) < VARIETY_RULES.minDaysBetweenSameSlot
        );

        violations.push({ ...placement, kind: inSlot ? 'repeated_in_slot_too_soon' : 'repeated_too_soon' });
      }

      placed.push(placement);
    }
  }

  // No two days may serve the exact same dishes (owner, 2026-09-26) — a hard
  // rule, like the two above. `enforceDistinctDays` in `core/domain/Scheduler`
  // is what prevents it; this is the same "prove it, don't drive it" audit as
  // every other violation here, and the one case it does not fully prevent: a
  // pool so thin that no alternative existed for the day that repeated.
  const signatures = new Map<string, number>();

  for (const day of days) {
    const signature = daySignature(day);
    const firstDayIndex = signatures.get(signature);

    if (firstDayIndex === undefined) {
      signatures.set(signature, day.dayIndex);
    } else {
      violations.push({ dayIndex: day.dayIndex, kind: 'identical_day', matchesDayIndex: firstDayIndex });
    }
  }

  return violations;
}
