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
    expect(canPlace('paella', 'lunch', 3, placements(['paella', 'lunch', 1]))).toBe(true);
  });

  it('allows the same dish in a different slot on the next day', () => {
    expect(canPlace('paella', 'dinner', 2, placements(['paella', 'lunch', 1]))).toBe(true);
  });

  it('blocks a dish that has hit the per-plan cap', () => {
    const used = placements(['paella', 'lunch', 1], ['paella', 'lunch', 4], ['paella', 'dinner', 7]);

    expect(used).toHaveLength(VARIETY_RULES.maxOccurrencesPerPlan);
    expect(canPlace('paella', 'lunch', 10, used)).toBe(false);
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

  it('flags a fourth appearance across the plan', () => {
    const found = varietyViolations([day(1, ['a']), day(3, ['a']), day(5, ['a']), day(7, ['a'])]);

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ dayIndex: 7, kind: 'too_many_occurrences' });
  });
});
