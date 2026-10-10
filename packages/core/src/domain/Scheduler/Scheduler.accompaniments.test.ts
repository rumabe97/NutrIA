import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { ACCOMPANIMENT_MAX_SHARE, pickReplacement, PLATE_GRAMS_MAX, plateGramsMax, schedulePlan } from 'core/domain/Scheduler';
import { ACCOMPANIMENTS, larderFor } from 'core/domain/Accompaniment';
import { addMacros, composePerServing, scaleMacros } from 'core/domain/Composition';
import { mealShareKcal, shapeFor, weightsFor } from 'core/domain/MealShape';
import { validatePlan } from 'core/domain/PlanValidation';
import { breaksDishRule, NO_PREFERENCE_EXCLUSIONS } from 'core/domain/Preference';
import { dishSafety, toSafetyProfile } from 'core/domain/Safety';
import { toCatalogue } from 'core/entities/Plan';
import { makeAccompanimentRows, makeCatalogue, makeCatalogueIngredient, MINIMUM_KCAL, TARGETS } from '#test/fixtures';

import type { AccompanimentDiner } from 'core/domain/Accompaniment';
import type { CandidateDish, Catalogue, MealSlot, PlanAssignment } from 'core/entities/Plan';
import type { MealShape } from 'core/entities/Profile';
import type { NutritionTargets } from 'core/entities/Nutrition';

/**
 * The plans the scheduler made before accompaniments existed, pinned by hash
 * (project 016 phase 3: "the flag off gives byte-identical plans").
 *
 * The hashes were taken from `schedulePlan` and `pickReplacement` at
 * 1cea5c06, before the scheduler learnt about accompaniments, over the fixture
 * below. What is hashed is everything a plan carries that a person or the
 * database sees — per day, per meal: the dish's slug, the servings, the slot,
 * the order, the macros and the scaled ingredients; and the day's totals — as
 * JSON in that key order. A field added to a meal later (`accompaniments`) is
 * not in the hash, so the test says what it means: with the flag off, every
 * number of every plan is the one it was.
 *
 * Phase 5 (`PLATE_FOOD_MAX`) caps every plate, flag on or off, and moved one
 * plan on purpose: five meals at 1.8× the target, re-pinned at that phase.
 */
const FOODS = [
  { carbs: 28, fat: 0.3, kcal: 130, protein: 2.7, slug: 'arroz' },
  { carbs: 0, fat: 3.6, kcal: 165, protein: 31, slug: 'pollo' },
  { carbs: 0, fat: 100, kcal: 884, protein: 0, slug: 'aceite' },
  { carbs: 4, fat: 0.4, kcal: 59, protein: 10, slug: 'yogur' },
  { carbs: 7, fat: 0.2, kcal: 32, protein: 1.2, slug: 'verdura' },
  { carbs: 49, fat: 3.2, kcal: 265, protein: 9, slug: 'pan' },
  { carbs: 20, fat: 0.4, kcal: 116, protein: 9, slug: 'lenteja' },
  { carbs: 0, fat: 13, kcal: 208, protein: 20, slug: 'salmon' },
  { carbs: 12, fat: 0.2, kcal: 52, protein: 0.3, slug: 'manzana' },
  { carbs: 1, fat: 11, kcal: 155, protein: 13, slug: 'huevo' }
];

const plates = FOODS.map((food, index) =>
  makeCatalogueIngredient({
    id: `ing-${index}`,
    carbsPer100g: food.carbs,
    fatPer100g: food.fat,
    fiberPer100g: 1,
    kcalPer100g: food.kcal,
    name: food.slug,
    proteinPer100g: food.protein,
    slug: food.slug,
    ...(food.slug === 'pollo' ? { classes: ['animal', 'meat'] as const } : food.slug === 'yogur' ? { classes: ['animal', 'dairy'] as const } : {})
  })
);
const catalogue = makeCatalogue(plates);

/** A small deterministic generator, so the pool is varied and the same every run. */
function lcg(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;

    return state / 2_147_483_648;
  };
}

