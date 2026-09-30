import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { NotFoundError } from 'core/entities/Error';
import { RecipeController } from 'core/controllers/Recipe';

import { PictureCandidatesService } from './PictureCandidates.service.js';
import { STUB_PICTURE, StubPictureCandidateStore, StubPictureStore } from '../clients/StubPictureClients.js';

import type { AcceptanceFiles } from 'core/controllers/Recipe';

const RECIPE = '6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f';
const OWNER = 'owner-1';
const NOW = new Date('2026-09-30T12:00:00Z');
const PATH = `dish-picture-candidates/${RECIPE}/2.0.0-0b7e3f2a-5c1d-4e8f-9a6b-7c8d9e0f1a2b.jpg`;
/** What the console showed and the request repeats: the candidate's allergens and its expiry. */
const SHOWN = { allergens: ['crustaceans'], expiresAt: '2026-10-06T12:00:00.000Z' };
const FOUND = {
  candidate: { extras: [{ foreignAllergens: ['crustaceans'], mappedTo: ['gambas'] }], model: 'stub/picture', path: PATH, promptVersion: '2.0.0' },
  expiresAt: new Date('2026-10-06T12:00:00Z')
};

function service(store = new StubPictureCandidateStore(), published = new StubPictureStore()) {
  return { candidates: new PictureCandidatesService(store, published, () => NOW), published, store };
}

function withoutToken(): StubPictureCandidateStore {
  return Object.defineProperty(new StubPictureCandidateStore(), 'isAvailable', { get: () => false });
}

let candidate: jest.Spied<typeof RecipeController.pictureCandidate>;
let discard: jest.Spied<typeof RecipeController.discardCandidate>;
let clean: jest.Spied<typeof RecipeController.cleanCandidates>;
let accept: jest.Spied<typeof RecipeController.acceptCandidate>;
let remove: jest.Spied<typeof RecipeController.removePicture>;

