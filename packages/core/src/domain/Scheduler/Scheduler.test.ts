import { describe, expect, it } from 'vitest';

import { axisFilter, pickReplacement, PLAN_DAYS, schedulePlan, SERVING_BOUNDS } from 'core/domain/Scheduler';
import { shapeFor, slotsIn, weightsFor } from 'core/domain/MealShape';

/** The old question, asked of the new answer: "N meals, snacks or not" is still how a test wants to describe a day. */
function slotsForTest(mealsPerDay: number, includesSnacks: boolean) {
  return slotsIn(shapeFor(mealsPerDay, includesSnacks));
}

import { VARIETY_RULES, varietyViolations } from 'core/domain/Variety';
import { isBlocking, validatePlan } from 'core/domain/PlanValidation';
import { makeCatalogue, makeCatalogueIngredient, makeDish, makePool, TARGETS } from '#test/fixtures';

import type { NutritionTargets } from 'core/entities/Nutrition';

const catalogue = makeCatalogue();

/**
 * What a hand-built fixture of three or four foods is held to. The product's
 * bar is `PLAN_TOLERANCE` (5% on every macro), reached on a real library and
 * asserted there (`0045`); a toy pool proves a mechanism works, not that it
 * reaches the bar, and holding it to 5% would test the fixture.
 */
const FIXTURE_BAND = 0.1;

function schedule(overrides: Partial<Parameters<typeof schedulePlan>[0]> = {}) {
  const slots = overrides.pool ? slotsForTest(3, false) : slotsForTest(3, false);

  return schedulePlan({ catalogue, pool: makePool(slots), targets: TARGETS, weights: weightsFor(shapeFor(3, false)), ...overrides });
}

describe('the slots a shape leaves', () => {
  it('gives three meals the core slots', () => {
    expect(slotsForTest(3, false)).toEqual(['breakfast', 'lunch', 'dinner']);
  });

  it('adds an afternoon snack at four meals when the user snacks', () => {
    expect(slotsForTest(4, true)).toEqual(['breakfast', 'lunch', 'afternoon_snack', 'dinner']);
  });

  it('adds supper instead when the user does not snack', () => {
    expect(slotsForTest(4, false)).toEqual(['breakfast', 'lunch', 'dinner', 'supper']);
  });

  it('returns slots in chronological order, not the order they were added', () => {
    expect(slotsForTest(5, true)).toEqual(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']);
  });

  it('never returns more slots than meals requested', () => {
    for (const meals of [2, 3, 4, 5, 6]) {
      expect(slotsForTest(meals, true)).toHaveLength(meals);
    }
  });
});

describe('schedulePlan', () => {
  it('fills fourteen days by default', () => {
    const result = schedule();

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.assignment.days).toHaveLength(PLAN_DAYS);
    }
  });

  it('gives every day every slot, in order', () => {
    const result = schedule();

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    for (const day of result.assignment.days) {
      expect(day.meals.map(meal => meal.slot)).toEqual(['breakfast', 'lunch', 'dinner']);
    }
  });

  it('produces a plan with no variety violations at all', () => {
    const result = schedule();

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(varietyViolations(result.assignment.days)).toEqual([]);
    }
  });

  it('keeps every day within 10% of the calorie target', () => {
    const result = schedule();

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

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

    if (!result.ok) {
      expect(result.shortfall).toMatchObject({ dayIndex: 1, reason: 'insufficient_pool', slot: 'dinner' });
    }
  });

  it('reports a shortfall when the pool is too small for the variety rules', () => {
    // With one dish per slot the spacing rule bites before the occurrence cap
    // does: the same dish cannot fill the same slot again until the gap has
    // passed, so the plan fails on day 2 whatever that gap is.
    const result = schedule({ pool: makePool(slotsForTest(3, false), 1) });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.shortfall.dayIndex).toBe(2);
      // Sanity on the premise: one dish cannot cover a gap of any size.
      expect(VARIETY_RULES.minDaysBetweenSameSlot).toBeGreaterThan(1);
    }
  });

  it('names the day and slot it could not fill, so a retry can ask for exactly that', () => {
    const result = schedule({ pool: makePool(slotsForTest(3, false), 2) });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.shortfall.slot).toBe('breakfast');
      expect(result.shortfall.available).toBe(2);
    }
  });

  it('scales servings in quarters, never in fractions a person cannot serve', () => {
    const result = schedule();

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    for (const day of result.assignment.days) {
      for (const meal of day.meals) {
        expect(Math.round(meal.servings * 4) / 4, `${meal.dish.slug} at ${meal.servings}`).toBe(meal.servings);
      }
    }
  });

  it('never scales a portion beyond its bounds, even against an extreme target', () => {
    const result = schedule({ targets: { ...TARGETS, kcal: 6000 } });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

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

    if (result.ok) {
      expect(result.assignment.days[0]?.totals.kcal).toBeGreaterThan(600);
    }
  });

  it('scales a dish ingredients alongside its servings', () => {
    const pool = [makeDish({ ingredients: [{ grams: 100, slug: 'base' }], servings: 1, slots: ['breakfast'], slug: 'only-breakfast' })];
    const result = schedulePlan({ catalogue, days: 1, pool, targets: { ...TARGETS, kcal: 400 }, weights: weightsFor(shapeFor(1, false)) });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const meal = result.assignment.days[0]?.meals[0];

    expect(meal?.servings).toBe(2);
    expect(meal?.ingredients).toEqual([{ grams: 200, slug: 'base' }]);
    expect(meal?.macros.kcal).toBe(400);
  });

  it('ignores a dish whose ingredients are not in the catalogue', () => {
    const pool = [
      ...makePool(slotsForTest(3, false)),
      makeDish({ ingredients: [{ grams: 100, slug: 'no-existe' }], slots: ['lunch'], slug: 'fantasma' })
    ];
    const result = schedule({ pool });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const used = result.assignment.days.flatMap(day => day.meals.map(meal => meal.dish.slug));

    expect(used).not.toContain('fantasma');
  });
});