function pool(slots: readonly MealSlot[]): CandidateDish[] {
  const random = lcg(16);

  return slots.flatMap(slot =>
    Array.from({ length: 24 }, (_none, index) => {
      const count = 2 + Math.floor(random() * 3);
      const ingredients = Array.from({ length: count }, () => ({
        grams: Math.round(20 + random() * (slot.endsWith('snack') ? 80 : 180)),
        slug: (FOODS[Math.floor(random() * FOODS.length)] as (typeof FOODS)[number]).slug
      }));
      const unique = [...new Map(ingredients.map(item => [item.slug, item])).values()];

      return {
        cookMinutes: 10,
        cuisine: 'mediterranea',
        difficulty: 'easy' as const,
        ingredients: unique,
        name: `${slot} ${index}`,
        prepMinutes: 5,
        servings: 1,
        slots: [slot],
        slug: `${slot}-${index}`,
        steps: [{ text: 'Cocinar.' }]
      };
    })
  );
}

function digest(assignment: PlanAssignment): string {
  const plain = assignment.days.map(day => ({
    dayIndex: day.dayIndex,
    meals: day.meals.map(meal => ({
      dish: meal.dish.slug,
      ingredients: meal.ingredients,
      macros: meal.macros,
      servings: meal.servings,
      slot: meal.slot,
      sortOrder: meal.sortOrder
    })),
    totals: day.totals
  }));

  return createHash('sha256').update(JSON.stringify(plain)).digest('hex');
}

function scaled(kcalScale: number): NutritionTargets {
  return {
    carbsG: TARGETS.carbsG * kcalScale,
    fatG: TARGETS.fatG * kcalScale,
    fiberG: TARGETS.fiberG,
    kcal: TARGETS.kcal * kcalScale,
    proteinG: TARGETS.proteinG * kcalScale
  };
}

function assignmentFor(shape: MealShape, kcalScale: number): PlanAssignment {
  const weights = weightsFor(shape);
  const targets = scaled(kcalScale);
  const result = schedulePlan({ catalogue, minimumKcal: MINIMUM_KCAL, pool: pool([...weights.keys()]), targets, weights });

  if (!result.ok) {
    throw new Error('the fixture pool must schedule');
  }

  return result.assignment;
}

function plan(shape: MealShape, kcalScale: number): string {
  return digest(assignmentFor(shape, kcalScale));
}

const TWO_MEALS: MealShape = { afternoon_snack: 'off', breakfast: 'off', dinner: 'normal', lunch: 'normal', morning_snack: 'light', supper: 'off' };

// All three moved again with 017 phase 2's fix: a day's swaps judged on its
// bands before the variety rules' prices, and no repair deepening a day's energy
// miss (`energyMiss`). On this toy pool it is a trade, not a gain — three meals:
// worst carbohydrate day 22% to 6%, worst energy day 6% to 9%; days inside 5% on
// all four 4, 11 and 3 of 14 (were 4, 12 and 4). The reference library is the
// measure: 176/182 such days to 180/182 without accompaniments, 182/182 to
// 181/182 with them.
// All three moved again with 017 phase 3: a day still outside its bands after
// the spread pass is repaired by a swap sized to them (`repairOutOfBand`). On
// this toy pool, three meals 4 to 5 days of 14 inside 5% on all four, the two
// main meals' worst day 15.2% to 14.4%, five meals unchanged at 11.
// Two moved with 019 phase 3: PRD 019's maximums are held (`heldMaximums`),
// and on this pool of ten foods the only meat is chicken and an egg dish is
// counted by the egg, so the caps bite early. Days inside 5% on all
// four unchanged (5, 11 and 2 of 14). Five meals: worst energy day 10.6% to
// 5.9%. The two main meals: the worst day trades 10.9% over its carbohydrate
// for 19.9% over its protein, and days 9 and 14 serve the same three dishes,
// no repair keeping the day as close to its bands. The reference library is
// the measure: 196/196 days, off and on, and no identical days.
describe('the scheduler with accompaniments off — the plans it always made', () => {
  it('three meals, an ordinary target', () => {
    expect(plan(shapeFor(3, false), 1)).toBe('6709f8bdb9c8a4010ad2c40954d61c01926c7c5377b57c81c88753a1eb38b289');
  });

  // Moved in 017 phase 2 (group D): the snacks of these shapes are now held to
  // three of a kind a fortnight (`SNACK_RULES`), and every fixture snack is one kind.
  it('five meals, a high target', () => {
    expect(plan(shapeFor(5, true), 1.8)).toBe('801e3ae9e01b00059acc6f242f731a080264f90ef66baab56f86e91ad096380a');
  });

  it('two big main meals and a light snack', () => {
    expect(plan(TWO_MEALS, 1.1)).toBe('b4a48021a523eeb7259dc9f7a77aaa697f47c9b21356e2107e00056e2b49d4b0');
  });

  it('a swap', () => {
    const replacement = pickReplacement({
      budget: { carbsG: 80, fatG: 25, kcal: 800, proteinG: 45 },
      catalogue,
      dayIndex: 3,
      placed: [],
      plateMinimumKcal: 0,
      pool: pool(['lunch']),
      slot: 'lunch'
    });

    expect(createHash('sha256').update(JSON.stringify(replacement)).digest('hex')).toBe(
      'a904b080b51a87150c83263c70337856a2035cf290bd8c5cda0f0d59778fba45'
    );
  });
});

