import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from 'core/entities/Error';

import { monthStart, PICTURE_COOL_OFF_DAYS, RecipeController, toPictureStatus } from './RecipeController';

import type { PictureState } from 'core/entities/DishPicture';

const dishPictures = vi.fn<() => Promise<boolean>>();
const pictureState = vi.fn<(recipeId: string) => Promise<PictureState>>();
const monthSpendUsd = vi.fn<(since: Date) => Promise<number>>();
const claimPicture = vi.fn<(recipeId: string, now: Date, coolOffDays: number, staleAfterMinutes: number) => Promise<boolean>>();
const servesRecipe = vi.fn<(userId: string, recipeId: string) => Promise<boolean>>();
const pictureRecipe = vi.fn<() => Promise<unknown>>();
const pictureCatalogue = vi.fn<() => Promise<unknown>>();

vi.mock('core/controllers/Settings', () => ({ SettingsController: { dishPictures: () => dishPictures() } }));
vi.mock('#repositories/Plan', () => ({ PlanRepository: { servesRecipe: (userId: string, recipeId: string) => servesRecipe(userId, recipeId) } }));
vi.mock('#repositories/Recipe', () => ({
  FALLBACK_LOCALE: 'es-ES',
  RecipeRepository: {
    claimPicture: (recipeId: string, now: Date, coolOffDays: number, stale: number) => claimPicture(recipeId, now, coolOffDays, stale),
    monthSpendUsd: (since: Date) => monthSpendUsd(since),
    pictureCatalogue: () => pictureCatalogue(),
    pictureRecipe: () => pictureRecipe(),
    pictureState: (recipeId: string) => pictureState(recipeId)
  }
}));

const RECIPE = '6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f';
const NOW = new Date('2026-09-27T12:00:00Z');
const NONE: PictureState = { attempts: 0, lastAttemptAt: null, status: 'none', url: null };

function minutesAgo(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60_000);
}

beforeEach(() => {
  vi.clearAllMocks();
  dishPictures.mockResolvedValue(true);
  pictureState.mockResolvedValue(NONE);
  monthSpendUsd.mockResolvedValue(0);
  claimPicture.mockResolvedValue(true);
});

/* PRD 006, criteria 1, 5, 7 and 9: when a view may start a drawing. */
describe('RecipeController.requestPicture', () => {
  it('claims a dish with no picture, under the cap, with the flag on — and hands back the claim’s token and attempts', async () => {
    pictureState.mockResolvedValueOnce(NONE).mockResolvedValueOnce({ ...NONE, lastAttemptAt: NOW, status: 'drawing' });

    await expect(RecipeController.requestPicture(RECIPE, 10, NOW)).resolves.toEqual({ attempts: 0, claimedAt: NOW, recipeId: RECIPE });
    expect(claimPicture).toHaveBeenCalledWith(RECIPE, NOW, PICTURE_COOL_OFF_DAYS, 15);
    expect(monthSpendUsd).toHaveBeenCalledWith(new Date('2026-09-01T00:00:00Z'));
  });

  it('carries the attempts a stale takeover already counted', async () => {
    pictureState
      .mockResolvedValueOnce({ attempts: 1, lastAttemptAt: minutesAgo(20), status: 'drawing', url: null })
      .mockResolvedValueOnce({ attempts: 2, lastAttemptAt: NOW, status: 'drawing', url: null });

    await expect(RecipeController.requestPicture(RECIPE, 10, NOW)).resolves.toMatchObject({ attempts: 2 });
  });

  it('claims nothing with the flag off, and reads nothing else', async () => {
    dishPictures.mockResolvedValue(false);

    await expect(RecipeController.requestPicture(RECIPE, 10, NOW)).resolves.toBeNull();
    expect(pictureState).not.toHaveBeenCalled();
    expect(claimPicture).not.toHaveBeenCalled();
  });

  it.each<[string, PictureState]>([
    ['ready', { attempts: 1, lastAttemptAt: minutesAgo(60), status: 'ready', url: 'https://blob/x.jpg' }],
    ['being drawn', { attempts: 0, lastAttemptAt: minutesAgo(2), status: 'drawing', url: null }],
    ['failed within the cool-off', { attempts: 3, lastAttemptAt: minutesAgo(6 * 24 * 60), status: 'failed', url: null }]
  ])('claims nothing for a dish %s, without reading the month’s spend', async (_case, state) => {
    pictureState.mockResolvedValue(state);

    await expect(RecipeController.requestPicture(RECIPE, 10, NOW)).resolves.toBeNull();
    expect(monthSpendUsd).not.toHaveBeenCalled();
    expect(claimPicture).not.toHaveBeenCalled();
  });

  it('asks again for a dish whose failure is past the cool-off, and for a drawing gone stale', async () => {
    pictureState.mockResolvedValueOnce({ attempts: 3, lastAttemptAt: minutesAgo(8 * 24 * 60), status: 'failed', url: null });
    await RecipeController.requestPicture(RECIPE, 10, NOW);
    pictureState.mockResolvedValueOnce({ attempts: 0, lastAttemptAt: minutesAgo(16), status: 'drawing', url: null });
    await RecipeController.requestPicture(RECIPE, 10, NOW);

    expect(claimPicture).toHaveBeenCalledTimes(2);
  });

  it('claims nothing once the month’s spend has reached the cap', async () => {
    monthSpendUsd.mockResolvedValue(10);

    await expect(RecipeController.requestPicture(RECIPE, 10, NOW)).resolves.toBeNull();
    expect(claimPicture).not.toHaveBeenCalled();
  });

  it('answers null to the caller that lost the claim', async () => {
    claimPicture.mockResolvedValue(false);

    await expect(RecipeController.requestPicture(RECIPE, 10, NOW)).resolves.toBeNull();
  });
});

