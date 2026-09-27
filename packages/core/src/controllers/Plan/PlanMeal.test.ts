import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlanController } from './PlanController';

import type * as RecipeModule from 'core/controllers/Recipe';
import type { PictureClaim } from 'core/controllers/Recipe';

const findMealDetail = vi.fn<() => Promise<unknown>>();
const requestPicture = vi.fn<(recipeId: string, capUsd: number) => Promise<PictureClaim | null>>();

vi.mock('#repositories/Plan', () => ({ PlanJobRepository: {}, PlanRepository: { findMealDetail: () => findMealDetail() } }));
vi.mock('#repositories/Recipe', () => ({ FALLBACK_LOCALE: 'es-ES', RecipeRepository: { findVerdict: () => Promise.resolve(null) } }));
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

function detail(picture: { pictureStatus: string | null; pictureUrl: string | null }) {
  return {
    day: { date: '2026-09-27', dayIndex: 0 },
    items: [],
    meal: { id: 'meal-1', carbsG: '10', fatG: '5', fiberG: '1', kcal: '300', proteinG: '20', servings: '1', slot: 'lunch', status: 'planned' },
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
