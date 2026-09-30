import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { NotFoundError } from 'core/entities/Error';
import { RecipeController } from 'core/controllers/Recipe';

import { PictureCandidatesService } from './PictureCandidates.service.js';
import { STUB_PICTURE, StubPictureCandidateStore } from '../clients/StubPictureClients.js';

const RECIPE = '6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f';
const OWNER = 'owner-1';
const NOW = new Date('2026-09-30T12:00:00Z');
const PATH = `dish-picture-candidates/${RECIPE}/2.0.0-0b7e3f2a-5c1d-4e8f-9a6b-7c8d9e0f1a2b.jpg`;
const FOUND = {
  candidate: { extras: [{ foreignAllergens: ['crustaceans'], mappedTo: ['gambas'] }], model: 'stub/picture', path: PATH, promptVersion: '2.0.0' },
  expiresAt: new Date('2026-10-06T12:00:00Z')
};

function service(store = new StubPictureCandidateStore()) {
  return { candidates: new PictureCandidatesService(store, () => NOW), store };
}

function withoutToken(): StubPictureCandidateStore {
  return Object.defineProperty(new StubPictureCandidateStore(), 'isAvailable', { get: () => false });
}

let candidate: jest.Spied<typeof RecipeController.pictureCandidate>;
let discard: jest.Spied<typeof RecipeController.discardCandidate>;
let clean: jest.Spied<typeof RecipeController.cleanCandidates>;

beforeEach(() => {
  candidate = jest.spyOn(RecipeController, 'pictureCandidate').mockResolvedValue(FOUND);
  discard = jest.spyOn(RecipeController, 'discardCandidate').mockResolvedValue(undefined);
  clean = jest.spyOn(RecipeController, 'cleanCandidates').mockResolvedValue({ deleted: 0, left: 0 });
});

afterEach(() => {
  jest.restoreAllMocks();
});

/* 0072: the rejected pictures that wait for the owner. The rules are core's; the private store is here. */
describe('PictureCandidatesService.read', () => {
  it('reads the file of the candidate core says can be looked at, by the clock it was given', async () => {
    const { candidates, store } = service();

    store.files.set(PATH, STUB_PICTURE);

    await expect(candidates.read(RECIPE)).resolves.toBe(STUB_PICTURE);
    expect(candidate).toHaveBeenCalledWith(RECIPE, NOW);
  });

  it('is not found when core finds no candidate to look at, and asks the store nothing', async () => {
    const { candidates, store } = service();
    const get = jest.spyOn(store, 'get');

    candidate.mockRejectedValue(new NotFoundError('Picture candidate not found'));

    await expect(candidates.read(RECIPE)).rejects.toBeInstanceOf(NotFoundError);
    expect(get).not.toHaveBeenCalled();
  });

  it('is not found, with the same fixed words, when the store no longer has the file', async () => {
    const failure = (await service()
      .candidates.read(RECIPE)
      .catch((error: unknown) => error)) as Error;

    expect(failure).toBeInstanceOf(NotFoundError);
    expect(failure.message).toBe('Picture candidate not found');
  });

  it('is not found without the store’s token, before anything is read', async () => {
    await expect(service(withoutToken()).candidates.read(RECIPE)).rejects.toBeInstanceOf(NotFoundError);
    expect(candidate).not.toHaveBeenCalled();
  });
});

describe('PictureCandidatesService.discard', () => {
  it('hands core the session’s owner, its clock, and the one thing core cannot do: delete the file', async () => {
    const { candidates, store } = service();

    store.files.set(PATH, STUB_PICTURE);
    await candidates.discard(RECIPE, OWNER);

    expect(discard).toHaveBeenCalledWith(RECIPE, OWNER, expect.any(Function), NOW);

    await discard.mock.calls[0]?.[2](PATH);
    expect(store.files.size).toBe(0);
  });

  it('is not found without the store’s token: nothing could be deleted, so no pointer is touched', async () => {
    await expect(service(withoutToken()).candidates.discard(RECIPE, OWNER)).rejects.toBeInstanceOf(NotFoundError);
    expect(discard).not.toHaveBeenCalled();
  });
});

describe('PictureCandidatesService.forget', () => {
  it('throws when the file could not be deleted, so whoever asked keeps the pointer', async () => {
    const store = Object.assign(new StubPictureCandidateStore(), { del: async () => Promise.reject(new Error('Candidate del failed: 503')) });

    await expect(service(store).candidates.forget(PATH)).rejects.toThrow('Candidate del failed: 503');
  });

  it('gives up on a store that never answers', async () => {
    jest.useFakeTimers();

    try {
      const store = Object.assign(new StubPictureCandidateStore(), { del: async () => new Promise<void>(() => undefined) });
      const forgotten = service(store).candidates.forget(PATH);
      const refused = expect(forgotten).rejects.toThrow();

      await jest.advanceTimersByTimeAsync(4_000);
      await refused;
    } finally {
      jest.useRealTimers();
    }
  });
});

/* PRD 009, criterion 3: the nightly cleanup, with its clock injected. */
describe('PictureCandidatesService.clean', () => {
  it('cleans by its clock, stops starting deletions one store call before its budget ends, and answers the count', async () => {
    const { candidates, store } = service();
    const before = Date.now();

    clean.mockResolvedValue({ deleted: 2, left: 1 });

    await expect(candidates.clean(8_000)).resolves.toEqual({ deleted: 2, left: 1 });

    const [forget, options, now] = clean.mock.calls[0] ?? [];

    expect(now).toBe(NOW);
    expect(options?.until?.getTime()).toBeGreaterThanOrEqual(before + 4_000);
    expect(options?.until?.getTime()).toBeLessThanOrEqual(Date.now() + 4_000);

    store.files.set(PATH, STUB_PICTURE);
    await forget?.(PATH);
    expect(store.files.size).toBe(0);
  });

  /* A token removed while dishes hold a pointer must not leave them waiting for ever (PRD 7). */
  it('removes the pointers without the store’s token, deleting no file', async () => {
    const store = withoutToken();
    const del = jest.spyOn(store, 'del');

    clean.mockResolvedValue({ deleted: 1, left: 0 });

    await expect(service(store).candidates.clean(8_000)).resolves.toEqual({ deleted: 1, left: 0 });

    const [forget] = clean.mock.calls[0] ?? [];

    await expect(forget?.(PATH)).resolves.toBeUndefined();
    expect(del).not.toHaveBeenCalled();
  });

  it('asks the store to delete nothing that is not a candidate’s path', async () => {
    const { candidates, store } = service();
    const del = jest.spyOn(store, 'del');

    await candidates.forget('dish-pictures/11111111-2222-4333-8444-555555555555/2.0.0-public.jpg');
    await candidates.forget(`${PATH}/../../other.jpg`);

    expect(del).not.toHaveBeenCalled();
  });
});
