import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlanController } from './PlanController';

import type * as RecipeModule from 'core/controllers/Recipe';
import type { PictureClaim } from 'core/controllers/Recipe';

const findMealDetail = vi.fn<() => Promise<unknown>>();
const loadCatalogue = vi.fn<(locale: string, country: string | null, slugs: readonly string[]) => Promise<unknown[]>>();
const requestPicture = vi.fn<(recipeId: string, capUsd: number) => Promise<PictureClaim | null>>();

vi.mock('#repositories/Plan', () => ({ PlanJobRepository: {}, PlanRepository: { findMealDetail: () => findMealDetail() } }));
vi.mock('#repositories/Recipe', () => ({
  FALLBACK_LOCALE: 'es-ES',
  RecipeRepository: {
    findVerdict: () => Promise.resolve(null),
    loadCatalogue: (locale: string, country: string | null, slugs: readonly string[]) => loadCatalogue(locale, country, slugs)
  }
}));
vi.mock('#repositories/Profile', () => ({ ProfileRepository: { findByUserId: () => Promise.resolve(null) } }));
vi.mock('core/controllers/Safety', () => ({
  SafetyController: {
    getSafetyProfile: () =>
      Promise.resolve({
        allergenIds: new Set(),
        crossContaminationAllergenIds: new Set(),
        excludedIngredientIds: new Set(),
        intoleranceAllergenIds: new Set(),
        unenforceableLabels: []
      })
  }
}));
vi.mock('core/controllers/Recipe', async importOriginal => ({
  ...(await importOriginal<typeof RecipeModule>()),
  RecipeController: { requestPicture: (recipeId: string, capUsd: number) => requestPicture(recipeId, capUsd) }
}));

const RECIPE = '6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f';

function detail(picture: { pictureStatus: string | null; pictureUrl: string | null }, items: readonly unknown[] = [], servings = '1') {
  return {
    day: { date: '2026-09-27', dayIndex: 0 },
    items,
    meal: { id: 'meal-1', carbsG: '10', fatG: '5', fiberG: '1', kcal: '300', proteinG: '20', servings, slot: 'lunch', status: 'planned' },
    plan: { id: 'plan-1', status: 'active' },
    recipe: {
      id: RECIPE,
      cookMinutes: 10,
      cuisine: null,
      difficulty: 'easy',
      instructions: [],
      name: 'Arroz',
      prepMinutes: 5,
      servings: 1,
      ...picture
    }
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* PRD 006, criterion 1: opening the meal page starts at most one drawing and never waits for it. */
describe('PlanController.openMeal', () => {
  it('asks for a picture when the dish has none, and says `drawing` for the caller that won the claim', async () => {
    const claim = { attempts: 0, claimedAt: new Date(), recipeId: RECIPE };

    findMealDetail.mockResolvedValue(detail({ pictureStatus: null, pictureUrl: null }));
    requestPicture.mockResolvedValue(claim);

    const opened = await PlanController.openMeal('usr-a', 'meal-1', null, 10);

    expect(requestPicture).toHaveBeenCalledWith(RECIPE, 10);
    expect(opened.claim).toBe(claim);
    expect(opened.meal).toMatchObject({ illustrationPath: null, pictureStatus: 'drawing' });
  });

  it('answers as it stands when no claim was won — the flag off, the cap reached, someone else drawing', async () => {
    findMealDetail.mockResolvedValue(detail({ pictureStatus: 'drawing', pictureUrl: null }));
    requestPicture.mockResolvedValue(null);

    await expect(PlanController.openMeal('usr-a', 'meal-1', null, 10)).resolves.toMatchObject({ claim: null, meal: { pictureStatus: 'drawing' } });
  });

  it('asks nothing for a dish whose picture is ready, and gives its address', async () => {
    findMealDetail.mockResolvedValue(detail({ pictureStatus: 'ready', pictureUrl: 'https://blob/x.jpg' }));

    const opened = await PlanController.openMeal('usr-a', 'meal-1', null, 10);

    expect(requestPicture).not.toHaveBeenCalled();
    expect(opened).toMatchObject({ claim: null, meal: { illustrationPath: 'https://blob/x.jpg', pictureStatus: 'ready' } });
  });

  it('still answers the meal when asking for its picture fails, and hands the failure back to be logged', async () => {
    const failure = new Error('database down');

    findMealDetail.mockResolvedValue(detail({ pictureStatus: null, pictureUrl: null }));
    requestPicture.mockRejectedValue(failure);

    await expect(PlanController.openMeal('usr-a', 'meal-1', null, 10)).resolves.toMatchObject({
      claim: null,
      failure,
      meal: { pictureStatus: 'none' }
    });
  });

  it('shows a failed drawing as no picture at all', async () => {
    findMealDetail.mockResolvedValue(detail({ pictureStatus: 'failed', pictureUrl: null }));
    requestPicture.mockResolvedValue(null);

    await expect(PlanController.openMeal('usr-a', 'meal-1', null, 10)).resolves.toMatchObject({
      meal: { illustrationPath: null, pictureStatus: 'none' }
    });
  });
});

/** One recipe ingredient as `findMealDetail` returns it. */
function item(slug: string, name: string, grams: number) {
  return { carbsPer100g: 0, fatPer100g: 0, grams: String(grams), kcalPer100g: 0, name, proteinPer100g: 0, slug, substitutes: [], unit: 'g' };
}

/* PRD 014, criterion 4: a cooked grain reads in dry weight too; nothing else changes. */
describe('PlanController.getMeal — dry weights (0078)', () => {
  it('gives couscous its dry weight and the dry food name, at the portion planned', async () => {
    // 400 g in the recipe, served at 1.5: 600 g cooked, 240 g dry.
    findMealDetail.mockResolvedValue(detail({ pictureStatus: null, pictureUrl: null }, [item('cuscus-cocido', 'Cuscús cocido', 400)], '1.5'));
    loadCatalogue.mockResolvedValue([{ name: 'Cuscús', slug: 'cuscus-crudo' }]);

    const meal = await PlanController.getMeal('usr-a', 'meal-1', 'es-ES');

    expect(loadCatalogue).toHaveBeenCalledWith('es-ES', null, ['cuscus-crudo']);
    expect(meal.ingredients[0]).toMatchObject({ dry: { grams: 240, name: 'Cuscús' }, grams: 600, name: 'Cuscús cocido' });
  });

  it('rounds the dry weight to 5 g, and names a pasta with no dry food by its own name without "cocida"', async () => {
    // 250 g at 2.3 is 108.7 g.
    findMealDetail.mockResolvedValue(detail({ pictureStatus: null, pictureUrl: null }, [item('pasta-cocida', 'Pasta cocida', 250)]));

    const meal = await PlanController.getMeal('usr-a', 'meal-1', 'es-ES');

    expect(loadCatalogue).not.toHaveBeenCalled();
    expect(meal.ingredients[0]?.dry).toEqual({ grams: 110, name: 'Pasta' });
  });

  it('leaves every other ingredient as it was, with no dry weight at all', async () => {
    findMealDetail.mockResolvedValue(detail({ pictureStatus: null, pictureUrl: null }, [item('lentejas-cocidas', 'Lentejas cocidas', 200)]));

    const meal = await PlanController.getMeal('usr-a', 'meal-1', 'es-ES');

    expect(loadCatalogue).not.toHaveBeenCalled();
    expect(meal.ingredients[0]).toEqual({ alternatives: [], grams: 200, name: 'Lentejas cocidas', unit: 'g' });
  });
});
