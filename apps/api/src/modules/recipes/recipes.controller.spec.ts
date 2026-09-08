import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { RecipeController } from 'core/controllers/Recipe';

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
