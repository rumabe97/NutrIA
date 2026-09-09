import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import express from 'express';

import { NotFoundError } from 'core/entities/Error';
import { RecipeController } from 'core/controllers/Recipe';

import { AllExceptionsFilter } from '../../shared/filters/index.js';
import { RecipesController } from './recipes.controller.js';

import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

const ID = '11111111-1111-4111-8111-111111111111';

/**
 * The one route that serves stored bytes, and the only public one that does.
 * What matters: nothing but the bytes leaves, a missing image is a 404 in the
 * envelope's absence (Nest's default here, since the global filter is not
 * mounted in this harness), and the caching is explicit and immutable.
 */
describe('GET /recipes/:id/image', () => {
  let app: INestApplication;

  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  async function boot(): Promise<Server> {
    const moduleRef = await Test.createTestingModule({ controllers: [RecipesController] }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    return app.getHttpServer() as Server;
  }

  it('serves the stored bytes with an immutable, public cache header', async () => {
    jest.spyOn(RecipeController, 'illustration').mockResolvedValue({ bytes: Buffer.from('RIFFxxxxWEBP'), contentType: 'image/webp' });
    const server = await boot();

    const response = await request(server).get(`/recipes/${ID}/image`).expect(200);

    expect(response.headers['content-type']).toBe('image/webp');
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, s-maxage=31536000, immutable');
    expect((response.body as Buffer).toString()).toBe('RIFFxxxxWEBP');
  });

  it('is 404 when nothing has been drawn', async () => {
    jest.spyOn(RecipeController, 'illustration').mockResolvedValue(undefined);
    const server = await boot();

    await request(server).get(`/recipes/${ID}/image`).expect(404);
  });

  it('refuses a non-UUID id before touching the database', async () => {
    const lookup = jest.spyOn(RecipeController, 'illustration');
    const server = await boot();

    await request(server).get('/recipes/not-a-uuid/image').expect(400);
    expect(lookup).not.toHaveBeenCalled();
  });
});

/**
 * The verdict is the one thing a person writes about a dish, and the one route
 * where the client names a recipe rather than a meal. What matters: the user
 * comes from the session and never from the body, the body is held to the
 * three verdicts the schema allows, and a recipe that does not exist is a 404
 * like every other denial.
 */
describe('PUT /recipes/:id/verdict', () => {
  let app: INestApplication;
  const ALICE = { id: 'alice', email: 'alice@example.com', emailVerified: true, name: 'Alice', role: 'user' as const };

  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  async function boot(): Promise<Server> {
    const moduleRef = await Test.createTestingModule({ controllers: [RecipesController] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    // Stands in for SessionGuard, which is global in AppModule.
    app.use((req: express.Request & { user?: unknown }, _res: express.Response, next: express.NextFunction) => {
      req.user = ALICE;
      next();
    });
    app.use(express.json());
    await app.init();

    return app.getHttpServer() as Server;
  }

  it('records the verdict for the session user, whatever the body says about users', async () => {
    const setVerdict = jest.spyOn(RecipeController, 'setVerdict').mockResolvedValue(undefined);
    const server = await boot();

    const response = await request(server).put(`/recipes/${ID}/verdict`).send({ userId: 'mallory', verdict: 'liked' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ verdict: 'liked' });
    expect(setVerdict).toHaveBeenCalledWith('alice', ID, 'liked');
  });

  it('refuses a verdict the schema does not know', async () => {
    const setVerdict = jest.spyOn(RecipeController, 'setVerdict').mockResolvedValue(undefined);
    const server = await boot();

    const response = await request(server).put(`/recipes/${ID}/verdict`).send({ verdict: 'meh' });

    expect(response.status).toBe(422);
    expect((response.body as { code: string }).code).toBe('INVALID_INPUT');
    expect(setVerdict).not.toHaveBeenCalled();
  });

  it('answers 404 for a recipe that does not exist', async () => {
    jest.spyOn(RecipeController, 'setVerdict').mockRejectedValue(new NotFoundError('Recipe not found'));
    const server = await boot();

    const response = await request(server).put(`/recipes/${ID}/verdict`).send({ verdict: 'disliked' });

    expect(response.status).toBe(404);
  });
});