describe('schedulePlan — the carb/fat split, not just calories and protein (0045)', () => {
  /**
   * The bug found on a real plan: kcal and protein landed exactly on target
   * every day while carbs ran up to 46% under and fat up to 75% over, because
   * nothing in the fit function looked at either. A pool of meat- and
   * fish-heavy dishes (real Spanish home cooking) and starch-only dishes, each
   * sized so a *rice-only* day and a *meat-only* day both hit the same
   * kcal+protein, is exactly the trap that let it through unnoticed.
   */
  const carbsVsFat = makeCatalogue([
    makeCatalogueIngredient({
      id: 'i-arroz',
      carbsPer100g: 28,
      fatPer100g: 0.3,
      fiberPer100g: 0.4,
      kcalPer100g: 130,
      name: 'Arroz',
      proteinPer100g: 2.7,
      slug: 'arroz'
    }),
    makeCatalogueIngredient({
      id: 'i-pollo',
      carbsPer100g: 0,
      fatPer100g: 3.6,
      fiberPer100g: 0,
      kcalPer100g: 165,
      name: 'Pollo',
      proteinPer100g: 31,
      slug: 'pollo'
    }),
    makeCatalogueIngredient({
      id: 'i-aceite',
      carbsPer100g: 0,
      fatPer100g: 100,
      fiberPer100g: 0,
      kcalPer100g: 884,
      name: 'Aceite',
      proteinPer100g: 0,
      slug: 'aceite'
    })
  ]);

  const slots = slotsForTest(3, false);

  /**
   * Each dish hits the slot's kcal and protein share on its own — some by
   * chicken and oil (fat-heavy for its carbs), some by chicken and rice
   * (carb-heavy for its fat) — so an energy-and-protein-only fit cannot tell
   * any of them apart. Only a scheduler that also looks at the split has a
   * reason to prefer the carb-bearing half over the fat-bearing half.
   */
  function splitPool() {
    return slots.flatMap(slot => {
      const centre = TARGETS.kcal * (slot === 'lunch' ? 0.37 : slot === 'dinner' ? 0.34 : 0.28);
      const proteinCentre = TARGETS.proteinG * (slot === 'lunch' ? 0.37 : slot === 'dinner' ? 0.34 : 0.28);
      const polloG = Math.round((proteinCentre / 31) * 100);
      const polloKcal = (polloG / 100) * 165;

      return [0, 1, 2, 3, 4].flatMap(index => {
        // Fat-heavy: chicken for protein, oil for the rest of the energy.
        const oilKcal = Math.max(centre - polloKcal, 0);
        const fatty = makeDish({
          ingredients: [
            { grams: polloG, slug: 'pollo' },
            { grams: Math.round((oilKcal / 884) * 100), slug: 'aceite' }
          ],
          name: `${slot} graso ${index}`,
          slots: [slot],
          slug: `${slot}-graso-${index}`
        });
        // Carb-heavy: the same chicken for protein, rice for the rest.
        const riceKcal = Math.max(centre - polloKcal, 0);
        const starchy = makeDish({
          ingredients: [
            { grams: polloG, slug: 'pollo' },
            { grams: Math.round((riceKcal / 130) * 100), slug: 'arroz' }
          ],
          name: `${slot} hidratos ${index}`,
          slots: [slot],
          slug: `${slot}-hidratos-${index}`
        });

        return [fatty, starchy];
      });
    });
  }

  it('used to let every day miss carbs and overshoot fat while kcal and protein looked perfect', () => {
    // Not a claim about today's behaviour — a record of the bug, reproduced
    // against the OLD cost function, so a future change to the weights cannot
    // silently reopen it without this failing first.
    const oldFitCost = (macros: { carbsG: number; fatG: number; kcal: number; proteinG: number }, budget: { kcal: number; proteinG: number }) => {
      const energy = budget.kcal > 0 ? Math.abs(macros.kcal - budget.kcal) / budget.kcal : 0;
      const protein = budget.proteinG > 0 ? Math.abs(macros.proteinG - budget.proteinG) / budget.proteinG : 0;

      return energy * 1.5 + protein;
    };

    const fatty = { carbsG: 0, fatG: 40, kcal: 560, proteinG: 35 };
    const starchy = { carbsG: 50, fatG: 2, kcal: 560, proteinG: 35 };
    const budget = { kcal: 560, proteinG: 35 };

    // Tied under the old function: it cannot see that one delivers its energy
    // as fat and the other as carbs.
    expect(oldFitCost(fatty, budget)).toBe(oldFitCost(starchy, budget));
  });

  it('now tells the two apart, and prefers whichever is closer to the stated split', () => {
    const result = schedulePlan({ catalogue: carbsVsFat, pool: splitPool(), targets: TARGETS, weights: weightsFor(shapeFor(3, false)) });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    for (const day of result.assignment.days) {
      // The old bug's shape, inverted into the new assertion: within a real
      // tolerance of the actual target, not just of kcal and protein.
      expect(Math.abs(day.totals.carbsG - TARGETS.carbsG), `day ${day.dayIndex} carbs at ${day.totals.carbsG}`).toBeLessThanOrEqual(
        TARGETS.carbsG * 0.25
      );
      expect(Math.abs(day.totals.fatG - TARGETS.fatG), `day ${day.dayIndex} fat at ${day.totals.fatG}`).toBeLessThanOrEqual(TARGETS.fatG * 0.5);
      // Still what it always had to hit, at the fixture's band: kcal both
      // ways, protein never below its floor.
      expect(Math.abs(day.totals.kcal - TARGETS.kcal)).toBeLessThanOrEqual(TARGETS.kcal * FIXTURE_BAND);
      expect(day.totals.proteinG).toBeGreaterThanOrEqual(TARGETS.proteinG * (1 - FIXTURE_BAND));
    }
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
    makeCatalogueIngredient({
      id: 'i-arroz',
      carbsPer100g: 28,
      fatPer100g: 0.3,
      fiberPer100g: 0.4,
      kcalPer100g: 130,
      name: 'Arroz',
      proteinPer100g: 2.7,
      slug: 'arroz'
    }),
    makeCatalogueIngredient({
      id: 'i-pollo',
      carbsPer100g: 0,
      fatPer100g: 3.6,
      fiberPer100g: 0,
      kcalPer100g: 165,
      name: 'Pollo',
      proteinPer100g: 31,
      slug: 'pollo'
    }),
    makeCatalogueIngredient({
      id: 'i-yogur',
      carbsPer100g: 3.6,
      fatPer100g: 4,
      fiberPer100g: 0,
      kcalPer100g: 97,
      name: 'Yogur',
      proteinPer100g: 9,
      slug: 'yogur'
    }),
    // Chicken breast and rice are both genuinely low-fat — this is not a data
    // error, it is what those two foods are. A real kitchen closes that gap
    // with the pan, not with a fourth macro nutrient invented for the plate:
    // the oil `pollo` is cooked in below is what makes a fat target reachable
    // from this catalogue at all (`0045`).
    makeCatalogueIngredient({
      id: 'i-aceite',
      carbsPer100g: 0,
      fatPer100g: 100,
      fiberPer100g: 0,
      kcalPer100g: 884,
      name: 'Aceite',
      proteinPer100g: 0,
      slug: 'aceite'
    })
  ]);

  const slots = slotsForTest(3, false);

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
        ...[0, 1, 2].map(index => {
          // A little oil here too — sautéed rice, not boiled — so fat has a
          // lever that does not run through chicken. Without one, the only way
          // to raise fat is to raise protein alongside it, since chicken is
          // this pool's one other fat source; that coupling is an artefact of
          // the fixture, not something a real 930-ingredient catalogue has.
          const aceite = 10;
          const rice = Math.round(((centre * spread(index, 3) - (aceite / 100) * 884) / KCAL.arroz) * 100);

          return makeDish({
            ingredients: [
              { grams: rice, slug: 'arroz' },
              { grams: aceite, slug: 'aceite' }
            ],
            name: `${slot} arroz ${index}`,
            slots: [slot],
            slug: `${slot}-arroz-${index}`
          });
        }),
        ...[0, 1, 2, 3, 4, 5, 6].map(index => {
          const pollo = 100 + index * 15;
          // A real tablespoon-and-a-bit, cooked into the dish rather than served
          // alongside it — the fat this catalogue has no other source for.
          const aceite = 15;
          const rice = Math.max(Math.round(((centre - (pollo / 100) * KCAL.pollo - (aceite / 100) * 884) / KCAL.arroz) * 100), 40);

          return makeDish({
            ingredients: [
              { grams: pollo, slug: 'pollo' },
              { grams: rice, slug: 'arroz' },
              { grams: aceite, slug: 'aceite' }
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
    const result = schedulePlan({ catalogue: realistic, pool: mixedPool(), targets: TARGETS, weights: weightsFor(shapeFor(3, false)) });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    for (const day of result.assignment.days) {
      // Shaped like the check `validatePlan` runs — protein has a floor and no
      // ceiling, energy a band both ways — but at `FIXTURE_BAND`, not
      // `PLAN_TOLERANCE`. The product's 5% is what the scheduler reaches on a
      // real library of ~170 dishes (`0045`, measured); a four-food fixture
      // with rice in every plate cannot reach it on every day, and holding it
      // there would test the fixture, not the scheduler. What this proves is
      // that protein is fitted at all, which an energy-only scheduler did not.
      expect(day.totals.proteinG, `day ${day.dayIndex} at ${day.totals.proteinG}g protein`).toBeGreaterThanOrEqual(
        TARGETS.proteinG * (1 - FIXTURE_BAND)
      );
      expect(Math.abs(day.totals.kcal - TARGETS.kcal), `day ${day.dayIndex} at ${day.totals.kcal} kcal`).toBeLessThanOrEqual(
        TARGETS.kcal * FIXTURE_BAND
      );
    }
  });

  it('prefers protein-bearing dishes when the pool offers both', () => {
    const result = schedulePlan({ catalogue: realistic, pool: mixedPool(), targets: TARGETS, weights: weightsFor(shapeFor(3, false)) });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

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
    const result = schedulePlan({ catalogue: realistic, pool: carbsOnly, targets: TARGETS, weights: weightsFor(shapeFor(3, false)) });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

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
    makeCatalogueIngredient({
      id: 'i-arroz',
      carbsPer100g: 28,
      fatPer100g: 0.3,
      fiberPer100g: 0.4,
      kcalPer100g: 130,
      name: 'Arroz',
      proteinPer100g: 2.7,
      slug: 'arroz'
    }),
    makeCatalogueIngredient({
      id: 'i-pollo',
      carbsPer100g: 0,
      fatPer100g: 3.6,
      fiberPer100g: 0,
      kcalPer100g: 165,
      name: 'Pollo',
      proteinPer100g: 31,
      slug: 'pollo'
    }),
    makeCatalogueIngredient({
      id: 'i-aceite',
      carbsPer100g: 0,
      fatPer100g: 100,
      fiberPer100g: 0,
      kcalPer100g: 884,
      name: 'Aceite',
      proteinPer100g: 0,
      slug: 'aceite'
    })
  ]);

  const slots = slotsForTest(3, false);

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
    const result = schedulePlan({ catalogue, pool: modestPool, targets: BIG, weights: weightsFor(shapeFor(3, false)) });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    for (const day of result.assignment.days) {
      expect(Math.abs(day.totals.kcal - BIG.kcal) <= BIG.kcal * 0.1).toBe(true);
    }
  });

  it('does so without running the protein ceiling over', () => {
    const result = schedulePlan({ catalogue, pool: modestPool, targets: BIG, weights: weightsFor(shapeFor(3, false)) });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    for (const day of result.assignment.days) {
      expect(day.totals.proteinG).toBeGreaterThanOrEqual(BIG.proteinG * 0.85);
      expect(day.totals.proteinG).toBeLessThanOrEqual(95 * 3);
    }
  });

  it('passes the same validation the pipeline applies', () => {
    const result = schedulePlan({ catalogue, pool: modestPool, targets: BIG, weights: weightsFor(shapeFor(3, false)) });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const violations = validatePlan({
      assignment: result.assignment,
      expectedDays: 14,
      expectedSlots: slots,
      sex: 'male',
      targets: BIG,
      weightKg: 95
    });

    // "Passes" means what the pipeline means by it: nothing that discards the
    // plan (`isBlocking`). Since `0045` validation also has a fat band, and
    // this three-food pool has one fat source — ten grams of oil in the pan —
    // so its days sit under 128 g and say so, as guidance. More oil moves the
    // energy from rice and chicken and the day misses carbohydrate and protein
    // instead; a fixture of three foods cannot land all four at 5%, which is
    // exactly why the 5% is asserted on a real library and not here.
    expect(violations.filter(isBlocking)).toEqual([]);
    expect(violations.every(violation => violation.kind === 'fat_out_of_band')).toBe(true);
  });
});

describe('schedulePlan — the fortnight is repaired as a whole (0048)', () => {
  /**
   * Days are built in order and each dish may appear twice, so the dishes that
   * fit best are spent first and the last days get what is left. This pool
   * reproduces it at toy scale: without the spread pass its last three days
   * ran 8–14% over on protein and up to 24% under on carbohydrate, though the
   * fortnight as a whole could land every day — which is what a real plan did.
   */
  const T: NutritionTargets = { carbsG: 330, fatG: 67, fiberG: 30, kcal: 2400, proteinG: 120 };
  const spreadCatalogue = makeCatalogue([
    makeCatalogueIngredient({
      id: 'i-arroz',
      carbsPer100g: 28,
      fatPer100g: 0.3,
      fiberPer100g: 1,
      kcalPer100g: 125.5,
      name: 'Arroz',
      proteinPer100g: 2.7,
      slug: 'arroz'
    }),
    makeCatalogueIngredient({
      id: 'i-pollo',
      carbsPer100g: 0,
      fatPer100g: 3.6,
      fiberPer100g: 1,
      kcalPer100g: 156.4,
      name: 'Pollo',
      proteinPer100g: 31,
      slug: 'pollo'
    }),
    makeCatalogueIngredient({
      id: 'i-aceite',
      carbsPer100g: 0,
      fatPer100g: 100,
      fiberPer100g: 1,
      kcalPer100g: 900,
      name: 'Aceite',
      proteinPer100g: 0,
      slug: 'aceite'
    })
  ]);
  const spreadSlots = slotsForTest(3, false);
  // From starchy to chicken-heavy, eight a meal: sixteen uses for fourteen days.
  const spreadPool = spreadSlots.flatMap(slot =>
    [0, 1, 2, 3, 4, 5, 6, 7].map(n =>
      makeDish({
        ingredients: [
          { grams: 200 - n * 12, slug: 'arroz' },
          { grams: 25 + n * 6, slug: 'pollo' },
          { grams: 8, slug: 'aceite' }
        ],
        name: `${slot} ${n}`,
        slots: [slot],
        slug: `${slot}-${n}`
      })
    )
  );
  const run = () => schedulePlan({ catalogue: spreadCatalogue, pool: spreadPool, targets: T, weights: weightsFor(shapeFor(3, false)) });

  it('brings the last days inside the bands the first days already sat in', () => {
    const result = run();

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    for (const day of result.assignment.days) {
      expect(Math.abs(day.totals.proteinG - T.proteinG)).toBeLessThanOrEqual(T.proteinG * 0.05);
      expect(Math.abs(day.totals.carbsG - T.carbsG)).toBeLessThanOrEqual(T.carbsG * 0.05);
      expect(Math.abs(day.totals.kcal - T.kcal)).toBeLessThanOrEqual(T.kcal * 0.05);
      expect(Math.abs(day.totals.fatG - T.fatG)).toBeLessThanOrEqual(T.fatG * FIXTURE_BAND);
    }
  });

  it('never breaks variety to do it, and does it the same way every time', () => {
    const first = run();
    const second = run();

    expect(first.ok && second.ok).toBe(true);

    if (!first.ok || !second.ok) {
      return;
    }

    expect(varietyViolations(first.assignment.days)).toEqual([]);
    expect(second.assignment).toEqual(first.assignment);
  });
});

describe('pickReplacement', () => {
  const catalogue = makeCatalogue([
    makeCatalogueIngredient({ id: 'i-rice', kcalPer100g: 130, proteinPer100g: 2.7, slug: 'rice' }),
    makeCatalogueIngredient({ id: 'i-chicken', kcalPer100g: 120, proteinPer100g: 22.5, slug: 'chicken' }),
    makeCatalogueIngredient({ id: 'i-oil', fatPer100g: 100, kcalPer100g: 884, proteinPer100g: 0, slug: 'oil' })
  ]);
  // Rice and chicken here both carry the fixture default's carb/fat ratio
  // (`makeCatalogueIngredient`'s 20g carb, 6g fat per 100g) rather than a real
  // ingredient's, so any mix of the two lands near 90g carbs and 27g fat at
  // 600 kcal regardless of the rice:chicken split — that split is what still
  // moves protein, which is what these tests are about (`0045`).
  const budget = { carbsG: 90, fatG: 27, kcal: 600, proteinG: 45 };
  const lunch = (slug: string, ingredients: { grams: number; slug: string }[]) =>
    makeDish({ ingredients, name: slug, servings: 1, slots: ['lunch'], slug });
  const fits = lunch('chicken-rice', [
    { grams: 200, slug: 'chicken' },
    { grams: 250, slug: 'rice' }
  ]);
  const heavy = lunch('oil-bomb', [
    { grams: 60, slug: 'oil' },
    { grams: 50, slug: 'rice' }
  ]);
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
    const alsoFits = lunch('turkey-rice', [
      { grams: 210, slug: 'chicken' },
      { grams: 240, slug: 'rice' }
    ]);

    expect(
      pickReplacement({
        budget,
        catalogue,
        dayIndex: 3,
        leaning: { preferSlugs: new Set(['turkey-rice']) },
        placed: [],
        pool: [fits, alsoFits],
        slot: 'lunch'
      })?.dish.slug
    ).toBe('turkey-rice');
    expect(
      pickReplacement({
        budget,
        catalogue,
        dayIndex: 3,
        leaning: { preferSlugs: new Set(['oil-bomb']) },
        placed: [],
        pool: [fits, heavy],
        slot: 'lunch'
      })?.dish.slug
    ).toBe('chicken-rice');
  });

  it('returns nothing when the pool has nothing for the slot', () => {
    expect(pickReplacement({ budget, catalogue, dayIndex: 3, placed: [], pool: [dinnerOnly], slot: 'lunch' })).toBeUndefined();
  });

  it('offers only what passes the filter, and nothing when nothing does', () => {
    const quick = {
      ...lunch('quick-rice', [
        { grams: 200, slug: 'chicken' },
        { grams: 250, slug: 'rice' }
      ]),
      cookMinutes: 0,
      prepMinutes: 5
    };
    const slow = { ...fits, cookMinutes: 30, prepMinutes: 15 };
    const filter = axisFilter('quicker', { cookMinutes: 10, macros: { carbsG: 0, fatG: 0, fiberG: 0, kcal: 600, proteinG: 45 }, prepMinutes: 10 });

    expect(pickReplacement({ budget, catalogue, dayIndex: 3, filter, placed: [], pool: [slow, quick], slot: 'lunch' })?.dish.slug).toBe('quick-rice');
    expect(pickReplacement({ budget, catalogue, dayIndex: 3, filter, placed: [], pool: [slow], slot: 'lunch' })).toBeUndefined();
  });
});