describe('the scheduler repairs a day still outside its bands (017 phase 3)', () => {
  const BAND_KINDS: ReadonlySet<string> = new Set([
    'carbs_out_of_band',
    'fat_out_of_band',
    'kcal_out_of_band',
    'protein_above_target',
    'protein_below_target'
  ]);

  it('brings one more day of three meals inside 5% on all four macros, by a swap sized to the bands', () => {
    const shape = shapeFor(3, false);
    const violations = validatePlan({
      assignment: assignmentFor(shape, 1),
      expectedDays: 14,
      expectedSlots: [...weightsFor(shape).keys()],
      sex: 'male',
      targets: scaled(1),
      weightKg: 80
    });
    const outside = new Set(violations.flatMap(violation => (BAND_KINDS.has(violation.kind) && 'dayIndex' in violation ? [violation.dayIndex] : [])));

    // 4 of 14 before the repair, on this toy pool.
    expect(14 - outside.size).toBe(5);
  });
});

// --- With accompaniments on (project 016 phase 3) ------------------------------

const SIDE_SLUGS = [...new Set(ACCOMPANIMENTS.flatMap(entry => entry.portions.flat().map(item => item.slug)))];
const MILK = 'a-milk';
const sides = makeAccompanimentRows(SIDE_SLUGS, {
  'queso-de-burgos': { allergens: [{ allergenId: MILK, presence: 'contains' }] },
  requeson: { allergens: [{ allergenId: MILK, presence: 'contains' }] },
  'yogur-griego-natural': { allergens: [{ allergenId: MILK, presence: 'contains' }] },
  'yogur-natural-desnatado': { allergens: [{ allergenId: MILK, presence: 'contains' }] }
});
// The plates' own yoghurt is milk too, so an allergic person's pool and sides are both judged.
const withSides: Catalogue = toCatalogue([
  ...plates.map(row => (row.slug === 'yogur' ? { ...row, allergens: [{ allergenId: MILK, presence: 'contains' as const }] } : row)),
  ...sides
]);

/** Table 3's fruit, by key: the only thing a snack may be offered (`0095`). */
const FRUIT_SIDES = new Set(
  ACCOMPANIMENTS.filter(entry => entry.role === 'dessert' && entry.slots.includes('morning_snack')).map(entry => entry.key)
);

function diner(overrides: Partial<AccompanimentDiner> = {}): AccompanimentDiner {
  return { catalogue: withSides, preferences: NO_PREFERENCE_EXCLUSIONS, safety: toSafetyProfile([], []), ...overrides };
}

function planWithSides(shape: MealShape, kcalScale: number, who: AccompanimentDiner = diner(), dishes?: readonly CandidateDish[]) {
  const weights = weightsFor(shape);
  const result = schedulePlan({
    accompaniments: { larder: larderFor(who), monthOf: () => 10 },
    catalogue: withSides,
    minimumKcal: MINIMUM_KCAL,
    pool: dishes ?? pool([...weights.keys()]),
    targets: scaled(kcalScale),
    weights
  });

  if (!result.ok) {
    throw new Error('the fixture pool must schedule');
  }

  return result.assignment;
}