describe('RecipeController.pictureStatus', () => {
  it('answers for a dish on one of the caller’s plans', async () => {
    servesRecipe.mockResolvedValue(true);
    pictureState.mockResolvedValue({ attempts: 1, lastAttemptAt: NOW, status: 'ready', url: 'https://blob/x.jpg' });

    await expect(RecipeController.pictureStatus('usr-a', RECIPE)).resolves.toEqual({ status: 'ready', url: 'https://blob/x.jpg' });
    expect(servesRecipe).toHaveBeenCalledWith('usr-a', RECIPE);
  });

  it('is a 404 for any other dish, and reads nothing about it', async () => {
    servesRecipe.mockResolvedValue(false);

    await expect(RecipeController.pictureStatus('usr-a', RECIPE)).rejects.toBeInstanceOf(NotFoundError);
    expect(pictureState).not.toHaveBeenCalled();
  });
});

describe('RecipeController.pictureInputs', () => {
  it('reads the dish and the whole catalogue, and nothing for a dish that does not exist', async () => {
    pictureRecipe.mockResolvedValueOnce({ ingredients: [], name: 'Arroz' }).mockResolvedValueOnce(null);
    pictureCatalogue.mockResolvedValue([{ allergens: [], mayContain: [], names: ['Arroz'], slug: 'arroz' }]);

    await expect(RecipeController.pictureInputs(RECIPE)).resolves.toEqual({
      catalogue: [{ allergens: [], mayContain: [], names: ['Arroz'], slug: 'arroz' }],
      recipe: { ingredients: [], name: 'Arroz' }
    });
    await expect(RecipeController.pictureInputs(RECIPE)).resolves.toBeNull();
  });
});

describe('toPictureStatus', () => {
  it.each([
    [
      { status: 'ready', url: 'https://blob/x.jpg' },
      { status: 'ready', url: 'https://blob/x.jpg' }
    ],
    [
      { status: 'ready', url: null },
      { status: 'none', url: null }
    ],
    [
      { status: 'drawing', url: null },
      { status: 'drawing', url: null }
    ],
    [
      { status: 'failed', url: null },
      { status: 'none', url: null }
    ],
    [
      { status: null, url: null },
      { status: 'none', url: null }
    ]
  ])('reads %j as %j — a failure is the placeholder, never announced', (state, view) => {
    expect(toPictureStatus(state)).toEqual(view);
  });
});

describe('monthStart', () => {
  it('is the first instant of the month in UTC', () => {
    expect(monthStart(new Date('2026-10-01T00:30:00+02:00'))).toEqual(new Date('2026-09-01T00:00:00Z'));
    expect(monthStart(new Date('2026-12-31T23:59:59Z'))).toEqual(new Date('2026-12-01T00:00:00Z'));
  });
});
