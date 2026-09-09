import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { AdminController } from 'core/controllers/Admin';

import { AdminGuard } from '../../shared/guards/index.js';
import { AdminRestController } from './admin.controller.js';
import { AllExceptionsFilter } from '../../shared/filters/index.js';

import type { AdminOverviewView } from 'core/controllers/Admin';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

const PREFIX = 'api/v1';

const OVERVIEW: AdminOverviewView = {
  counts: {
    accounts: { total: 6, waiting: 0 },
    catalogue: { ingredients: 930, recipes: 160, withoutImage: 160 },
    jobs: [{ n: 3, status: 'succeeded' }],
    plans: [{ n: 1, status: 'active' }]
  },
  jobs: [],
  windowDays: 7
};

/**
 * The guard is the feature: an admin route reachable by a signed-in user is a
 * way to read the whole service, and the answer to anyone else must be the
 * same 404 every other denial gives — never a 403, which confirms the route.
 */
describe('AdminRestController', () => {
  let app: INestApplication;
  let role = 'user';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminRestController],
      providers: [
        // Registration order is execution order: the session stand-in has to put
        // the user on the request before the role is checked, exactly as
        // `SessionGuard` runs before `AdminGuard` in the real application.
        { provide: APP_GUARD, useValue: { canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
          context.switchToHttp().getRequest().user = { id: 'usr-1', email: 'a@b.invalid', emailVerified: true, name: 'A', role };

          return true;
        } } },
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

  it('is 404 for an ordinary account, whatever it asks for', async () => {
    role = 'user';
    const overview = jest.spyOn(AdminController, 'overview');

    await request(app.getHttpServer() as Server).get(`/${PREFIX}/admin/overview`).expect(404);
    await request(app.getHttpServer() as Server).get(`/${PREFIX}/admin/failures`).expect(404);
    expect(overview).not.toHaveBeenCalled();
  });

  it('answers the owner', async () => {
    role = 'admin';
    jest.spyOn(AdminController, 'overview').mockResolvedValue(OVERVIEW);

    const response = await request(app.getHttpServer() as Server).get(`/${PREFIX}/admin/overview`).expect(200);

    expect((response.body as AdminOverviewView).counts.accounts.total).toBe(6);
  });
});
