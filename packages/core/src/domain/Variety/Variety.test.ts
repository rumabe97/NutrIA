import { describe, expect, it } from 'vitest';

import { canPlace, VARIETY_RULES, varietyViolations } from 'core/domain/Variety';
import type { Placement, VarietyViolation } from 'core/domain/Variety';
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

  /**
   * A dish that suits lunch and dinner was dinner one day and lunch the next
   * on a real plan: the slot gap never saw it, because the slots differed.
   */
  it('blocks the same dish in another slot on the same day or the next', () => {
    expect(canPlace('paella', 'dinner', 1, placements(['paella', 'lunch', 1]))).toBe(false);
    expect(canPlace('paella', 'dinner', 2, placements(['paella', 'lunch', 1]))).toBe(false);
    expect(canPlace('paella', 'lunch', 1, placements(['paella', 'dinner', 2]))).toBe(false);
  });

  it('allows it in another slot once the plan-wide gap has passed', () => {
    expect(canPlace('paella', 'dinner', 1 + VARIETY_RULES.minDaysBetween, placements(['paella', 'lunch', 1]))).toBe(true);
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
  it('is at most twice a fortnight, never within four days in one slot, never on consecutive days', () => {
    expect(VARIETY_RULES).toEqual({ maxOccurrencesPerPlan: 2, minDaysBetween: 2, minDaysBetweenSameSlot: 4 });
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

  // These days each hold one meal, so a repeated dish also makes the two days
  // identical — `identical_day` is filtered out below so each test still
  // proves only the per-dish rule it names; `identical_day` gets its own
  // `describe` further down.
  const perDish = (found: readonly VarietyViolation[]) => found.filter(violation => violation.kind !== 'identical_day');

  it('flags the same dish in the same slot on consecutive days', () => {
    const found = perDish(varietyViolations([day(1, ['a']), day(2, ['a'])]));

    expect(found).toHaveLength(1);
    expect(found[0]?.kind).toBe('repeated_in_slot_too_soon');
  });

  it('flags the appearance that exceeds the per-plan cap', () => {
    // Spaced well clear of the gap rule, so the only thing left to trip is the cap.
    const found = perDish(varietyViolations([day(1, ['a']), day(6, ['a']), day(11, ['a'])]));

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ dayIndex: 11, kind: 'too_many_occurrences' });
  });

  it('flags a repeat inside the gap even when the cap is not reached', () => {
    const found = perDish(varietyViolations([day(1, ['a']), day(3, ['a'])]));

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ dayIndex: 3, kind: 'repeated_in_slot_too_soon' });
  });

  it('flags the same dish back to back in different slots as its own kind', () => {
    const dinner = { ...day(1, ['a']), meals: day(1, ['a']).meals.map(meal => ({ ...meal, slot: 'dinner' as const })) };
    const found = perDish(varietyViolations([dinner, day(2, ['a'])]));

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ dayIndex: 2, kind: 'repeated_too_soon', slot: 'lunch' });
  });
});

describe('varietyViolations — no two days the same (owner, 2026-09-26)', () => {
  function day(dayIndex: number, dishes: readonly (readonly [string, PlanDayAssignment['meals'][number]['slot']])[]): PlanDayAssignment {
    return {
      dayIndex,
      meals: dishes.map(([slug, slot], index) => ({
        dish: makeDish({ slug }),
        ingredients: [],
        macros: { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 },
        servings: 1,
        slot,
        sortOrder: index
      })),
      totals: { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 }
    };
  }

  it('finds nothing when every day has a different set of dishes', () => {
    const days = [
      day(1, [
        ['a', 'lunch'],
        ['b', 'dinner']
      ]),
      day(2, [
        ['a', 'lunch'],
        ['c', 'dinner']
      ])
    ];

    expect(varietyViolations(days).filter(violation => violation.kind === 'identical_day')).toEqual([]);
  });

  it('flags a day whose exact set of dishes repeats an earlier one', () => {
    const days = [
      day(1, [
        ['a', 'lunch'],
        ['b', 'dinner']
      ]),
      day(8, [
        ['a', 'lunch'],
        ['b', 'dinner']
      ])
    ];
    const found = varietyViolations(days).filter(violation => violation.kind === 'identical_day');

    expect(found).toEqual([{ dayIndex: 8, kind: 'identical_day', matchesDayIndex: 1 }]);
  });

  it('does not care which slot each dish sits in, only the set', () => {
    // Swapped which is lunch and which is dinner — still the same two plates.
    const days = [
      day(1, [
        ['a', 'lunch'],
        ['b', 'dinner']
      ]),
      day(9, [
        ['a', 'dinner'],
        ['b', 'lunch']
      ])
    ];
    const found = varietyViolations(days).filter(violation => violation.kind === 'identical_day');

    expect(found).toEqual([{ dayIndex: 9, kind: 'identical_day', matchesDayIndex: 1 }]);
  });

  it('reports every later day that repeats the first one seen with that set', () => {
    const days = [day(1, [['a', 'lunch']]), day(6, [['a', 'lunch']]), day(11, [['b', 'lunch']])];
    const found = varietyViolations(days).filter(violation => violation.kind === 'identical_day');

    expect(found).toEqual([{ dayIndex: 6, kind: 'identical_day', matchesDayIndex: 1 }]);
  });
});
