import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from 'core/entities/Error';

import { candidateExpiry, PICTURE_COOL_OFF_DAYS, RecipeController, reviewableCandidate } from './RecipeController';

type Row = { lastAttemptAt: Date | null; provenance: Record<string, unknown> | null; status: string };

const candidateRow = vi.fn<(recipeId: string) => Promise<Row | null>>();
const dropCandidate = vi.fn<(recipeId: string, path: string, record?: (tx: unknown) => Promise<void>) => Promise<boolean>>();
const unreviewableCandidates = vi.fn<(expiredAt: Date, limit: number) => Promise<{ path: string; recipeId: string }[]>>();
const record = vi.fn<(entry: unknown, tx: unknown) => Promise<void>>();

vi.mock('#repositories/Audit', () => ({ AuditRepository: { record: (entry: unknown, tx: unknown) => record(entry, tx) } }));
vi.mock('#repositories/Recipe', () => ({
  FALLBACK_LOCALE: 'es-ES',
  RecipeRepository: {
    candidateRow: (recipeId: string) => candidateRow(recipeId),
    dropCandidate: (recipeId: string, path: string, audit?: (tx: unknown) => Promise<void>) => dropCandidate(recipeId, path, audit),
    unreviewableCandidates: (expiredAt: Date, limit: number) => unreviewableCandidates(expiredAt, limit)
  }
}));

const RECIPE = '6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f';
const OTHER = '7c2a1d4f-7b2e-4d66-8a4b-2a3c4d5e6f70';
const OWNER = 'owner-1';
const NOW = new Date('2026-09-30T12:00:00Z');
const DAY = 86_400_000;
const PATH = `dish-picture-candidates/${RECIPE}/2.0.0-0b7e3f2a-5c1d-4e8f-9a6b-7c8d9e0f1a2b.jpg`;
const CANDIDATE = {
  extras: [{ foreignAllergens: ['crustaceans'], mappedTo: ['gambas'] }],
  model: 'stub/picture',
  path: PATH,
  promptVersion: '2.0.0'
};

/** A failed row whose drawing ended `days` ago, holding the candidate. */
function failed(days: number): Row {
  return {
    lastAttemptAt: new Date(NOW.getTime() - days * DAY),
    provenance: { candidate: CANDIDATE, notes: [], reason: 'judge_allergen' },
    status: 'failed'
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  candidateRow.mockResolvedValue(failed(1));
  dropCandidate.mockImplementation(async (_recipeId, _path, audit) => {
    await audit?.('tx');

    return true;
  });
  unreviewableCandidates.mockResolvedValue([]);
});

/* 0072: one clock. A candidate is reviewable while its dish's cool-off runs, and not a millisecond longer. */
describe('reviewableCandidate', () => {
  it('expires at the very instant the dish’s cool-off ends', () => {
    const ended = new Date('2026-09-23T12:00:00Z');

    expect(candidateExpiry(ended)).toEqual(new Date(ended.getTime() + PICTURE_COOL_OFF_DAYS * DAY));
    expect(candidateExpiry(ended)).toEqual(NOW);
  });

  it('answers the candidate and its expiry while the row is failed and the clock is before it', () => {
    expect(reviewableCandidate(failed(1), NOW)).toEqual({ candidate: CANDIDATE, expiresAt: new Date(NOW.getTime() + 6 * DAY) });
    expect(reviewableCandidate({ ...failed(7), lastAttemptAt: new Date(NOW.getTime() - 7 * DAY + 1) }, NOW)).not.toBeNull();
  });

  it.each<[string, Row]>([
    ['expired, to the millisecond, though the cleanup has not deleted it yet', failed(7)],
    ['long expired', failed(30)],
    ['on a row that is no longer failed', { ...failed(1), status: 'ready' }],
    ['on a row being drawn', { ...failed(1), status: 'drawing' }],
    ['on a row with no date', { ...failed(1), lastAttemptAt: null }],
    ['absent', { ...failed(1), provenance: { notes: [], reason: 'call_failed' } }],
    ['a pointer outside the candidates’ folder', { ...failed(1), provenance: { candidate: { ...CANDIDATE, path: 'dish-pictures/x/2.0.0-y.jpg' } } }],
    ['a pointer that is an address', { ...failed(1), provenance: { candidate: { ...CANDIDATE, path: 'https://store.example/x.jpg' } } }],
    ['no provenance at all', { ...failed(1), provenance: null }]
  ])('answers nothing for a candidate %s', (_case, row) => {
    expect(reviewableCandidate(row, NOW)).toBeNull();
  });
});

describe('RecipeController.pictureCandidate', () => {
  it('answers the candidate of a dish that holds a reviewable one', async () => {
    await expect(RecipeController.pictureCandidate(RECIPE, NOW)).resolves.toEqual({
      candidate: CANDIDATE,
      expiresAt: new Date(NOW.getTime() + 6 * DAY)
    });
  });

  it.each<[string, () => void, string]>([
    ['a dish with no candidate', () => candidateRow.mockResolvedValue(null), RECIPE],
    ['an expired candidate', () => candidateRow.mockResolvedValue(failed(8)), RECIPE],
    ['a row that is no longer failed', () => candidateRow.mockResolvedValue({ ...failed(1), status: 'ready' }), RECIPE]
  ])('is not found for %s, with a fixed message', async (_case, arrange, id) => {
    arrange();

    const error = await RecipeController.pictureCandidate(id, NOW).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as Error).message).toBe('Picture candidate not found');
  });

  it('is not found for an id that is not one, without reading anything, and never echoes it', async () => {
    const error = await RecipeController.pictureCandidate('not-a-uuid-zzq', NOW).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as Error).message).not.toContain('zzq');
    expect(candidateRow).not.toHaveBeenCalled();
  });
});

