import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { UserController } from 'core/controllers/User';

import { activationToken } from '../../auth/services/ActivationLink.js';
import { AdminAccountsController } from './AdminAccounts.controller.js';
import { AdminAccountsService } from '../services/index.js';
import { AdminGuard } from '../../../shared/guards/index.js';
import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { ENV } from '../../../config/index.js';

import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

const PREFIX = 'api/v1';
const SECRET = 'a'.repeat(48);

/**
 * The one-click link out of the owner's mail. It is `@Public()` on a controller
 * that is `@Roles('admin')`, which is the whole reason this spec exists: the
 * combination used to 404 for everybody, and a stale token 404s too, so the
 * button looked broken rather than guarded.
 */
describe('AdminAccountsController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminAccountsController],
      providers: [
        AdminAccountsService,
        { provide: ENV, useValue: { APP_URL: 'https://nutria.example', BETTER_AUTH_SECRET: SECRET } },
        // No session guard stands in here on purpose: an inbox has no session,
        // and that is exactly the request this route has to survive.
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
    jest.restoreAllMocks();
  });

  /**
   * The owner clicked a button in their own mail, which is Spanish, so the
   * queue they land on is the Spanish one — the account they just opened may
   * read the product in anything.
   */
  it("sends the one-click link back to the queue, in the owner's language", async () => {
    jest.spyOn(UserController, 'activate').mockResolvedValue({ email: 'ana@example.invalid' });

    const response = await request(app.getHttpServer() as Server)
      .get(`/${PREFIX}/admin/activate`)
      .query({ token: activationToken('usr-9', SECRET) })
      .expect(302);

    expect(response.headers.location).toBe('https://nutria.example/admin?abierta=ana%40example.invalid');
  });

  it('answers 404 to a forged token, like every other denial', async () => {
    await request(app.getHttpServer() as Server)
      .get(`/${PREFIX}/admin/activate`)
      .query({ token: 'not-a-token' })
      .expect(404);
  });
});
