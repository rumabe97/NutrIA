import { describe, expect, it } from 'vitest';

import { pickReplacement, PLAN_DAYS, schedulePlan, SERVING_BOUNDS, slotsFor } from 'core/domain/Scheduler';
import { VARIETY_RULES, varietyViolations } from 'core/domain/Variety';
import { validatePlan } from 'core/domain/PlanValidation';
import { makeCatalogue, makeCatalogueIngredient, makeDish, makePool, TARGETS } from '#test/fixtures';

import type { NutritionTargets } from 'core/entities/Nutrition';

const catalogue = makeCatalogue();

function schedule(overrides: Partial<Parameters<typeof schedulePlan>[0]> = {}) {
  const slots = overrides.pool ? slotsFor(3, false) : slotsFor(3, false);

  return schedulePlan({ catalogue, includesSnacks: false, mealsPerDay: 3, pool: makePool(slots), targets: TARGETS, ...overrides });
}

describe('slotsFor', () => {
  it('gives three meals the core slots', () => {
    expect(slotsFor(3, false)).toEqual(['breakfast', 'lunch', 'dinner']);
  });

  it('adds an afternoon snack at four meals when the user snacks', () => {
    expect(slotsFor(4, true)).toEqual(['breakfast', 'lunch', 'afternoon_snack', 'dinner']);
  });

  it('adds supper instead when the user does not snack', () => {
    expect(slotsFor(4, false)).toEqual(['breakfast', 'lunch', 'dinner', 'supper']);
  });

  it('returns slots in chronological order, not the order they were added', () => {
    expect(slotsFor(5, true)).toEqual(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']);
  });

  it('never returns more slots than meals requested', () => {
    for (const meals of [2, 3, 4, 5, 6]) {expect(slotsFor(meals, true)).toHaveLength(meals);}
  });
});

describe('schedulePlan', () => {
  it('fills fourteen days by default', () => {
    const result = schedule();

    expect(result.ok).toBe(true);

    if (result.ok) {expect(result.assignment.days).toHaveLength(PLAN_DAYS);}
  });

  it('gives every day every slot, in order', () => {
    const result = schedule();

    expect(result.ok).toBe(true);

    if (!result.ok) {return;}

    for (const day of result.assignment.days) {
      expect(day.meals.map(meal => meal.slot)).toEqual(['breakfast', 'lunch', 'dinner']);
    }
  });

  it('produces a plan with no variety violations at all', () => {
    const result = schedule();

    expect(result.ok).toBe(true);

    if (result.ok) {expect(varietyViolations(result.assignment.days)).toEqual([]);}
  });

  it('keeps every day within 10% of the calorie target', () => {
    const result = schedule();

    expect(result.ok).toBe(true);

    if (!result.ok) {return;}

    for (const day of result.assignment.days) {
      expect(Math.abs(day.totals.kcal - TARGETS.kcal), `day ${day.dayIndex} at ${day.totals.kcal} kcal`).toBeLessThanOrEqual(TARGETS.kcal * 0.1);
    }
  });

  it('is deterministic — the same input gives the same plan', () => {
    const a = schedule();
    const b = schedule();

    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('reports a shortfall rather than a thin plan when a slot has no dishes', () => {
    const result = schedule({ pool: makePool(['breakfast', 'lunch']) });

    expect(result.ok).toBe(false);

    if (!result.ok) {expect(result.shortfall).toMatchObject({ dayIndex: 1, reason: 'insufficient_pool', slot: 'dinner' });}
  });

  it('reports a shortfall when the pool is too small for the variety rules', () => {
    // With one dish per slot the spacing rule bites before the occurrence cap
    // does: the same dish cannot fill the same slot again until the gap has
    // passed, so the plan fails on day 2 whatever that gap is.
    const result = schedule({ pool: makePool(slotsFor(3, false), 1) });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.shortfall.dayIndex).toBe(2);
      // Sanity on the premise: one dish cannot cover a gap of any size.
      expect(VARIETY_RULES.minDaysBetweenSameSlot).toBeGreaterThan(1);
    }
  });

  it('names the day and slot it could not fill, so a retry can ask for exactly that', () => {
    const result = schedule({ pool: makePool(slotsFor(3, false), 2) });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.shortfall.slot).toBe('breakfast');
      expect(result.shortfall.available).toBe(2);
    }
  });

  it('scales servings in quarters, never in fractions a person cannot serve', () => {
    const result = schedule();

    expect(result.ok).toBe(true);

    if (!result.ok) {return;}

    for (const day of result.assignment.days) {
      for (const meal of day.meals) {
        expect(Math.round(meal.servings * 4) / 4, `${meal.dish.slug} at ${meal.servings}`).toBe(meal.servings);
      }
    }
  });

  it('never scales a portion beyond its bounds, even against an extreme target', () => {
    const result = schedule({ targets: { ...TARGETS, kcal: 6000 } });

    expect(result.ok).toBe(true);

    if (!result.ok) {return;}

    for (const day of result.assignment.days) {
      for (const meal of day.meals) {
        // Asserted against the constant, not a literal, so the bound can move
        // without the test needing an edit to agree with it.
        expect(meal.servings).toBeLessThanOrEqual(SERVING_BOUNDS.max);
        expect(meal.servings).toBeGreaterThanOrEqual(SERVING_BOUNDS.min);
      }
    }
  });

  it('leaves a day short rather than shrinking portions past the floor, so validation can reject it', () => {
    // 600 kcal/day is below any sane floor. The scheduler must not invent a way
    // to hit it — it clamps, and validatePlan is what refuses the plan.
    const result = schedule({ targets: { ...TARGETS, kcal: 600 } });

    expect(result.ok).toBe(true);

    if (result.ok) {expect(result.assignment.days[0]?.totals.kcal).toBeGreaterThan(600);}
  });

  it('scales a dish ingredients alongside its servings', () => {
    const pool = [makeDish({ ingredients: [{ grams: 100, slug: 'base' }], servings: 1, slots: ['breakfast'], slug: 'only-breakfast' })];
    const result = schedulePlan({
      catalogue,
      days: 1,
      includesSnacks: false,
      mealsPerDay: 1,
      pool,
      targets: { ...TARGETS, kcal: 400 }
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {return;}

    const meal = result.assignment.days[0]?.meals[0];

    expect(meal?.servings).toBe(2);
    expect(meal?.ingredients).toEqual([{ grams: 200, slug: 'base' }]);
    expect(meal?.macros.kcal).toBe(400);
  });

  it('ignores a dish whose ingredients are not in the catalogue', () => {
    const pool = [...makePool(slotsFor(3, false)), makeDish({ ingredients: [{ grams: 100, slug: 'no-existe' }], slots: ['lunch'], slug: 'fantasma' })];
    const result = schedule({ pool });

    expect(result.ok).toBe(true);

    if (!result.ok) {return;}

    const used = result.assignment.days.flatMap(day => day.meals.map(meal => meal.dish.slug));

    expect(used).not.toContain('fantasma');
  });
});

describe('schedulePlan — protein, not just calories', () => {
  /**
   * The fixture pool has macros in the target's exact ratio, so protein tracked
   * calories perfectly and an energy-only scheduler looked correct. Real food does
   * not: a plan built from rice and potatoes hits its calorie target and misses
   * protein by half, and validation rejects it — which is what a real generation
   * did, repeatedly, before the scheduler learned to weigh both.
   */
  const realistic = makeCatalogue([
    makeCatalogueIngredient({ id: 'i-arroz', carbsPer100g: 28, fatPer100g: 0.3, fiberPer100g: 0.4, kcalPer100g: 130, name: 'Arroz', proteinPer100g: 2.7, slug: 'arroz' }),
    makeCatalogueIngredient({ id: 'i-pollo', carbsPer100g: 0, fatPer100g: 3.6, fiberPer100g: 0, kcalPer100g: 165, name: 'Pollo', proteinPer100g: 31, slug: 'pollo' }),
    makeCatalogueIngredient({ id: 'i-yogur', carbsPer100g: 3.6, fatPer100g: 4, fiberPer100g: 0, kcalPer100g: 97, name: 'Yogur', proteinPer100g: 9, slug: 'yogur' })
  ]);

  const slots = slotsFor(3, false);

  /** The share of the day each slot carries, mirroring the scheduler's own weights. */
  const SHARE: Record<string, number> = { breakfast: 0.28, dinner: 0.34, lunch: 0.37 };

  /**
   * Both carb-led and protein-led options in every slot, sized for that slot.
   *
   * Two things this fixture has to get right, and an earlier version got the
   * second one wrong:
   *
   *  1. **Enough of them.** Under `maxOccurrencesPerPlan: 2` a dish covers two
   *     days, so seven protein-led options are what covers a fortnight. Three
   *     left eight days to be filled with rice — the plan validation exists to
   *     reject.
   *  2. **Plausible composition.** Sizing a chicken dish by calories alone puts
   *     300 g of chicken in one meal: 90 g of protein against a 120 g daily
   *     target. The scheduler then cannot add a portion anywhere without sending
   *     protein through the roof, so it leaves the day short on energy instead —
   *     correctly, and the test reads like a scheduler bug. Chicken varies
   *     modestly and **rice fills the calories**, which is what real food does.
   */
  function mixedPool() {
    const KCAL = { arroz: 130, pollo: 165, yogur: 97 };

    return slots.flatMap(slot => {
      const centre = TARGETS.kcal * (SHARE[slot] ?? 0.33);
      const spread = (index: number, count: number) => 0.85 + (index / Math.max(count - 1, 1)) * 0.3;

      return [
        ...[0, 1, 2].map(index =>
          makeDish({
            ingredients: [{ grams: Math.round(((centre * spread(index, 3)) / KCAL.arroz) * 100), slug: 'arroz' }],
            name: `${slot} arroz ${index}`,
            slots: [slot],
            slug: `${slot}-arroz-${index}`
          })
        ),
        ...[0, 1, 2, 3, 4, 5, 6].map(index => {
          const pollo = 100 + index * 15;
          const rice = Math.max(Math.round(((centre - (pollo / 100) * KCAL.pollo) / KCAL.arroz) * 100), 40);

          return makeDish({
            ingredients: [
              { grams: pollo, slug: 'pollo' },
              { grams: rice, slug: 'arroz' }
            ],
            name: `${slot} pollo ${index}`,
            slots: [slot],
            slug: `${slot}-pollo-${index}`
          });
        }),
        ...[0, 1].map(index =>
          makeDish({
            ingredients: [{ grams: Math.round(((centre * spread(index, 2)) / KCAL.yogur) * 100), slug: 'yogur' }],
            name: `${slot} yogur ${index}`,
            slots: [slot],
            slug: `${slot}-yogur-${index}`
          })
        )
      ];
    });
  }

  it('lands within the protein tolerance, not only the calorie one', () => {
    const result = schedulePlan({ catalogue: realistic, includesSnacks: false, mealsPerDay: 3, pool: mixedPool(), targets: TARGETS });

    expect(result.ok).toBe(true);

    if (!result.ok) {return;}

    for (const day of result.assignment.days) {
      expect(Math.abs(day.totals.proteinG - TARGETS.proteinG) <= TARGETS.proteinG * 0.15).toBe(true);
      expect(Math.abs(day.totals.kcal - TARGETS.kcal) <= TARGETS.kcal * 0.1).toBe(true);
    }
  });

  it('prefers protein-bearing dishes when the pool offers both', () => {
    const result = schedulePlan({ catalogue: realistic, includesSnacks: false, mealsPerDay: 3, pool: mixedPool(), targets: TARGETS });

    expect(result.ok).toBe(true);

    if (!result.ok) {return;}

    const used = result.assignment.days.flatMap(day => day.meals.map(meal => meal.dish.slug));

    // A rice-only plan would hit the calorie target and fail the protein one.
    expect(used.filter(slug => slug.includes('pollo')).length).toBeGreaterThan(0);
  });

  it('still produces a plan when the pool cannot reach the protein target, so validation is what rejects it', () => {
    // The scheduler's job is the best assignment available; refusing the plan on
    // nutritional grounds belongs to validatePlan, which reports every violation.
    const carbsOnly = slots.flatMap(slot =>
      // Nine, comfortably over the `ceil(14 / maxOccurrencesPerPlan)` floor of
      // seven. At exactly the floor the four-day gap rule leaves the scheduler no
      // legal dish for the tail of the fortnight, and the test would fail for
      // running out of dishes rather than for the nutritional shortfall it is
      // about.
      [300, 350, 400, 450, 500, 550, 600, 650, 700].map((grams, index) =>
        makeDish({ ingredients: [{ grams, slug: 'arroz' }], name: `${slot} ${index}`, slots: [slot], slug: `${slot}-${index}` })
      )
    );
    const result = schedulePlan({ catalogue: realistic, includesSnacks: false, mealsPerDay: 3, pool: carbsOnly, targets: TARGETS });

    expect(result.ok).toBe(true);

    if (!result.ok) {return;}

    expect(result.assignment.days[0]?.totals.proteinG ?? 0).toBeLessThan(TARGETS.proteinG * 0.85);
  });
});

describe('schedulePlan — a large athlete on three meals a day', () => {
  /**
   * The case that broke in production: 4,099 kcal and 171 g of protein over three
   * slots is ~1,370 kcal a meal, far larger than a model proposes unprompted. Two
   * things failed at once — a day fell 29% short on energy because portions could
   * not scale far enough, and other days ran 40% over on protein because the
   * dishes that *could* scale were protein-dense.
   *
   * Both came from ranking dishes at one serving, which compares raw size when
   * size is the one thing scaling fixes.
   */
  const BIG: NutritionTargets = { carbsG: 566, fatG: 128, fiberG: 57, kcal: 4099, proteinG: 171 };

  const catalogue = makeCatalogue([
    makeCatalogueIngredient({ id: 'i-arroz', carbsPer100g: 28, fatPer100g: 0.3, fiberPer100g: 0.4, kcalPer100g: 130, name: 'Arroz', proteinPer100g: 2.7, slug: 'arroz' }),
    makeCatalogueIngredient({ id: 'i-pollo', carbsPer100g: 0, fatPer100g: 3.6, fiberPer100g: 0, kcalPer100g: 165, name: 'Pollo', proteinPer100g: 31, slug: 'pollo' }),
    makeCatalogueIngredient({ id: 'i-aceite', carbsPer100g: 0, fatPer100g: 100, fiberPer100g: 0, kcalPer100g: 884, name: 'Aceite', proteinPer100g: 0, slug: 'aceite' })
  ]);

  const slots = slotsFor(3, false);

  /**
   * Dishes around 450 kcal, spread either side of the target's own protein density
   * (171 g × 4 ÷ 4,099 kcal ≈ 17% of energy).
   *
   * That premise matters: variety requires the plan to draw on most of the pool, so
   * **the pool's average ratio is the plan's average ratio**. No scheduler can
   * rescue a pool that is uniformly too protein-dense — it can only trade calories
   * away to contain the protein, which is the 2,675 kcal day this test first
   * produced. Sizing the pool correctly is the prompt's job, and the prompt now
   * states per-slot energy and protein for exactly this reason.
   */
  const modestPool = slots.flatMap(slot =>
    [0, 1, 2, 3, 4, 5, 6, 7, 8].map(n =>
      makeDish({
        ingredients: [
          { grams: 270 - n * 8, slug: 'arroz' },
          { grams: 20 + n * 6, slug: 'pollo' },
          { grams: 10, slug: 'aceite' }
        ],
        name: `${slot} ${n}`,
        slots: [slot],
        slug: `${slot}-${n}`
      })
    )
  );

  it('reaches a high calorie target by scaling portions', () => {
    const result = schedulePlan({ catalogue, includesSnacks: false, mealsPerDay: 3, pool: modestPool, targets: BIG });

    expect(result.ok).toBe(true);

    if (!result.ok) {return;}

    for (const day of result.assignment.days) {
      expect(Math.abs(day.totals.kcal - BIG.kcal) <= BIG.kcal * 0.1).toBe(true);
    }
  });

  it('does so without running the protein ceiling over', () => {
    const result = schedulePlan({ catalogue, includesSnacks: false, mealsPerDay: 3, pool: modestPool, targets: BIG });

    expect(result.ok).toBe(true);

    if (!result.ok) {return;}

    for (const day of result.assignment.days) {
      expect(day.totals.proteinG).toBeGreaterThanOrEqual(BIG.proteinG * 0.85);
      expect(day.totals.proteinG).toBeLessThanOrEqual(95 * 3);
    }
  });

  it('passes the same validation the pipeline applies', () => {
    const result = schedulePlan({ catalogue, includesSnacks: false, mealsPerDay: 3, pool: modestPool, targets: BIG });

    expect(result.ok).toBe(true);

    if (!result.ok) {return;}

    expect(validatePlan({ assignment: result.assignment, expectedDays: 14, expectedSlots: slots, sex: 'male', targets: BIG, weightKg: 95 })).toEqual([]);
  });
});

describe('pickReplacement', () => {
  const catalogue = makeCatalogue([
    makeCatalogueIngredient({ id: 'i-rice', kcalPer100g: 130, proteinPer100g: 2.7, slug: 'rice' }),
    makeCatalogueIngredient({ id: 'i-chicken', kcalPer100g: 120, proteinPer100g: 22.5, slug: 'chicken' }),
    makeCatalogueIngredient({ id: 'i-oil', fatPer100g: 100, kcalPer100g: 884, proteinPer100g: 0, slug: 'oil' })
  ]);
  const budget = { kcal: 600, proteinG: 45 };
  const lunch = (slug: string, ingredients: { grams: number; slug: string }[]) => makeDish({ ingredients, name: slug, servings: 1, slots: ['lunch'], slug });
  const fits = lunch('chicken-rice', [{ grams: 200, slug: 'chicken' }, { grams: 250, slug: 'rice' }]);
  const heavy = lunch('oil-bomb', [{ grams: 60, slug: 'oil' }, { grams: 50, slug: 'rice' }]);
  const dinnerOnly = makeDish({ ingredients: [{ grams: 200, slug: 'chicken' }], name: 'dinner', slots: ['dinner'], slug: 'dinner-only' });

  it('picks the dish whose scaled macros land closest to the budget, for that slot only', () => {
    const picked = pickReplacement({ budget, catalogue, dayIndex: 3, placed: [], pool: [heavy, dinnerOnly, fits], slot: 'lunch' });

    expect(picked?.dish.slug).toBe('chicken-rice');
    expect(picked?.servings).toBeGreaterThan(0);
    expect(Math.abs((picked?.macros.kcal ?? 0) - budget.kcal) / budget.kcal).toBeLessThan(0.2);
  });

  it('keeps the variety rules: a dish already used too often in the plan is not offered', () => {
    const placed = [
      { dayIndex: 1, dishSlug: 'chicken-rice', slot: 'lunch' as const },
      { dayIndex: 8, dishSlug: 'chicken-rice', slot: 'lunch' as const }
    ];

    expect(pickReplacement({ budget, catalogue, dayIndex: 3, placed, pool: [fits], slot: 'lunch' })).toBeUndefined();
  });

  it('puts a favourite first when it fits, and not when it does not', () => {
    const alsoFits = lunch('turkey-rice', [{ grams: 210, slug: 'chicken' }, { grams: 240, slug: 'rice' }]);

    expect(pickReplacement({ budget, catalogue, dayIndex: 3, placed: [], pool: [fits, alsoFits], prefer: new Set(['turkey-rice']), slot: 'lunch' })?.dish.slug).toBe('turkey-rice');
    expect(pickReplacement({ budget, catalogue, dayIndex: 3, placed: [], pool: [fits, heavy], prefer: new Set(['oil-bomb']), slot: 'lunch' })?.dish.slug).toBe('chicken-rice');
  });

  it('returns nothing when the pool has nothing for the slot', () => {
    expect(pickReplacement({ budget, catalogue, dayIndex: 3, placed: [], pool: [dinnerOnly], slot: 'lunch' })).toBeUndefined();
  });
});