/* PRD 009, criterion 4: discarding deletes the file and the pointer, leaves the cool-off as it was and writes `picture.discarded`. */
describe('RecipeController.discardCandidate', () => {
  it('deletes the file first, then removes that very pointer with the audit row in the same transaction', async () => {
    const order: string[] = [];
    const forget = vi.fn(async (_path: string) => {
      order.push('file');
    });

    dropCandidate.mockImplementation(async (_recipeId, _path, audit) => {
      order.push('pointer');
      await audit?.('tx');

      return true;
    });

    await RecipeController.discardCandidate(RECIPE, OWNER, forget, NOW);

    expect(order).toEqual(['file', 'pointer']);
    expect(forget).toHaveBeenCalledWith(PATH);
    expect(dropCandidate).toHaveBeenCalledWith(RECIPE, PATH, expect.any(Function));
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith({ action: 'picture.discarded', actorId: OWNER, entity: 'recipe', entityId: RECIPE, metadata: {} }, 'tx');
  });

  it('keeps the pointer, and writes no audit row, when the file cannot be deleted', async () => {
    await expect(RecipeController.discardCandidate(RECIPE, OWNER, async () => Promise.reject(new Error('store down')), NOW)).rejects.toThrow(
      'store down'
    );

    expect(dropCandidate).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('is not found, deleting nothing, when there is no reviewable candidate', async () => {
    const forget = vi.fn(async () => Promise.resolve());

    for (const row of [null, failed(8), { ...failed(1), status: 'drawing' }]) {
      candidateRow.mockResolvedValue(row);
      await expect(RecipeController.discardCandidate(RECIPE, OWNER, forget, NOW)).rejects.toBeInstanceOf(NotFoundError);
    }

    await expect(RecipeController.discardCandidate('not-a-uuid', OWNER, forget, NOW)).rejects.toBeInstanceOf(NotFoundError);
    expect(forget).not.toHaveBeenCalled();
    expect(dropCandidate).not.toHaveBeenCalled();
  });

  it('is not found, with no audit row, when the pointer went between the read and the write', async () => {
    dropCandidate.mockResolvedValue(false);

    await expect(RecipeController.discardCandidate(RECIPE, OWNER, async () => Promise.resolve(), NOW)).rejects.toBeInstanceOf(NotFoundError);
    expect(record).not.toHaveBeenCalled();
  });
});

/* PRD 009, criterion 3: the nightly cleanup, with its clock injected. */
describe('RecipeController.cleanCandidates', () => {
  const OTHER_PATH = `dish-picture-candidates/${OTHER}/2.0.0-1c8f4a3b-6d2e-4f90-8b7c-8d9e0f1a2b3c.jpg`;

  it('asks for what expired at the cool-off’s own instant, by the clock it is given', async () => {
    await RecipeController.cleanCandidates(async () => Promise.resolve(), {}, NOW);

    expect(unreviewableCandidates).toHaveBeenCalledWith(new Date(NOW.getTime() - PICTURE_COOL_OFF_DAYS * DAY), 100);
  });

  it('deletes each file and only then its pointer, without an audit row, and counts them', async () => {
    const order: string[] = [];

    unreviewableCandidates.mockResolvedValue([
      { path: PATH, recipeId: RECIPE },
      { path: OTHER_PATH, recipeId: OTHER }
    ]);
    dropCandidate.mockImplementation(async (recipeId, _path, audit) => {
      order.push(`pointer:${recipeId}`);
      expect(audit).toBeUndefined();

      return true;
    });

    await expect(
      RecipeController.cleanCandidates(
        async path => {
          order.push(`file:${path}`);
        },
        {},
        NOW
      )
    ).resolves.toEqual({ deleted: 2, left: 0 });
    expect(order).toEqual([`file:${PATH}`, `pointer:${RECIPE}`, `file:${OTHER_PATH}`, `pointer:${OTHER}`]);
    expect(record).not.toHaveBeenCalled();
  });

  it('leaves the pointer of a file it could not delete, and goes on with the rest', async () => {
    unreviewableCandidates.mockResolvedValue([
      { path: PATH, recipeId: RECIPE },
      { path: OTHER_PATH, recipeId: OTHER }
    ]);

    await expect(
      RecipeController.cleanCandidates(
        async path => {
          if (path === PATH) {
            throw new Error('store down');
          }
        },
        {},
        NOW
      )
    ).resolves.toEqual({ deleted: 1, left: 1 });
    expect(dropCandidate).toHaveBeenCalledTimes(1);
    expect(dropCandidate).toHaveBeenCalledWith(OTHER, OTHER_PATH, undefined);
  });

  it('does not count a pointer that was no longer that one', async () => {
    unreviewableCandidates.mockResolvedValue([{ path: PATH, recipeId: RECIPE }]);
    dropCandidate.mockResolvedValue(false);

    await expect(RecipeController.cleanCandidates(async () => Promise.resolve(), {}, NOW)).resolves.toEqual({ deleted: 0, left: 1 });
  });

  it('starts no deletion once its time is up', async () => {
    const forget = vi.fn(async () => Promise.resolve());

    unreviewableCandidates.mockResolvedValue([{ path: PATH, recipeId: RECIPE }]);

    await expect(RecipeController.cleanCandidates(forget, { until: new Date(Date.now() - 1) }, NOW)).resolves.toEqual({ deleted: 0, left: 1 });
    expect(forget).not.toHaveBeenCalled();
  });

  it('deletes nothing when nothing expired', async () => {
    const forget = vi.fn(async () => Promise.resolve());

    await expect(RecipeController.cleanCandidates(forget, {}, NOW)).resolves.toEqual({ deleted: 0, left: 0 });
    expect(forget).not.toHaveBeenCalled();
  });
});