describe('axisFilter', () => {
  const macros = { carbsG: 50, fatG: 10, fiberG: 5, kcal: 600, proteinG: 30 };
  const current = { cookMinutes: 20, macros, prepMinutes: 10 };
  const dish = (prepMinutes: number, cookMinutes: number) => ({
    ...makeDish({ ingredients: [], name: 'x', slots: ['lunch'], slug: 'x' }),
    cookMinutes,
    prepMinutes
  });

  it('asks nothing when no axis was chosen', () => {
    expect(axisFilter(undefined, current)).toBeUndefined();
  });

  it('quicker: strictly less time in total than the current dish', () => {
    const passes = axisFilter('quicker', current);

    expect(passes?.(dish(10, 15), macros)).toBe(true);
    expect(passes?.(dish(15, 15), macros)).toBe(false);
  });

  it('no cooking: a cook time of zero, whatever the prep', () => {
    const passes = axisFilter('no_cooking', current);

    expect(passes?.(dish(25, 0), macros)).toBe(true);
    expect(passes?.(dish(0, 5), macros)).toBe(false);
  });

  it('vegetarian: nothing carrying meat, fish or shellfish, read from the catalogue', () => {
    const meaty = makeCatalogue([
      makeCatalogueIngredient({ id: 'i-rice', classes: [], slug: 'rice' }),
      makeCatalogueIngredient({ id: 'i-chicken', classes: ['animal', 'meat'], slug: 'chicken' }),
      makeCatalogueIngredient({ id: 'i-egg', classes: ['animal', 'egg'], slug: 'egg' })
    ]);
    const passes = axisFilter('vegetarian', current, meaty);
    const withSlugs = (...slugs: string[]) => ({ ...dish(0, 0), ingredients: slugs.map(slug => ({ grams: 100, slug })) });

    expect(passes?.(withSlugs('rice', 'egg'), macros)).toBe(true);
    expect(passes?.(withSlugs('rice', 'chicken'), macros)).toBe(false);
    // An ingredient the catalogue does not know cannot be vouched for.
    expect(passes?.(withSlugs('rice', 'mystery'), macros)).toBe(false);
  });

  it('vegetarian without a catalogue claims nothing rather than letting meat through', () => {
    expect(axisFilter('vegetarian', current)?.(dish(0, 0), macros)).toBe(false);
  });

  it('more protein: at least a fifth more protein per calorie', () => {
    const passes = axisFilter('more_protein', current);

    // 30 g / 600 kcal = 0.05 g per kcal; the bar is 0.06.
    expect(passes?.(dish(0, 0), { ...macros, kcal: 500, proteinG: 30 })).toBe(true);
    expect(passes?.(dish(0, 0), { ...macros, kcal: 600, proteinG: 33 })).toBe(false);
    expect(passes?.(dish(0, 0), { ...macros, kcal: 0, proteinG: 0 })).toBe(false);
  });
});

