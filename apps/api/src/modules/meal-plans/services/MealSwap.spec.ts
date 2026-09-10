import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { NO_PREFERENCE_EXCLUSIONS } from 'core/domain/Preference';
import { QuotaExceededError } from 'core/entities/Error';
import { PlanController } from 'core/controllers/Plan';
import { ProfileController } from 'core/controllers/Profile';
import { RecipeController } from 'core/controllers/Recipe';
import { toCatalogue } from 'core/entities/Plan';

import { MealSwapService } from './MealSwap.service.js';

import type { CandidateDish, CatalogueIngredient, MealSlot } from 'core/entities/Plan';
import type { MealCompositionView } from 'core/controllers/Plan';
import type { PoolBuilder, PoolResult } from '../../ai/services/PoolBuilder.service.js';

const MEAL = '11111111-1111-4111-8111-111111111111';

function ingredient(slug: string, kcalPer100g: number, proteinPer100g: number): CatalogueIngredient {
  return {
    id: `i-${slug}`,
    allergens: [],
    carbsPer100g: 10,
    category: 'pantry',
    classes: [],
    defaultUnit: 'g',
    fatPer100g: 2,
    fiberPer100g: 1,
    gramsPerUnit: null,
    kcalPer100g,
    name: slug,
    nameLocale: 'es-ES',
    proteinPer100g,
    slug
  };
}

const CATALOGUE: readonly CatalogueIngredient[] = [ingredient('rice', 130, 2.7), ingredient('chicken', 120, 22.5), ingredient('lentils', 116, 9)];
const SAFETY = {
  allergenIds: new Set<string>(),
  crossContaminationAllergenIds: new Set<string>(),
  excludedIngredientIds: new Set<string>(),
  intoleranceAllergenIds: new Set<string>(),
  unenforceableLabels: []
};

function lunch(slug: string, ingredients: { grams: number; slug: string }[]): CandidateDish {
  return {
    cookMinutes: 10,
    cuisine: null,
    difficulty: 'easy',
    ingredients,
    name: slug,
    prepMinutes: 5,
    servings: 1,
    slots: ['lunch'],
    slug,
    steps: [{ text: 'Cocer 10 minutos' }, { text: 'Servir' }]
  };
}

const CURRENT = lunch('lentil-stew', [
  { grams: 300, slug: 'lentils' },
  { grams: 100, slug: 'rice' }
]);
const FITS = lunch('chicken-rice', [
  { grams: 200, slug: 'chicken' },
  { grams: 250, slug: 'rice' }
]);
const DISLIKED = lunch('chicken-rice-bad', [
  { grams: 200, slug: 'chicken' },
  { grams: 250, slug: 'rice' }
]);

function meal(id: string, dayIndex: number, slot: MealSlot, dish: CandidateDish): MealCompositionView {
  return {
    id,
    dayIndex,
    ingredients: dish.ingredients,
    macros: { carbsG: 60, fatG: 8, fiberG: 10, kcal: 560, proteinG: 42 },
    recipeSlug: dish.slug,
    servings: 1,
    slot,
    sortOrder: 0
  };
}

