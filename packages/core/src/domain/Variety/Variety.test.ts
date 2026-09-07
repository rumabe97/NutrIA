import { describe, expect, it } from 'vitest';

import { canPlace, VARIETY_RULES, varietyViolations } from 'core/domain/Variety';
import type { Placement } from 'core/domain/Variety';
import type { PlanDayAssignment } from 'core/entities/Plan';

import { makeDish } from '#test/fixtures';

function placements(...entries: readonly [string, PlanDayAssignment['meals'][number]['slot'], number][]): Placement[] {
  return entries.map(([dishSlug, slot, dayIndex]) => ({ dayIndex, dishSlug, slot }));
}

describe('canPlace', () => {
  it('allows a dish never used', () => {
    expect(canPlace('paella', 'lunch', 1, [])).toBe(true);
  });

  it('blocks the same dish in the same slot on the next day', () => {
    expect(canPlace('paella', 'lunch', 2, placements(['paella', 'lunch', 1]))).toBe(false);
  });

  it('allows it again once the gap is wide enough', () => {
    const clear = 1 + VARIETY_RULES.minDaysBetweenSameSlot;

    expect(canPlace('paella', 'lunch', clear - 1, placements(['paella', 'lunch', 1]))).toBe(false);
    expect(canPlace('paella', 'lunch', clear, placements(['paella', 'lunch', 1]))).toBe(true);
  });

  it('allows the same dish in a different slot on the next day', () => {
    expect(canPlace('paella', 'dinner', 2, placements(['paella', 'lunch', 1]))).toBe(true);
  });

  it('blocks a dish that has hit the per-plan cap', () => {
    const used = placements(['paella', 'lunch', 1], ['paella', 'dinner', 7]);

    expect(used).toHaveLength(VARIETY_RULES.maxOccurrencesPerPlan);
    // Far enough away that only the cap can be what refuses it.
    expect(canPlace('paella', 'lunch', 14, used)).toBe(false);
  });

  /**
   * The numbers themselves, pinned.
   *
   * Everything else here derives from `VARIETY_RULES`, which is right for the
   * *rule* and useless for the *policy*: a test that derives everything passes
   * whatever the policy becomes. This one fails if someone loosens it, which is
   * the change worth noticing — "certain meals are repeated each week" was this
   * pair of numbers, not a scheduling bug.
   */
  it('is at most twice a fortnight, never within four days', () => {
    expect(VARIETY_RULES).toEqual({ maxOccurrencesPerPlan: 2, minDaysBetweenSameSlot: 4 });
  });

  it('does not let one dish be blocked by another dish history', () => {
    expect(canPlace('lentejas', 'lunch', 2, placements(['paella', 'lunch', 1]))).toBe(true);
  });
});

describe('varietyViolations', () => {
  function day(dayIndex: number, slugs: readonly string[]): PlanDayAssignment {
    return {
      dayIndex,
      meals: slugs.map((slug, index) => ({
        dish: makeDish({ slug }),
        ingredients: [],
        macros: { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 },
        servings: 1,
        slot: 'lunch' as const,
        sortOrder: index
      })),
      totals: { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 }
    };
  }

  it('finds nothing in a varied plan', () => {
    expect(varietyViolations([day(1, ['a']), day(2, ['b']), day(3, ['c'])])).toEqual([]);
  });

  it('flags the same dish in the same slot on consecutive days', () => {
    const found = varietyViolations([day(1, ['a']), day(2, ['a'])]);

    expect(found).toHaveLength(1);
    expect(found[0]?.kind).toBe('repeated_in_slot_too_soon');
  });

  it('flags the appearance that exceeds the per-plan cap', () => {
    // Spaced well clear of the gap rule, so the only thing left to trip is the cap.
    const found = varietyViolations([day(1, ['a']), day(6, ['a']), day(11, ['a'])]);

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ dayIndex: 11, kind: 'too_many_occurrences' });
  });

  it('flags a repeat inside the gap even when the cap is not reached', () => {
    const found = varietyViolations([day(1, ['a']), day(3, ['a'])]);

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ dayIndex: 3, kind: 'repeated_in_slot_too_soon' });
  });
});