describe('schedulePlan — the portions keep the shape of the day (0036, 0045)', () => {
  /*
   * A real end-to-end run caught this: with lunch "normal" and dinner "light",
   * the exhaustive portion search fed the day's four totals by making dinner
   * the bigger meal — the combination priced the totals a little lower, and
   * nothing in the cost said which meal was which. The share is something the
   * person was asked about by name; it holds.
   */
  const shape = { afternoon_snack: 'off', breakfast: 'off', dinner: 'light', lunch: 'normal', morning_snack: 'off', supper: 'off' } as const;

  it('keeps a light dinner smaller than a normal lunch on every day', () => {
    const slots = slotsIn(shape);
    const result = schedulePlan({ catalogue, pool: makePool(slots), targets: TARGETS, weights: weightsFor(shape) });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    for (const day of result.assignment.days) {
      const lunch = day.meals.find(meal => meal.slot === 'lunch');
      const dinner = day.meals.find(meal => meal.slot === 'dinner');

      expect(lunch?.macros.kcal ?? 0, `day ${day.dayIndex}`).toBeGreaterThan(dinner?.macros.kcal ?? 0);
    }
  });

  it('still lands the day inside the fixture band while keeping the shape', () => {
    const slots = slotsIn(shape);
    const result = schedulePlan({ catalogue, pool: makePool(slots), targets: TARGETS, weights: weightsFor(shape) });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    for (const day of result.assignment.days) {
      expect(Math.abs(day.totals.kcal - TARGETS.kcal), `day ${day.dayIndex}`).toBeLessThanOrEqual(TARGETS.kcal * FIXTURE_BAND);
    }
  });
});