describe('the scheduler with accompaniments on', () => {
  // One plan for the tests that only read it: the search with sets is the slow part.
  let ordinary: PlanAssignment | undefined;
  const ordinaryPlan = (): PlanAssignment => (ordinary ??= planWithSides(TWO_MEALS, 1.1));

  it('leaves the field off every meal when the flag is off', () => {
    const weights = weightsFor(TWO_MEALS);
    const result = schedulePlan({ catalogue, minimumKcal: MINIMUM_KCAL, pool: pool([...weights.keys()]), targets: scaled(1.1), weights });

    expect(result.ok && result.assignment.days.flatMap(day => day.meals).some(meal => 'accompaniments' in meal)).toBe(false);
  });

  it('puts bread, salad or fruit beside big lunches and dinners, and the meal carries all of it', () => {
    const assignment = ordinaryPlan();
    const meals = assignment.days.flatMap(day => day.meals);
    const mains = meals.filter(meal => meal.slot === 'lunch' || meal.slot === 'dinner');

    expect(mains.some(meal => (meal.accompaniments ?? []).length > 0)).toBe(true);

    for (const meal of meals) {
      const sideList = meal.accompaniments ?? [];
      const base = composePerServing(meal.dish, withSides);

      expect(meal.accompaniments).toBeDefined();
      expect(sideList.length).toBeLessThanOrEqual(3);
      // The meal's rows are the plate's, then every accompaniment's.
      expect(meal.ingredients.slice(meal.dish.ingredients.length)).toEqual(sideList.flatMap(side => side.ingredients));
      // And its macros are the plate's plus theirs, as the plan adds them.
      expect(base.ok).toBe(true);
      expect(meal.macros).toEqual(
        sideList.reduce((sum, side) => addMacros(sum, side.macros), base.ok ? scaleMacros(base.macros, meal.servings) : meal.macros)
      );
    }

    for (const day of assignment.days) {
      const kcal = day.meals.reduce((sum, meal) => sum + meal.macros.kcal, 0);

      expect(day.totals.kcal).toBeCloseTo(kcal, 1);
      // A fixture of ten foods, held to a fixture's band.
      expect(Math.abs(day.totals.kcal - scaled(1.1).kcal) / scaled(1.1).kcal).toBeLessThan(0.1);
    }
  });

  // A rice beside the plate counts towards the starch rule like the plate's own
  // (019 phase 3): plates of chicken and vegetables, Japanese, so rice is a
  // starch the larder offers beside them at every big lunch and dinner — and
  // 60 g of bread here carries what 50 g of rice does, so a day loses nothing
  // in its bands by taking the bread instead.
  const breadLikeRice: Catalogue = toCatalogue([
    ...plates,
    ...sides.map(row =>
      row.slug === 'pan-blanco' ? { ...row, carbsPer100g: 65, fatPer100g: 0.58, fiberPer100g: 1.67, kcalPer100g: 300, proteinPer100g: 5.83 } : row
    )
  ]);

  it('holds a rice beside the plate to the starch rule, and moves no day further from its energy', () => {
    const random = lcg(19);
    const mains = (['lunch', 'dinner'] as const).flatMap(slot =>
      Array.from({ length: 24 }, (_none, index) => ({
        cookMinutes: 10,
        cuisine: 'japonesa',
        difficulty: 'easy' as const,
        ingredients: [
          { grams: Math.round(120 + random() * 80), slug: 'pollo' },
          { grams: Math.round(100 + random() * 150), slug: 'verdura' },
          { grams: Math.round(5 + random() * 10), slug: 'aceite' }
        ],
        name: `${slot} ${index}`,
        prepMinutes: 5,
        servings: 1,
        slots: [slot],
        slug: `${slot}-${index}`,
        steps: [{ text: 'Cocinar.' }]
      }))
    );
    // Without the wholemeal roll the starches beside a plate are all refined, so
    // the rice competes on the macros alone — which is the rule under test here.
    // With it offered, `REFINED_SIDE_WEIGHT` turns every one of these meals into
    // a `pan-integral` and there is no side rice left to hold (`0087`).
    const noWholemeal = {
      ...NO_PREFERENCE_EXCLUSIONS,
      excludedIngredientIds: new Set([breadLikeRice.get('pan-integral')?.id].filter((id): id is string => id !== undefined))
    };
    const assignment = planWithSides(TWO_MEALS, 1.1, diner({ catalogue: breadLikeRice, preferences: noWholemeal }), [
      ...mains,
      ...pool(['morning_snack'])
    ]);
    const riceDays = assignment.days.flatMap(day =>
      day.meals.filter(meal => (meal.accompaniments ?? []).some(side => side.key.startsWith('arroz'))).map(() => day.dayIndex)
    );

    expect(riceDays.length).toBeGreaterThan(0);
    expect(riceDays.length).toBeLessThanOrEqual(4);
    expect(riceDays.filter((day, index) => index > 0 && day - (riceDays[index - 1] as number) <= 1)).toEqual([]);

    // Plates with no carbohydrate of their own leave two days 12% under their
    // energy whatever goes beside them; the hold moves none further.
    for (const day of assignment.days) {
      expect(Math.abs(day.totals.kcal - scaled(1.1).kcal) / scaled(1.1).kcal).toBeLessThan(0.13);
    }
  });

  it('weighs the plate, not the meal, against the flat ceiling', () => {
    const assignment = ordinaryPlan();

    for (const meal of assignment.days.flatMap(day => day.meals)) {
      const plateGrams = meal.ingredients.slice(0, meal.dish.ingredients.length).reduce((sum, item) => sum + item.grams, 0);

      expect(plateGrams).toBeLessThanOrEqual(PLATE_GRAMS_MAX[meal.slot] + 0.5);
    }
  });

  /**
   * `ACCOMPANIED_FROM_KCAL` used to be 700, and a meal below it was left alone:
   * a plate that size was a meal on its own, and a person who ate five times on
   * an ordinary target paid nothing in search. `0087` asks for 150 g of
   * vegetables at **every** lunch and dinner and two fruit a day, and most of
   * both arrive beside the plate — so the two could not both stand. The ones
   * who lost were the people this rule was meant to spare: five meals on 1,800
   * kcal put every one of them under 700, and their plans carried no vegetables
   * from a side at all and a third of the fruit of a two-meal day.
   *
   * What is left of the rule is the slot: nothing goes beside a breakfast, a
   * snack or a supper, whatever its share of the day.
   */
  it('offers a side at every lunch and dinner, and at no meal that is not a snack', () => {
    const shape = shapeFor(5, true);
    const shares = mealShareKcal(shape, scaled(1));

    // Five meals on this target: every one of them is a meal the old rule left alone.
    expect(Math.max(...[...shares.values()])).toBeLessThanOrEqual(700);

    const meals = planWithSides(shape, 1).days.flatMap(day => day.meals);

    // A snack may be given a piece of fruit afterwards (`0095`, `meetSides`); a breakfast
    // and a supper may not, though Table 3 has written sides for a breakfast since 016.
    for (const meal of meals.filter(entry => entry.slot === 'breakfast' || entry.slot === 'supper')) {
      expect(meal.accompaniments, meal.slot).toEqual([]);
    }

    for (const meal of meals.filter(entry => entry.slot === 'morning_snack' || entry.slot === 'afternoon_snack')) {
      // Nothing but fruit: Table 3 gives a snack no bread, no salad and no starch.
      for (const side of meal.accompaniments ?? []) {
        expect(FRUIT_SIDES.has(side.key), `${meal.slot} took ${side.key}`).toBe(true);
      }
    }

    expect(meals.some(meal => (meal.accompaniments ?? []).length > 0)).toBe(true);
  });

  it('never puts milk on the table of somebody allergic to it — plate or side', () => {
    const safety = toSafetyProfile([{ allergenId: MILK, crossContaminationSensitive: false }], []);
    const weights = weightsFor(TWO_MEALS);
    const safePool = pool([...weights.keys()]).filter(dish => dishSafety(dish.ingredients, withSides, safety).kind === 'safe');

    for (const meal of planWithSides(TWO_MEALS, 1.1, diner({ safety }), safePool).days.flatMap(day => day.meals)) {
      expect(dishSafety(meal.ingredients, withSides, safety)).toEqual({ kind: 'safe' });
    }
  });

  it('keeps meat and dairy apart over the whole meal for somebody who keeps them apart', () => {
    const kosher = { ...NO_PREFERENCE_EXCLUSIONS, keepsMeatFromDairy: true };
    const weights = weightsFor(TWO_MEALS);
    const kosherPool = pool([...weights.keys()]).filter(dish => !breaksDishRule(dish.ingredients, withSides, kosher));
    const meals = planWithSides(TWO_MEALS, 1.1, diner({ preferences: kosher }), kosherPool).days.flatMap(day => day.meals);

    expect(meals.some(meal => meal.ingredients.some(item => item.slug === 'pollo'))).toBe(true);

    for (const meal of meals) {
      expect(breaksDishRule(meal.ingredients, withSides, kosher)).toBe(false);
    }
  });

  it('composes a set for a swapped dish too, inside the old meal', () => {
    const replacement = pickReplacement({
      accompaniments: { larder: larderFor(diner()), month: 10 },
      budget: { carbsG: 120, fatG: 35, kcal: 1050, proteinG: 60 },
      catalogue: withSides,
      dayIndex: 3,
      placed: [],
      plateMinimumKcal: 0,
      pool: pool(['lunch']),
      slot: 'lunch'
    });
    const sideList = replacement?.accompaniments ?? [];

    expect(replacement).toBeDefined();
    expect(replacement?.ingredients.slice(replacement.dish.ingredients.length)).toEqual(sideList.flatMap(side => side.ingredients));
    expect(Math.abs((replacement?.macros.kcal ?? 0) - 1050) / 1050).toBeLessThan(0.15);
  });
});

