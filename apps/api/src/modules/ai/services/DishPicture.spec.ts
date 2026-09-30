import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { RecipeController } from 'core/controllers/Recipe';

import { BackgroundTaskService } from '../../../shared/services/index.js';
import { DishPictureService, IMAGE_COST_FLOOR_USD, isRefusal, JUDGE_COST_FLOOR_USD } from './DishPicture.service.js';
import { PictureCallError } from '../clients/pictureTransport.js';
import { STUB_PICTURE, StubPictureImageClient, StubPictureJudgeClient, StubPictureStore } from '../clients/StubPictureClients.js';

import type { PictureClaim } from 'core/controllers/Recipe';
import type { PictureCall } from 'core/entities/DishPicture';
import type { PictureCatalogueEntry, PictureRecipe } from 'core/domain/DishPicture';
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

function service(parts: { cap?: number; images?: PictureImageClient; judge?: PictureJudgeClient; store?: StubPictureStore } = {}) {
  const store = parts.store ?? new StubPictureStore();

  return {
    pictures: new DishPictureService(
      new BackgroundTaskService(),
      parts.images ?? new StubPictureImageClient(),
      parts.judge ?? new StubPictureJudgeClient(),
      store,
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
      provenance: { notes: ['1:unkeepable:no C2PA manifest (image/jpeg)'], reason: 'no_provenance' }
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

/* PRD 006, criterion 7, and the key's own limit: what stops a drawing without failing the dish. */
describe('DishPictureService.draw — stopping without blaming the dish', () => {
  it('makes no image call once the month’s spend has reached the cap, and gives the claim back', async () => {
    spend = 10;
    const images = drawing(async () => Promise.reject(new Error('must not be called')));

    await expect(service({ images }).pictures.draw(CLAIM)).resolves.toBe('released');

    expect(images.draw).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledWith(CLAIM, { attempts: 0, reason: 'cap_reached', why: 'the month’s cap is reached' });
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
    expect(fail).toHaveBeenCalledWith(CLAIM, { attempts: 3, provenance: { notes: expect.any(Array), reason: 'call_failed' } });
  });

  it('fails the dish on anything unexpected, never leaving it drawing', async () => {
    jest.spyOn(RecipeController, 'pictureSpendUsd').mockRejectedValue(new Error('database down'));

    await expect(service().pictures.draw(CLAIM)).resolves.toBe('failed');
    expect(fail).toHaveBeenCalledWith(CLAIM, { attempts: 0, provenance: { notes: ['error:database down'], reason: 'other' } });
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
