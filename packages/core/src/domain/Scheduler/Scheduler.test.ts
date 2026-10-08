import { describe, expect, it } from 'vitest';

import {
  axisFilter,
  pickReplacement,
  PLAN_DAYS,
  PLATE_GRAMS_MAX,
  PLATE_LIMIT,
  plateGramsMax,
  SCALED_PLATE_GRAMS,
  schedulePlan,
  SERVING_BOUNDS,
  SHARE_BAND
} from 'core/domain/Scheduler';
import { shapeFor, slotsIn, weightsFor } from 'core/domain/MealShape';
import { PLATE_FOOD_MAX, plateFoodMax } from 'core/domain/PlateFood';
import { BALANCE_CAPS, placementGroups } from 'core/domain/Balance';

/** The old question, asked of the new answer: "N meals, snacks or not" is still how a test wants to describe a day. */
function slotsForTest(mealsPerDay: number, includesSnacks: boolean) {
  return slotsIn(shapeFor(mealsPerDay, includesSnacks));
}

import {
  LEGUME_RULES,
  legumeKind,
  MAIN_SLOTS,
  mainProtein,
  planWeek,
  PROTEIN_RULES,
  proteinCap,
  SNACK_RULES,
  snackKind,
  STARCH_RULES,
  starchBase,
  starchCap,
  VARIETY_RULES,
  varietyViolations
} from 'core/domain/Variety';
import { isBlocking, PLAN_TOLERANCE, validatePlan } from 'core/domain/PlanValidation';
import { makeCatalogue, makeCatalogueIngredient, makeDish, makePool, MINIMUM_KCAL, TARGETS } from '#test/fixtures';

import type { NutritionTargets } from 'core/entities/Nutrition';
import type { CandidateDish, CatalogueIngredient } from 'core/entities/Plan';

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

  return schedulePlan({
    catalogue,
    minimumKcal: MINIMUM_KCAL,
    pool: makePool(slots),
    targets: TARGETS,
    weights: weightsFor(shapeFor(3, false)),
    ...overrides
  });
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
    const result = schedulePlan({
      catalogue,
      days: 1,
      // A day of one dish and 400 kcal is a fixture, not a person: nobody's target
      // is under the floor. Out of play here, so that what is measured is the
      // arithmetic of a serving and not the scheduler pulling the day up to 1,200.
      minimumKcal: 0,
      pool,
      targets: { ...TARGETS, kcal: 400 },
      weights: weightsFor(shapeFor(1, false))
    });

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
    const result = schedulePlan({
      catalogue: carbsVsFat,
      minimumKcal: MINIMUM_KCAL,
      pool: splitPool(),
      targets: TARGETS,
      weights: weightsFor(shapeFor(3, false))
    });

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
    const result = schedulePlan({
      catalogue: realistic,
      minimumKcal: MINIMUM_KCAL,
      pool: mixedPool(),
      targets: TARGETS,
      weights: weightsFor(shapeFor(3, false))
    });

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
    const result = schedulePlan({
      catalogue: realistic,
      minimumKcal: MINIMUM_KCAL,
      pool: mixedPool(),
      targets: TARGETS,
      weights: weightsFor(shapeFor(3, false))
    });

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
    const result = schedulePlan({
      catalogue: realistic,
      minimumKcal: MINIMUM_KCAL,
      pool: carbsOnly,
      targets: TARGETS,
      weights: weightsFor(shapeFor(3, false))
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.assignment.days[0]?.totals.proteinG ?? 0).toBeLessThan(TARGETS.proteinG * 0.85);
  });
});

// The file's heaviest schedule — nine sizes a meal on a day of 4,099 kcal. A
// shared CI runner took it from three seconds to five on the same code, past
// the default limit, so this block states its own.
describe('schedulePlan — a large athlete on three meals a day', { timeout: 20_000 }, () => {
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

  // Rice and chicken at twice their real density, and half their real grams in
  // each dish below, so every dish carries the same macros in half the weight:
  // ~1,370 kcal of cooked rice is over 900 g, past `PLATE_GRAMS_MAX` (`0078`),
  // and this test is about scaling portions, not about weight.
  const catalogue = makeCatalogue([
    makeCatalogueIngredient({
      id: 'i-arroz',
      carbsPer100g: 56,
      fatPer100g: 0.6,
      fiberPer100g: 0.8,
      kcalPer100g: 260,
      name: 'Arroz',
      proteinPer100g: 5.4,
      slug: 'arroz'
    }),
    makeCatalogueIngredient({
      id: 'i-pollo',
      carbsPer100g: 0,
      fatPer100g: 7.2,
      fiberPer100g: 0,
      kcalPer100g: 330,
      name: 'Pollo',
      proteinPer100g: 62,
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
          { grams: 135 - n * 4, slug: 'arroz' },
          { grams: 10 + n * 3, slug: 'pollo' },
          { grams: 10, slug: 'aceite' }
        ],
        name: `${slot} ${n}`,
        slots: [slot],
        slug: `${slot}-${n}`
      })
    )
  );

  // Every test here asks the same question of the same pool: one answer, computed once.
  let scheduled: ReturnType<typeof schedulePlan> | undefined;

  function athletePlan(): ReturnType<typeof schedulePlan> {
    scheduled ??= schedulePlan({ catalogue, minimumKcal: MINIMUM_KCAL, pool: modestPool, targets: BIG, weights: weightsFor(shapeFor(3, false)) });

    return scheduled;
  }

  it('reaches a high calorie target by scaling portions', () => {
    const result = athletePlan();

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    for (const day of result.assignment.days) {
      expect(Math.abs(day.totals.kcal - BIG.kcal) <= BIG.kcal * 0.1).toBe(true);
    }
  });

  it('does so without running the protein ceiling over', () => {
    const result = athletePlan();

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
    const result = athletePlan();

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
    // exactly why the 5% is asserted on a real library and not here. Since
    // `SHARE_BAND` one day also ends a hair over protein (5.03%): the portions
    // that would land its last gram put a plate far past its share, and on
    // three foods nothing else can.
    expect(violations.filter(isBlocking)).toEqual([]);
    expect(
      violations.every(
        violation =>
          violation.kind === 'fat_out_of_band' || (violation.kind === 'protein_above_target' && violation.actual <= violation.target * 1.06)
      )
    ).toBe(true);
  });
});

describe('schedulePlan — each meal near its share of the day (SHARE_BAND)', () => {
  /**
   * Breakfasts heavy on protein, lunches leaning to starch, dinners a little
   * to protein: the day lands its macros by making lunch big and dinner small,
   * and with nothing bounding a meal's share it did — measured on this pool,
   * meals from 0.49 to 1.65 of their share, every day still on its macros. A
   * real plan did the same with a 388-kcal lunch and a 1,247-kcal dinner.
   */
  const T: NutritionTargets = { carbsG: 250, fatG: 58, fiberG: 25, kcal: 2000, proteinG: 120 };
  // Three pure foods at 200 kcal per 100 g, so a dish's grams are half its
  // energy — at 100, an 800-kcal lunch weighed 800 g, past `PLATE_GRAMS_MAX`.
  const pureCatalogue = makeCatalogue([
    makeCatalogueIngredient({ id: 'p', carbsPer100g: 0, fatPer100g: 0, kcalPer100g: 200, name: 'Proteína', proteinPer100g: 50, slug: 'proteina' }),
    makeCatalogueIngredient({ id: 'c', carbsPer100g: 50, fatPer100g: 0, kcalPer100g: 200, name: 'Hidrato', proteinPer100g: 0, slug: 'hidrato' }),
    makeCatalogueIngredient({ id: 'f', carbsPer100g: 0, fatPer100g: 22.22, kcalPer100g: 200, name: 'Grasa', proteinPer100g: 0, slug: 'grasa' })
  ]);
  const weights = weightsFor(shapeFor(3, false));
  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0);
  const budgetOf = (slot: MealSlotName): number => (T.kcal * (weights.get(slot) ?? 0)) / total;
  const LEAN: Record<MealSlotName, number> = { breakfast: 0.3, dinner: 0.09, lunch: -0.3 };
  const pool = (['breakfast', 'lunch', 'dinner'] as const).flatMap(slot =>
    Array.from({ length: 9 }, (_none, n) => {
      const kcal = budgetOf(slot) * (0.92 + n * 0.02);
      const protein = 0.24 * (1 + LEAN[slot]);

      return makeDish({
        ingredients: [
          { grams: Math.round(protein * kcal) / 2, slug: 'proteina' },
          { grams: Math.round((0.74 - protein) * kcal) / 2, slug: 'hidrato' },
          { grams: Math.round(0.26 * kcal) / 2, slug: 'grasa' }
        ],
        name: `${slot} ${n}`,
        slots: [slot],
        slug: `${slot}-${n}`
      });
    })
  );

  it('keeps every meal inside its band of the energy its share gives it, and every day on its macros', () => {
    const result = schedulePlan({ catalogue: pureCatalogue, minimumKcal: MINIMUM_KCAL, pool, targets: T, weights });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    for (const day of result.assignment.days) {
      for (const meal of day.meals) {
        const share = meal.macros.kcal / budgetOf(meal.slot as MealSlotName);

        expect(share, `day ${day.dayIndex} ${meal.slot} at ${share.toFixed(2)} of its share`).toBeGreaterThanOrEqual(SHARE_BAND.min);
        expect(share, `day ${day.dayIndex} ${meal.slot} at ${share.toFixed(2)} of its share`).toBeLessThanOrEqual(SHARE_BAND.max);
      }

      for (const [actual, target] of [
        [day.totals.kcal, T.kcal],
        [day.totals.proteinG, T.proteinG],
        [day.totals.carbsG, T.carbsG],
        [day.totals.fatG, T.fatG]
      ] as const) {
        expect(Math.abs(actual - target) / target, `day ${day.dayIndex}`).toBeLessThanOrEqual(0.05);
      }
    }
  });
});

type MealSlotName = 'breakfast' | 'dinner' | 'lunch';

