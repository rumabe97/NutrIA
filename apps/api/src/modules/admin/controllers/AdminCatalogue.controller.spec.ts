import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { AdminCatalogueController as CoreCatalogue, AdminQualityController as CoreQuality } from 'core/controllers/Admin';
import { NotFoundError, PictureRetryRefusedError } from 'core/entities/Error';
import { RecipeController } from 'core/controllers/Recipe';

import { AdminCatalogueController } from './AdminCatalogue.controller.js';
import { AdminCatalogueService } from '../services/index.js';
import { AdminGuard } from '../../../shared/guards/index.js';
import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { RATE_LIMIT_KEY } from '../../../shared/decorators/RateLimit.decorator.js';
import { DishPictureService, PictureCandidatesService } from '../../ai/services/index.js';
import { OwnerAlertsService } from '../../owner-alerts/index.js';

import type { AdminCatalogueQualityView, AdminIngredientsView, AdminRecipesView, AdminRecipeView } from 'core/controllers/Admin';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

const PREFIX = 'api/v1';

const RECIPES: AdminRecipesView = {
  counts: { bySlot: [], bySource: [], total: 1, withoutImage: 1 },
  offset: 0,
  rows: [
    {
      id: '6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f',
      allergens: ['gluten'],
      carbsG: 60.8,
      fatG: 23.4,
      kcal: 541.2,
      locale: 'es-ES',
      mayContain: [],
      mealSlots: ['lunch'],
      name: 'Bocadillo',
      picture: 'failed',
      pictureCandidate: { allergens: ['crustaceans'], expiresAt: '2026-10-06T12:00:00.000Z', ingredients: [{ name: 'Gambas', slug: 'gambas' }] },
      pictureReason: 'judge_allergen',
      proteinG: 25.8,
      retryableAt: '2026-10-06T12:00:00.000Z',
      slug: 'bocadillo',
      source: 'seed'
    }
  ],
  size: 25,
  total: 1
};

const QUALITY: AdminCatalogueQualityView = {
  period: 30,
  recipes: 3,
  shouldBeZero: { mealsOutsideServingBounds: 0, overBound: 0, refusalLimit: 0, uncosted: 0, unserved: 0 },
  sweep: { attemptBound: 3, current: 3, givenUp: 0, pending: 0, stepsVersion: '2.8.0', withRefusals: 0 },
  sweepHistory: { calls: [], costUsd: [], days: [], heldByCap: [], pending: [], rewritten: [], runs: [], skipped: [], unreached: [] },
  toLookAt: { overCapBySource: [], oversizedRejections: { days: [], values: [] }, picturesFailed: 0 },
  window: { from: '2026-08-30T22:00:00.000Z', previousFrom: '2026-07-30T22:00:00.000Z', to: '2026-09-29T10:00:00.000Z' }
};

const INGREDIENTS: AdminIngredientsView = { offset: 0, rows: [], size: 25, total: 0 };

/**
 * The catalogue's tables (`0068`): the owner's like every console read — a 404
 * for anyone else before the query is read — and the query a DTO bound to one
 * parameter, so a value outside its grammar is 422 before anything runs.
 */
