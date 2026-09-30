import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { Logger } from '@nestjs/common';

import { RecipeController } from 'core/controllers/Recipe';
import { judgePicture } from 'core/domain/DishPicture';

import { BackgroundTaskService } from '../../../shared/services/index.js';
import { DishPictureService, IMAGE_COST_FLOOR_USD, isRefusal, JUDGE_COST_FLOOR_USD } from './DishPicture.service.js';
import { PictureCallError } from '../clients/pictureTransport.js';
import {
  STUB_PICTURE,
  StubPictureCandidateStore,
  StubPictureImageClient,
  StubPictureJudgeClient,
  StubPictureStore
} from '../clients/StubPictureClients.js';

import type { PictureClaim } from 'core/controllers/Recipe';
import type { PictureCall, PictureJudgedDrawing } from 'core/entities/DishPicture';
import type { PictureCatalogueEntry, PictureRecipe } from 'core/domain/DishPicture';
import type { PictureCandidateStore } from '../clients/PictureCandidateStore.js';
import type { PictureImageClient } from '../clients/PictureImageClient.js';
import type { PictureJudgeClient } from '../clients/PictureJudgeClient.js';

const RECIPE = '6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f';
const CLAIM: PictureClaim = { attempts: 0, claimedAt: new Date('2026-09-27T12:00:00Z'), recipeId: RECIPE };

const RICE: PictureRecipe = { ingredients: [{ grams: 200, name: 'Cooked white rice', slug: 'arroz-blanco-cocido' }], name: 'Arroz blanco' };
const CATALOGUE: readonly PictureCatalogueEntry[] = [
  { allergens: [], mayContain: [], names: ['Arroz blanco cocido', 'Cooked white rice'], slug: 'arroz-blanco-cocido' },
  { allergens: ['crustaceans'], mayContain: [], names: ['Gambas', 'Fresh prawns'], slug: 'gambas' },
  { allergens: ['milk', 'lactose'], mayContain: [], names: ['Queso curado', 'Mature cheese'], slug: 'queso-curado' }
];

/** A judge that sees prawns on a dish of rice: an extra food carrying an allergen the dish lacks. */
class PrawnsJudge extends StubPictureJudgeClient {
  override async see() {
    return {
      costUsd: 0.0004,
      model: 'judge',
      provider: 'DeepInfra',
      result: { foods: [{ amount: 'main' as const, name: 'shrimp', specific: true }] }
    };
  }

  override async match() {
    return { costUsd: 0.0002, model: 'judge', provider: 'DeepInfra', result: { extras: ['shrimp'], ingredients: [] } };
  }
}

let calls: PictureCall[];
let spend: number;

/** The private store with no token: nothing is kept in it, which is how every drawing was before `0072`. */
function noCandidateStore(): StubPictureCandidateStore {
  return Object.defineProperty(new StubPictureCandidateStore(), 'isAvailable', { get: () => false });
}

function service(
  parts: { candidates?: PictureCandidateStore; cap?: number; images?: PictureImageClient; judge?: PictureJudgeClient; store?: StubPictureStore } = {}
) {
  const store = parts.store ?? new StubPictureStore();

  return {
    pictures: new DishPictureService(
      new BackgroundTaskService(),
      parts.images ?? new StubPictureImageClient(),
      parts.judge ?? new StubPictureJudgeClient(),
      store,
      parts.candidates ?? noCandidateStore(),
      parts.cap ?? 10
    ),
    store
  };
}

/** An image client whose every call ends as `draw` says. */
function drawing(draw: PictureImageClient['draw']): PictureImageClient {
  return Object.assign(new StubPictureImageClient(), { draw: jest.fn(draw) });
}

let complete: jest.Spied<typeof RecipeController.completePicture>;
let fail: jest.Spied<typeof RecipeController.failPicture>;
let release: jest.Spied<typeof RecipeController.releasePicture>;

