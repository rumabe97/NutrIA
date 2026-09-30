import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError, PictureRetryRefusedError } from 'core/entities/Error';

import { monthStart, PICTURE_COOL_OFF_DAYS, RecipeController, toPictureStatus } from './RecipeController';

import type { PictureState } from 'core/entities/DishPicture';

const dishPictures = vi.fn<() => Promise<boolean>>();
const pictureState = vi.fn<(recipeId: string) => Promise<PictureState>>();
const monthSpendUsd = vi.fn<(since: Date) => Promise<number>>();
const claimPicture = vi.fn<(recipeId: string, now: Date, coolOffDays: number, staleAfterMinutes: number) => Promise<boolean>>();
const servesRecipe = vi.fn<(userId: string, recipeId: string) => Promise<boolean>>();
const recipeExists = vi.fn<(recipeId: string) => Promise<boolean>>();
const retryPicture =
  vi.fn<
    (recipeId: string, now: Date, staleMinutes: number, record: (tx: unknown) => Promise<void>) => Promise<{ candidatePath: string | null } | null>
  >();
const record = vi.fn<(entry: unknown, tx: unknown) => Promise<void>>();
const pictureRecipe = vi.fn<() => Promise<unknown>>();
const pictureCatalogue = vi.fn<() => Promise<unknown>>();

