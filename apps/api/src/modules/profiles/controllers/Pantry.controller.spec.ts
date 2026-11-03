import { afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { InputParseError, NotFoundError } from 'core/entities/Error';
import { MAX_PANTRY_ITEMS } from 'core/entities/Pantry';
import { PantryController as Pantry } from 'core/controllers/Pantry';

import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { PantryController } from './Pantry.controller.js';
import { PantryService } from '../services/index.js';

import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';
import type { Server } from 'node:http';

const EMPTY = { items: [], maxItems: MAX_PANTRY_ITEMS };
const ID = 'b1c2d3e4-f506-4a7b-8c9d-0e1f2a3b4c5d';

/**
 * The cupboard's routes through the real pipeline.
 *
 * The same pipeline-level cover as the profile and onboarding controllers, for
 * the reason written there: a handler-level `@UsePipes` applies the body schema
 * to `@CurrentUser()` too and rejects every valid request, and only a request
 * through the real pipeline sees it.
 */
describe('the cupboard’s routes', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [PantryController], providers: [PantryService] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.use((req: express.Request & { user?: unknown }, _res: express.Response, next: express.NextFunction) => {
      req.user = { id: 'usr-1', activated: true, email: 'a@b.co', emailVerified: true, name: 'A', role: 'user' };
      next();
    });
    app.use(express.json());
    await app.init();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads the cupboard of the session’s account', async () => {
    const read = jest.spyOn(Pantry, 'read').mockResolvedValue(EMPTY);

    const response: Response = await request(app.getHttpServer() as Server).get('/pantry');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(EMPTY);
    expect(read).toHaveBeenCalledWith('usr-1');
  });

  it('takes the account from the session and never from the body', async () => {
    const add = jest.spyOn(Pantry, 'add').mockResolvedValue(EMPTY);

    const response: Response = await request(app.getHttpServer() as Server)
      .post('/pantry')
      .send({ label: 'arroz', userId: 'usr-2' });

    expect(response.status).toBe(201);
    // `userId` is stripped by the schema, and the id passed on is
    // `@CurrentUser()`'s. An id from a body is an id the caller chose.
    expect(add).toHaveBeenCalledWith('usr-1', { grams: null, label: 'arroz', unit: null });
  });

  it('trims the word and defaults the amount to "I have some"', async () => {
    const add = jest.spyOn(Pantry, 'add').mockResolvedValue(EMPTY);

    await request(app.getHttpServer() as Server)
      .post('/pantry')
      .send({ label: '  Arroz largo  ' });

    expect(add).toHaveBeenCalledWith('usr-1', { grams: null, label: 'Arroz largo', unit: null });
  });

  it('refuses an empty word, a word past the cap and a unit it does not ship', async () => {
    const add = jest.spyOn(Pantry, 'add');

    for (const body of [{ label: '' }, { label: 'x'.repeat(81) }, { label: 'arroz', unit: 'barrels' }, { grams: -1, label: 'arroz' }]) {
      const response: Response = await request(app.getHttpServer() as Server)
        .post('/pantry')
        .send(body);

      expect(response.status).toBe(422);
    }

    expect(add).not.toHaveBeenCalled();
  });

  it('answers a full cupboard with 422 naming the field, and the message carries no word of the cupboard', async () => {
    const message = `At most ${MAX_PANTRY_ITEMS} things may be in the cupboard`;

    jest.spyOn(Pantry, 'add').mockRejectedValue(new InputParseError(message, { label: [message] }));

    const response: Response = await request(app.getHttpServer() as Server)
      .post('/pantry')
      .send({ label: 'una cosa secreta' });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ fieldErrors: { label: [message] } });
    expect(JSON.stringify(response.body)).not.toContain('una cosa secreta');
  });

  it('offers the picker what the resolver answers, for the word and the language of the request', async () => {
    const catalogue = jest.spyOn(Pantry, 'catalogue').mockResolvedValue([{ cookedWith: true, name: 'Arroz largo', slug: 'arroz-largo-crudo' }]);

    const response: Response = await request(app.getHttpServer() as Server)
      .post('/pantry/catalogue')
      .set('accept-language', 'en-GB')
      .send({ q: 'arro' });

    // 200 and not 201: a read that is a POST so the typed word stays out of the
    // platform's request log (`0100`, and `/privacidad` on what logs keep).
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ cookedWith: true, name: 'Arroz largo', slug: 'arroz-largo-crudo' }]);
    expect(catalogue).toHaveBeenCalledWith('usr-1', 'arro', 'en-GB');
  });

  it('asks for the top of the catalogue when nobody has typed anything yet', async () => {
    const catalogue = jest.spyOn(Pantry, 'catalogue').mockResolvedValue([]);

    for (const body of [{}, { q: '' }, { q: '   ' }]) {
      const response: Response = await request(app.getHttpServer() as Server)
        .post('/pantry/catalogue')
        .send(body);

      expect(response.status).toBe(200);
    }

    // Absent, empty and blank are one ask, because that is what a picker sends
    // before anybody has typed — not three different errors.
    expect(catalogue.mock.calls.map(call => call[1])).toEqual(['', '', '']);
  });

  it('takes no word in the URL, so there is nothing for a request log to keep', async () => {
    const catalogue = jest.spyOn(Pantry, 'catalogue').mockResolvedValue([]);

    // The GET the route deliberately is not. If this ever answers 200, the
    // privacy decision has been undone.
    const asGet: Response = await request(app.getHttpServer() as Server).get('/pantry/catalogue?q=leche%20sin%20lactosa');

    expect(asGet.status).toBe(404);
    expect(catalogue).not.toHaveBeenCalled();
  });

  it('refuses a word past the cupboard’s own cap, and never quotes it back', async () => {
    const catalogue = jest.spyOn(Pantry, 'catalogue');
    const word = 'x'.repeat(81);

    const response: Response = await request(app.getHttpServer() as Server)
      .post('/pantry/catalogue')
      .send({ q: word });

    expect(response.status).toBe(422);
    expect(JSON.stringify(response.body)).not.toContain(word);
    expect(catalogue).not.toHaveBeenCalled();
  });

  it('is a route of its own and not a cupboard entry called "catalogue"', async () => {
    const catalogue = jest.spyOn(Pantry, 'catalogue').mockResolvedValue([]);
    const add = jest.spyOn(Pantry, 'add');

    await request(app.getHttpServer() as Server)
      .post('/pantry/catalogue')
      .send({ q: 'arroz' });

    expect(catalogue).toHaveBeenCalled();
    // Declared before `@Post()`'s own path would not help — these are different
    // paths — but an entry is never added by asking the picker a question.
    expect(add).not.toHaveBeenCalled();
  });

  it('answers an id that is not this account’s with a 404', async () => {
    jest.spyOn(Pantry, 'remove').mockRejectedValue(new NotFoundError('Pantry item not found'));

    const response: Response = await request(app.getHttpServer() as Server).delete(`/pantry/${ID}`);

    expect(response.status).toBe(404);
  });

  it('refuses an id that is not a uuid before it reaches the account’s rows', async () => {
    const remove = jest.spyOn(Pantry, 'remove');

    const response: Response = await request(app.getHttpServer() as Server).delete('/pantry/not-an-id');

    expect(response.status).toBe(400);
    expect(remove).not.toHaveBeenCalled();
  });

  it('empties the cupboard of the session’s account', async () => {
    const clear = jest.spyOn(Pantry, 'clear').mockResolvedValue(EMPTY);

    const response: Response = await request(app.getHttpServer() as Server).delete('/pantry');

    expect(response.status).toBe(200);
    expect(clear).toHaveBeenCalledWith('usr-1');
  });
});