beforeEach(() => {
  candidate = jest.spyOn(RecipeController, 'pictureCandidate').mockResolvedValue(FOUND);
  discard = jest.spyOn(RecipeController, 'discardCandidate').mockResolvedValue(undefined);
  clean = jest.spyOn(RecipeController, 'cleanCandidates').mockResolvedValue({ deleted: 0, left: 0 });
  accept = jest.spyOn(RecipeController, 'acceptCandidate').mockResolvedValue(undefined);
  remove = jest.spyOn(RecipeController, 'removePicture').mockResolvedValue({ fileDeleted: true });
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

/*
 * 0072, PRD 009 criteria 5 and 8: the owner's acceptance. The six steps and their order are core's
 * (`RecipeController.acceptCandidate`, specified there); what is pinned here is what each store is asked.
 */
describe('PictureCandidatesService.accept', () => {
  const PUBLIC_PATH = new RegExp(`^dish-pictures/${RECIPE}/2\\.0\\.0-[0-9a-f-]{36}\\.jpg$`);

  /** The stores as core was handed them by an acceptance. */
  async function handed(candidates: PictureCandidatesService): Promise<AcceptanceFiles> {
    await candidates.accept(RECIPE, OWNER, SHOWN);

    const files = accept.mock.calls.at(-1)?.[3];

    if (files === undefined) {
      throw new Error('core was not asked');
    }

    return files;
  }

  it('hands core the session’s owner, what the request repeats — the allergens and the candidate’s expiry — its clock and the two stores', async () => {
    const { candidates } = service();

    await candidates.accept(RECIPE, OWNER, SHOWN);

    expect(accept).toHaveBeenCalledTimes(1);
    expect(accept).toHaveBeenCalledWith(
      RECIPE,
      OWNER,
      SHOWN,
      { available: true, forget: expect.any(Function), publish: expect.any(Function), read: expect.any(Function), unpublish: expect.any(Function) },
      NOW
    );
  });

  /* A uuid in upper case is the same recipe, and Postgres matches it: it must not pass every check and then break at the public path. */
  it('takes a recipe id in upper case as the recipe it is, and publishes under the lower-case path', async () => {
    const { candidates, published } = service();

    await candidates.accept(RECIPE.toUpperCase(), OWNER, SHOWN);

    expect(accept.mock.calls[0]?.[0]).toBe(RECIPE);
    await accept.mock.calls[0]?.[3].publish(STUB_PICTURE, '2.0.0');
    expect(published.stored[0]?.path).toMatch(PUBLIC_PATH);

    await candidates.remove(RECIPE.toUpperCase(), OWNER);
    expect(remove.mock.calls[0]?.[0]).toBe(RECIPE);
  });

  it('says the stores are unavailable when either token is missing, and lets core refuse', async () => {
    const withoutPublic = Object.defineProperty(new StubPictureStore(), 'isAvailable', { get: () => false });

    await expect(handed(service(withoutToken()).candidates)).resolves.toMatchObject({ available: false });
    await expect(handed(service(new StubPictureCandidateStore(), withoutPublic).candidates)).resolves.toMatchObject({ available: false });
  });

  it('publishes the candidate byte for byte: the very bytes read from the private store, at the usual public path, with the candidate’s prompt version', async () => {
    const { candidates, published, store } = service();

    store.files.set(PATH, STUB_PICTURE);

    // As core does at steps 3 and 4: read, then publish what was read.
    accept.mockImplementation(async (_recipeId, _actorId, _shown, files) => {
      const bytes = await files.read(PATH);

      if (bytes !== null) {
        await files.publish(bytes, '2.0.0');
      }
    });

    await candidates.accept(RECIPE, OWNER, SHOWN);

    expect(published.stored).toHaveLength(1);

    const [file] = published.stored;

    // The same array, never a copy that went through anything: nothing was resized, re-encoded or stripped.
    expect(file?.bytes).toBe(STUB_PICTURE);
    expect(Buffer.from(file?.bytes ?? []).equals(Buffer.from(store.files.get(PATH) ?? [1]))).toBe(true);
    expect(file?.path).toMatch(PUBLIC_PATH);
    // The private file is untouched by the publication: deleting it is a later step.
    expect(store.files.get(PATH)).toBe(STUB_PICTURE);
  });

  it('publishes as a JPEG, under a path made of the recipe and a random part — a new one each time', async () => {
    const { candidates, published } = service();
    const put = jest.spyOn(published, 'put');
    const files = await handed(candidates);

    const { url } = await files.publish(STUB_PICTURE, '2.0.0');
    await files.publish(STUB_PICTURE, '2.0.0');

    expect(url).toMatch(/^data:image\/jpeg;base64,/);
    expect(put.mock.calls[0]?.slice(0, 3)).toEqual([expect.stringMatching(PUBLIC_PATH), STUB_PICTURE, 'image/jpeg']);
    expect(new Set(published.stored.map(file => file.path)).size).toBe(2);
  });

  it('writes a candidate’s bytes nowhere but the public path: the private store is only read and deleted from', async () => {
    const { candidates, store } = service();
    const put = jest.spyOn(store, 'put');
    const files = await handed(candidates);

    store.files.set(PATH, STUB_PICTURE);
    await files.publish((await files.read(PATH)) ?? new Uint8Array(), '2.0.0');
    await files.forget(PATH);

    expect(put).not.toHaveBeenCalled();
    expect(store.files.size).toBe(0);
  });

  it('refuses to publish under a path that is not a dish picture’s, and asks the public store nothing', async () => {
    const { candidates, published } = service();
    const files = await handed(candidates);

    await expect(files.publish(STUB_PICTURE, '../../other/2.0.0')).rejects.toThrow('not a dish picture path');
    expect(published.stored).toHaveLength(0);
  });

  it('reads nothing that is not a candidate’s path, and answers null for a file the store no longer has', async () => {
    const { candidates, store } = service();
    const get = jest.spyOn(store, 'get');
    const files = await handed(candidates);

    await expect(files.read(`dish-pictures/${RECIPE}/2.0.0-public.jpg`)).resolves.toBeNull();
    expect(get).not.toHaveBeenCalled();

    await expect(files.read(PATH)).resolves.toBeNull();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('deletes what a failed publication may have left, by its path, and throws what the store said', async () => {
    const published = Object.assign(new StubPictureStore(), { put: async () => Promise.reject(new Error('Blob put failed: 503')) });
    const files = await handed(service(new StubPictureCandidateStore(), published).candidates);

    await expect(files.publish(STUB_PICTURE, '2.0.0')).rejects.toThrow('Blob put failed: 503');
    expect(published.deleted).toHaveLength(1);
    expect(published.deleted[0]).toMatch(PUBLIC_PATH);
  });

  it('deletes from the public store the file core says no row points to, and throws when it could not', async () => {
    const { candidates, published } = service();
    const files = await handed(candidates);

    await files.unpublish('data:image/jpeg;base64,AAAA');
    expect(published.deleted).toEqual(['data:image/jpeg;base64,AAAA']);

    const failing = Object.assign(new StubPictureStore(), { del: async () => Promise.reject(new Error('Blob del failed: 503')) });

    await expect((await handed(service(new StubPictureCandidateStore(), failing).candidates)).unpublish('x')).rejects.toThrow('Blob del failed: 503');
  });

  it('lets core’s refusal through untouched', async () => {
    const { PictureRetryRefusedError } = await import('core/entities/Error');

    accept.mockRejectedValue(new PictureRetryRefusedError('not_acceptable'));

    await expect(service().candidates.accept(RECIPE, OWNER, { ...SHOWN, allergens: [] })).rejects.toMatchObject({ reason: 'not_acceptable' });
  });
});

/* PRD 009, criterion 6: taking back a picture accepted by hand. */
describe('PictureCandidatesService.remove', () => {
  it('hands core the session’s owner, its clock and the two deletions, and answers whether the public file went', async () => {
    const { candidates, published, store } = service();

    remove.mockResolvedValue({ fileDeleted: false });

    await expect(candidates.remove(RECIPE, OWNER)).resolves.toEqual({ fileDeleted: false });
    expect(remove).toHaveBeenCalledWith(RECIPE, OWNER, { forget: expect.any(Function), unpublish: expect.any(Function) }, NOW);

    const files = remove.mock.calls[0]?.[2];

    await files?.unpublish('https://store.example/dish-pictures/x.jpg');
    expect(published.deleted).toEqual(['https://store.example/dish-pictures/x.jpg']);

    store.files.set(PATH, STUB_PICTURE);
    await files?.forget(PATH);
    expect(store.files.size).toBe(0);
  });

  it('works without the private store’s token: a picture can always be taken back', async () => {
    await expect(service(withoutToken()).candidates.remove(RECIPE, OWNER)).resolves.toEqual({ fileDeleted: true });
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
