import { describe, expect, it } from 'vitest';

import { kindCap, kindCrowded, kindExcess, kindMeals, kindsCrowded, kindsExcess } from 'core/domain/Variety';

import type { KindCheck, KindMeal, KindRule } from 'core/domain/Variety';

const APART: KindRule = { apart: true, perFortnight: 3 };
const LOOSE: KindRule = { apart: false, perFortnight: 3 };

function meal(kind: string, dayIndex: number): KindMeal {
  return { dayIndex, kind };
}

describe('kind rules', () => {
  it('scale the cap to the plan, one at least', () => {
    expect(kindCap(APART, 14)).toBe(3);
    expect(kindCap(APART, 7)).toBe(2);
    expect(kindCap(APART, 1)).toBe(1);
  });

  it('count each meal past the cap, kind by kind', () => {
    expect(
      kindExcess(
        [1, 4, 7].map(day => meal('garbanzos', day)),
        14,
        APART
      )
    ).toBe(0);
    expect(
      kindExcess(
        [1, 4, 7, 10].map(day => meal('garbanzos', day)),
        14,
        APART
      )
    ).toBe(1);
    expect(kindExcess([...[1, 4, 7].map(day => meal('garbanzos', day)), ...[2, 5, 8].map(day => meal('lentejas', day))], 14, APART)).toBe(0);
  });

  it('count days running and a second one on a day only when the rule keeps a kind apart', () => {
    expect(kindExcess([meal('garbanzos', 3), meal('garbanzos', 4)], 14, APART)).toBe(1);
    expect(kindExcess([meal('garbanzos', 3), meal('garbanzos', 3)], 14, APART)).toBe(1);
    expect(kindExcess([meal('yogur', 3), meal('yogur', 4), meal('yogur', 4)], 14, LOOSE)).toBe(0);
  });

  it('crowd a meal beside its kind, or past the cap', () => {
    expect(kindCrowded('garbanzos', 5, [meal('garbanzos', 4)], 14, APART)).toBe(true);
    expect(kindCrowded('garbanzos', 6, [meal('garbanzos', 4)], 14, APART)).toBe(false);
    expect(kindCrowded('yogur', 5, [meal('yogur', 4)], 14, LOOSE)).toBe(false);
    expect(
      kindCrowded(
        'yogur',
        13,
        [1, 5, 9].map(day => meal('yogur', day)),
        14,
        LOOSE
      )
    ).toBe(true);
    expect(kindCrowded(null, 5, [meal('garbanzos', 5)], 14, APART)).toBe(false);
  });

  it('apply a check to placements: its slots only, a placement’s named kind first, nothing for a dish outside the pool', () => {
    const check: KindCheck = {
      index: new Map([
        ['cuenco', 'yogur'],
        ['tosta', 'pan']
      ]),
      named: placement => (placement.dishSlug === 'kept' ? 'yogur' : undefined),
      rule: LOOSE,
      slots: new Set(['morning_snack'])
    };
    const placements = [
      { dayIndex: 1, dishSlug: 'cuenco', slot: 'morning_snack' as const },
      { dayIndex: 2, dishSlug: 'cuenco', slot: 'breakfast' as const },
      { dayIndex: 3, dishSlug: 'kept', slot: 'morning_snack' as const },
      { dayIndex: 4, dishSlug: 'unknown', slot: 'morning_snack' as const }
    ];

    expect(kindMeals(placements, check)).toEqual([meal('yogur', 1), meal('yogur', 3)]);
    expect(
      kindsExcess(
        [...placements, { dayIndex: 5, dishSlug: 'cuenco', slot: 'morning_snack' }, { dayIndex: 6, dishSlug: 'cuenco', slot: 'morning_snack' }],
        [check],
        14
      )
    ).toBe(1);
    expect(kindsCrowded('cuenco', 'morning_snack', 9, [[1, 3, 5].map(day => meal('yogur', day))], [check], 14)).toBe(1);
    expect(kindsCrowded('cuenco', 'breakfast', 9, [[1, 3, 5].map(day => meal('yogur', day))], [check], 14)).toBe(0);
    expect(kindsCrowded('tosta', 'morning_snack', 9, [[1, 3, 5].map(day => meal('yogur', day))], [check], 14)).toBe(0);
  });
});