describe('AdminCatalogueController', () => {
  let app: INestApplication;
  let role = 'user';
  const schedule = jest.fn();
  const pictures = { capUsd: 10, isAvailable: true, schedule };
  const pictureFailures = jest.fn(async () => Promise.resolve());
  const NOW = new Date('2026-09-30T12:00:00Z');
  const read = jest.fn<(recipeId: string) => Promise<Uint8Array>>();
  const discard = jest.fn<(recipeId: string, actorId: string) => Promise<void>>();
  const forget = jest.fn<(path: string) => Promise<void>>();
  const candidates = { discard, forget, now: () => NOW, read };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminCatalogueController],
      providers: [
        AdminCatalogueService,
        { provide: DishPictureService, useValue: pictures },
        { provide: PictureCandidatesService, useValue: candidates },
        { provide: OwnerAlertsService, useValue: { pictureFailures } },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
              context.switchToHttp().getRequest().user = { id: 'usr-1', activated: true, email: 'a@b.invalid', emailVerified: true, name: 'A', role };

              return true;
            }
          }
        },
        { provide: APP_GUARD, useClass: AdminGuard }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(PREFIX);
    app.useGlobalFilters(new AllExceptionsFilter());
    app.use(express.json());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    schedule.mockClear();
    read.mockReset();
    discard.mockReset();
    forget.mockReset();
    pictures.isAvailable = true;
  });

  function retry(id: string) {
    return request(app.getHttpServer() as Server).post(`/${PREFIX}/admin/catalogue/recipes/${id}/picture/retry`);
  }

  function get(path: string) {
    return request(app.getHttpServer() as Server).get(`/${PREFIX}/admin/catalogue/${path}`);
  }

  it('is 404 for an ordinary account on both tables, whatever it asks, and reads nothing', async () => {
    role = 'user';
    const recipes = jest.spyOn(CoreCatalogue, 'recipes');
    const ingredients = jest.spyOn(CoreCatalogue, 'ingredients');

    const quality = jest.spyOn(CoreQuality, 'quality');

    for (const path of [
      'recipes',
      'recipes?sort=kcal',
      'recipes?sort=createdAt',
      'recipes?check=over_bound',
      'quality',
      'quality?period=12',
      'ingredients',
      'ingredients?category=meat'
    ]) {
      await get(path).expect(404);
    }

    expect(recipes).not.toHaveBeenCalled();
    expect(ingredients).not.toHaveBeenCalled();
    expect(quality).not.toHaveBeenCalled();
  });

  it('answers the owner one page of recipes, the query validated and typed', async () => {
    role = 'admin';
    const recipes = jest.spyOn(CoreCatalogue, 'recipes').mockResolvedValue(RECIPES);

    const response = await get(
      'recipes?q=%20pan%20&slot=lunch&allergen=gluten&picture=none&source=seed&locale=es-ES&sort=protein&dir=desc&offset=25&size=50&check=over_bound'
    ).expect(200);

    expect(response.body).toEqual(RECIPES);
    // The current steps version is the API's own (`check=refusal_limit` is read against it).
    expect(recipes).toHaveBeenCalledWith(
      {
        allergen: 'gluten',
        check: 'over_bound',
        dir: 'desc',
        locale: 'es-ES',
        offset: 25,
        picture: 'none',
        q: 'pan',
        size: 50,
        slot: 'lunch',
        sort: 'protein',
        source: 'seed'
      },
      expect.stringMatching(/^\d+\.\d+\.\d+$/),
      // 0072: the candidates' own clock, so a row and the file's route agree on what has expired.
      NOW
    );
  });

  it('answers the owner the catalogue’s quality over a period, 30 days when none is asked', async () => {
    role = 'admin';
    const quality = jest.spyOn(CoreQuality, 'quality').mockResolvedValue(QUALITY);

    expect((await get('quality').expect(200)).body).toEqual(QUALITY);
    expect(quality).toHaveBeenLastCalledWith(30, expect.stringMatching(/^\d+\.\d+\.\d+$/));

    await get('quality?period=7').expect(200);
    expect(quality).toHaveBeenLastCalledWith(7, expect.any(String));
  });

  it('answers the owner one page of ingredients, by name from the start when nothing is asked', async () => {
    role = 'admin';
    const ingredients = jest.spyOn(CoreCatalogue, 'ingredients').mockResolvedValue(INGREDIENTS);

    await get('ingredients').expect(200);
    expect(ingredients).toHaveBeenCalledWith({ dir: 'asc', offset: 0, q: undefined, size: 25, sort: 'name' });
  });

  it('refuses a value outside the grammar with INVALID_INPUT — createdAt included, which recipes do not record', async () => {
    role = 'admin';
    const recipes = jest.spyOn(CoreCatalogue, 'recipes');
    const ingredients = jest.spyOn(CoreCatalogue, 'ingredients');
    const quality = jest.spyOn(CoreQuality, 'quality');

    for (const path of [
      'recipes?sort=createdAt',
      'recipes?slot=brunch',
      'recipes?picture=released',
      'recipes?source=import',
      'recipes?allergen=GLUTEN',
      'recipes?locale=spanish',
      'recipes?check=everything',
      'quality?period=12',
      'quality?period=7&period=30',
      'recipes?size=0',
      'recipes?q=a%00b',
      'ingredients?category=meat',
      'ingredients?sort=fiber',
      'ingredients?dir=up'
    ]) {
      const response = await get(path).expect(422);

      expect((response.body as { code: string }).code).toBe('INVALID_INPUT');
    }

    expect(recipes).not.toHaveBeenCalled();
    expect(ingredients).not.toHaveBeenCalled();
    expect(quality).not.toHaveBeenCalled();
  });

  describe('POST recipes/:id/picture/retry', () => {
    it('is rate-limited on the handler: 30 an hour', () => {
      expect(Reflect.getMetadata(RATE_LIMIT_KEY, AdminCatalogueController.prototype.retryPicture)).toEqual({ limit: 30, ttlSeconds: 3600 });
    });

    const CLAIM = { attempts: 0, claimedAt: new Date('2026-09-30T12:00:00Z'), recipeId: '6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f' };

    it('is 404 for an ordinary account, claims nothing and draws nothing', async () => {
      role = 'user';
      const claim = jest.spyOn(RecipeController, 'retryPicture');

      await retry(CLAIM.recipeId).expect(404);

      expect(claim).not.toHaveBeenCalled();
      expect(schedule).not.toHaveBeenCalled();
    });

    it('claims for the owner from the session, hands the claim to the drawing service and answers 202', async () => {
      role = 'admin';
      const claim = jest.spyOn(RecipeController, 'retryPicture').mockResolvedValue(CLAIM);

      const response = await retry(CLAIM.recipeId).expect(202);

      expect(response.body).toEqual({ status: 'drawing' });
      expect(claim).toHaveBeenCalledWith(CLAIM.recipeId, 'usr-1', { available: true, capUsd: 10, forget: expect.any(Function) });
      expect(schedule).toHaveBeenCalledWith(CLAIM, expect.any(Function));

      // 0072: a candidate the dish held is deleted by the retry — core asks, once its claim is made.
      await claim.mock.calls[0]?.[2].forget?.('dish-picture-candidates/x/2.0.0-y.jpg');
      expect(forget).toHaveBeenCalledWith('dish-picture-candidates/x/2.0.0-y.jpg');

      // Project 009: a retry that fails again is mailed like any other, once its drawing ends.
      expect(pictureFailures).not.toHaveBeenCalled();
      await (schedule.mock.calls[0]?.[1] as () => Promise<void>)();
      expect(pictureFailures).toHaveBeenCalledTimes(1);
    });

    it('tells the core when pictures are unavailable, and draws nothing when it refuses', async () => {
      role = 'admin';
      pictures.isAvailable = false;
      const claim = jest.spyOn(RecipeController, 'retryPicture').mockRejectedValue(new PictureRetryRefusedError('unavailable'));

      const response = await retry(CLAIM.recipeId).expect(409);

      expect(claim).toHaveBeenCalledWith(CLAIM.recipeId, 'usr-1', { available: false, capUsd: 10, forget: expect.any(Function) });
      expect((response.body as { code: string }).code).toBe('PICTURE_UNAVAILABLE');
      expect(schedule).not.toHaveBeenCalled();
    });

    it.each([
      ['flag_off', 'PICTURE_FLAG_OFF'],
      ['cap_reached', 'PICTURE_CAP_REACHED'],
      ['drawing', 'PICTURE_DRAWING'],
      ['not_retryable', 'PICTURE_NOT_RETRYABLE']
    ] as const)('answers 409 %s as %s', async (reason, code) => {
      role = 'admin';
      jest.spyOn(RecipeController, 'retryPicture').mockRejectedValue(new PictureRetryRefusedError(reason));

      const response = await retry(CLAIM.recipeId).expect(409);

      expect(response.body).toMatchObject({ code, statusCode: 409 });
    });

    it('answers 404 for a recipe that does not exist', async () => {
      role = 'admin';
      jest.spyOn(RecipeController, 'retryPicture').mockRejectedValue(new NotFoundError('Recipe not found'));

      await retry('00000000-0000-4000-8000-000000000000').expect(404);
      expect(schedule).not.toHaveBeenCalled();
    });

    it('never echoes the segment sent in a 404, for an unknown id or one that is not a uuid', async () => {
      role = 'admin';
      jest.spyOn(RecipeController, 'retryPicture').mockRejectedValue(new NotFoundError('Recipe not found'));

      for (const segment of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid-zzq']) {
        const response = await retry(segment).expect(404);

        expect(JSON.stringify(response.body)).not.toContain(segment);
      }
    });
  });

  /* Project 009, step 4 as amended: one recipe by id with its ingredients, for the review of its rejected picture. */
  describe('GET recipes/:id', () => {
    const ID = '6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f';
    const RECIPE = { ...RECIPES.rows[0], ingredients: [{ grams: 120, name: 'Pan', slug: 'pan' }] } as AdminRecipeView;

    it('is 404 for an ordinary account, the same as every denial, before the id is looked at — and reads nothing', async () => {
      role = 'user';
      const recipe = jest.spyOn(CoreCatalogue, 'recipe');

      const denied = await get(`recipes/${ID}`).expect(404);

      expect(denied.body).toEqual((await get('recipes').expect(404)).body);
      await get('recipes/not-a-uuid').expect(404);
      expect(recipe).not.toHaveBeenCalled();
    });

    it('answers the owner the recipe with its ingredients, by the candidates’ clock, with no address of a file', async () => {
      role = 'admin';
      const recipe = jest.spyOn(CoreCatalogue, 'recipe').mockResolvedValue(RECIPE);

      const response = await get(`recipes/${ID}`).expect(200);

      expect(response.body).toEqual(RECIPE);
      expect(recipe).toHaveBeenCalledWith(ID, NOW);
      expect(JSON.stringify(response.body)).not.toMatch(/dish-picture-candidates|https?:|blob/);
    });

    it('answers 404 for an unknown recipe or an id that is not one, never echoing the segment', async () => {
      role = 'admin';
      jest.spyOn(CoreCatalogue, 'recipe').mockRejectedValue(new NotFoundError('Recipe not found'));

      for (const segment of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid-zzq']) {
        const response = await get(`recipes/${segment}`).expect(404);

        expect(response.body).toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
        expect(JSON.stringify(response.body)).not.toContain(segment);
      }
    });

    it('does not take the table’s, the quality’s or the ingredients’ routes for an id', async () => {
      role = 'admin';
      const recipe = jest.spyOn(CoreCatalogue, 'recipe');

      jest.spyOn(CoreCatalogue, 'recipes').mockResolvedValue(RECIPES);
      jest.spyOn(CoreQuality, 'quality').mockResolvedValue(QUALITY);
      jest.spyOn(CoreCatalogue, 'ingredients').mockResolvedValue(INGREDIENTS);

      await get('recipes').expect(200);
      await get('quality').expect(200);
      await get('ingredients').expect(200);

      expect(recipe).not.toHaveBeenCalled();
    });
  });

  /* 0072, PRD 009 criteria 2, 4 and 9: the rejected picture a dish holds for the owner — seen, and discarded. */
  describe('a dish’s picture candidate', () => {
    const RECIPE = '6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f';
    const FILE = new Uint8Array([0xff, 0xd8, 0xff, 0xeb, 0x00, 0x04, 0x4a, 0x50, 0xff, 0xd9]);

    function file(id: string) {
      return request(app.getHttpServer() as Server).get(`/${PREFIX}/admin/catalogue/recipes/${id}/picture/candidate`);
    }

    function discarding(id: string) {
      return request(app.getHttpServer() as Server).post(`/${PREFIX}/admin/catalogue/recipes/${id}/picture/candidate/discard`);
    }

    it('is limited to thirty discards an hour, like the retry', () => {
      expect(Reflect.getMetadata(RATE_LIMIT_KEY, AdminCatalogueController.prototype.discardCandidate)).toEqual({ limit: 30, ttlSeconds: 3600 });
    });

    it('is 404 for an ordinary account on both routes, the same as every denial, and neither reads nor deletes', async () => {
      role = 'user';

      const denied = await file(RECIPE).expect(404);
      const other = await get('recipes').expect(404);

      expect(denied.body).toEqual(other.body);
      await file('not-a-uuid').expect(404);
      await discarding(RECIPE).expect(404);
      await discarding('not-a-uuid').expect(404);

      expect(read).not.toHaveBeenCalled();
      expect(discard).not.toHaveBeenCalled();
    });

    it('answers the owner the file itself, byte for byte, as a private JPEG nothing may sniff or store', async () => {
      role = 'admin';
      read.mockResolvedValue(FILE);

      const response = await file(RECIPE).buffer(true).expect(200);

      expect(new Uint8Array(response.body as Buffer)).toEqual(FILE);
      expect(response.headers['content-type']).toBe('image/jpeg');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.headers['content-length']).toBe(String(FILE.length));
      expect(read).toHaveBeenCalledWith(RECIPE);
    });

    it('answers 404 when there is no candidate to look at — none, an expired one, an unknown dish — and never echoes the id', async () => {
      role = 'admin';
      read.mockRejectedValue(new NotFoundError('Picture candidate not found'));

      for (const segment of [RECIPE, 'not-a-uuid-zzq']) {
        const response = await file(segment).expect(404);

        expect(response.headers['content-type']).toMatch(/json/);
        expect(response.body).toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
        expect(JSON.stringify(response.body)).not.toContain(segment);
      }
    });

    it('discards for the owner from the session, and answers that it is gone', async () => {
      role = 'admin';
      discard.mockResolvedValue(undefined);

      const response = await discarding(RECIPE).send({ actorId: 'somebody-else' }).expect(200);

      expect(response.body).toEqual({ status: 'discarded' });
      // Who discarded is the session's user, whatever a body says.
      expect(discard).toHaveBeenCalledWith(RECIPE, 'usr-1');
    });

    it('answers 404 to a discard with no candidate to look at', async () => {
      role = 'admin';
      discard.mockRejectedValue(new NotFoundError('Picture candidate not found'));

      const response = await discarding(RECIPE).expect(404);

      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    });

    it('carries the candidate on a recipe row as flags and an expiry, and no address of its file', async () => {
      role = 'admin';
      jest.spyOn(CoreCatalogue, 'recipes').mockResolvedValue(RECIPES);

      const [row] = ((await get('recipes').expect(200)).body as AdminRecipesView).rows;

      expect(Object.keys(row?.pictureCandidate ?? {}).sort()).toEqual(['allergens', 'expiresAt', 'ingredients']);
      expect(JSON.stringify(row)).not.toMatch(/dish-picture-candidates|https?:|blob/);
    });
  });
});