vi.mock('core/controllers/Settings', () => ({ SettingsController: { dishPictures: () => dishPictures() } }));
vi.mock('#repositories/Audit', () => ({ AuditRepository: { record: (entry: unknown, tx: unknown) => record(entry, tx) } }));
vi.mock('#repositories/Plan', () => ({ PlanRepository: { servesRecipe: (userId: string, recipeId: string) => servesRecipe(userId, recipeId) } }));
vi.mock('#repositories/Recipe', () => ({
  FALLBACK_LOCALE: 'es-ES',
  RecipeRepository: {
    claimPicture: (recipeId: string, now: Date, coolOffDays: number, stale: number) => claimPicture(recipeId, now, coolOffDays, stale),
    monthSpendUsd: (since: Date) => monthSpendUsd(since),
    pictureCatalogue: () => pictureCatalogue(),
    pictureRecipe: () => pictureRecipe(),
    pictureState: (recipeId: string) => pictureState(recipeId),
    recipeExists: (recipeId: string) => recipeExists(recipeId),
    retryPicture: (recipeId: string, now: Date, staleMinutes: number, audit: (tx: unknown) => Promise<void>) =>
      retryPicture(recipeId, now, staleMinutes, audit)
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
  recipeExists.mockResolvedValue(true);
  retryPicture.mockImplementation(async (_id, _now, _stale, audit) => {
    await audit('tx');

    return { candidatePath: null };
  });
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

  /* 0072: the claim would forget where the rejected file is kept. */
  it.each<[string, PictureState]>([
    ['inside its cool-off', { attempts: 3, candidate: true, lastAttemptAt: minutesAgo(60), status: 'failed', url: null }],
    [
      'past its cool-off, until the cleanup removes the pointer',
      { attempts: 3, candidate: true, lastAttemptAt: minutesAgo(8 * 24 * 60), status: 'failed', url: null }
    ],
    ['given back', { attempts: 1, candidate: true, lastAttemptAt: minutesAgo(1), released: true, status: 'failed', url: null }]
  ])('claims nothing for a dish holding a candidate, %s', async (_case, state) => {
    pictureState.mockResolvedValue(state);

    await expect(RecipeController.requestPicture(RECIPE, 10, NOW)).resolves.toBeNull();
    expect(claimPicture).not.toHaveBeenCalled();
  });

  it('asks again for a dish whose failure is past the cool-off, and for a drawing gone stale', async () => {
    pictureState.mockResolvedValueOnce({ attempts: 3, lastAttemptAt: minutesAgo(8 * 24 * 60), status: 'failed', url: null });
    await RecipeController.requestPicture(RECIPE, 10, NOW);
    pictureState.mockResolvedValueOnce({ attempts: 0, lastAttemptAt: minutesAgo(16), status: 'drawing', url: null });
    await RecipeController.requestPicture(RECIPE, 10, NOW);

    expect(claimPicture).toHaveBeenCalledTimes(2);
  });

  it('asks again at once for a drawing given back — the cap, a refused key — with no cool-off', async () => {
    pictureState.mockResolvedValueOnce({ attempts: 2, lastAttemptAt: minutesAgo(1), released: true, status: 'failed', url: null });

    await RecipeController.requestPicture(RECIPE, 10, NOW);

    expect(claimPicture).toHaveBeenCalledTimes(1);
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

/* The owner's retry from the console: no cool-off, but the flag, availability, the cap and a drawing in flight all still hold. */
describe('RecipeController.retryPicture', () => {
  const FAILED: PictureState = { attempts: 3, lastAttemptAt: minutesAgo(60), status: 'failed', url: null };
  const OWNER = 'owner-1';
  const OPEN = { available: true, capUsd: 10 };

  beforeEach(() => {
    pictureState.mockResolvedValue(FAILED);
  });

  it('claims a picture that failed one hour ago — inside the cool-off — and writes the audit row in the claim’s transaction', async () => {
    await expect(RecipeController.retryPicture(RECIPE, OWNER, OPEN, NOW)).resolves.toEqual({ attempts: 0, claimedAt: NOW, recipeId: RECIPE });

    expect(retryPicture).toHaveBeenCalledWith(RECIPE, NOW, 15, expect.any(Function));
    expect(record).toHaveBeenCalledWith({ action: 'picture.retried', actorId: OWNER, entity: 'recipe', entityId: RECIPE, metadata: {} }, 'tx');
    // The normal claim, with its cool-off, is not the one used.
    expect(claimPicture).not.toHaveBeenCalled();
  });

  it('answers not found for a recipe that does not exist, and for an id that is not one, before anything else', async () => {
    recipeExists.mockResolvedValue(false);
    dishPictures.mockResolvedValue(false);

    await expect(RecipeController.retryPicture(RECIPE, OWNER, OPEN, NOW)).rejects.toBeInstanceOf(NotFoundError);
    await expect(RecipeController.retryPicture('not-a-uuid', OWNER, OPEN, NOW)).rejects.toBeInstanceOf(NotFoundError);
    expect(retryPicture).not.toHaveBeenCalled();
  });

  it.each<[string, () => void, { available: boolean; capUsd: number }, string]>([
    ['the flag is off', () => dishPictures.mockResolvedValue(false), OPEN, 'flag_off'],
    ['pictures are unavailable', () => undefined, { available: false, capUsd: 10 }, 'unavailable'],
    ['a drawing is in flight', () => pictureState.mockResolvedValue({ ...FAILED, lastAttemptAt: minutesAgo(1), status: 'drawing' }), OPEN, 'drawing'],
    ['the picture is ready', () => pictureState.mockResolvedValue({ ...FAILED, status: 'ready', url: 'https://blob/x.jpg' }), OPEN, 'not_retryable'],
    ['the dish never had a drawing', () => pictureState.mockResolvedValue(NONE), OPEN, 'not_retryable'],
    ['the month’s cap is reached', () => monthSpendUsd.mockResolvedValue(10), OPEN, 'cap_reached']
  ])('refuses, leaving no row, when %s', async (_case, arrange, options, reason) => {
    arrange();

    await expect(RecipeController.retryPicture(RECIPE, OWNER, options, NOW)).rejects.toEqual(new PictureRetryRefusedError(reason as never));
    expect(retryPicture).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('takes over a drawing stuck past the stale bound, as a view would, but not one inside it', async () => {
    pictureState.mockResolvedValue({ ...FAILED, lastAttemptAt: minutesAgo(60), status: 'drawing' });
    await expect(RecipeController.retryPicture(RECIPE, OWNER, OPEN, NOW)).resolves.toMatchObject({ recipeId: RECIPE });

    pictureState.mockResolvedValue({ ...FAILED, lastAttemptAt: minutesAgo(14), status: 'drawing' });
    await expect(RecipeController.retryPicture(RECIPE, OWNER, OPEN, NOW)).rejects.toMatchObject({ reason: 'drawing' });
  });

  it('answers a fixed not found that never echoes the id sent', async () => {
    recipeExists.mockResolvedValue(false);

    for (const segment of [RECIPE, 'not-a-uuid-zzq']) {
      const error = await RecipeController.retryPicture(segment, OWNER, OPEN, NOW).catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as Error).message).toBe('Recipe not found');
    }
  });

  it('refuses as drawing when somebody claimed it between the read and the claim', async () => {
    const forget = vi.fn(async () => Promise.resolve());

    retryPicture.mockResolvedValue(null);

    await expect(RecipeController.retryPicture(RECIPE, OWNER, { ...OPEN, forget }, NOW)).rejects.toMatchObject({ reason: 'drawing' });
    expect(record).not.toHaveBeenCalled();
    expect(forget).not.toHaveBeenCalled();
  });

  /* 0072: a retry discards the candidate — checks, then the claim, then the file. */
  describe('with a candidate waiting', () => {
    const PATH = `dish-picture-candidates/${RECIPE}/2.0.0-0b7e3f2a-5c1d-4e8f-9a6b-7c8d9e0f1a2b.jpg`;

    it('deletes the candidate’s file only after the claim that cleared its pointer', async () => {
      const order: string[] = [];
      const forget = vi.fn(async (_path: string) => {
        order.push('forget');
      });

      retryPicture.mockImplementation(async (_id, _now, _stale, audit) => {
        await audit('tx');
        order.push('claim');

        return { candidatePath: PATH };
      });

      await expect(RecipeController.retryPicture(RECIPE, OWNER, { ...OPEN, forget }, NOW)).resolves.toMatchObject({ recipeId: RECIPE });
      expect(order).toEqual(['claim', 'forget']);
      expect(forget).toHaveBeenCalledWith(PATH);
    });

    it('deletes nothing when the retry is refused', async () => {
      const forget = vi.fn(async () => Promise.resolve());

      monthSpendUsd.mockResolvedValue(10);

      await expect(RecipeController.retryPicture(RECIPE, OWNER, { ...OPEN, forget }, NOW)).rejects.toMatchObject({ reason: 'cap_reached' });
      expect(forget).not.toHaveBeenCalled();
    });

    it('keeps the claim when the file cannot be deleted: a private file nothing points to, never an undone retry', async () => {
      retryPicture.mockResolvedValue({ candidatePath: PATH });

      await expect(
        RecipeController.retryPicture(RECIPE, OWNER, { ...OPEN, forget: async () => Promise.reject(new Error('store down')) }, NOW)
      ).resolves.toEqual({ attempts: 0, claimedAt: NOW, recipeId: RECIPE });
    });

    it('asks for no deletion for a dish that held none', async () => {
      const forget = vi.fn(async () => Promise.resolve());

      await RecipeController.retryPicture(RECIPE, OWNER, { ...OPEN, forget }, NOW);

      expect(forget).not.toHaveBeenCalled();
    });
  });

  it('claims a picture that was given back too', async () => {
    pictureState.mockResolvedValue({ ...FAILED, released: true });

    await expect(RecipeController.retryPicture(RECIPE, OWNER, OPEN, NOW)).resolves.toMatchObject({ recipeId: RECIPE });
  });
});