// --- Phase 4: the sides' share, kosher over the whole set, and the ceiling -----

describe('the scheduler with accompaniments on — phase 4', () => {
  it(`never lets the sides carry more than ${ACCOMPANIMENT_MAX_SHARE * 100}% of a meal's energy, in a plan or a swap`, () => {
    const meals = planWithSides(TWO_MEALS, 1.3).days.flatMap(day => day.meals);
    const sided = meals.filter(meal => (meal.accompaniments ?? []).length > 0);

    expect(sided.length).toBeGreaterThan(0);

    for (const meal of sided) {
      const besideKcal = (meal.accompaniments ?? []).reduce((sum, side) => sum + side.macros.kcal, 0);

      expect(besideKcal / meal.macros.kcal).toBeLessThanOrEqual(ACCOMPANIMENT_MAX_SHARE + 1e-3);
    }

    for (const kcal of [800, 1050, 1300]) {
      const replacement = pickReplacement({
        accompaniments: { larder: larderFor(diner()), month: 10 },
        budget: { carbsG: (kcal * 0.5) / 4, fatG: (kcal * 0.3) / 9, kcal, proteinG: (kcal * 0.2) / 4 },
        catalogue: withSides,
        dayIndex: 3,
        placed: [],
        plateMinimumKcal: 0,
        pool: pool(['lunch']),
        slot: 'lunch'
      });
      const besideKcal = (replacement?.accompaniments ?? []).reduce((sum, side) => sum + side.macros.kcal, 0);

      expect(replacement).toBeDefined();
      expect(besideKcal / (replacement?.macros.kcal ?? 1)).toBeLessThanOrEqual(ACCOMPANIMENT_MAX_SHARE + 1e-3);
    }
  });

  // A side that is meat and one that is dairy each pass beside a plain plate;
  // together they break the rule. Only the set's own check (`setsBeside`) sees it.
  const meatyBread: Catalogue = toCatalogue([
    ...plates,
    ...makeAccompanimentRows(
      SIDE_SLUGS,
      Object.fromEntries(SIDE_SLUGS.filter(slug => slug.startsWith('pan-')).map(slug => [slug, { classes: ['animal', 'meat'] }]))
    )
  ]);
  const kosher = { ...NO_PREFERENCE_EXCLUSIONS, keepsMeatFromDairy: true };
  const keeper: AccompanimentDiner = { catalogue: meatyBread, preferences: kosher, safety: toSafetyProfile([], []) };
  const plain = (slots: readonly MealSlot[]): CandidateDish[] =>
    pool(slots).filter(dish => dish.ingredients.every(item => item.slug !== 'pollo' && item.slug !== 'yogur'));

  const both = (ingredients: readonly { readonly slug: string }[]): boolean => {
    const classes = new Set(ingredients.flatMap(item => meatyBread.get(item.slug)?.classes ?? []));

    return classes.has('meat') && classes.has('dairy');
  };

  it('keeps meat and dairy apart over the whole set, through schedulePlan', () => {
    const weights = weightsFor(TWO_MEALS);
    const result = schedulePlan({
      accompaniments: { larder: larderFor(keeper), monthOf: () => 10 },
      catalogue: meatyBread,
      minimumKcal: MINIMUM_KCAL,
      pool: plain([...weights.keys()]),
      targets: scaled(1.3),
      weights
    });
    const meals = result.ok ? result.assignment.days.flatMap(day => day.meals) : [];

    expect(result.ok).toBe(true);
    // Meat bread and yoghurt are both on offer, each on its own.
    expect(meals.some(meal => (meal.accompaniments ?? []).some(side => side.key.startsWith('pan-')))).toBe(true);
    expect(meals.some(meal => (meal.accompaniments ?? []).some(side => side.key.startsWith('yogur')))).toBe(true);

    for (const meal of meals) {
      expect(both(meal.ingredients)).toBe(false);
    }
  });

  it('keeps meat and dairy apart over the whole set, through pickReplacement', () => {
    for (const kcal of [800, 1050, 1300]) {
      for (const dish of plain(['lunch'])) {
        const replacement = pickReplacement({
          accompaniments: { larder: larderFor(keeper), month: 10 },
          budget: { carbsG: (kcal * 0.5) / 4, fatG: (kcal * 0.3) / 9, kcal, proteinG: (kcal * 0.2) / 4 },
          catalogue: meatyBread,
          dayIndex: 3,
          placed: [],
          plateMinimumKcal: 0,
          pool: [dish],
          slot: 'lunch'
        });

        expect(both(replacement?.ingredients ?? [])).toBe(false);
      }
    }
  });

  // One dish of 400 g a serving at 464 kcal: a 1,100-kcal lunch wants it at 2.25 servings, 900 g.
  const heavy: CandidateDish = { ...(pool(['lunch'])[0] as CandidateDish), ingredients: [{ grams: 400, slug: 'lenteja' }], slug: 'heavy' };
  const heavyLunch = { carbsG: 135, fatG: 30, kcal: 1100, proteinG: 70 };
  const plateGramsOf = (replacement: ReturnType<typeof pickReplacement>): number =>
    (replacement?.ingredients ?? []).slice(0, replacement?.dish.ingredients.length ?? 0).reduce((sum, item) => sum + item.grams, 0);

  it('lets a big lunch weigh more than the flat ceiling while the flag is off (phase 1, scaled)', () => {
    const replacement = pickReplacement({
      budget: heavyLunch,
      catalogue,
      dayIndex: 3,
      placed: [],
      plateMinimumKcal: 0,
      pool: [heavy],
      slot: 'lunch'
    });

    expect(plateGramsOf(replacement)).toBeGreaterThan(PLATE_GRAMS_MAX.lunch);
    expect(plateGramsOf(replacement)).toBeLessThanOrEqual(plateGramsMax('lunch', heavyLunch.kcal) + 0.5);
  });

  it('holds every plate to the flat 750 / 250 g once the flag is on', () => {
    const replacement = pickReplacement({
      accompaniments: { larder: larderFor(diner()), month: 10 },
      budget: heavyLunch,
      catalogue: withSides,
      dayIndex: 3,
      placed: [],
      plateMinimumKcal: 0,
      pool: [heavy],
      slot: 'lunch'
    });

    expect(replacement).toBeDefined();
    expect(plateGramsOf(replacement)).toBeLessThanOrEqual(PLATE_GRAMS_MAX.lunch + 0.5);

    const meals = planWithSides(shapeFor(5, true), 1.3).days.flatMap(day => day.meals);

    for (const meal of meals) {
      const plateGrams = meal.ingredients.slice(0, meal.dish.ingredients.length).reduce((sum, item) => sum + item.grams, 0);

      expect(plateGrams).toBeLessThanOrEqual(PLATE_GRAMS_MAX[meal.slot] + 0.5);
    }
  });
});

describe('vegetables and fruit beside the plate (019 phase 5b)', () => {
  it('brings 150 g of vegetables to more of the mains and two fruits to more of the days than the day’s own search does', async () => {
    const { mealGroups } = await import('core/domain/Balance');
    const assignment = planWithSides(TWO_MEALS, 1.1);
    let vegetableMains = 0;
    let fruitDays = 0;

    for (const day of assignment.days) {
      let fruit = 0;

      for (const meal of day.meals) {
        const groups = mealGroups(meal.ingredients, withSides);

        fruit += groups.fruitPortions;
        vegetableMains += (meal.slot === 'lunch' || meal.slot === 'dinner') && groups.vegetables >= 150 ? 1 : 0;
      }

      fruitDays += fruit >= 2 ? 1 : 0;
    }

    // Without `meetSides`, this pool has 11 of 28 mains and 1 of 14 days.
    expect(vegetableMains).toBeGreaterThanOrEqual(14);
    expect(fruitDays).toBeGreaterThanOrEqual(3);
  });
});