function harness(
  options: { readonly generated?: readonly CandidateDish[]; readonly library?: readonly CandidateDish[]; readonly remaining?: number } = {}
) {
  jest
    .spyOn(PlanController, 'mealForSwap')
    .mockResolvedValue({
      day: { id: 'day-3', dayIndex: 3 },
      meal: { id: MEAL } as never,
      plan: {
        id: 'plan-1',
        endDate: '2026-09-22',
        startDate: '2026-09-09',
        status: 'active',
        strategy: { carbsG: 250, fatG: 70, fiberG: 30, kcal: 2200, proteinG: 160 }
      },
      recipe: { id: 'r-1', cookMinutes: 10, name: 'Lentil stew', prepMinutes: 5, servings: 1, slug: 'lentil-stew' }
    } as never);
  jest
    .spyOn(PlanController, 'allowances')
    .mockResolvedValue({
      events: { limit: 3, midPlan: null, remaining: 3 },
      mealSwaps: { allowed: (options.remaining ?? 5) > 0, limit: 5, remaining: options.remaining ?? 5, used: 5 - (options.remaining ?? 5) },
      planRedo: { allowed: true, kind: 'redo', limit: 1, nextAt: null, used: 0 },
      tier: 'free'
    });
  jest
    .spyOn(RecipeController, 'generationContext')
    .mockResolvedValue({ catalogue: toCatalogue(CATALOGUE), locale: 'es-ES', preferences: NO_PREFERENCE_EXCLUSIONS, safety: SAFETY });
  jest.spyOn(RecipeController, 'verdicts').mockResolvedValue({ disliked: [{ name: 'Bad', slug: 'chicken-rice-bad' }], liked: [] });
  jest
    .spyOn(ProfileController, 'getFullProfile')
    .mockResolvedValue({ cuisines: [], dietaryPatterns: [], foodPreferences: [], preferences: null } as never);
  jest.spyOn(PlanController, 'composition').mockResolvedValue([meal(MEAL, 3, 'lunch', CURRENT), meal('m-2', 4, 'dinner', FITS)]);
  jest.spyOn(RecipeController, 'reusablePool').mockResolvedValue(options.library ?? []);
  const swapMeal = jest.spyOn(PlanController, 'swapMeal').mockResolvedValue(undefined);
  jest.spyOn(PlanController, 'getMeal').mockResolvedValue({ id: MEAL } as never);

  const build = jest.fn<(input: unknown) => Promise<PoolResult>>(async () =>
    Promise.resolve({
      dishes: options.generated ?? [],
      generated: options.generated ?? [],
      metadata: {
        attempts: 1,
        backfilled: 0,
        calls: 1,
        inputTokens: 0,
        model: 'gemini',
        outputTokens: 0,
        promptVersion: '2.5.0',
        providerUsed: true,
        rejected: 0,
        reused: 0
      }
    })
  );

  return { build, service: new MealSwapService({ build } as unknown as PoolBuilder), swapMeal };
}

