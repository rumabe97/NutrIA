import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { AdminCatalogueController as CoreCatalogue } from 'core/controllers/Admin';

import { AdminCatalogueController } from './AdminCatalogue.controller.js';
import { AdminCatalogueService } from '../services/index.js';
import { AdminGuard } from '../../../shared/guards/index.js';
import { AllExceptionsFilter } from '../../../shared/filters/index.js';

import type { AdminIngredientsView, AdminRecipesView } from 'core/controllers/Admin';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

const PREFIX = 'api/v1';

const RECIPES: AdminRecipesView = {
  counts: { bySlot: [], bySource: [], total: 1, withoutImage: 1 },
  offset: 0,
  rows: [
    {
      allergens: ['gluten'],
      carbsG: 60.8,
      fatG: 23.4,
      kcal: 541.2,
      locale: 'es-ES',
      mayContain: [],
      mealSlots: ['lunch'],
      name: 'Bocadillo',
      picture: 'none',
      proteinG: 25.8,
      slug: 'bocadillo',
      source: 'seed'
    }
  ],
  size: 25,
  total: 1
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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminCatalogueController],
      providers: [
        AdminCatalogueService,
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
  });

  function get(path: string) {
    return request(app.getHttpServer() as Server).get(`/${PREFIX}/admin/catalogue/${path}`);
  }

  it('is 404 for an ordinary account on both tables, whatever it asks, and reads nothing', async () => {
    role = 'user';
    const recipes = jest.spyOn(CoreCatalogue, 'recipes');
    const ingredients = jest.spyOn(CoreCatalogue, 'ingredients');

    for (const path of ['recipes', 'recipes?sort=kcal', 'recipes?sort=createdAt', 'ingredients', 'ingredients?category=meat']) {
      await get(path).expect(404);
    }

    expect(recipes).not.toHaveBeenCalled();
    expect(ingredients).not.toHaveBeenCalled();
  });

  it('answers the owner one page of recipes, the query validated and typed', async () => {
    role = 'admin';
    const recipes = jest.spyOn(CoreCatalogue, 'recipes').mockResolvedValue(RECIPES);

    const response = await get(
      'recipes?q=%20pan%20&slot=lunch&allergen=gluten&picture=none&source=seed&locale=es-ES&sort=protein&dir=desc&offset=25&size=50'
    ).expect(200);

    expect(response.body).toEqual(RECIPES);
    expect(recipes).toHaveBeenCalledWith({
      allergen: 'gluten',
      dir: 'desc',
      locale: 'es-ES',
      offset: 25,
      picture: 'none',
      q: 'pan',
      size: 50,
      slot: 'lunch',
      sort: 'protein',
      source: 'seed'
    });
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

    for (const path of [
      'recipes?sort=createdAt',
      'recipes?slot=brunch',
      'recipes?picture=released',
      'recipes?source=import',
      'recipes?allergen=GLUTEN',
      'recipes?locale=spanish',
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
  });
});
