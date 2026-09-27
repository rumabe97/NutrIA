import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import express from 'express';

import { NotFoundError } from 'core/entities/Error';
import { RecipeController } from 'core/controllers/Recipe';

import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { RecipesController } from './Recipes.controller.js';
import { RecipesService } from '../services/index.js';

import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

const ID = '11111111-1111-4111-8111-111111111111';

const ALICE = { id: 'alice', activated: true, email: 'alice@example.com', emailVerified: true, name: 'Alice', role: 'user' as const };

/**
 * What the meal page polls while its dish is being drawn (`0066`). What
 * matters: the user comes from the session, a dish they were never served is a
 * 404 like every denial, a bad id never reaches the database — and the old
 * public image route is gone.
 */
describe('GET /recipes/:id/picture-status', () => {
  let app: INestApplication;

  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  async function boot(): Promise<Server> {
    const moduleRef = await Test.createTestingModule({ controllers: [RecipesController], providers: [RecipesService] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    // Stands in for SessionGuard, which is global in AppModule.
    app.use((req: express.Request & { user?: unknown }, _res: express.Response, next: express.NextFunction) => {
      req.user = ALICE;
      next();
    });
    await app.init();

    return app.getHttpServer() as Server;
  }

  it('answers for the session’s user', async () => {
    const pictureStatus = jest.spyOn(RecipeController, 'pictureStatus').mockResolvedValue({ status: 'ready', url: 'https://blob.example/x.jpg' });
    const server = await boot();

    const response = await request(server).get(`/recipes/${ID}/picture-status`).expect(200);

    expect(response.body).toEqual({ status: 'ready', url: 'https://blob.example/x.jpg' });
    expect(pictureStatus).toHaveBeenCalledWith('alice', ID);
  });

  it('is 404 for a dish the caller was never served', async () => {
    jest.spyOn(RecipeController, 'pictureStatus').mockRejectedValue(new NotFoundError('Recipe not found'));
    const server = await boot();

    await request(server).get(`/recipes/${ID}/picture-status`).expect(404);
  });

  it('refuses a non-UUID id before touching the database', async () => {
    const pictureStatus = jest.spyOn(RecipeController, 'pictureStatus');
    const server = await boot();

    await request(server).get('/recipes/not-a-uuid/picture-status').expect(400);
    expect(pictureStatus).not.toHaveBeenCalled();
  });

  /* 0066: pictures live in Blob; Postgres serves no bytes. */
  it('no longer serves an image', async () => {
    const server = await boot();

    await request(server).get(`/recipes/${ID}/image`).expect(404);
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

  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  async function boot(): Promise<Server> {
    const moduleRef = await Test.createTestingModule({ controllers: [RecipesController], providers: [RecipesService] }).compile();

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