beforeEach(() => {
  calls = [];
  spend = 0;
  jest.spyOn(RecipeController, 'pictureInputs').mockResolvedValue({ catalogue: CATALOGUE, recipe: RICE });
  jest.spyOn(RecipeController, 'pictureSpendUsd').mockImplementation(async () => Promise.resolve(spend));
  jest.spyOn(RecipeController, 'recordPictureCall').mockImplementation(async call => {
    calls.push(call);
  });
  complete = jest.spyOn(RecipeController, 'completePicture').mockResolvedValue(true);
  fail = jest.spyOn(RecipeController, 'failPicture').mockResolvedValue(true);
  release = jest.spyOn(RecipeController, 'releasePicture').mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/* PRD 006, criteria 2 and 6: only an accepted picture is kept, byte for byte, in Blob. */
describe('DishPictureService.draw — a picture that is kept', () => {
  it('stores the file untouched at a path with the recipe and no person, then marks the dish ready', async () => {
    const { pictures, store } = service();

    await expect(pictures.draw(CLAIM)).resolves.toBe('accepted');

    expect(store.stored).toHaveLength(1);
    expect(store.stored[0]?.bytes).toBe(STUB_PICTURE);
    expect(store.stored[0]?.path).toMatch(new RegExp(`^dish-pictures/${RECIPE}/2\\.0\\.0-[0-9a-f-]{36}\\.jpg$`));
    expect(complete).toHaveBeenCalledWith(CLAIM, {
      attempts: 1,
      judged: expect.objectContaining({ attempts: [expect.objectContaining({ attempt: 1, verdict: { accepted: true, notes: [] } })] }),
      model: 'stub/picture',
      promptVersion: '2.0.0',
      provenance: { c2pa: true, judge: [], notes: [], trainedAlgorithmicMedia: true },
      url: expect.stringMatching(/^data:image\/jpeg;base64,/)
    });
    expect(fail).not.toHaveBeenCalled();
  });

  it('records the image call and both judge calls, each with what it cost', async () => {
    const { pictures } = service();

    await pictures.draw(CLAIM);

    expect(calls.map(call => [call.kind, call.outcome, call.costUsd])).toEqual([
      ['image', 'drawn', 0],
      ['judge', 'seen', 0],
      ['judge', 'matched', 0]
    ]);
    expect(calls.every(call => call.recipeId === RECIPE)).toBe(true);
  });

  it('records a call whose cost OpenRouter never said at the floor, never at 0', async () => {
    const images = drawing(async () =>
      Promise.resolve({ bytes: STUB_PICTURE, contentType: 'image/jpeg', costUsd: null, generationId: null, model: 'm', provider: null })
    );
    const judge = Object.assign(new StubPictureJudgeClient(), {
      see: async () => Promise.resolve({ costUsd: null, model: 'judge', provider: null, result: { foods: [] } })
    });

    await service({ images, judge }).pictures.draw(CLAIM);

    expect(calls.map(call => call.costUsd)).toEqual([IMAGE_COST_FLOOR_USD, JUDGE_COST_FLOOR_USD, 0]);
  });
});

describe('DishPictureService.draw — a picture that is not kept', () => {
  it('rejects a picture showing a food with an allergen the dish lacks, three times, and stores none of them', async () => {
    const { pictures, store } = service({ judge: new PrawnsJudge() });

    await expect(pictures.draw(CLAIM)).resolves.toBe('failed');

    expect(store.stored).toEqual([]);
    expect(complete).not.toHaveBeenCalled();
    expect(calls.filter(call => call.kind === 'image')).toHaveLength(3);
    expect(fail).toHaveBeenCalledWith(CLAIM, {
      attempts: 3,
      judged: expect.objectContaining({ attempts: [1, 2, 3].map(attempt => expect.objectContaining({ attempt })) }),
      provenance: {
        notes: expect.arrayContaining([expect.stringMatching(/^1:rejected:extra_allergen:shrimp=crustaceans/)]),
        reason: 'judge_allergen'
      }
    });
  });

  it('never keeps a picture the judge could not judge', async () => {
    const judge = Object.assign(new StubPictureJudgeClient(), {
      see: async () => Promise.reject(new PictureCallError('The judge answered with JSON of the wrong shape', null))
    });
    const { pictures, store } = service({ judge });

    await expect(pictures.draw(CLAIM)).resolves.toBe('failed');

    expect(store.stored).toEqual([]);
    expect(calls.filter(call => call.kind === 'judge').map(call => [call.outcome, call.costUsd])).toEqual([
      ['error', JUDGE_COST_FLOOR_USD],
      ['error', JUDGE_COST_FLOOR_USD],
      ['error', JUDGE_COST_FLOOR_USD]
    ]);
  });

  it('counts the attempts a stale takeover already made, and fails the dish at three', async () => {
    const { pictures } = service({ judge: new PrawnsJudge() });

    await pictures.draw({ ...CLAIM, attempts: 2 });

    expect(calls.filter(call => call.kind === 'image')).toHaveLength(1);
    expect(fail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ attempts: 3 }));
  });

  it('fails a file with no C2PA manifest at once, without judging it or drawing again', async () => {
    const images = drawing(async () =>
      Promise.resolve({
        bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
        contentType: 'image/jpeg',
        costUsd: 0.0337,
        generationId: null,
        model: 'm',
        provider: null
      })
    );
    const { pictures, store } = service({ images });

    await expect(pictures.draw(CLAIM)).resolves.toBe('failed');

    expect(store.stored).toEqual([]);
    expect(calls.map(call => call.kind)).toEqual(['image']);
    expect(fail).toHaveBeenCalledWith(CLAIM, {
      attempts: 1,
      // Nothing reached the judge: nothing of it is stored.
      judged: null,
      // 0072: the file is never kept; what it was is — a closed diagnostic.
      provenance: {
        diagnostic: { c2pa: false, contentType: 'image/jpeg', jpeg: true, size: 4, trainedAlgorithmicMedia: false },
        notes: ['1:unkeepable:no C2PA manifest (image/jpeg)'],
        reason: 'no_provenance'
      }
    });
  });

  it('draws again after an image call that failed, recording what it may have cost', async () => {
    let first = true;
    const images = drawing(async () => {
      if (first) {
        first = false;

        throw new PictureCallError('OpenRouter /images answered 502: bad gateway', 502);
      }

      return Promise.resolve({
        bytes: STUB_PICTURE,
        contentType: 'image/jpeg' as const,
        costUsd: 0.0337,
        generationId: null,
        model: 'm',
        provider: null
      });
    });

    await expect(service({ images }).pictures.draw(CLAIM)).resolves.toBe('accepted');

    expect(calls.filter(call => call.kind === 'image').map(call => [call.outcome, call.costUsd])).toEqual([
      ['error', IMAGE_COST_FLOOR_USD],
      ['drawn', 0.0337]
    ]);
    expect(complete).toHaveBeenCalledWith(CLAIM, expect.objectContaining({ attempts: 2 }));
  });

  it('fails the dish when the store fails, rather than paying for another drawing', async () => {
    const store = Object.assign(new StubPictureStore(), { put: async () => Promise.reject(new Error('Blob put failed: 503')) });

    await expect(service({ store }).pictures.draw(CLAIM)).resolves.toBe('failed');

    expect(calls.filter(call => call.kind === 'image')).toHaveLength(1);
    expect(complete).not.toHaveBeenCalled();
  });

  it('says a drawing whose claim was taken over is lost', async () => {
    complete.mockResolvedValue(false);

    await expect(service().pictures.draw(CLAIM)).resolves.toBe('lost');
  });
});