describe('a day that eats for something (0043)', () => {
  const dayKcal = (result: ReturnType<typeof schedule>, dayIndex: number): number => {
    if (!result.ok) {
      throw new Error('expected a plan');
    }

    const day = result.assignment.days.find(candidate => candidate.dayIndex === dayIndex);

    return (day?.meals ?? []).reduce((sum, meal) => sum + meal.macros.kcal, 0);
  };

  it("builds a loaded day to its own targets and every other day to the plan's", () => {
    const loaded = { ...TARGETS, carbsG: Math.round(TARGETS.carbsG * 1.4), kcal: Math.round(TARGETS.kcal * 1.25) };
    const result = schedule({ dayTargets: new Map([[3, loaded]]) });

    expect(result.ok).toBe(true);
    expect(dayKcal(result, 3)).toBeGreaterThan(dayKcal(result, 2));
    expect(dayKcal(result, 3)).toBeGreaterThan(dayKcal(result, 4));
  });

  it('is the same fortnight as before when nothing eats for anything', () => {
    const plain = schedule();
    const withEmptyMap = schedule({ dayTargets: new Map() });

    expect(withEmptyMap).toEqual(plain);
  });
});

describe('schedulePlan — laying out some days against a plan that keeps the rest (0044)', () => {
  const slots = slotsForTest(3, false);
  const weights = weightsFor(shapeFor(3, false));
  const pool = makePool(slots);

  it('builds only the days asked for, and returns nothing else', () => {
    const result = schedulePlan({ catalogue, dayIndexes: [5, 6], pool, targets: TARGETS, weights });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.assignment.days.map(day => day.dayIndex)).toEqual([5, 6]);
      expect(result.assignment.days.every(day => day.meals.length === slots.length)).toBe(true);
    }
  });

  it('holds the variety rules against the days it was told to keep', () => {
    const whole = schedulePlan({ catalogue, pool, targets: TARGETS, weights });

    expect(whole.ok).toBe(true);

    if (!whole.ok) {
      return;
    }

    // Every placement of the fortnight except days 5 and 6, as a rebuild hands it over.
    const kept = whole.assignment.days.filter(day => day.dayIndex !== 5 && day.dayIndex !== 6);
    const placed = kept.flatMap(day => day.meals.map(meal => ({ dayIndex: day.dayIndex, dishSlug: meal.dish.slug, slot: meal.slot })));
    const rebuilt = schedulePlan({ catalogue, dayIndexes: [5, 6], placed, pool, targets: TARGETS, weights });

    expect(rebuilt.ok).toBe(true);

    if (rebuilt.ok) {
      const merged = [...kept, ...rebuilt.assignment.days].sort((a, b) => a.dayIndex - b.dayIndex);

      expect(varietyViolations(merged)).toEqual([]);
    }
  });

  it('is the fortnight it always was when neither is given', () => {
    const plain = schedulePlan({ catalogue, pool, targets: TARGETS, weights });
    const explicit = schedulePlan({
      catalogue,
      dayIndexes: Array.from({ length: PLAN_DAYS }, (_none, index) => index + 1),
      placed: [],
      pool,
      targets: TARGETS,
      weights
    });

    expect(explicit).toEqual(plain);
  });
});