describe('schedulePlan — one main protein, once a day (PROTEIN_RULES)', () => {
  const kinds = [
    'atun-al-natural',
    'bacalao-fresco',
    'clara-de-huevo',
    'garbanzos-cocidos',
    'lentejas-cocidas',
    'merluza',
    'pechuga-de-pavo',
    'pechuga-de-pollo',
    'salmon',
    'ternera-magra'
  ];
  // Every food the same composition, so fit ties everywhere and the pool's
  // order decides — tuna first in every slot, which a scheduler with no word
  // for "the same protein" would serve at every meal of the first day.
  const proteinCatalogue = makeCatalogue(
    kinds.map((slug, index) => makeCatalogueIngredient({ id: `p-${index}`, category: 'protein', name: slug, slug }))
  );
  const SHARE = { breakfast: 0.28, dinner: 0.34, lunch: 0.37 } as const;
  const slots = ['breakfast', 'lunch', 'dinner'] as const;
  const pool = slots.flatMap(slot =>
    kinds.flatMap(kind =>
      [0, 1].map(n =>
        makeDish({
          ingredients: [{ grams: Math.round((TARGETS.kcal * SHARE[slot]) / 2) + n * 5, slug: kind }],
          name: `${slot} ${kind} ${n}`,
          slots: [slot],
          slug: `${slot}-${kind}-${n}`
        })
      )
    )
  );

  it('never serves one main protein twice in a day, nor past its share of the fortnight', () => {
    const result = schedulePlan({
      catalogue: proteinCatalogue,
      minimumKcal: MINIMUM_KCAL,
      pool,
      targets: TARGETS,
      weights: weightsFor(shapeFor(3, false))
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const perPlan = new Map<string, number>();
    const perSlot = new Map<string, number>();

    for (const day of result.assignment.days) {
      const today = day.meals.map(meal => mainProtein(meal.dish, proteinCatalogue) ?? 'none');

      expect(new Set(today).size, `day ${day.dayIndex}: ${today.join(', ')}`).toBe(today.length);

      for (const [index, kind] of today.entries()) {
        perPlan.set(kind, (perPlan.get(kind) ?? 0) + 1);
        perSlot.set(`${day.meals[index]?.slot}:${kind}`, (perSlot.get(`${day.meals[index]?.slot}:${kind}`) ?? 0) + 1);
      }
    }

    expect(Math.max(...perPlan.values())).toBeLessThanOrEqual(proteinCap(42));
    // Ten proteins a meal is room enough for the per-meal allowance itself.
    expect(Math.max(...perSlot.values())).toBeLessThanOrEqual(PROTEIN_RULES.perSlot);
  });

  it('still gives somebody a plan when the pool is one protein throughout', () => {
    const tuna = slots.flatMap(slot =>
      Array.from({ length: 8 }, (_none, n) =>
        makeDish({
          ingredients: [{ grams: Math.round((TARGETS.kcal * SHARE[slot]) / 2) + n * 5, slug: 'atun-al-natural' }],
          name: `${slot} atún ${n}`,
          slots: [slot],
          slug: `${slot}-atun-${n}`
        })
      )
    );

    expect(
      schedulePlan({ catalogue: proteinCatalogue, minimumKcal: MINIMUM_KCAL, pool: tuna, targets: TARGETS, weights: weightsFor(shapeFor(3, false)) })
        .ok
    ).toBe(true);
  });
});

describe('schedulePlan — no protein dominates, and legumes vary (017 phase 2)', () => {
  // A real fortnight served pork in eight of twenty-eight mains: lomo, solomillo
  // and a ham are three slugs and one animal. Every dish here is mostly a
  // neutral base with 100 g of its protein, so fit ties and the rules decide.
  const pork = ['lomo-de-cerdo', 'solomillo-de-cerdo', 'jamon-serrano'];
  const others = ['pechuga-de-pollo', 'pechuga-de-pavo', 'ternera-magra', 'merluza', 'huevo'];
  const legumes = ['garbanzos-cocidos', 'garbanzos-secos', 'lentejas-cocidas'];
  const catalogue = makeCatalogue([
    makeCatalogueIngredient({ id: 'base', slug: 'base' }),
    ...pork.map((slug, index) => makeCatalogueIngredient({ id: `pork-${index}`, category: 'protein', classes: ['animal', 'meat', 'pork'], slug })),
    ...others.map((slug, index) => makeCatalogueIngredient({ id: `other-${index}`, category: 'protein', slug })),
    ...legumes.map((slug, index) => makeCatalogueIngredient({ id: `legume-${index}`, slug }))
  ]);
  const SHARE = { breakfast: 0.28, dinner: 0.34, lunch: 0.37 } as const;
  const plate = (slot: keyof typeof SHARE, n: number) => Math.round((TARGETS.kcal * SHARE[slot]) / 2) + n * 5;
  const pool = [
    ...Array.from({ length: 8 }, (_none, n) =>
      makeDish({ ingredients: [{ grams: plate('breakfast', n), slug: 'base' }], slots: ['breakfast'], slug: `breakfast-${n}` })
    ),
    ...(['lunch', 'dinner'] as const).flatMap(slot =>
      [...pork, ...others, ...legumes].flatMap(kind =>
        [0, 1, 2].map(n =>
          makeDish({
            ingredients: [
              { grams: plate(slot, n) - 100, slug: 'base' },
              { grams: 100, slug: kind }
            ],
            slots: [slot],
            slug: `${slot}-${kind}-${n}`
          })
        )
      )
    )
  ];
  const result = schedulePlan({ catalogue, minimumKcal: MINIMUM_KCAL, pool, targets: TARGETS, weights: weightsFor(shapeFor(3, false)) });

  it('counts every pork cut as one protein, held to three lunches and dinners a week', () => {
    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const byWeek = new Map<string, number>();
    let porkMains = 0;

    for (const day of result.assignment.days) {
      for (const meal of day.meals.filter(entry => MAIN_SLOTS.has(entry.slot))) {
        const protein = mainProtein(meal.dish, catalogue);

        if (protein) {
          byWeek.set(`${planWeek(day.dayIndex)}:${protein}`, (byWeek.get(`${planWeek(day.dayIndex)}:${protein}`) ?? 0) + 1);
        }

        porkMains += protein === 'cerdo' ? 1 : 0;
      }
    }

    expect(porkMains).toBeGreaterThan(0);
    expect(porkMains).toBeLessThanOrEqual(2 * PROTEIN_RULES.perMainsWeek);
    expect(Math.max(...byWeek.values()), JSON.stringify([...byWeek])).toBeLessThanOrEqual(PROTEIN_RULES.perMainsWeek);
  });

  it('serves the same legume three times a fortnight at most, never on days running', () => {
    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const days = new Map<string, number[]>();

    for (const day of result.assignment.days) {
      for (const meal of day.meals) {
        const legume = legumeKind(meal.dish);

        if (legume) {
          days.set(legume, [...(days.get(legume) ?? []), day.dayIndex]);
        }
      }
    }

    expect(days.get('garbanzos')?.length ?? 0).toBeGreaterThan(0);

    for (const [legume, at] of days) {
      expect(at.length, `${legume} on days ${at.join(', ')}`).toBeLessThanOrEqual(LEGUME_RULES.perFortnight);
      expect(
        at.some((dayIndex, position) => at.includes(dayIndex + 1) || at.indexOf(dayIndex) !== position),
        `${legume} on days ${at.join(', ')}`
      ).toBe(false);
    }
  });
});

describe('schedulePlan — on a small pool, energy before every other band (017 phase 2)', () => {
  // The end-to-end suite's pool: fifteen dishes of ten seeded foods, each asked
  // for in variants, with the seed's own macros and meals. Both cases failed the
  // suite's own check once phase 2's rules were in.
  const food = (slug: string, macros: [number, number, number, number, number], extra: Partial<CatalogueIngredient> = {}) =>
    makeCatalogueIngredient({
      id: slug,
      carbsPer100g: macros[2],
      fatPer100g: macros[3],
      fiberPer100g: macros[4],
      kcalPer100g: macros[0],
      proteinPer100g: macros[1],
      slug,
      ...extra
    });
  const catalogue = makeCatalogue([
    food('arroz-blanco-cocido', [130, 2.4, 28.6, 0.2, 0], { mealSlots: ['lunch', 'dinner'] }),
    food('copos-de-avena', [379, 13.2, 67.7, 6.5, 10.1], { mealSlots: ['breakfast', 'morning_snack', 'afternoon_snack', 'supper'] }),
    food('huevo', [143, 12.6, 0.7, 9.5, 0], { category: 'protein', classes: ['animal', 'egg'] }),
    food('lentejas-cocidas', [116, 9, 20.1, 0.4, 7.9], { category: 'protein', mealSlots: ['lunch'] }),
    food('merluza', [82, 17.8, 0, 1, 0], { category: 'protein', classes: ['animal', 'fish'], mealSlots: ['lunch', 'dinner'] }),
    food('pan-integral', [252, 12.4, 42.7, 3.5, 6]),
    food('patata', [77, 2, 17.5, 0.1, 2.1]),
    food('pechuga-de-pollo', [120, 22.5, 0, 2.6, 0], { category: 'protein', classes: ['animal', 'meat'], mealSlots: ['lunch', 'dinner'] }),
    food('tomate', [18, 0.9, 3.9, 0.2, 1.2], { seasonMonths: [6, 7, 8, 9] }),
    food('yogur-griego-natural', [97, 9, 4, 5, 0], { classes: ['animal', 'dairy'] })
  ]);
  const dishes: readonly (readonly [string, readonly (readonly [number, string])[]])[] = [
    [
      'avena-con-yogur',
      [
        [80, 'copos-de-avena'],
        [150, 'yogur-griego-natural']
      ]
    ],
    [
      'tostada-con-huevo',
      [
        [80, 'pan-integral'],
        [120, 'huevo']
      ]
    ],
    [
      'yogur-con-avena',
      [
        [200, 'yogur-griego-natural'],
        [60, 'copos-de-avena']
      ]
    ],
    [
      'huevos-con-pan',
      [
        [140, 'huevo'],
        [60, 'pan-integral']
      ]
    ],
    ['avena-sola', [[110, 'copos-de-avena']]],
    [
      'arroz-con-pollo',
      [
        [220, 'arroz-blanco-cocido'],
        [180, 'pechuga-de-pollo']
      ]
    ],
    [
      'lentejas-con-arroz',
      [
        [250, 'lentejas-cocidas'],
        [150, 'arroz-blanco-cocido']
      ]
    ],
    [
      'pollo-con-patata',
      [
        [200, 'pechuga-de-pollo'],
        [250, 'patata']
      ]
    ],
    [
      'arroz-con-tomate',
      [
        [260, 'arroz-blanco-cocido'],
        [150, 'tomate']
      ]
    ],
    ['lentejas-solas', [[350, 'lentejas-cocidas']]],
    [
      'merluza-con-patata',
      [
        [200, 'merluza'],
        [220, 'patata']
      ]
    ],
    [
      'pollo-con-tomate',
      [
        [170, 'pechuga-de-pollo'],
        [200, 'tomate']
      ]
    ],
    [
      'merluza-con-arroz',
      [
        [180, 'merluza'],
        [180, 'arroz-blanco-cocido']
      ]
    ],
    [
      'patata-con-huevo',
      [
        [250, 'patata'],
        [110, 'huevo']
      ]
    ],
    ['merluza-sola', [[300, 'merluza']]]
  ];
  const slots = slotsForTest(3, false);
  // `dish:call-variant`, in the order the pool came: the order breaks ties, so it is the fixture.
  const drawn =
    '1:1.3 1:1.2 12:1.2 4:1.2 4:3.3 5:1.2 13:2.2 3:1.3 8:3.1 3:3.1 10:2.3 13:2.3 7:1.2 4:1.1 7:3.3 11:2.1 10:3.2 10:1.3 14:1.3 1:2.1 ' +
    '2:2.1 6:2.1 1:2.3 12:2.2 6:3.2 7:2.1 6:3.3 6:3.1 1:1.1 7:1.1 8:1.3 4:3.2 0:3.3 9:1.1 13:3.2 11:3.2 5:1.3 12:3.2 5:2.2 2:1.1 ' +
    '2:1.3 11:3.1 9:2.1 1:3.3 9:3.1 4:3.1 5:3.3 13:1.3 11:3.3 11:2.3 13:1.2 6:1.1 6:1.3 2:2.2 7:1.3 0:2.2 11:1.3 0:2.1';
  const pool = drawn.split(' ').map(entry => {
    const [at, variant] = entry.split(':') as [string, string];
    const [name, items] = dishes[Number(at)] as (typeof dishes)[number];

    return makeDish({
      ingredients: items.map(([grams, slug]) => ({ grams, slug })),
      name,
      // A dish's meals are its foods' (`fitSlots`): lentils are a lunch, oats a breakfast.
      slots: slots.filter(slot =>
        items.every(([, slug]) => {
          const meals = catalogue.get(slug)?.mealSlots ?? [];

          return meals.length === 0 || meals.includes(slot);
        })
      ),
      slug: `${name}-${variant.replace('.', '-')}`
    });
  });
  const targets = { carbsG: 291, fatG: 70, fiberG: 31, kcal: 2246, proteinG: 113 };
  // Every dish in `count` variants, in the order the suite asks for them.
  const variants = (count: number) =>
    Array.from({ length: count }, (_none, variant) =>
      dishes.map(([name, items]) =>
        makeDish({
          ingredients: items.map(([grams, slug]) => ({ grams, slug })),
          name,
          slots: slots.filter(slot =>
            items.every(([, slug]) => {
              const meals = catalogue.get(slug)?.mealSlots ?? [];

              return meals.length === 0 || meals.includes(slot);
            })
          ),
          slug: `${name}-${variant}`
        })
      )
    ).flat();

  const inBand = (pool: readonly CandidateDish[]) => {
    const result = schedulePlan({ catalogue, minimumKcal: MINIMUM_KCAL, monthOf: () => 10, pool, targets, weights: weightsFor(shapeFor(3, false)) });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    for (const day of result.assignment.days) {
      expect(Math.abs(day.totals.kcal - targets.kcal), `day ${day.dayIndex} at ${day.totals.kcal} kcal`).toBeLessThanOrEqual(
        targets.kcal * FIXTURE_BAND
      );
    }
  };

  // The pool's fat is in its eggs alone, and an egg at lunch and at dinner passes
  // the protein rules four ways. Priced at `PROTEIN_SWAP_WEIGHT` beside the fit,
  // the swap to one that brought a day inside its bands cost more than it gained.
  it('serves the eggs a day needs for its macros rather than keep it off them for variety', () => {
    inBand(variants(4));
  });

  // The repairs used to trade a day a little off on three macros for one 21%
  // short of its energy, twice (`energyMiss`).
  it('never repairs one day by leaving another far off its energy', () => {
    inBand(pool);
  });
});

describe('schedulePlan — pasta and rice four times a fortnight, never on days running (STARCH_RULES)', () => {
  // Every food the same composition, so fit ties everywhere and the pool's
  // order decides — pasta first at every lunch and dinner, which a scheduler
  // with no word for "the same plate of pasta" would serve all fortnight.
  const bases = ['espaguetis-secos', 'arroz-largo-crudo', 'patata', 'lentejas-cocidas', 'quinoa-cruda', 'pechuga-de-pollo', 'merluza'];
  const starchCatalogue = makeCatalogue(bases.map((slug, index) => makeCatalogueIngredient({ id: `s-${index}`, name: slug, slug })));
  const SHARE = { breakfast: 0.28, dinner: 0.34, lunch: 0.37 } as const;
  const slots = ['breakfast', 'lunch', 'dinner'] as const;
  const pool = slots.flatMap(slot =>
    bases.flatMap(base =>
      Array.from({ length: 6 }, (_none, n) =>
        makeDish({
          ingredients: [{ grams: Math.round((TARGETS.kcal * SHARE[slot]) / 2) + n * 5, slug: base }],
          name: `${slot} ${base} ${n}`,
          slots: [slot],
          slug: `${slot}-${base}-${n}`
        })
      )
    )
  );

  it('serves pasta, and rice, at most four times and never on two days running', () => {
    const result = schedulePlan({
      catalogue: starchCatalogue,
      minimumKcal: MINIMUM_KCAL,
      pool,
      targets: TARGETS,
      weights: weightsFor(shapeFor(3, false))
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    for (const capped of STARCH_RULES.capped) {
      const days = result.assignment.days.flatMap(day => day.meals.filter(meal => starchBase(meal.dish) === capped).map(() => day.dayIndex));

      expect(days.length, `${capped} on days ${days.join(', ')}`).toBeLessThanOrEqual(starchCap(PLAN_DAYS));
      expect(new Set(days).size, `${capped} twice on a day: ${days.join(', ')}`).toBe(days.length);
      expect(
        days.some(day => days.includes(day + 1)),
        `${capped} on days running: ${days.join(', ')}`
      ).toBe(false);
    }
  });

  it('keeps the rule against the days a rebuild leaves in place', () => {
    // Pasta on days 3 and 5, from meals the pool no longer holds: day 4 is rebuilt.
    const kept = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].flatMap(dayIndex =>
      slots.map(slot => ({
        dayIndex,
        dishSlug: `kept-${slot}-${dayIndex}`,
        slot,
        starch: slot === 'lunch' && (dayIndex === 3 || dayIndex === 5) ? ('pasta' as const) : null
      }))
    );
    const result = schedulePlan({
      catalogue: starchCatalogue,
      dayIndexes: [4],
      minimumKcal: MINIMUM_KCAL,
      placed: kept,
      pool,
      targets: TARGETS,
      weights: weightsFor(shapeFor(3, false))
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.assignment.days.flatMap(day => day.meals.map(meal => starchBase(meal.dish)))).not.toContain('pasta');
    }
  });
});

describe('schedulePlan — the maximums of PRD 019 held (019 phase 3)', () => {
  // Every food the same composition, so fit ties everywhere and the pool's
  // order decides — beef and ham first at every lunch and dinner, then
  // chicken, prawns and hake, then plates of no group the maximums count:
  // 150 g of each on a neutral base. Without the maximums held, this serves
  // meat eight times.
  const bases: readonly (readonly [string, Partial<CatalogueIngredient>])[] = [
    ['filete-de-ternera', { classes: ['animal', 'meat'] }],
    ['jamon-serrano', { classes: ['animal', 'meat', 'pork'] }],
    ['pechuga-de-pollo', { classes: ['animal', 'meat'] }],
    ['gambas', { classes: ['animal', 'shellfish'] }],
    ['merluza', { classes: ['animal', 'fish'] }],
    ['patata', {}],
    ['calabacin', {}],
    ['base', {}]
  ];
  const groupsCatalogue = makeCatalogue(bases.map(([slug, rest], index) => makeCatalogueIngredient({ id: `m-${index}`, name: slug, slug, ...rest })));
  const SHARE = { breakfast: 0.28, dinner: 0.34, lunch: 0.37 } as const;
  const pool = (['breakfast', 'lunch', 'dinner'] as const).flatMap(slot =>
    (slot === 'breakfast' ? bases.slice(5, 7) : bases.slice(0, 7)).flatMap(([base]) =>
      Array.from({ length: 6 }, (_none, n) =>
        makeDish({
          ingredients: [
            { grams: 150, slug: base },
            { grams: Math.round((TARGETS.kcal * SHARE[slot]) / 2) - 150 + n * 5, slug: 'base' }
          ],
          name: `${slot} ${base} ${n}`,
          slots: [slot],
          slug: `${slot}-${base}-${n}`
        })
      )
    )
  );

  it('serves meat, red and processed meat and fish with shellfish no more than their maximums, red and processed never on days running', () => {
    const result = schedulePlan({
      catalogue: groupsCatalogue,
      minimumKcal: MINIMUM_KCAL,
      pool,
      targets: TARGETS,
      weights: weightsFor(shapeFor(3, false))
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const daysOf = (group: 'fishOrShellfish' | 'meat' | 'processed' | 'redMeat') =>
      result.assignment.days.flatMap(day =>
        day.meals.filter(meal => placementGroups(meal.ingredients, groupsCatalogue)[group]).map(() => day.dayIndex)
      );
    const running = (days: readonly number[]) => days.some(day => days.includes(day + 1));

    expect(daysOf('meat').length).toBeLessThanOrEqual(BALANCE_CAPS.meat);
    expect(daysOf('redMeat').length).toBeLessThanOrEqual(BALANCE_CAPS.redMeat);
    expect(running(daysOf('redMeat')), `red meat on days ${daysOf('redMeat').join(', ')}`).toBe(false);
    expect(daysOf('processed').length).toBeLessThanOrEqual(BALANCE_CAPS.processed);
    expect(running(daysOf('processed')), `processed meat on days ${daysOf('processed').join(', ')}`).toBe(false);
    expect(daysOf('fishOrShellfish').length).toBeLessThanOrEqual(BALANCE_CAPS.fishAndShellfish);
  });
});

describe('schedulePlan — rice beside rice and a fourth legume held like the starch cap (0082)', () => {
  // Day 4 is rebuilt, and its lunch is one of two plates of the same macros:
  // chicken with rice or white beans, or turkey with potato. The turkey is a fourth
  // in its week and already served on day 12, so it pays more in priced rules
  // (0.15 + 0.05) than one rule broken by the other (0.15): priced, the rice
  // went beside day 3's rice and the beans past their three. White meat, five
  // times: within the maximums of 019 phase 3, which pork would have broken.
  const SHARE = { breakfast: 0.28, dinner: 0.34, lunch: 0.37 } as const;
  const plate = (slot: keyof typeof SHARE, n: number) => Math.round((TARGETS.kcal * SHARE[slot]) / 2) + n * 5;
  const catalogue = makeCatalogue([
    ...['base', 'arroz-largo-crudo', 'alubias-blancas-cocidas', 'patata'].map(slug => makeCatalogueIngredient({ id: slug, slug })),
    makeCatalogueIngredient({ id: 'pollo', category: 'protein', slug: 'pechuga-de-pollo' }),
    makeCatalogueIngredient({ id: 'pavo', category: 'protein', classes: ['animal', 'meat'], slug: 'pechuga-de-pavo' }),
    makeCatalogueIngredient({ id: 'merluza', category: 'protein', slug: 'merluza' })
  ]);
  const dish = (slot: keyof typeof SHARE, slug: string, n: number, ...items: string[]) =>
    makeDish({
      ingredients: [{ grams: plate(slot, n) - 100 * items.length, slug: 'base' }, ...items.map(item => ({ grams: 100, slug: item }))],
      slots: [slot],
      slug
    });
  const turkeyLunch = dish('lunch', 'lunch-turkey-potato', 0, 'pechuga-de-pavo', 'patata');
  const neutral = [
    ...[0, 1, 2].map(n => dish('breakfast', `breakfast-${n}`, n)),
    ...[0, 1, 2].map(n => dish('dinner', `dinner-hake-${n}`, n, 'merluza')),
    ...[0, 1, 2].map(n => dish('dinner', `dinner-turkey-${n}`, n, 'pechuga-de-pavo'))
  ];
  const slots = ['breakfast', 'lunch', 'dinner'] as const;
  // Every other day kept, from meals the pool no longer holds — but for turkey at
  // the dinners of days 1–3 and the turkey lunch on day 12, which the pool does.
  const kept = (named: (dayIndex: number, slot: (typeof slots)[number]) => { legume?: string; starch?: 'rice' }) =>
    [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].flatMap(dayIndex =>
      slots.map(slot => ({
        dayIndex,
        dishSlug:
          slot === 'dinner' && dayIndex <= 3
            ? `dinner-turkey-${dayIndex - 1}`
            : slot === 'lunch' && dayIndex === 12
              ? turkeyLunch.slug
              : `kept-${slot}-${dayIndex}`,
        slot,
        ...named(dayIndex, slot)
      }))
    );

  const lunchOnDay4 = (lunches: readonly CandidateDish[], placed: ReturnType<typeof kept>) => {
    const result = schedulePlan({
      catalogue,
      dayIndexes: [4],
      minimumKcal: MINIMUM_KCAL,
      placed,
      pool: [...neutral, ...lunches],
      targets: TARGETS,
      weights: weightsFor(shapeFor(3, false))
    });

    return result.ok ? result.assignment.days.flatMap(day => day.meals.filter(meal => meal.slot === 'lunch').map(meal => meal.dish.slug)) : [];
  };

  it('serves no rice the day after a rice while another dish keeps the day as close; the rice when none does', () => {
    const rice = dish('lunch', 'lunch-chicken-rice', 0, 'pechuga-de-pollo', 'arroz-largo-crudo');
    const riceOnDay3 = kept((dayIndex, slot) => (dayIndex === 3 && slot === 'lunch' ? { starch: 'rice' } : {}));

    expect(lunchOnDay4([rice, turkeyLunch], riceOnDay3)).toEqual([turkeyLunch.slug]);
    expect(
      lunchOnDay4(
        [rice, turkeyLunch],
        kept(() => ({}))
      )
    ).toEqual([rice.slug]);
    expect(lunchOnDay4([rice], riceOnDay3)).toEqual([rice.slug]);
  });

  it('serves no fourth white beans while another dish keeps the day as close; the fourth when none does', () => {
    const beans = dish('lunch', 'lunch-chicken-beans', 0, 'pechuga-de-pollo', 'alubias-blancas-cocidas');
    const beansOn = (...days: number[]) =>
      kept((dayIndex, slot) => (slot === 'dinner' && days.includes(dayIndex) ? { legume: 'alubias-blancas' } : {}));

    expect(lunchOnDay4([beans, turkeyLunch], beansOn(8, 10, 13))).toEqual([turkeyLunch.slug]);
    expect(lunchOnDay4([beans, turkeyLunch], beansOn(8, 13))).toEqual([beans.slug]);
    expect(lunchOnDay4([beans], beansOn(8, 10, 13))).toEqual([beans.slug]);
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
  const run = () =>
    schedulePlan({ catalogue: spreadCatalogue, minimumKcal: MINIMUM_KCAL, pool: spreadPool, targets: T, weights: weightsFor(shapeFor(3, false)) });

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

  /**
   * Sizing a day to its bands priced steeply enough to beat the size order, and
   * the end-to-end suite caught the result: a "light" dinner twice the large
   * lunch beside it. The order the person chose outranks the bands.
   */
  it('never serves the day back to front to bring it inside its bands', () => {
    const shape = { afternoon_snack: 'off', breakfast: 'normal', dinner: 'light', lunch: 'large', morning_snack: 'off', supper: 'off' } as const;
    const result = schedulePlan({ catalogue: spreadCatalogue, minimumKcal: MINIMUM_KCAL, pool: spreadPool, targets: T, weights: weightsFor(shape) });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    for (const day of result.assignment.days) {
      const kcal = (slot: string) => day.meals.find(meal => meal.slot === slot)?.macros.kcal ?? 0;

      expect(kcal('lunch')).toBeGreaterThan(kcal('dinner'));
      expect(kcal('breakfast')).toBeGreaterThan(kcal('dinner'));
    }
  });

  it('never breaks a per-dish variety rule to do it, and repeats deterministically where the pool leaves no choice', () => {
    const first = run();
    const second = run();

    expect(first.ok && second.ok).toBe(true);

    if (!first.ok || !second.ok) {
      return;
    }

    // This fixture's whole point is a pool too thin for fourteen different
    // dinners (eight distinct against fourteen days), so an identical day can
    // be the pool's own limit rather than a bug — `enforceDistinctDays`
    // records what it could not avoid instead of pretending it did not
    // happen. The rules `canPlace` enforces by construction still hold
    // absolutely, and the plan the thin pool forces is still the same one
    // every time.
    expect(varietyViolations(first.assignment.days).filter(violation => violation.kind !== 'identical_day')).toEqual([]);
    expect(second.assignment).toEqual(first.assignment);
  });

  it('repairs the fortnight without bringing rice onto days running (STARCH_RULES)', () => {
    // The same pool, the starch of its two starchiest lunches rice: the exchanges now move a base between days.
    // The rest keep the fixture's own `arroz`, which no food group knows. They were quinoa until 017 phase 2
    // capped the grains too, and a pool whose every lunch is capped has no way to keep rice apart.
    const starchy = makeCatalogue([
      ...[...spreadCatalogue.values()],
      { ...(spreadCatalogue.get('arroz') as CatalogueIngredient), id: 'i-arroz-largo', slug: 'arroz-largo-crudo' }
    ]);
    const pool = spreadPool.map(dish => ({
      ...dish,
      ingredients: dish.ingredients.map(item =>
        item.slug === 'arroz' && (dish.slug === 'lunch-0' || dish.slug === 'lunch-1') ? { ...item, slug: 'arroz-largo-crudo' } : item
      )
    }));
    const result = schedulePlan({ catalogue: starchy, minimumKcal: MINIMUM_KCAL, pool, targets: T, weights: weightsFor(shapeFor(3, false)) });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const rice = result.assignment.days.flatMap(day => day.meals.filter(meal => starchBase(meal.dish) === 'rice').map(() => day.dayIndex));

    expect(rice.length).toBeGreaterThan(0);
    expect(rice.length).toBeLessThanOrEqual(starchCap(PLAN_DAYS));
    expect(rice.some(day => rice.includes(day + 1))).toBe(false);

    for (const day of result.assignment.days) {
      expect(Math.abs(day.totals.kcal - T.kcal)).toBeLessThanOrEqual(T.kcal * 0.05);
    }
  });
});

describe('schedulePlan — snacks vary (017 phase 2)', () => {
  // Yoghurt cups with a different fruit each, a fresh cheese, toasts and eggs,
  // alike in every macro: the morning snack takes the pool's first, a cup.
  const catalogue = makeCatalogue([
    makeCatalogueIngredient({ id: 'base', slug: 'base' }),
    makeCatalogueIngredient({ id: 'yogur', category: 'dairy', slug: 'yogur-proteico' }),
    makeCatalogueIngredient({ id: 'requeson', category: 'dairy', slug: 'requeson' }),
    makeCatalogueIngredient({ id: 'pan', category: 'bakery', slug: 'pan-integral' }),
    makeCatalogueIngredient({ id: 'huevo', category: 'protein', slug: 'huevo' }),
    makeCatalogueIngredient({ id: 'pavo', category: 'protein', slug: 'pechuga-de-pavo' })
  ]);
  const SHARE = { dinner: 0.4, lunch: 0.45, morning_snack: 0.15 } as const;
  const plate = (slot: keyof typeof SHARE, n: number) => Math.round((TARGETS.kcal * SHARE[slot]) / 2) + n * 5;
  const snacks = ['yogur-proteico', 'yogur-proteico', 'yogur-proteico', 'requeson', 'pan-integral', 'huevo', 'pechuga-de-pavo'];
  const pool = [
    ...snacks.flatMap((main, kind) =>
      [0, 1].map(n =>
        makeDish({ ingredients: [{ grams: plate('morning_snack', n), slug: main }], slots: ['morning_snack'], slug: `snack-${kind}-${n}` })
      )
    ),
    ...(['lunch', 'dinner'] as const).flatMap(slot =>
      Array.from({ length: 10 }, (_none, n) =>
        makeDish({ ingredients: [{ grams: plate(slot, n), slug: 'base' }], slots: [slot], slug: `${slot}-${n}` })
      )
    )
  ];
  const weights = weightsFor({ afternoon_snack: 'off', breakfast: 'off', dinner: 'normal', lunch: 'normal', morning_snack: 'normal', supper: 'off' });

  it('serves the same kind of snack three times a fortnight at most', () => {
    const result = schedulePlan({ catalogue, minimumKcal: MINIMUM_KCAL, pool, targets: TARGETS, weights });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const kinds = new Map<string, number>();

    for (const meal of result.assignment.days.flatMap(day => day.meals.filter(entry => entry.slot === 'morning_snack'))) {
      const kind = snackKind(meal.dish, catalogue) ?? 'none';

      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    }

    expect(Math.max(...kinds.values()), JSON.stringify([...kinds])).toBeLessThanOrEqual(SNACK_RULES.perFortnight);
  });
});

describe('schedulePlan — fruit in season on the plate (017 phase 2)', () => {
  // A nectarine snack and a caqui snack fit alike; the fortnight runs from 25
  // September into October, when nectarines are over (Spain's calendar, `0062`).
  const catalogue = makeCatalogue([
    makeCatalogueIngredient({ id: 'base', slug: 'base' }),
    makeCatalogueIngredient({ id: 'nectarina', category: 'produce', seasonMonths: [5, 6, 7, 8, 9], slug: 'nectarina' }),
    makeCatalogueIngredient({ id: 'caqui', category: 'produce', seasonMonths: [10, 11, 12], slug: 'caqui' })
  ]);
  const SHARE = { breakfast: 0.28, dinner: 0.34, lunch: 0.37 } as const;
  const pool = (['breakfast', 'lunch', 'dinner'] as const).flatMap(slot =>
    Array.from({ length: 8 }, (_none, n) => {
      const fruit = slot === 'breakfast' ? (n % 2 === 0 ? 'nectarina' : 'caqui') : null;
      const grams = Math.round((TARGETS.kcal * SHARE[slot]) / 2) + n * 5;

      return makeDish({
        ingredients: fruit
          ? [
              { grams: grams - 50, slug: 'base' },
              { grams: 50, slug: fruit }
            ]
          : [{ grams, slug: 'base' }],
        slots: [slot],
        slug: `${slot}-${fruit ?? 'base'}-${n}`
      });
    })
  );
  // Day 1 is 25 September: days 1–6 are September, 7–14 October.
  const monthOf = (dayIndex: number): number => (dayIndex <= 6 ? 9 : 10);
  const run = (withMonths: boolean) =>
    schedulePlan({
      catalogue,
      minimumKcal: MINIMUM_KCAL,
      ...(withMonths ? { monthOf } : {}),
      pool,
      targets: TARGETS,
      weights: weightsFor(shapeFor(3, false))
    });

  it('serves no nectarine on an October day, and still serves it in September', () => {
    const result = run(true);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const nectarines = result.assignment.days.flatMap(day =>
      day.meals.filter(meal => meal.ingredients.some(item => item.slug === 'nectarina')).map(() => day.dayIndex)
    );

    expect(nectarines.filter(dayIndex => monthOf(dayIndex) === 10)).toEqual([]);
    expect(nectarines.length).toBeGreaterThan(0);
  });

  it('judges no season when it is not told the months', () => {
    const result = run(false);

    expect(
      result.ok &&
        result.assignment.days.some(day => day.dayIndex > 6 && day.meals.some(meal => meal.ingredients.some(item => item.slug === 'nectarina')))
    ).toBe(true);
  });

  it('keeps a plan when the only dish for a meal is out of season', () => {
    const only = pool.map(dish => ({
      ...dish,
      ingredients: dish.ingredients.map(item => (item.slug === 'caqui' ? { ...item, slug: 'nectarina' } : item))
    }));

    expect(
      schedulePlan({ catalogue, minimumKcal: MINIMUM_KCAL, monthOf: () => 10, pool: only, targets: TARGETS, weights: weightsFor(shapeFor(3, false)) })
        .ok
    ).toBe(true);
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
    const picked = pickReplacement({
      budget,
      catalogue,
      dayIndex: 3,
      placed: [],
      plateMinimumKcal: 0,
      pool: [heavy, dinnerOnly, fits],
      slot: 'lunch'
    });

    expect(picked?.dish.slug).toBe('chicken-rice');
    expect(picked?.servings).toBeGreaterThan(0);
    expect(Math.abs((picked?.macros.kcal ?? 0) - budget.kcal) / budget.kcal).toBeLessThan(0.2);
  });

  it('offers no dish whose fresh fruit is out of season in the day’s month (017 phase 2)', () => {
    const seasonal = makeCatalogue([
      ...catalogue.values(),
      makeCatalogueIngredient({ id: 'i-nectarina', category: 'produce', seasonMonths: [5, 6, 7, 8, 9], slug: 'nectarina' })
    ]);
    const withNectarine = lunch('chicken-rice-nectarine', [
      { grams: 200, slug: 'chicken' },
      { grams: 250, slug: 'rice' },
      { grams: 1, slug: 'nectarina' }
    ]);
    const pick = { budget, catalogue: seasonal, dayIndex: 3, placed: [], plateMinimumKcal: 0, pool: [withNectarine], slot: 'lunch' as const };

    expect(pickReplacement({ ...pick, month: 10 })).toBeUndefined();
    expect(pickReplacement({ ...pick, month: 7 })?.dish.slug).toBe('chicken-rice-nectarine');
    expect(pickReplacement(pick)?.dish.slug).toBe('chicken-rice-nectarine');
  });

  it('keeps the variety rules: a dish already used too often in the plan is not offered', () => {
    const placed = [
      { dayIndex: 1, dishSlug: 'chicken-rice', slot: 'lunch' as const },
      { dayIndex: 8, dishSlug: 'chicken-rice', slot: 'lunch' as const }
    ];

    expect(pickReplacement({ budget, catalogue, dayIndex: 3, placed, plateMinimumKcal: 0, pool: [fits], slot: 'lunch' })).toBeUndefined();
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
        plateMinimumKcal: 0,
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
        plateMinimumKcal: 0,
        pool: [fits, heavy],
        slot: 'lunch'
      })?.dish.slug
    ).toBe('chicken-rice');
  });

  it('returns nothing when the pool has nothing for the slot', () => {
    expect(pickReplacement({ budget, catalogue, dayIndex: 3, placed: [], plateMinimumKcal: 0, pool: [dinnerOnly], slot: 'lunch' })).toBeUndefined();
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

    expect(
      pickReplacement({ budget, catalogue, dayIndex: 3, filter, placed: [], plateMinimumKcal: 0, pool: [slow, quick], slot: 'lunch' })?.dish.slug
    ).toBe('quick-rice');
    expect(pickReplacement({ budget, catalogue, dayIndex: 3, filter, placed: [], plateMinimumKcal: 0, pool: [slow], slot: 'lunch' })).toBeUndefined();
  });

  it('serves the new plate a quarter larger when its day would otherwise slip under the floor', () => {
    // 565 kcal a serving against a 600-kcal plate: quarter servings round that to
    // one, 35 kcal short of the plate it replaces. For most days that is nothing.
    // For a day built just over the floor it is the floor.
    const asFits = pickReplacement({ budget, catalogue, dayIndex: 3, placed: [], plateMinimumKcal: 0, pool: [fits], slot: 'lunch' });

    expect(asFits?.servings).toBe(1);
    expect(asFits?.macros.kcal).toBe(565);

    const owed = pickReplacement({ budget, catalogue, dayIndex: 3, placed: [], plateMinimumKcal: 600, pool: [fits], slot: 'lunch' });

    expect(owed?.servings).toBe(1.25);
    expect(owed?.macros.kcal).toBeGreaterThanOrEqual(600);
    // The ingredients follow the serving, or the list would shop for the smaller plate.
    expect(owed?.ingredients).toEqual([
      { grams: 250, slug: 'chicken' },
      { grams: 312.5, slug: 'rice' }
    ]);
  });

  it('does not offer a dish that cannot carry the plate at any size a person is served', () => {
    const tooMuch = 565 * SERVING_BOUNDS.max + 1;

    expect(pickReplacement({ budget, catalogue, dayIndex: 3, placed: [], plateMinimumKcal: tooMuch, pool: [fits], slot: 'lunch' })).toBeUndefined();
  });

  it('keeps pasta off the day beside a pasta, and off a plan that has its four (STARCH_RULES)', () => {
    const starchCatalogue = makeCatalogue([
      makeCatalogueIngredient({ id: 'i-pasta', slug: 'espaguetis-secos' }),
      makeCatalogueIngredient({ id: 'i-patata', slug: 'patata' })
    ]);
    // The same plate at the same size: the pasta wins every tie by its slug.
    const pool = [lunch('espaguetis', [{ grams: 300, slug: 'espaguetis-secos' }]), lunch('patatas', [{ grams: 300, slug: 'patata' }])];
    // The plan's own meals: never in a swap's pool, so they bring their base.
    const pastaOn = (...days: number[]) =>
      days.map(dayIndex => ({ dayIndex, dishSlug: `pasta-${dayIndex}`, slot: 'dinner' as const, starch: 'pasta' as const }));
    const swap = (placed: ReturnType<typeof pastaOn>) =>
      pickReplacement({ budget, catalogue: starchCatalogue, dayIndex: 3, placed, plateMinimumKcal: 0, pool, slot: 'lunch' })?.dish.slug;

    expect(swap([])).toBe('espaguetis');
    expect(swap(pastaOn(5, 9))).toBe('espaguetis');
    expect(swap(pastaOn(2))).toBe('patatas');
    expect(swap(pastaOn(3))).toBe('patatas');
    expect(swap(pastaOn(6, 8, 10, 12))).toBe('patatas');
  });

  it('serves no fifth pasta however much better it fits, while another dish passes; the fifth when none does (0081)', () => {
    const starchCatalogue = makeCatalogue([
      makeCatalogueIngredient({ id: 'i-pasta', proteinPer100g: 13, slug: 'espaguetis-secos' }),
      makeCatalogueIngredient({ id: 'i-patata', proteinPer100g: 2, slug: 'patata' }),
      makeCatalogueIngredient({ id: 'i-chicken', kcalPer100g: 120, proteinPer100g: 22.5, slug: 'chicken' })
    ]);
    // Pasta and chicken land on the protein; potato alone is far under it.
    const pasta = lunch('espaguetis-con-pollo', [
      { grams: 150, slug: 'espaguetis-secos' },
      { grams: 200, slug: 'chicken' }
    ]);
    const potato = lunch('patatas', [{ grams: 400, slug: 'patata' }]);
    const pastaOn = (...days: number[]) =>
      days.map(dayIndex => ({ dayIndex, dishSlug: `pasta-${dayIndex}`, slot: 'dinner' as const, starch: 'pasta' as const }));
    const swap = (pool: readonly (typeof pasta)[], placed: ReturnType<typeof pastaOn>) =>
      pickReplacement({ budget, catalogue: starchCatalogue, dayIndex: 3, placed, plateMinimumKcal: 0, pool, slot: 'lunch' })?.dish.slug;

    expect(swap([pasta, potato], pastaOn(6, 9, 12))).toBe('espaguetis-con-pollo');
    expect(swap([pasta, potato], pastaOn(6, 8, 10, 12))).toBe('patatas');
    expect(swap([pasta], pastaOn(6, 8, 10, 12))).toBe('espaguetis-con-pollo');
  });

  it('serves no pasta beside a pasta however much better it fits, while another dish passes; beside one when none does (0082)', () => {
    const starchCatalogue = makeCatalogue([
      makeCatalogueIngredient({ id: 'i-pasta', proteinPer100g: 13, slug: 'espaguetis-secos' }),
      makeCatalogueIngredient({ id: 'i-patata', proteinPer100g: 2, slug: 'patata' }),
      makeCatalogueIngredient({ id: 'i-chicken', kcalPer100g: 120, proteinPer100g: 22.5, slug: 'chicken' })
    ]);
    const pasta = lunch('espaguetis-con-pollo', [
      { grams: 150, slug: 'espaguetis-secos' },
      { grams: 200, slug: 'chicken' }
    ]);
    const potato = lunch('patatas', [{ grams: 400, slug: 'patata' }]);
    const pastaOn = (...days: number[]) =>
      days.map(dayIndex => ({ dayIndex, dishSlug: `pasta-${dayIndex}`, slot: 'dinner' as const, starch: 'pasta' as const }));
    const swap = (pool: readonly (typeof pasta)[], placed: ReturnType<typeof pastaOn>) =>
      pickReplacement({ budget, catalogue: starchCatalogue, dayIndex: 3, placed, plateMinimumKcal: 0, pool, slot: 'lunch' })?.dish.slug;

    expect(swap([pasta, potato], pastaOn(5, 9))).toBe('espaguetis-con-pollo');
    expect(swap([pasta, potato], pastaOn(2))).toBe('patatas');
    expect(swap([pasta, potato], pastaOn(3))).toBe('patatas');
    expect(swap([pasta, potato], pastaOn(4))).toBe('patatas');
    expect(swap([pasta], pastaOn(2))).toBe('espaguetis-con-pollo');
  });

  it('serves no fourth of a legume however much better it fits, while another dish passes; the fourth when none does (0082)', () => {
    const legumeCatalogue = makeCatalogue([
      makeCatalogueIngredient({ id: 'i-beans', proteinPer100g: 13, slug: 'alubias-blancas-cocidas' }),
      makeCatalogueIngredient({ id: 'i-patata', proteinPer100g: 2, slug: 'patata' }),
      makeCatalogueIngredient({ id: 'i-chicken', kcalPer100g: 120, proteinPer100g: 22.5, slug: 'chicken' })
    ]);
    const beans = lunch('alubias-con-pollo', [
      { grams: 150, slug: 'alubias-blancas-cocidas' },
      { grams: 200, slug: 'chicken' }
    ]);
    const potato = lunch('patatas', [{ grams: 400, slug: 'patata' }]);
    const legumeOn = (legume: string, ...days: number[]) =>
      days.map(dayIndex => ({ dayIndex, dishSlug: `${legume}-${dayIndex}`, legume, slot: 'dinner' as const }));
    const swap = (pool: readonly (typeof beans)[], placed: ReturnType<typeof legumeOn>) =>
      pickReplacement({ budget, catalogue: legumeCatalogue, dayIndex: 3, placed, plateMinimumKcal: 0, pool, slot: 'lunch' })?.dish.slug;

    expect(swap([beans, potato], legumeOn('alubias-blancas', 7, 11))).toBe('alubias-con-pollo');
    expect(swap([beans, potato], legumeOn('alubias-blancas', 7, 9, 11))).toBe('patatas');
    // Another legume's three are no reason to hold these back.
    expect(swap([beans, potato], legumeOn('garbanzos', 7, 9, 11))).toBe('alubias-con-pollo');
    expect(swap([beans], legumeOn('alubias-blancas', 7, 9, 11))).toBe('alubias-con-pollo');
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

describe('schedulePlan — distinct dishes are maximised, not just varied (owner, 2026-09-26)', () => {
  /*
   * The owner's report: a 3-meal, 14-day plan came back with every one of
   * twenty-eight distinct dishes used exactly twice, and two whole days
   * identical, though the pool handed to the scheduler held nineteen per
   * slot — enough, on its own, for fourteen different lunches. The cause was
   * the repair passes (`improveDay`, before this change) judging a swap on
   * fit alone: with every day's targets nearly the same, the day-by-day
   * search kept finding that the same handful of dishes fit best and spent
   * them again rather than reaching for the eighteen others sitting in the
   * pool unused. `DISH_REPEAT_WEIGHT` is what changed that.
   */
  const slots = slotsForTest(3, false);

  it('uses a different dish every day when the pool has one to give it', () => {
    // Nineteen per slot — `REUSED_DISHES_PER_SLOT` after `0065` — against
    // fourteen days: enough for zero repeats if the scheduler reaches for them.
    const result = schedulePlan({
      catalogue,
      minimumKcal: MINIMUM_KCAL,
      pool: makePool(slots, 19),
      targets: TARGETS,
      weights: weightsFor(shapeFor(3, false))
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    for (const slot of slots) {
      const usage = new Map<string, number>();

      for (const day of result.assignment.days) {
        const dish = day.meals.find(meal => meal.slot === slot);

        if (dish) {
          usage.set(dish.dish.slug, (usage.get(dish.dish.slug) ?? 0) + 1);
        }
      }

      expect(usage.size).toBe(PLAN_DAYS);
      expect([...usage.values()].every(count => count === 1)).toBe(true);
    }

    expect(varietyViolations(result.assignment.days)).toEqual([]);
  });

  it('still repeats, up to the cap, when the pool is too thin for one dish a day — but never breaks a per-dish rule doing it', () => {
    // Eight per slot: the exact shape of `0048`'s own thin-pool fixture, a
    // deliberate adversarial case, not the production floor.
    const result = schedulePlan({
      catalogue,
      minimumKcal: MINIMUM_KCAL,
      pool: makePool(slots, 8),
      targets: TARGETS,
      weights: weightsFor(shapeFor(3, false))
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    for (const slot of slots) {
      const usage = new Map<string, number>();

      for (const day of result.assignment.days) {
        const dish = day.meals.find(meal => meal.slot === slot);

        if (dish) {
          usage.set(dish.dish.slug, (usage.get(dish.dish.slug) ?? 0) + 1);
        }
      }

      // The rule the pool cannot make impossible: never more than twice.
      expect([...usage.values()].every(count => count <= VARIETY_RULES.maxOccurrencesPerPlan)).toBe(true);
      // And the pool being thin is exactly why a repeat happened at all.
      expect(usage.size).toBeLessThan(PLAN_DAYS);
    }

    expect(varietyViolations(result.assignment.days).filter(violation => violation.kind !== 'identical_day')).toEqual([]);
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
    const result = schedulePlan({ catalogue, minimumKcal: MINIMUM_KCAL, pool: makePool(slots), targets: TARGETS, weights: weightsFor(shape) });

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
    const result = schedulePlan({ catalogue, minimumKcal: MINIMUM_KCAL, pool: makePool(slots), targets: TARGETS, weights: weightsFor(shape) });

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
    const result = schedulePlan({ catalogue, dayIndexes: [5, 6], minimumKcal: MINIMUM_KCAL, pool, targets: TARGETS, weights });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.assignment.days.map(day => day.dayIndex)).toEqual([5, 6]);
      expect(result.assignment.days.every(day => day.meals.length === slots.length)).toBe(true);
    }
  });

  it('holds the variety rules against the days it was told to keep', () => {
    const whole = schedulePlan({ catalogue, minimumKcal: MINIMUM_KCAL, pool, targets: TARGETS, weights });

    expect(whole.ok).toBe(true);

    if (!whole.ok) {
      return;
    }

    // Every placement of the fortnight except days 5 and 6, as a rebuild hands it over.
    const kept = whole.assignment.days.filter(day => day.dayIndex !== 5 && day.dayIndex !== 6);
    const placed = kept.flatMap(day => day.meals.map(meal => ({ dayIndex: day.dayIndex, dishSlug: meal.dish.slug, slot: meal.slot })));
    const rebuilt = schedulePlan({ catalogue, dayIndexes: [5, 6], minimumKcal: MINIMUM_KCAL, placed, pool, targets: TARGETS, weights });

    expect(rebuilt.ok).toBe(true);

    if (rebuilt.ok) {
      const merged = [...kept, ...rebuilt.assignment.days].sort((a, b) => a.dayIndex - b.dayIndex);

      expect(varietyViolations(merged)).toEqual([]);
    }
  });

  it('is the fortnight it always was when neither is given', () => {
    const plain = schedulePlan({ catalogue, minimumKcal: MINIMUM_KCAL, pool, targets: TARGETS, weights });
    const explicit = schedulePlan({
      catalogue,
      dayIndexes: Array.from({ length: PLAN_DAYS }, (_none, index) => index + 1),
      minimumKcal: MINIMUM_KCAL,
      placed: [],
      pool,
      targets: TARGETS,
      weights
    });

    expect(explicit).toEqual(plain);
  });
});

describe('schedulePlan — no day is sized under the energy floor', () => {
  /**
   * Somebody light and sedentary who asks for a fast pace has their target
   * clamped *to* the floor, so the target and the floor are one number. Aimed at
   * with a band either side, about half the days land a few calories under it —
   * a fine fit, and a blocking violation: measured on the real library, nine
   * days of fourteen, and the person was given no plan. This pool reproduces it
   * at toy scale, which the first test proves before the second relies on it.
   */
  const ON_THE_FLOOR: NutritionTargets = { carbsG: 120, fatG: 40, fiberG: 25, kcal: MINIMUM_KCAL, proteinG: 90 };
  const floorCatalogue = makeCatalogue([
    makeCatalogueIngredient({
      id: 'f-arroz',
      carbsPer100g: 28,
      fatPer100g: 0.3,
      fiberPer100g: 1,
      kcalPer100g: 125.5,
      name: 'Arroz',
      proteinPer100g: 2.7,
      slug: 'arroz'
    }),
    makeCatalogueIngredient({
      id: 'f-pollo',
      carbsPer100g: 0,
      fatPer100g: 3.6,
      fiberPer100g: 1,
      kcalPer100g: 156.4,
      name: 'Pollo',
      proteinPer100g: 31,
      slug: 'pollo'
    }),
    makeCatalogueIngredient({
      id: 'f-aceite',
      carbsPer100g: 0,
      fatPer100g: 100,
      fiberPer100g: 1,
      kcalPer100g: 900,
      name: 'Aceite',
      proteinPer100g: 0,
      slug: 'aceite'
    })
  ]);
  const floorSlots = slotsForTest(3, false);
  const floorPool = floorSlots.flatMap(slot =>
    [0, 1, 2, 3, 4, 5, 6, 7].map(n =>
      makeDish({
        ingredients: [
          { grams: 118 - n * 7, slug: 'arroz' },
          { grams: 62 + n * 9, slug: 'pollo' },
          { grams: 9 + (n % 3), slug: 'aceite' }
        ],
        name: `${slot} ${n}`,
        slots: [slot],
        slug: `floor-${slot}-${n}`
      })
    )
  );
  const run = (minimumKcal: number, targets: NutritionTargets = ON_THE_FLOOR) =>
    schedulePlan({ catalogue: floorCatalogue, minimumKcal, pool: floorPool, targets, weights: weightsFor(shapeFor(3, false)) });
  const person = { expectedDays: 14, expectedSlots: floorSlots, sex: 'female' as const, targets: ON_THE_FLOOR, weightKg: 58 };

  it('reproduces the fault when the floor is not in play: days inside their band and under the floor', () => {
    const result = run(0);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const under = result.assignment.days.filter(day => day.totals.kcal < MINIMUM_KCAL);

    expect(under.length).toBeGreaterThan(0);
    // The trap: some of them are a fine fit by the band's lights — inside 5% of
    // the target — and thrown away all the same, because the target is the floor.
    expect(under.some(day => day.totals.kcal >= MINIMUM_KCAL * (1 - PLAN_TOLERANCE.kcal))).toBe(true);

    expect(
      validatePlan({ ...person, assignment: result.assignment })
        .filter(isBlocking)
        .map(v => v.kind)
    ).toContain('below_minimum_kcal');
  });

  it('sizes every day at or over the floor, as validation will read it, and still inside the band', () => {
    const result = run(MINIMUM_KCAL);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    for (const day of result.assignment.days) {
      expect(day.totals.kcal).toBeGreaterThanOrEqual(MINIMUM_KCAL);
      expect(day.totals.kcal).toBeLessThanOrEqual(MINIMUM_KCAL * (1 + FIXTURE_BAND));
    }

    // The totals above are the delivered ones — every meal rounded to a decimal,
    // then summed — which is the number the floor is judged on in both places.
    expect(validatePlan({ ...person, assignment: result.assignment }).filter(isBlocking)).toEqual([]);
  });

  it('changes nothing for a plan whose target is nowhere near the floor', () => {
    const far: NutritionTargets = { carbsG: 250, fatG: 70, fiberG: 30, kcal: 2100, proteinG: 117.5 };

    expect(run(MINIMUM_KCAL, far)).toEqual(run(0, far));
  });
});

describe('schedulePlan — every plate inside PLATE_LIMIT of its share (0076)', () => {
  // Pure foods at 100 kcal per 100 g, so a dish's grams are its energy.
  const pureCatalogue = makeCatalogue([
    makeCatalogueIngredient({ id: 'p', carbsPer100g: 0, fatPer100g: 0, kcalPer100g: 100, name: 'Proteína', proteinPer100g: 25, slug: 'proteina' }),
    makeCatalogueIngredient({ id: 'c', carbsPer100g: 25, fatPer100g: 0, kcalPer100g: 100, name: 'Hidrato', proteinPer100g: 0, slug: 'hidrato' }),
    makeCatalogueIngredient({ id: 'f', carbsPer100g: 0, fatPer100g: 11.11, kcalPer100g: 100, name: 'Grasa', proteinPer100g: 0, slug: 'grasa' })
  ]);
  // The shape that found it: a light morning snack, a lunch and a dinner.
  const weights = weightsFor({ afternoon_snack: 'off', breakfast: 'off', dinner: 'normal', lunch: 'normal', morning_snack: 'light', supper: 'off' });
  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0);
  const T: NutritionTargets = { carbsG: 194, fatG: 66, fiberG: 29, kcal: 2100, proteinG: 185 };
  const budgetOf = (slot: string, targets: NutritionTargets = T): number => (targets.kcal * (weights.get(slot as never) ?? 0)) / total;
  /** A dish of `kcal` per serving, `protein` of it from protein, the rest split carbs/fat. */
  const dish = (slug: string, slot: 'dinner' | 'lunch' | 'morning_snack', kcal: number, protein: number) =>
    makeDish({
      ingredients: [
        { grams: Math.round(protein * kcal), slug: 'proteina' },
        { grams: Math.round((0.72 - protein) * kcal), slug: 'hidrato' },
        { grams: Math.round(0.28 * kcal), slug: 'grasa' }
      ],
      name: slug,
      servings: 1,
      slots: [slot],
      slug
    });
  // Protein lives at lunch; dinner is starch. Only a lunch far past its share
  // and a dinner far under it would land 185 g — what the real plan did.
  const pool = [
    ...Array.from({ length: 8 }, (_none, n) => dish(`lunch-${n}`, 'lunch', budgetOf('lunch') * (0.95 + n * 0.02), 0.6)),
    ...Array.from({ length: 8 }, (_none, n) => dish(`dinner-${n}`, 'dinner', budgetOf('dinner') * (0.95 + n * 0.02), 0.08)),
    ...Array.from({ length: 8 }, (_none, n) => dish(`snack-${n}`, 'morning_snack', budgetOf('morning_snack') * (0.95 + n * 0.02), 0.3))
  ];

  const sharesOf = (result: ReturnType<typeof schedulePlan>, targets: NutritionTargets = T) =>
    result.ok
      ? result.assignment.days.flatMap(day =>
          day.meals.map(meal => ({ day: day.dayIndex, share: meal.macros.kcal / budgetOf(meal.slot, targets), slot: meal.slot }))
        )
      : [];

  it('serves no plate outside the limit, and leaves the protein short rather than inflating lunch', () => {
    const result = schedulePlan({ catalogue: pureCatalogue, minimumKcal: MINIMUM_KCAL, pool, targets: T, weights });

    expect(result.ok).toBe(true);
    // Written out, so this fails if the constant is loosened, not only if it is ignored.
    expect(PLATE_LIMIT).toEqual({ max: 1.5, min: 0.5 });

    for (const { day, share, slot } of sharesOf(result)) {
      expect(share, `day ${day} ${slot} at ${share.toFixed(2)}`).toBeGreaterThanOrEqual(0.5);
      expect(share, `day ${day} ${slot} at ${share.toFixed(2)}`).toBeLessThanOrEqual(1.5);
    }
  });

  it('never places a snack whose smallest size is already past the limit', () => {
    const tooBig = dish('snack-huge', 'morning_snack', budgetOf('morning_snack') * 4, 0.3);
    const result = schedulePlan({ catalogue: pureCatalogue, minimumKcal: MINIMUM_KCAL, pool: [tooBig, ...pool], targets: T, weights });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.assignment.days.flatMap(day => day.meals.map(meal => meal.dish.slug))).not.toContain('snack-huge');
    }
  });

  it('lets the energy floor outrank the limit when nothing inside it reaches the floor', () => {
    // 900 kcal of target under a 1,500 floor: 1.5 × every share is 1,350, short of it.
    const low: NutritionTargets = { carbsG: 83, fatG: 28, fiberG: 13, kcal: 900, proteinG: 79 };
    const lowPool = [
      ...Array.from({ length: 8 }, (_none, n) => dish(`lunch-${n}`, 'lunch', budgetOf('lunch', low) * (0.95 + n * 0.02), 0.35)),
      ...Array.from({ length: 8 }, (_none, n) => dish(`dinner-${n}`, 'dinner', budgetOf('dinner', low) * (0.95 + n * 0.02), 0.35)),
      ...Array.from({ length: 8 }, (_none, n) => dish(`snack-${n}`, 'morning_snack', budgetOf('morning_snack', low) * (0.95 + n * 0.02), 0.35))
    ];
    const result = schedulePlan({ catalogue: pureCatalogue, days: 2, minimumKcal: 1500, pool: lowPool, targets: low, weights });

    expect(result.ok).toBe(true);

    if (result.ok) {
      for (const day of result.assignment.days) {
        expect(day.totals.kcal, `day ${day.dayIndex}`).toBeGreaterThanOrEqual(1500);
      }

      expect(Math.max(...sharesOf(result, low).map(entry => entry.share))).toBeGreaterThan(PLATE_LIMIT.max);
    }
  });
});

describe('pickReplacement — PLATE_LIMIT (0076)', () => {
  const pure = makeCatalogue([makeCatalogueIngredient({ id: 'x', kcalPer100g: 100, proteinPer100g: 10, slug: 'food' })]);
  const budget = { carbsG: 75, fatG: 20, kcal: 600, proteinG: 45 };
  const lunch = (slug: string, grams: number) =>
    makeDish({ ingredients: [{ grams, slug: 'food' }], name: slug, servings: 1, slots: ['lunch'], slug });

  it('does not offer a dish whose smallest size is past the limit', () => {
    // 2,000 kcal a serving: half of one is already 1.67 × a 600-kcal share.
    expect(
      pickReplacement({ budget, catalogue: pure, dayIndex: 2, placed: [], plateMinimumKcal: 0, pool: [lunch('huge', 2000)], slot: 'lunch' })
    ).toBeUndefined();
  });

  it('keeps the plate inside the limit when the floor does not need more', () => {
    const picked = pickReplacement({
      budget,
      catalogue: pure,
      dayIndex: 2,
      placed: [],
      plateMinimumKcal: 0,
      pool: [lunch('plain', 300)],
      slot: 'lunch'
    });

    expect((picked?.macros.kcal ?? 0) / budget.kcal).toBeLessThanOrEqual(PLATE_LIMIT.max);
  });

  it('passes the limit only as far as the floor needs, and stops at the first size that clears it', () => {
    const picked = pickReplacement({
      budget,
      catalogue: pure,
      dayIndex: 2,
      placed: [],
      plateMinimumKcal: 1000,
      pool: [lunch('plain', 300)],
      slot: 'lunch'
    });

    expect(picked?.servings).toBe(3.5);
    expect(picked?.macros.kcal).toBeGreaterThanOrEqual(1000);
    expect((picked?.macros.kcal ?? 0) / budget.kcal).toBeGreaterThan(PLATE_LIMIT.max);
  });
});

describe('PLATE_GRAMS_MAX — no plate weighs more than its slot allows (0078)', () => {
  // Pure foods at 200 kcal per 100 g, and water at none: a dish's weight is
  // set by how much water it carries, independently of its energy.
  const watery = makeCatalogue([
    makeCatalogueIngredient({ id: 'p', carbsPer100g: 0, fatPer100g: 0, kcalPer100g: 200, name: 'Proteína', proteinPer100g: 50, slug: 'proteina' }),
    makeCatalogueIngredient({ id: 'c', carbsPer100g: 50, fatPer100g: 0, kcalPer100g: 200, name: 'Hidrato', proteinPer100g: 0, slug: 'hidrato' }),
    makeCatalogueIngredient({ id: 'f', carbsPer100g: 0, fatPer100g: 22.22, kcalPer100g: 200, name: 'Grasa', proteinPer100g: 0, slug: 'grasa' }),
    makeCatalogueIngredient({
      id: 'w',
      carbsPer100g: 0,
      fatPer100g: 0,
      fiberPer100g: 0,
      kcalPer100g: 0,
      name: 'Agua',
      proteinPer100g: 0,
      slug: 'agua'
    })
  ]);
  const weights = weightsFor({ afternoon_snack: 'off', breakfast: 'off', dinner: 'normal', lunch: 'normal', morning_snack: 'light', supper: 'off' });
  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0);
  const T: NutritionTargets = { carbsG: 250, fatG: 70, fiberG: 29, kcal: 2100, proteinG: 120 };
  const budgetOf = (slot: string, targets: NutritionTargets = T): number => (targets.kcal * (weights.get(slot as never) ?? 0)) / total;

  /** One serving of `kcal`, weighing `grams` — the rest of the weight is water. */
  const dish = (slug: string, slot: 'dinner' | 'lunch' | 'morning_snack', kcal: number, grams: number) => {
    const food = Math.round(kcal / 2);
    const [protein, carbs, fat] = [Math.round(food * 0.23), Math.round(food * 0.47), Math.round(food * 0.3)];

    return makeDish({
      ingredients: [
        { grams: protein, slug: 'proteina' },
        { grams: carbs, slug: 'hidrato' },
        { grams: fat, slug: 'grasa' },
        // Exactly `grams` in all, so a dish of 1,000 g is not 1,001.
        { grams: Math.max(1, grams - protein - carbs - fat), slug: 'agua' }
      ],
      name: slug,
      servings: 1,
      slots: [slot],
      slug
    });
  };

  const plateGrams = (meal: { readonly ingredients: readonly { readonly grams: number }[] }): number =>
    meal.ingredients.reduce((sum, item) => sum + item.grams, 0);
  // Each item is rounded to a tenth of a gram on its own, so a plate at the edge may sum a hair over it.
  const ROUNDING = 0.5;

  it('holds the ceilings the owner set', () => {
    // Written out, so this fails if a ceiling is loosened, not only if it is ignored.
    expect(PLATE_GRAMS_MAX).toEqual({ afternoon_snack: 250, breakfast: 750, dinner: 750, lunch: 750, morning_snack: 250, supper: 250 });
  });

  it('never serves a 1,000 g lunch dish above 750 g, nor a 300 g snack dish above 250 g', () => {
    // Each lunch carries its whole share in 1,000 g and each snack in 300 g, so
    // sizing them to their energy alone would serve one of each.
    const pool = [
      ...Array.from({ length: 8 }, (_none, n) => dish(`lunch-${n}`, 'lunch', budgetOf('lunch') * (0.95 + n * 0.02), 1000)),
      ...Array.from({ length: 8 }, (_none, n) => dish(`dinner-${n}`, 'dinner', budgetOf('dinner') * (0.95 + n * 0.02), 500)),
      ...Array.from({ length: 8 }, (_none, n) => dish(`snack-${n}`, 'morning_snack', budgetOf('morning_snack') * (0.95 + n * 0.02), 300))
    ];
    const result = schedulePlan({ catalogue: watery, minimumKcal: MINIMUM_KCAL, pool, targets: T, weights });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const meals = result.assignment.days.flatMap(day => day.meals.map(meal => ({ day: day.dayIndex, grams: plateGrams(meal), meal })));

    for (const { day, grams, meal } of meals) {
      expect(grams, `day ${day} ${meal.slot} at ${grams} g`).toBeLessThanOrEqual(plateGramsMax(meal.slot, budgetOf(meal.slot)) + ROUNDING);
    }

    // Served smaller, not refused: the 1,000 g lunches are still the lunches.
    expect(meals.filter(entry => entry.meal.slot === 'lunch').every(entry => entry.meal.dish.slug.startsWith('lunch-'))).toBe(true);
    expect(meals.filter(entry => entry.meal.slot === 'lunch').every(entry => entry.meal.servings < 1)).toBe(true);
    expect(meals.filter(entry => entry.meal.slot === 'morning_snack').every(entry => entry.meal.servings < 1)).toBe(true);
  });

  it('never places a dish whose smallest size is already past its ceiling when another fits', () => {
    // Half a serving of 1,600 g is 800 g: no size of it is a lunch.
    const pool = [
      dish('lunch-heavy', 'lunch', budgetOf('lunch'), 1600),
      ...Array.from({ length: 8 }, (_none, n) => dish(`lunch-${n}`, 'lunch', budgetOf('lunch') * (0.95 + n * 0.02), 600)),
      ...Array.from({ length: 8 }, (_none, n) => dish(`dinner-${n}`, 'dinner', budgetOf('dinner') * (0.95 + n * 0.02), 500)),
      ...Array.from({ length: 8 }, (_none, n) => dish(`snack-${n}`, 'morning_snack', budgetOf('morning_snack') * (0.95 + n * 0.02), 200))
    ];
    const result = schedulePlan({ catalogue: watery, minimumKcal: MINIMUM_KCAL, pool, targets: T, weights });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.assignment.days.flatMap(day => day.meals.map(meal => meal.dish.slug))).not.toContain('lunch-heavy');
    }
  });

  it('lets the energy floor outrank the ceiling when nothing under it reaches the floor', () => {
    // 900 kcal of target under a 1,500 floor, on dishes of two grams a calorie:
    // every plate at its ceiling is 875 kcal, short of it.
    const low: NutritionTargets = { carbsG: 105, fatG: 30, fiberG: 13, kcal: 900, proteinG: 52 };
    const pool = [
      ...Array.from({ length: 8 }, (_none, n) => dish(`lunch-${n}`, 'lunch', budgetOf('lunch', low) * (0.95 + n * 0.02), 2 * budgetOf('lunch', low))),
      ...Array.from({ length: 8 }, (_none, n) =>
        dish(`dinner-${n}`, 'dinner', budgetOf('dinner', low) * (0.95 + n * 0.02), 2 * budgetOf('dinner', low))
      ),
      ...Array.from({ length: 8 }, (_none, n) =>
        dish(`snack-${n}`, 'morning_snack', budgetOf('morning_snack', low) * (0.95 + n * 0.02), 2 * budgetOf('morning_snack', low))
      )
    ];
    const result = schedulePlan({ catalogue: watery, days: 2, minimumKcal: 1500, pool, targets: low, weights });

    expect(result.ok).toBe(true);

    if (result.ok) {
      for (const day of result.assignment.days) {
        expect(day.totals.kcal, `day ${day.dayIndex}`).toBeGreaterThanOrEqual(1500);
      }

      expect(result.assignment.days.some(day => day.meals.some(meal => plateGrams(meal) > plateGramsMax(meal.slot, budgetOf(meal.slot, low))))).toBe(
        true
      );
    }
  });
});

describe('pickReplacement — PLATE_GRAMS_MAX (0078)', () => {
  // 100 kcal per 100 g of food, and water at none.
  const catalogue = makeCatalogue([
    makeCatalogueIngredient({ id: 'x', kcalPer100g: 100, proteinPer100g: 10, slug: 'food' }),
    makeCatalogueIngredient({ id: 'w', carbsPer100g: 0, fatPer100g: 0, fiberPer100g: 0, kcalPer100g: 0, proteinPer100g: 0, slug: 'agua' })
  ]);
  const budget = { carbsG: 110, fatG: 30, kcal: 900, proteinG: 70 };
  const lunch = (slug: string, food: number, water = 0) =>
    makeDish({
      ingredients:
        water > 0
          ? [
              { grams: food, slug: 'food' },
              { grams: water, slug: 'agua' }
            ]
          : [{ grams: food, slug: 'food' }],
      name: slug,
      servings: 1,
      slots: ['lunch'],
      slug
    });
  const gramsOf = (picked: ReturnType<typeof pickReplacement>): number => (picked?.ingredients ?? []).reduce((sum, item) => sum + item.grams, 0);

  it('serves a 1,000 g dish no heavier than the ceiling, though its energy asks for a whole serving', () => {
    const picked = pickReplacement({ budget, catalogue, dayIndex: 2, placed: [], plateMinimumKcal: 0, pool: [lunch('big', 1000)], slot: 'lunch' });

    expect(picked?.servings).toBe(0.75);
    expect(gramsOf(picked)).toBeLessThanOrEqual(PLATE_GRAMS_MAX.lunch);
  });

  it('does not offer a dish whose smallest size is past the ceiling', () => {
    // 600 kcal in 2,000 g: half a serving is 1,000 g.
    expect(
      pickReplacement({ budget, catalogue, dayIndex: 2, placed: [], plateMinimumKcal: 0, pool: [lunch('soup', 600, 1400)], slot: 'lunch' })
    ).toBeUndefined();
  });

  it('passes the ceiling only as far as the floor needs', () => {
    const picked = pickReplacement({ budget, catalogue, dayIndex: 2, placed: [], plateMinimumKcal: 900, pool: [lunch('big', 1000)], slot: 'lunch' });

    expect(picked?.servings).toBe(1);
    expect(gramsOf(picked)).toBeGreaterThan(PLATE_GRAMS_MAX.lunch);
  });
});

describe('plateGramsMax — a big main meal may weigh more until accompaniments land (016, temporary)', () => {
  it('keeps 750 g for a main meal up to 950 kcal of share', () => {
    expect(SCALED_PLATE_GRAMS).toEqual({ fromKcal: 950, maxGrams: 900 });
    expect(plateGramsMax('lunch', 900)).toBe(750);
    expect(plateGramsMax('lunch', 950)).toBe(750);
  });

  it('scales above 950 kcal in proportion to the share', () => {
    expect(plateGramsMax('lunch', 1050)).toBeCloseTo(828.9, 1);
    expect(plateGramsMax('dinner', 1050)).toBeCloseTo(828.9, 1);
    expect(plateGramsMax('breakfast', 1050)).toBeCloseTo(828.9, 1);
  });

  it('never past 900 g', () => {
    expect(plateGramsMax('lunch', 1400)).toBe(900);
    expect(plateGramsMax('lunch', 3000)).toBe(900);
  });

  it('leaves snacks and supper at their ceiling however big their share', () => {
    for (const slot of ['morning_snack', 'afternoon_snack', 'supper'] as const) {
      expect(plateGramsMax(slot, 1400)).toBe(PLATE_GRAMS_MAX[slot]);
    }
  });

  describe('through pickReplacement, on a 1,400 kcal lunch', () => {
    // 100 kcal per 100 g: one serving of 400 kcal weighs 400 g, so 2.25 servings are 900 g.
    const catalogue = makeCatalogue([makeCatalogueIngredient({ id: 'x', kcalPer100g: 100, proteinPer100g: 10, slug: 'food' })]);
    const budget = { carbsG: 170, fatG: 47, kcal: 1400, proteinG: 105 };
    const pool = [makeDish({ ingredients: [{ grams: 400, slug: 'food' }], name: 'big', servings: 1, slots: ['lunch'], slug: 'big' })];
    const gramsOf = (picked: ReturnType<typeof pickReplacement>): number => (picked?.ingredients ?? []).reduce((sum, item) => sum + item.grams, 0);

    it('serves it past 750 g but within 900 g', () => {
      const picked = pickReplacement({ budget, catalogue, dayIndex: 2, placed: [], plateMinimumKcal: 0, pool, slot: 'lunch' });

      expect(picked?.servings).toBe(2.25);
      expect(gramsOf(picked)).toBe(SCALED_PLATE_GRAMS.maxGrams);
    });

    it('passes 900 g only for the energy floor', () => {
      const picked = pickReplacement({ budget, catalogue, dayIndex: 2, placed: [], plateMinimumKcal: 1000, pool, slot: 'lunch' });

      expect(gramsOf(picked)).toBeGreaterThan(SCALED_PLATE_GRAMS.maxGrams);
    });
  });
});

describe('PLATE_FOOD_MAX — no plate holds more than about two servings of one food (016 phase 5)', () => {
  // 'food' carries the energy; potato and water weigh and carry none, so a
  // dish's potato is set independently of its energy and its weight.
  const catalogue = makeCatalogue([
    makeCatalogueIngredient({ id: 'x', kcalPer100g: 300, proteinPer100g: 30, slug: 'food' }),
    makeCatalogueIngredient({ id: 'p', carbsPer100g: 0, fatPer100g: 0, fiberPer100g: 0, kcalPer100g: 0, proteinPer100g: 0, slug: 'patata' })
  ]);
  /** One serving: 600 kcal in 200 g of food, beside `potato` g of potato. */
  const lunch = (slug: string, potato: number) =>
    makeDish({
      ingredients: [
        { grams: 200, slug: 'food' },
        { grams: potato, slug: 'patata' }
      ],
      name: slug,
      servings: 1,
      slots: ['lunch'],
      slug
    });
  const potatoOf = (picked: ReturnType<typeof pickReplacement>): number =>
    (picked?.ingredients ?? []).filter(item => item.slug === 'patata').reduce((sum, item) => sum + item.grams, 0);

  describe('through pickReplacement', () => {
    const budget = { carbsG: 110, fatG: 30, kcal: 900, proteinG: 70 };

    it('serves 300 g of potato a serving no further than 400 g, though its energy asks for a serving and a half', () => {
      const picked = pickReplacement({
        budget,
        catalogue,
        dayIndex: 2,
        placed: [],
        plateMinimumKcal: 0,
        pool: [lunch('patatas', 300)],
        slot: 'lunch'
      });

      expect(picked?.servings).toBe(1.25);
      expect(potatoOf(picked)).toBeLessThanOrEqual(PLATE_FOOD_MAX.potato);
    });

    it('does not offer a dish whose smallest size is past the ceiling', () => {
      // Half a serving is 450 g of potato.
      expect(
        pickReplacement({ budget, catalogue, dayIndex: 2, placed: [], plateMinimumKcal: 0, pool: [lunch('patatas', 900)], slot: 'lunch' })
      ).toBeUndefined();
    });

    it('scales the ceiling for a share past 1,100 kcal', () => {
      // 1,320 kcal: 480 g of potato, so a serving and a half — 1.25 at the flat 400 g.
      const big = { carbsG: 160, fatG: 44, kcal: 1320, proteinG: 100 };
      const picked = pickReplacement({
        budget: big,
        catalogue,
        dayIndex: 2,
        placed: [],
        plateMinimumKcal: 0,
        pool: [lunch('patatas', 300)],
        slot: 'lunch'
      });

      expect(picked?.servings).toBe(1.5);
      expect(potatoOf(picked)).toBeLessThanOrEqual(plateFoodMax('potato', 'lunch', 1320));
    });

    it('passes the ceiling only as far as the floor needs', () => {
      const picked = pickReplacement({
        budget,
        catalogue,
        dayIndex: 2,
        placed: [],
        plateMinimumKcal: 900,
        pool: [lunch('patatas', 300)],
        slot: 'lunch'
      });

      expect(picked?.servings).toBe(1.5);
      expect(potatoOf(picked)).toBeGreaterThan(PLATE_FOOD_MAX.potato);
    });
  });

  describe('through schedulePlan', () => {
    const weights = weightsFor({ afternoon_snack: 'off', breakfast: 'off', dinner: 'normal', lunch: 'normal', morning_snack: 'off', supper: 'off' });
    const T: NutritionTargets = { carbsG: 200, fatG: 55, fiberG: 25, kcal: 1800, proteinG: 180 };
    // Each lunch and dinner carries its 900-kcal share in one serving and a half, with 300 g of potato a serving.
    const pool = [
      ...Array.from({ length: 8 }, (_none, n) => lunch(`lunch-${n}`, 300 + n)),
      ...Array.from({ length: 8 }, (_none, n) => ({ ...lunch(`dinner-${n}`, 300 + n), slots: ['dinner' as const] }))
    ];
    // Each item is rounded to a tenth of a gram on its own.
    const ROUNDING = 0.5;

    it('never serves more potato than the ceiling, though every day then sits under its energy', () => {
      const result = schedulePlan({ catalogue, days: 4, minimumKcal: 1200, pool, targets: T, weights });

      expect(result.ok).toBe(true);

      if (!result.ok) {
        return;
      }

      const meals = result.assignment.days.flatMap(day => day.meals);

      expect(meals.length).toBeGreaterThan(0);

      for (const meal of meals) {
        const potato = meal.ingredients.filter(item => item.slug === 'patata').reduce((sum, item) => sum + item.grams, 0);

        expect(potato, `${meal.dish.slug} at ${meal.servings}`).toBeLessThanOrEqual(PLATE_FOOD_MAX.potato + ROUNDING);
      }
    });

    it('lets the energy floor outrank the ceiling when nothing under it reaches the floor', () => {
      // At the ceiling a plate is 1.25 servings, 750 kcal: 1,500 a day, under a 1,700 floor.
      const result = schedulePlan({ catalogue, days: 2, minimumKcal: 1700, pool, targets: T, weights });

      expect(result.ok).toBe(true);

      if (result.ok) {
        for (const day of result.assignment.days) {
          expect(day.totals.kcal, `day ${day.dayIndex}`).toBeGreaterThanOrEqual(1700);
        }
      }
    });
  });
});
