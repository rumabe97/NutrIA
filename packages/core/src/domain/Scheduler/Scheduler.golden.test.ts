import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { pickReplacement, schedulePlan } from 'core/domain/Scheduler';
import { shapeFor, weightsFor } from 'core/domain/MealShape';
import { makeCatalogue, makeCatalogueIngredient, MINIMUM_KCAL, TARGETS } from '#test/fixtures';

import type { CandidateDish, MealSlot, PlanAssignment } from 'core/entities/Plan';
import type { MealShape } from 'core/entities/Profile';

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

const catalogue = makeCatalogue(
  FOODS.map((food, index) =>
    makeCatalogueIngredient({
      id: `ing-${index}`,
      carbsPer100g: food.carbs,
      fatPer100g: food.fat,
      fiberPer100g: 1,
      kcalPer100g: food.kcal,
      name: food.slug,
      proteinPer100g: food.protein,
      slug: food.slug
    })
  )
);

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

function plan(shape: MealShape, kcalScale: number): string {
  const weights = weightsFor(shape);
  const targets = {
    carbsG: TARGETS.carbsG * kcalScale,
    fatG: TARGETS.fatG * kcalScale,
    fiberG: TARGETS.fiberG,
    kcal: TARGETS.kcal * kcalScale,
    proteinG: TARGETS.proteinG * kcalScale
  };
  const result = schedulePlan({ catalogue, minimumKcal: MINIMUM_KCAL, pool: pool([...weights.keys()]), targets, weights });

  if (!result.ok) {
    throw new Error('the fixture pool must schedule');
  }

  return digest(result.assignment);
}

const TWO_MEALS: MealShape = { afternoon_snack: 'off', breakfast: 'off', dinner: 'normal', lunch: 'normal', morning_snack: 'light', supper: 'off' };

describe('the scheduler with accompaniments off — the plans it always made', () => {
  it('three meals, an ordinary target', () => {
    expect(plan(shapeFor(3, false), 1)).toBe('c4a45a2989dd20d05d5c4d5db22e9825fa645275701eb90c3c305b1bc583a4b6');
  });

  it('five meals, a high target', () => {
    expect(plan(shapeFor(5, true), 1.8)).toBe('9ed7481961f71050515bb87beab8d173df234f7245665f40e5f20f34b8a676b0');
  });

  it('two big main meals and a light snack', () => {
    expect(plan(TWO_MEALS, 1.1)).toBe('9d742f73e4ac84f1bcb3cefa5da72384912a99b2e08858b82ab9793967700ac4');
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

    expect(createHash('sha256').update(JSON.stringify(replacement)).digest('hex')).toBe('a904b080b51a87150c83263c70337856a2035cf290bd8c5cda0f0d59778fba45');
  });
});