describe('MealSwapService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serves the swap from the library when a dish fits, without calling the model', async () => {
    const fresh = lunch('turkey-rice', [
      { grams: 200, slug: 'chicken' },
      { grams: 250, slug: 'rice' }
    ]);
    const { build, service, swapMeal } = harness({ library: [DISLIKED, fresh] });

    await service.swap('user-1', MEAL, 'es-ES');

    expect(build).not.toHaveBeenCalled();
    const change = swapMeal.mock.calls[0]?.[2];

    expect(change?.recipeSlug).toBe('turkey-rice');
    expect(change?.source).toBe('library');
    expect(change?.newRecipe).toBeNull();
  });

  it('never offers a dish the person disliked, nor one already in the plan', async () => {
    // FITS is already in the plan (day 4, dinner); DISLIKED is disliked. Nothing else → the model is asked.
    const { build, service } = harness({
      generated: [
        lunch('new-dish', [
          { grams: 220, slug: 'chicken' },
          { grams: 230, slug: 'rice' }
        ])
      ],
      library: [DISLIKED, FITS]
    });

    await service.swap('user-1', MEAL, 'es-ES');

    expect(build).toHaveBeenCalledTimes(1);
  });

  it('asks the model for a handful of dishes for that one slot when the library has nothing, and stores the new recipe', async () => {
    const written = lunch('model-dish', [
      { grams: 220, slug: 'chicken' },
      { grams: 230, slug: 'rice' }
    ]);
    const { build, service, swapMeal } = harness({ generated: [written] });

    await service.swap('user-1', MEAL, 'es-ES');

    const input = build.mock.calls[0]?.[0] as { needPerSlot: number; slots: readonly MealSlot[] } | undefined;

    expect(input?.needPerSlot).toBe(3);
    expect(input?.slots).toEqual(['lunch']);
    const change = swapMeal.mock.calls[0]?.[2];

    expect(change?.source).toBe('model');
    expect(change?.newRecipe?.slug).toBe('model-dish');
  });

  it('rebuilds the shopping list from the whole plan with the new dish in place', async () => {
    const fresh = lunch('turkey-rice', [
      { grams: 200, slug: 'chicken' },
      { grams: 250, slug: 'rice' }
    ]);
    const { service, swapMeal } = harness({ library: [fresh] });

    await service.swap('user-1', MEAL, 'es-ES');

    const items = swapMeal.mock.calls[0]?.[3] ?? [];
    const names = items.map(item => item.name);

    // Lentils left with the old dish; chicken and rice aggregate across the two meals.
    expect(names).not.toContain('lentils');
    expect(items.find(item => item.ingredientId === 'i-rice')?.totalGrams).toBeGreaterThan(250);
  });

  it('quicker: only a dish that takes less time than the current one, library first', async () => {
    const slow = {
      ...lunch('slow-rice', [
        { grams: 200, slug: 'chicken' },
        { grams: 250, slug: 'rice' }
      ]),
      cookMinutes: 30,
      prepMinutes: 10
    };
    const quick = {
      ...lunch('quick-rice', [
        { grams: 190, slug: 'chicken' },
        { grams: 260, slug: 'rice' }
      ]),
      cookMinutes: 0,
      prepMinutes: 8
    };
    const { build, service, swapMeal } = harness({ library: [slow, quick] });

    await service.swap('user-1', MEAL, 'es-ES', 'quicker');

    expect(build).not.toHaveBeenCalled();
    expect(swapMeal.mock.calls[0]?.[2]?.recipeSlug).toBe('quick-rice');
  });

  it('tells the model what was asked when the library cannot answer it, and holds the answer to it too', async () => {
    const slow = {
      ...lunch('slow-rice', [
        { grams: 200, slug: 'chicken' },
        { grams: 250, slug: 'rice' }
      ]),
      cookMinutes: 30,
      prepMinutes: 10
    };
    const cooked = {
      ...lunch('model-cooked', [
        { grams: 220, slug: 'chicken' },
        { grams: 230, slug: 'rice' }
      ]),
      cookMinutes: 12,
      prepMinutes: 5
    };
    const raw = {
      ...lunch('model-raw', [
        { grams: 210, slug: 'chicken' },
        { grams: 240, slug: 'rice' }
      ]),
      cookMinutes: 0,
      prepMinutes: 10
    };
    const { build, service, swapMeal } = harness({ generated: [cooked, raw], library: [slow] });

    await service.swap('user-1', MEAL, 'es-ES', 'no_cooking');

    const input = build.mock.calls[0]?.[0] as { preferences: { swapWish: string | null } } | undefined;

    expect(input?.preferences.swapWish).toContain('no cooking');
    expect(swapMeal.mock.calls[0]?.[2]?.recipeSlug).toBe('model-raw');
  });

  it('more protein: a richer plate for the same calories, or nothing', async () => {
    const same = lunch('lentil-again', [
      { grams: 300, slug: 'lentils' },
      { grams: 100, slug: 'rice' }
    ]);
    const richer = lunch('chicken-plate', [
      { grams: 300, slug: 'chicken' },
      { grams: 100, slug: 'rice' }
    ]);
    const { service, swapMeal } = harness({ library: [same, richer] });

    await service.swap('user-1', MEAL, 'es-ES', 'more_protein');

    expect(swapMeal.mock.calls[0]?.[2]?.recipeSlug).toBe('chicken-plate');
  });

  it('refuses when the plan has no swaps left, before looking anything up', async () => {
    const reusablePool = jest.spyOn(RecipeController, 'reusablePool');
    const { service } = harness({ library: [FITS], remaining: 0 });

    await expect(service.swap('user-1', MEAL, 'es-ES')).rejects.toBeInstanceOf(QuotaExceededError);
    expect(reusablePool).not.toHaveBeenCalled();
  });
});
