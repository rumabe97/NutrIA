import { describe, expect, it } from 'vitest';

import {
  kindAtCap,
  kindCap,
  kindCrowded,
  kindExcess,
  kindExcessWith,
  kindMeals,
  kindPastCap,
  kindsCrowded,
  kindsExcess,
  kindTally
} from 'core/domain/Variety';

import type { KindCheck, KindMeal, KindRule } from 'core/domain/Variety';

const APART: KindRule = { apart: true, fixedSpendsCap: false, perFortnight: 3 };
const LOOSE: KindRule = { apart: false, fixedSpendsCap: false, perFortnight: 3 };
/** A health maximum: what somebody fixed still counts (`0099`). */
const SPENT: KindRule = { apart: false, fixedSpendsCap: true, perFortnight: 3 };

function meal(kind: string, dayIndex: number): KindMeal {
  return { dayIndex, kind };
}

/** The same meal, fixed to that day by the person (`0098`). */
function fixed(kind: string, dayIndex: number): KindMeal {
  return { dayIndex, fixed: true, kind };
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

  it('count the cap alone, kind by kind, and tell a meal that would pass it wherever it lands (0081)', () => {
    const four = [1, 2, 3, 4].map(day => meal('garbanzos', day));

    expect(kindPastCap(four, 14, APART)).toBe(1);
    expect(kindPastCap([...four.slice(0, 3), meal('lentejas', 4)], 14, APART)).toBe(0);
    expect(kindAtCap('garbanzos', four.slice(0, 3), 14, APART)).toBe(true);
    expect(kindAtCap('garbanzos', four.slice(0, 2), 14, APART)).toBe(false);
    expect(kindAtCap(null, four, 14, APART)).toBe(false);
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

  it('spend a variety cap on the generator’s own meals and a health maximum on every one (0099)', () => {
    // Three of four is inside the cap of three; the fourth is the question.
    const three = [1, 4, 7].map(day => meal('garbanzos', day));

    expect(kindExcess([...three, fixed('garbanzos', 10)], 14, APART)).toBe(0);
    expect(kindExcess([...three, meal('garbanzos', 10)], 14, APART)).toBe(1);
    expect(kindExcess([...three, fixed('garbanzos', 10)], 14, SPENT)).toBe(1);
    // A rule whose cap the fixed meal does not spend still gets the days running.
    expect(kindExcess([meal('garbanzos', 3), fixed('garbanzos', 4)], 14, APART)).toBe(1);
    expect(kindExcess([fixed('garbanzos', 3), fixed('garbanzos', 3)], 14, APART)).toBe(1);
  });

  it('keep a fixed meal out of the cap wherever the cap is read (0099)', () => {
    const four = [...[1, 4, 7].map(day => meal('garbanzos', day)), fixed('garbanzos', 10)];

    expect(kindPastCap(four, 14, APART)).toBe(0);
    expect(kindPastCap(four, 14, SPENT)).toBe(1);
    expect(kindAtCap('garbanzos', [...[1, 4].map(day => meal('garbanzos', day)), fixed('garbanzos', 7)], 14, APART)).toBe(false);
    expect(kindAtCap('garbanzos', [...[1, 4].map(day => meal('garbanzos', day)), fixed('garbanzos', 7)], 14, SPENT)).toBe(true);
    // Crowding: the cap forgives it, being beside it never does.
    expect(kindCrowded('garbanzos', 13, [...[1, 5].map(day => meal('garbanzos', day)), fixed('garbanzos', 9)], 14, APART)).toBe(false);
    expect(kindCrowded('garbanzos', 13, [...[1, 5].map(day => meal('garbanzos', day)), fixed('garbanzos', 9)], 14, SPENT)).toBe(true);
    expect(kindCrowded('garbanzos', 10, [fixed('garbanzos', 9)], 14, APART)).toBe(true);
  });

  it('price a day against the rest of the plan the same way whether or not it holds a fixed meal (0099)', () => {
    // `kindExcessWith` is the search's incremental path, and a tally that lost
    // the flag would charge the day differently from `kindExcess`.
    for (const rule of [APART, LOOSE, SPENT]) {
      for (const day of [[meal('garbanzos', 10)], [fixed('garbanzos', 10)], [fixed('garbanzos', 10), meal('garbanzos', 10)]]) {
        const rest = [...[1, 4].map(index => meal('garbanzos', index)), fixed('garbanzos', 7)];

        expect(kindExcessWith(kindTally(rest), kindExcess(rest, 14, rule), day, 14, rule)).toBe(kindExcess([...rest, ...day], 14, rule));
      }
    }
  });

  it('read a placement’s fixed flag into the meal it counts (0099)', () => {
    const check: KindCheck = { index: new Map([['arroz', 'rice']]), rule: APART };

    expect(
      kindMeals(
        [
          { dayIndex: 1, dishSlug: 'arroz', slot: 'lunch' },
          { dayIndex: 2, dishSlug: 'arroz', fixed: true, slot: 'lunch' }
        ],
        check
      )
    ).toEqual([meal('rice', 1), fixed('rice', 2)]);
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

  it('count a weighted meal as many times as it weighs, at the cap and in the excess', () => {
    const check: KindCheck = {
      index: new Map([
        ['tortilla', 'eggs'],
        ['revuelto', 'eggs']
      ]),
      rule: { apart: false, fixedSpendsCap: false, perFortnight: 8 },
      weight: placement => (placement.dishSlug === 'tortilla' ? 3 : 1)
    };
    const placed = [1, 3].map(dayIndex => ({ dayIndex, dishSlug: 'tortilla', slot: 'dinner' as const }));

    expect(kindMeals(placed, check)).toHaveLength(6);
    expect(kindsCrowded('revuelto', 'breakfast', 5, [kindMeals(placed, check)], [check], 14)).toBe(0);
    expect(kindsCrowded('tortilla', 'dinner', 5, [kindMeals(placed, check)], [check], 14)).toBe(1);
    expect(kindsExcess([...placed, { dayIndex: 5, dishSlug: 'tortilla', slot: 'dinner' }], [check], 14)).toBe(1);
    expect(kindCrowded('eggs', 5, kindMeals(placed, check), 14, check.rule, 2)).toBe(false);
    expect(kindCrowded('eggs', 5, kindMeals(placed, check), 14, check.rule, 3)).toBe(true);
  });
  it('count the excess of the rest of the plan once, and the kinds a day brings again, to the same figure', () => {
    const rest = [meal('pasta', 1), meal('pasta', 3), meal('pasta', 4), meal('arroz', 2), meal('arroz', 9), meal('quinoa', 12)];
    const days = [[], [meal('pasta', 5)], [meal('arroz', 10), meal('arroz', 10)], [meal('pasta', 2), meal('cuscus', 8)], [meal('quinoa', 13)]];

    for (const rule of [APART, LOOSE]) {
      const base = kindExcess(rest, 14, rule);

      for (const day of days) {
        expect(kindExcessWith(kindTally(rest), base, day, 14, rule)).toBe(kindExcess([...rest, ...day], 14, rule));
      }
    }
  });
});
