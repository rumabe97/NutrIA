import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { AdminSeriesController } from 'core/controllers/Admin';
import { FeedbackController } from 'core/controllers/Feedback';
import { UserController } from 'core/controllers/User';

import { AdminAccountsController } from './AdminAccounts.controller.js';
import { AdminAccountsService, AdminFeedbackService, AdminService } from '../services/index.js';
import { AdminController } from './Admin.controller.js';
import { AdminFeedbackController } from './AdminFeedback.controller.js';
import { AdminGuard } from '../../../shared/guards/index.js';
import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { ENV } from '../../../config/index.js';

import type { AdminPeopleView } from 'core/controllers/Admin';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

const PREFIX = 'api/v1';

const EMPTY_PAGE = { offset: 0, rows: [], size: 25, total: 0 };

/**
 * The console's people tables (`0068`): the query string is a DTO bound to one
 * parameter, an allow-list decides every sort and filter value, and anything
 * else is 422 before a query runs. For anyone but the owner, every one of them
 * is the same 404 — before the query is even read.
 */
describe('the people tables', () => {
  let app: INestApplication;
  let role = 'user';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminAccountsController, AdminFeedbackController, AdminController],
      providers: [
        AdminAccountsService,
        AdminFeedbackService,
        AdminService,
        { provide: ENV, useValue: { AI_IMAGE_MONTHLY_CAP_USD: 10, APP_URL: 'https://nutria.example', BETTER_AUTH_SECRET: 'a'.repeat(48) } },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
              context.switchToHttp().getRequest().user = { id: 'usr-1', activated: true, email: 'a@b.invalid', emailVerified: true, name: 'A', role, twoFactorEnabled: true };

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
    return request(app.getHttpServer() as Server).get(`/${PREFIX}/admin/${path}`);
  }

  it('is 404 for an ordinary account on every table, whatever it asks, and reads nothing', async () => {
    role = 'user';
    const accounts = jest.spyOn(UserController, 'accounts');
    const inbox = jest.spyOn(FeedbackController, 'list');
    const people = jest.spyOn(AdminSeriesController, 'people');

    for (const path of ['accounts', 'accounts?sort=nonsense', 'feedback?state=waiting', 'people', 'people?period=14']) {
      await get(path).expect(404);
    }

    expect(accounts).not.toHaveBeenCalled();
    expect(inbox).not.toHaveBeenCalled();
    expect(people).not.toHaveBeenCalled();
  });

  describe('as the owner', () => {
    beforeAll(() => {
      role = 'admin';
    });

    it('reads today’s call — only an offset — as the newest 25 from there', async () => {
      const accounts = jest.spyOn(UserController, 'accounts').mockResolvedValue(EMPTY_PAGE);

      await get('accounts?offset=50').expect(200);

      expect(accounts).toHaveBeenCalledWith({ dir: 'desc', offset: 50, q: undefined, size: 25, sort: 'createdAt' });
    });

    it('passes every filter, the sort and the page through, typed', async () => {
      const accounts = jest.spyOn(UserController, 'accounts').mockResolvedValue(EMPTY_PAGE);

      await get(
        'accounts?q=%20Ana%40&confirmed=yes&activated=no&professional=no&onboarded=yes&tier=premium&role=user&sort=lastActiveAt&dir=asc&offset=0&size=100&unknown=1'
      ).expect(200);

      expect(accounts).toHaveBeenCalledWith({
        activated: 'no',
        confirmed: 'yes',
        dir: 'asc',
        offset: 0,
        onboarded: 'yes',
        professional: 'no',
        q: 'Ana@',
        role: 'user',
        size: 100,
        sort: 'lastActiveAt',
        tier: 'premium'
      });
    });

    it.each([
      'sort=password',
      'sort=createdAt;drop',
      'dir=sideways',
      'confirmed=true',
      'activated=1',
      'tier=gold',
      'role=owner',
      'offset=-1',
      'offset=abc',
      'size=0',
      'size=101',
      'size=2.5',
      'sort=email&sort=plans',
      `q=${'a'.repeat(201)}`
    ])('refuses accounts?%s with INVALID_INPUT and reads nothing', async query => {
      const accounts = jest.spyOn(UserController, 'accounts');

      const response = await get(`accounts?${query}`).expect(422);

      expect((response.body as { code: string }).code).toBe('INVALID_INPUT');
      expect(accounts).not.toHaveBeenCalled();
    });

    it('reads the inbox as every message, newest first, when nothing is asked, and keeps waiting', async () => {
      const inbox = jest.spyOn(FeedbackController, 'list').mockResolvedValue({ ...EMPTY_PAGE, waiting: 4 });

      const response = await get('feedback?offset=25').expect(200);

      expect(inbox).toHaveBeenCalledWith({ dir: 'desc', offset: 25, q: undefined, size: 25, sort: 'createdAt', state: 'all' });
      expect(response.body).toMatchObject({ waiting: 4 });
    });

    it('passes the inbox’s search and state through', async () => {
      const inbox = jest.spyOn(FeedbackController, 'list').mockResolvedValue({ ...EMPTY_PAGE, waiting: 0 });

      await get('feedback?q=plan&state=seen&dir=asc&size=50').expect(200);

      expect(inbox).toHaveBeenCalledWith({ dir: 'asc', offset: 0, q: 'plan', size: 50, sort: 'createdAt', state: 'seen' });
    });

    it.each(['sort=email', 'state=read', 'dir=newest', 'size=500'])('refuses feedback?%s with INVALID_INPUT', async query => {
      const inbox = jest.spyOn(FeedbackController, 'list');

      const response = await get(`feedback?${query}`).expect(422);

      expect((response.body as { code: string }).code).toBe('INVALID_INPUT');
      expect(inbox).not.toHaveBeenCalled();
    });

    it('reads the weekly series over 30 days by default, and 7 or 90 when asked', async () => {
      const people = jest.spyOn(AdminSeriesController, 'people').mockResolvedValue({ period: 30 } as AdminPeopleView);

      await get('people').expect(200);
      await get('people?period=90').expect(200);

      expect(people).toHaveBeenNthCalledWith(1, 30);
      expect(people).toHaveBeenNthCalledWith(2, 90);
      await get('people?period=14').expect(422);
    });
  });
});