/* PRD 009, criteria 2 and 7 (`0072`): the last rejected picture waits, privately, only when the drawing ends failed. */
describe('DishPictureService.draw — a rejected picture kept for the owner', () => {
  const CANDIDATE_PATH = new RegExp(`^dish-picture-candidates/${RECIPE}/2\\.0\\.0-[0-9a-f-]{36}\\.jpg$`);

  /** A signed picture that is not the stub's: the same marks, one byte more. */
  const picture = (last: number) => new Uint8Array([...STUB_PICTURE, last]);

  /** Draws a different signed picture each time, so the one that was kept can be told. */
  function numbered(): PictureImageClient {
    let drawn = 0;

    return drawing(async () => {
      drawn += 1;

      return Promise.resolve({
        bytes: picture(drawn),
        contentType: 'image/jpeg' as const,
        costUsd: 0,
        generationId: null,
        model: 'stub/picture',
        provider: 'stub'
      });
    });
  }

  it('uploads the last rejected picture, untouched, to the private store and points the failed row at it', async () => {
    const candidates = new StubPictureCandidateStore();
    const { pictures, store } = service({ candidates, images: numbered(), judge: new PrawnsJudge() });

    await expect(pictures.draw(CLAIM)).resolves.toBe('failed');

    // Exactly one private file — the third attempt's — and nothing in the public store.
    expect(store.stored).toEqual([]);
    expect([...candidates.files.keys()]).toEqual([expect.stringMatching(CANDIDATE_PATH)]);
    const [[path, bytes] = []] = [...candidates.files];

    expect(bytes).toEqual(picture(3));
    expect(fail).toHaveBeenCalledTimes(1);
    expect(fail).toHaveBeenCalledWith(CLAIM, {
      attempts: 3,
      judged: expect.objectContaining({ attempts: expect.any(Array) }),
      provenance: {
        // The judge's closed data: allergen keys and catalogue slugs. Its word for the food ("shrimp") is not here.
        candidate: { extras: [{ foreignAllergens: ['crustaceans'], mappedTo: ['gambas'] }], model: 'stub/picture', path, promptVersion: '2.0.0' },
        notes: expect.arrayContaining([expect.stringMatching(/^3:rejected:extra_allergen/)]),
        // Phase 1's mail counts by this: a candidate beside it changes nothing.
        reason: 'judge_allergen'
      }
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it('keeps nothing of the judge’s own words in the pointer', async () => {
    const { pictures } = service({ candidates: new StubPictureCandidateStore(), judge: new PrawnsJudge() });

    await pictures.draw(CLAIM);

    const candidate = (fail.mock.calls[0]?.[1].provenance as { candidate: unknown }).candidate;

    expect(JSON.stringify(candidate)).not.toContain('shrimp');
  });

  it('keeps none when the drawing is accepted in the end, though an earlier attempt was rejected', async () => {
    const candidates = new StubPictureCandidateStore();
    const prawns = new PrawnsJudge();
    let judged = 0;
    const judge = Object.assign(new StubPictureJudgeClient(), {
      match: async (...args: Parameters<StubPictureJudgeClient['match']>) =>
        judged === 1 ? prawns.match() : new StubPictureJudgeClient().match(...args),
      see: async () => {
        judged += 1;

        return judged === 1 ? prawns.see() : new StubPictureJudgeClient().see();
      }
    });
    const { pictures, store } = service({ candidates, judge });

    await expect(pictures.draw(CLAIM)).resolves.toBe('accepted');

    expect(candidates.files.size).toBe(0);
    expect(store.stored).toHaveLength(1);
    expect(complete).toHaveBeenCalledWith(CLAIM, expect.objectContaining({ attempts: 2 }));
    expect(fail).not.toHaveBeenCalled();
  });

  it('keeps none when the drawing is given back after a rejection — the cap, a refused key', async () => {
    const candidates = new StubPictureCandidateStore();
    let first = true;
    const images = drawing(async () => {
      if (first) {
        first = false;

        return Promise.resolve({
          bytes: STUB_PICTURE,
          contentType: 'image/jpeg' as const,
          costUsd: 0,
          generationId: null,
          model: 'm',
          provider: null
        });
      }

      throw new PictureCallError('OpenRouter /images answered 402: Key limit exceeded', 402);
    });

    await expect(service({ candidates, images, judge: new PrawnsJudge() }).pictures.draw(CLAIM)).resolves.toBe('released');

    expect(candidates.files.size).toBe(0);
    expect(fail).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('never uploads a file without its C2PA manifest: the row gets a closed diagnostic and no candidate', async () => {
    const candidates = new StubPictureCandidateStore();
    const images = drawing(async () =>
      Promise.resolve({
        bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]),
        contentType: 'image/png',
        costUsd: 0,
        generationId: null,
        model: 'm',
        provider: null
      })
    );

    await expect(service({ candidates, images, judge: new PrawnsJudge() }).pictures.draw(CLAIM)).resolves.toBe('failed');

    expect(candidates.files.size).toBe(0);
    expect(fail).toHaveBeenCalledWith(CLAIM, {
      attempts: 1,
      judged: null,
      provenance: {
        diagnostic: { c2pa: false, contentType: 'image/png', jpeg: false, size: 6, trainedAlgorithmicMedia: false },
        notes: ['1:unkeepable:no C2PA manifest (image/png)'],
        reason: 'no_provenance'
      }
    });
  });

  it('keeps the signed picture the judge rejected earlier, and never the unsigned file that ended the drawing', async () => {
    const candidates = new StubPictureCandidateStore();
    const unsigned = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    let first = true;
    const images = drawing(async () => {
      const bytes = first ? STUB_PICTURE : unsigned;

      first = false;

      return Promise.resolve({ bytes, contentType: 'image/jpeg' as const, costUsd: 0, generationId: null, model: 'm', provider: null });
    });

    await expect(service({ candidates, images, judge: new PrawnsJudge() }).pictures.draw(CLAIM)).resolves.toBe('failed');

    expect([...candidates.files.values()]).toEqual([STUB_PICTURE]);
    expect(fail).toHaveBeenCalledWith(CLAIM, {
      attempts: 2,
      // The first attempt reached the judge; the unsigned file that ended the drawing did not.
      judged: expect.objectContaining({ attempts: [expect.objectContaining({ attempt: 1 })] }),
      provenance: expect.objectContaining({
        candidate: expect.objectContaining({ path: expect.stringMatching(CANDIDATE_PATH) }),
        diagnostic: { c2pa: false, contentType: 'image/jpeg', jpeg: true, size: 4, trainedAlgorithmicMedia: false },
        reason: 'no_provenance'
      })
    });
  });

  it('keeps none of a picture the judge never got to judge', async () => {
    const candidates = new StubPictureCandidateStore();
    const judge = Object.assign(new StubPictureJudgeClient(), {
      see: async () => Promise.reject(new PictureCallError('The judge answered with JSON of the wrong shape', null))
    });

    await expect(service({ candidates, judge }).pictures.draw(CLAIM)).resolves.toBe('failed');

    expect(candidates.files.size).toBe(0);
    expect(fail).toHaveBeenCalledWith(CLAIM, { attempts: 3, judged: null, provenance: { notes: expect.any(Array), reason: 'call_failed' } });
  });

  it('fails the dish exactly as before, with no candidate, when the upload fails', async () => {
    const candidates = Object.assign(new StubPictureCandidateStore(), { put: async () => Promise.reject(new Error('Candidate put failed: 503')) });

    await expect(service({ candidates, judge: new PrawnsJudge() }).pictures.draw(CLAIM)).resolves.toBe('failed');

    expect(fail).toHaveBeenCalledWith(CLAIM, {
      attempts: 3,
      judged: expect.objectContaining({ attempts: expect.any(Array) }),
      provenance: { notes: expect.any(Array), reason: 'judge_allergen' }
    });
  });

  /* PRD 009, criterion 7. */
  it('keeps nothing, and asks the private store nothing, without its token', async () => {
    const candidates = noCandidateStore();
    const put = jest.spyOn(candidates, 'put');

    await expect(service({ candidates, judge: new PrawnsJudge() }).pictures.draw(CLAIM)).resolves.toBe('failed');

    expect(put).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith(CLAIM, {
      attempts: 3,
      judged: expect.objectContaining({ attempts: expect.any(Array) }),
      provenance: { notes: expect.any(Array), reason: 'judge_allergen' }
    });
  });

  it('can draw without the private store: it is not what a picture needs to be kept', () => {
    expect(service({ candidates: noCandidateStore() }).pictures.isAvailable).toBe(true);
  });

  it('deletes the file it uploaded when the claim was taken over, so no file is left without a pointer', async () => {
    const candidates = new StubPictureCandidateStore();

    fail.mockResolvedValue(false);

    await expect(service({ candidates, judge: new PrawnsJudge() }).pictures.draw(CLAIM)).resolves.toBe('lost');

    expect(candidates.files.size).toBe(0);
  });

  it('deletes the file it uploaded when the failure could not be written', async () => {
    const candidates = new StubPictureCandidateStore();

    fail.mockRejectedValue(new Error('database gone'));

    await expect(service({ candidates, judge: new PrawnsJudge() }).pictures.draw(CLAIM)).rejects.toThrow('database gone');

    expect(candidates.files.size).toBe(0);
  });
});

/* Project 010, phase 3 (PRD 010, criterion 10): what the judge said on each attempt is handed to the drawing's end. */
describe('DishPictureService.draw — what the judge said is kept', () => {
  /** The judged drawing a call to the controller carried. */
  const judgedOf = (call: { judged: PictureJudgedDrawing | null } | undefined): PictureJudgedDrawing | null => call?.judged ?? null;

  it('hands a failed drawing’s end each judged attempt’s two answers and verdict, and the recipe it was judged against', async () => {
    await service({ judge: new PrawnsJudge() }).pictures.draw(CLAIM);

    const judged = judgedOf(fail.mock.calls[0]?.[1]);

    expect(judged?.recipe).toEqual({ ...RICE, reduced: false });
    expect(judged?.attempts).toHaveLength(3);
    expect(judged?.attempts[0]).toEqual({
      at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      attempt: 1,
      match: { extras: ['shrimp'], ingredients: [] },
      reduced: false,
      seen: { foods: [{ amount: 'main', name: 'shrimp', specific: true }] },
      verdict: { accepted: false, notes: [expect.stringMatching(/^extra_allergen:shrimp=crustaceans/), 'extra_food:shrimp'] }
    });
  });

  it('stores what a replay needs: the stored answers, run through the rule again, give the verdict the drawing got', async () => {
    await service({ judge: new PrawnsJudge() }).pictures.draw(CLAIM);

    const judged = judgedOf(fail.mock.calls[0]?.[1]);

    for (const attempt of judged?.attempts ?? []) {
      const verdict = judgePicture({ catalogue: CATALOGUE, match: attempt.match, recipe: judged?.recipe ?? RICE, seen: attempt.seen });

      expect({ accepted: verdict.accepted, notes: verdict.notes }).toEqual(attempt.verdict);
    }
  });

  it('hands an accepted drawing’s end its judged attempts, the rejected one before it included', async () => {
    const prawns = new PrawnsJudge();
    let seen = 0;
    const judge = Object.assign(new StubPictureJudgeClient(), {
      match: async (...args: Parameters<StubPictureJudgeClient['match']>) =>
        seen === 1 ? prawns.match() : new StubPictureJudgeClient().match(...args),
      see: async () => {
        seen += 1;

        return seen === 1 ? prawns.see() : new StubPictureJudgeClient().see();
      }
    });

    await expect(service({ judge }).pictures.draw(CLAIM)).resolves.toBe('accepted');

    expect(judgedOf(complete.mock.calls[0]?.[1])?.attempts.map(attempt => [attempt.attempt, attempt.verdict.accepted])).toEqual([
      [1, false],
      [2, true]
    ]);
  });

  it('stores nothing of an attempt that never reached the judge — a failed image call, a failed judge call — and keeps the ones that did', async () => {
    let drawn = 0;
    const images = drawing(async () => {
      drawn += 1;

      if (drawn === 2) {
        throw new PictureCallError('OpenRouter /images answered 503: overloaded', 503);
      }

      return Promise.resolve({ bytes: STUB_PICTURE, contentType: 'image/jpeg' as const, costUsd: 0, generationId: null, model: 'm', provider: null });
    });
    const prawns = new PrawnsJudge();
    let seen = 0;
    const judge = Object.assign(new PrawnsJudge(), {
      see: async () => {
        seen += 1;

        return seen === 2 ? Promise.reject(new PictureCallError('The judge answered with JSON of the wrong shape', null)) : prawns.see();
      }
    });

    await expect(service({ images, judge }).pictures.draw(CLAIM)).resolves.toBe('failed');

    // Attempt 1 judged; 2 had no picture; 3 had one the judge could not answer on.
    expect(judgedOf(fail.mock.calls[0]?.[1])?.attempts.map(attempt => attempt.attempt)).toEqual([1]);
  });

  it('hands a drawing given back after a judged attempt what that attempt was judged', async () => {
    let calls = 0;
    const judge = Object.assign(new PrawnsJudge(), {
      match: async () => {
        calls += 1;

        return calls < 2
          ? Promise.resolve({ costUsd: 0.0002, model: 'judge', provider: null, result: { extras: ['shrimp'], ingredients: [] } })
          : Promise.reject(new PictureCallError('OpenRouter /chat/completions answered 402: Key limit exceeded', 402));
      }
    });

    await expect(service({ judge }).pictures.draw(CLAIM)).resolves.toBe('released');

    expect(judgedOf(release.mock.calls[0]?.[1])?.attempts.map(attempt => attempt.attempt)).toEqual([1]);
  });

  it('ends a drawing whose answers are oversized or malformed exactly as it would have, with them stored cut', async () => {
    const foods = Array.from({ length: 80 }, (_, index) => ({ amount: 'main' as const, name: `${'x'.repeat(400)}\u0000${index}`, specific: true }));
    const judge = Object.assign(new PrawnsJudge(), {
      see: async () => ({
        costUsd: 0,
        model: 'judge',
        provider: null,
        result: { foods: [{ amount: 'main' as const, name: 'shrimp', specific: true }, ...foods] }
      })
    });

    await expect(service({ judge }).pictures.draw(CLAIM)).resolves.toBe('failed');

    const [, outcome] = fail.mock.calls[0] ?? [];

    expect(outcome?.provenance).toMatchObject({ reason: 'judge_allergen' });
    expect(outcome?.judged?.attempts[0]).toMatchObject({ reduced: true, seen: { foods: expect.any(Array) } });
    expect(outcome?.judged?.attempts[0]?.seen.foods).toHaveLength(16);
    expect(JSON.stringify(outcome?.judged)).not.toContain('\\u0000');
  });

  it('ends a drawing as it would have, storing nothing of the attempt, when its answers cannot be kept at all', async () => {
    const name = 'n'.repeat(60);
    const ingredients = Array.from({ length: 30 }, (_, index) => ({
      matched: [name, name, name, name],
      slug: `slug-${index}-${'s'.repeat(70)}`,
      status: 'seen' as const
    }));
    const judge = Object.assign(new PrawnsJudge(), {
      match: async () => ({ costUsd: 0, model: 'judge', provider: null, result: { extras: ['shrimp'], ingredients } })
    });

    await expect(service({ judge }).pictures.draw(CLAIM)).resolves.toBe('failed');

    expect(fail).toHaveBeenCalledWith(CLAIM, {
      attempts: 3,
      judged: null,
      provenance: { notes: expect.arrayContaining([expect.stringMatching(/^3:rejected:extra_allergen/)]), reason: 'judge_allergen' }
    });
  });

  it('writes none of the judge’s answers to a log line', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const judge = Object.assign(new PrawnsJudge(), {
      see: async () => ({
        costUsd: 0,
        model: 'judge',
        provider: null,
        result: { foods: [{ amount: 'main' as const, name: 'zzjudge-sentinel-food', specific: true }] }
      })
    });

    fail.mockRejectedValue(new Error('database gone'));
    await service({ candidates: new StubPictureCandidateStore(), judge })
      .pictures.draw(CLAIM)
      .catch(() => undefined);
    release.mockResolvedValue(true);
    spend = 10;
    await service({ judge }).pictures.draw(CLAIM);

    expect(JSON.stringify(warn.mock.calls)).not.toContain('zzjudge-sentinel-food');
  });
});

/* PRD 006, criterion 7, and the key's own limit: what stops a drawing without failing the dish. */
describe('DishPictureService.draw — stopping without blaming the dish', () => {
  it('makes no image call once the month’s spend has reached the cap, and gives the claim back', async () => {
    spend = 10;
    const images = drawing(async () => Promise.reject(new Error('must not be called')));

    await expect(service({ images }).pictures.draw(CLAIM)).resolves.toBe('released');

    expect(images.draw).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledWith(CLAIM, { attempts: 0, judged: null, reason: 'cap_reached', why: 'the month’s cap is reached' });
    expect(fail).not.toHaveBeenCalled();
  });

  it.each([
    ['a key past its limit (402)', new PictureCallError('OpenRouter /images answered 402: Key limit exceeded', 402), 'payment_refused'],
    ['a rate limit (429)', new PictureCallError('OpenRouter /images answered 429: Too many requests', 429), 'model_refused'],
    ['a quota in the provider’s words', new Error('RESOURCE_EXHAUSTED: quota exceeded'), 'payment_refused']
  ])('gives the claim back on %s, recording the refusal at no cost', async (_case, refusal, reason) => {
    const images = drawing(async () => Promise.reject(refusal));

    await expect(service({ images }).pictures.draw(CLAIM)).resolves.toBe('released');

    expect(images.draw).toHaveBeenCalledTimes(1);
    // The refused attempt is not counted against the dish.
    expect(release).toHaveBeenCalledWith(CLAIM, expect.objectContaining({ attempts: 0, reason }));
    expect(fail).not.toHaveBeenCalled();
    expect(calls[0]?.costUsd).toBe(refusal instanceof PictureCallError ? 0 : IMAGE_COST_FLOOR_USD);
  });

  it('keeps the attempts the dish already used when the claim is given back', async () => {
    let calls = 0;
    const judge = Object.assign(new PrawnsJudge(), {
      match: async () => {
        calls += 1;

        return calls < 3
          ? Promise.resolve({ costUsd: 0.0002, model: 'judge', provider: null, result: { extras: ['shrimp'], ingredients: [] } })
          : Promise.reject(new PictureCallError('OpenRouter /chat/completions answered 402: Key limit exceeded', 402));
      }
    });

    await expect(service({ judge }).pictures.draw(CLAIM)).resolves.toBe('released');
    expect(release).toHaveBeenCalledWith(CLAIM, expect.objectContaining({ attempts: 2 }));
  });

  it('gives the claim back when the judge’s key is refused too', async () => {
    const judge = Object.assign(new StubPictureJudgeClient(), {
      match: async () => Promise.reject(new PictureCallError('OpenRouter /chat/completions answered 402: Key limit exceeded', 402))
    });

    await expect(service({ judge }).pictures.draw(CLAIM)).resolves.toBe('released');
    expect(fail).not.toHaveBeenCalled();
  });

  it('gives the claim back for a recipe that is gone', async () => {
    jest.spyOn(RecipeController, 'pictureInputs').mockResolvedValue(null);

    await expect(service().pictures.draw(CLAIM)).resolves.toBe('released');
  });

  it('fails the dish with a closed reason for a call that broke, never the provider’s words', async () => {
    const images = drawing(async () => Promise.reject(new PictureCallError('OpenRouter /images answered 503: upstream trouble', 503)));

    await expect(service({ images }).pictures.draw(CLAIM)).resolves.toBe('failed');
    expect(fail).toHaveBeenCalledWith(CLAIM, { attempts: 3, judged: null, provenance: { notes: expect.any(Array), reason: 'call_failed' } });
  });

  it('fails the dish on anything unexpected, never leaving it drawing', async () => {
    jest.spyOn(RecipeController, 'pictureSpendUsd').mockRejectedValue(new Error('database down'));

    await expect(service().pictures.draw(CLAIM)).resolves.toBe('failed');
    expect(fail).toHaveBeenCalledWith(CLAIM, { attempts: 0, judged: null, provenance: { notes: ['error:database down'], reason: 'other' } });
  });
});

describe('DishPictureService', () => {
  it('can draw only when it can draw, judge and keep', () => {
    const unavailable = <T extends object>(client: T) => Object.defineProperty(client, 'isAvailable', { get: () => false });

    expect(service().pictures.isAvailable).toBe(true);
    expect(service({ images: unavailable(new StubPictureImageClient()) }).pictures.isAvailable).toBe(false);
    expect(service({ judge: unavailable(new StubPictureJudgeClient()) }).pictures.isAvailable).toBe(false);
    expect(service({ store: unavailable(new StubPictureStore()) }).pictures.isAvailable).toBe(false);
  });

  it('draws a scheduled claim after answering', async () => {
    const { pictures, store } = service();

    pictures.schedule(CLAIM);
    await new Promise(resolve => {
      setTimeout(resolve, 20);
    });

    expect(store.stored).toHaveLength(1);
  });

  /* Project 009: whoever scheduled the drawing is told it ended; what they do with it lives outside this module. */
  it('tells the caller a scheduled drawing ended, however it ended, and only then', async () => {
    const wait = async () =>
      new Promise(resolve => {
        setTimeout(resolve, 20);
      });
    const onEnd = jest.fn<() => void>();
    const kept = service();

    kept.pictures.schedule(CLAIM, onEnd);
    expect(onEnd).not.toHaveBeenCalled();
    await wait();
    expect(kept.store.stored).toHaveLength(1);
    expect(onEnd).toHaveBeenCalledTimes(1);

    const failed = service({
      images: drawing(async () => Promise.reject(new PictureCallError('OpenRouter /images answered 503: upstream trouble', 503)))
    });

    failed.pictures.schedule(CLAIM, onEnd);
    await wait();
    expect(onEnd).toHaveBeenCalledTimes(2);

    const thrown = service();

    jest.spyOn(thrown.pictures, 'draw').mockRejectedValue(new Error('database down'));
    thrown.pictures.schedule(CLAIM, onEnd);
    await wait();
    expect(onEnd).toHaveBeenCalledTimes(3);
  });

  it('is not touched by a caller whose end-of-drawing call throws', async () => {
    const { pictures, store } = service();

    pictures.schedule(CLAIM, async () => Promise.reject(new Error('smtp is down')));
    await new Promise(resolve => {
      setTimeout(resolve, 20);
    });

    expect(store.stored).toHaveLength(1);
    expect(complete).toHaveBeenCalledTimes(1);
  });
});

describe('isRefusal', () => {
  it.each([
    [new PictureCallError('x', 402), true],
    [new PictureCallError('x', 429), true],
    [new Error('Key limit exceeded'), true],
    [new Error('insufficient_quota'), true],
    [new PictureCallError('x', 500), false],
    [new PictureCallError('x', null), false],
    [new Error('socket hang up'), false]
  ])('%s → %s', (error, refused) => {
    expect(isRefusal(error)).toBe(refused);
  });
});
