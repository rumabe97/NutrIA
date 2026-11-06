import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { UserController } from 'core/controllers/User';

import { AdminAccountsController } from './AdminAccounts.controller.js';
import { AdminAccountsService } from '../services/index.js';
import { AdminGuard } from '../../../shared/guards/index.js';
import { AllExceptionsFilter } from '../../../shared/filters/index.js';

import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

const PREFIX = 'api/v1';

/**
 * Who the trail names as the actor of an opening and of a tier move (`0071`).
 *
 * This spec was written for the one-click link out of the owner's mail — a
 * `@Public()` route on a `@Roles('admin')` controller, a combination that used to
 * 404 for everybody. That route was removed on 2026-11-06, every token it could
 * honour having expired, and what is left is the console's own two routes, which
 * always have a session: the point of the remaining cases is that the session is
 * what the trail records.
 */
describe('AdminAccountsController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminAccountsController],
      providers: [
        AdminAccountsService,
        // The session that stands in for the owner on both routes.
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
              context.switchToHttp().getRequest().user = {
                id: 'usr-owner',
                activated: true,
                email: 'owner@example.invalid',
                emailVerified: true,
                name: 'Owner',
                role: 'admin',
                twoFactorEnabled: true
              };

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

  /* `0071`: the console always has a session, so the trail always names it. */
  it('records the session as the actor when the console opens an account', async () => {
    const activate = jest.spyOn(UserController, 'activate').mockResolvedValue({ email: 'ana@example.invalid' });

    await request(app.getHttpServer() as Server)
      .post(`/${PREFIX}/admin/accounts/usr-9/activate`)
      .expect(201);

    expect(activate).toHaveBeenCalledWith({ id: 'usr-9' }, { actorId: 'usr-owner', via: 'console' });
  });

  /* `0071`: the console is the only route that moves a tier, and its session is always the actor. */
  it('records the session as the actor when the console moves a tier', async () => {
    const setTier = jest.spyOn(UserController, 'setTier').mockResolvedValue({ email: 'ana@example.invalid' });

    await request(app.getHttpServer() as Server)
      .patch(`/${PREFIX}/admin/accounts/usr-9/tier`)
      .send({ tier: 'premium' })
      .expect(200);

    expect(setTier).toHaveBeenCalledWith('usr-9', 'premium', 'usr-owner');
  });
});
