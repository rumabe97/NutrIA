import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { AdminSeriesController, AdminUsageController } from 'core/controllers/Admin';

import { AdminController } from './Admin.controller.js';
import { AdminGuard } from '../../../shared/guards/index.js';
import { AdminService } from '../services/index.js';
import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { ENV } from '../../../config/index.js';

import type { AdminAiView, AdminPicturesPeriodView, AdminPlansView, AdminProductView, AdminSummaryView } from 'core/controllers/Admin';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

const PREFIX = 'api/v1';

/**
 * The guard is the feature: an admin route reachable by a signed-in user is a
 * way to read the whole service, and the answer to anyone else must be the
 * same 404 every other denial gives — never a 403, which confirms the route.
 */
describe('AdminController', () => {
  let app: INestApplication;
  let role = 'user';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        AdminService,
        { provide: ENV, useValue: { AI_IMAGE_MONTHLY_CAP_USD: 10, APP_URL: 'https://nutria.example', BETTER_AUTH_SECRET: 'a'.repeat(48) } },
        // Registration order is execution order: the session stand-in has to put
        // the user on the request before the role is checked, exactly as
        // `SessionGuard` runs before `AdminGuard` in the real application.
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
    jest.restoreAllMocks();
  });

  it('is 404 for an ordinary account, whatever it asks for', async () => {
    role = 'user';
    const pictures = jest.spyOn(AdminUsageController, 'pictures');

    await request(app.getHttpServer() as Server)
      .get(`/${PREFIX}/admin/pictures`)
      .expect(404);
    expect(pictures).not.toHaveBeenCalled();
  });

  /* 0068: the console's period reads are the owner's like every other admin route. */
  it('is 404 for an ordinary account on the period reads, before the period is even read', async () => {
    role = 'user';
    const summary = jest.spyOn(AdminSeriesController, 'summary');
    const product = jest.spyOn(AdminSeriesController, 'product');
    const plans = jest.spyOn(AdminSeriesController, 'plans');

    for (const path of ['summary', 'product', 'plans', 'summary?period=7', 'plans?period=14']) {
      await request(app.getHttpServer() as Server)
        .get(`/${PREFIX}/admin/${path}`)
        .expect(404);
    }

    expect(summary).not.toHaveBeenCalled();
    expect(product).not.toHaveBeenCalled();
    expect(plans).not.toHaveBeenCalled();
  });

  it('reads the summary over 30 days when no period is asked for, against the configured picture cap', async () => {
    role = 'admin';
    const summary = jest.spyOn(AdminSeriesController, 'summary').mockResolvedValue({ period: 30 } as AdminSummaryView);

    const response = await request(app.getHttpServer() as Server)
      .get(`/${PREFIX}/admin/summary`)
      .expect(200);

    expect(response.body).toEqual({ period: 30 });
    expect(summary).toHaveBeenCalledWith(30, 10, expect.any(Date), undefined);
  });

  it('passes 7, 30 and 90 through as numbers to each period read', async () => {
    role = 'admin';
    const summary = jest.spyOn(AdminSeriesController, 'summary').mockResolvedValue({ period: 7 } as AdminSummaryView);
    const product = jest.spyOn(AdminSeriesController, 'product').mockResolvedValue({ period: 90 } as AdminProductView);
    const plans = jest.spyOn(AdminSeriesController, 'plans').mockResolvedValue({ period: 30 } as AdminPlansView);

    await request(app.getHttpServer() as Server)
      .get(`/${PREFIX}/admin/summary?period=7`)
      .expect(200);
    await request(app.getHttpServer() as Server)
      .get(`/${PREFIX}/admin/product?period=90`)
      .expect(200);
    await request(app.getHttpServer() as Server)
      .get(`/${PREFIX}/admin/plans?period=30`)
      .expect(200);

    expect(summary).toHaveBeenCalledWith(7, 10, expect.any(Date), undefined);
    expect(product).toHaveBeenCalledWith(90);
    expect(plans).toHaveBeenCalledWith(30);
  });

  it('refuses any other period with INVALID_INPUT, and reads nothing', async () => {
    role = 'admin';
    const summary = jest.spyOn(AdminSeriesController, 'summary');
    const product = jest.spyOn(AdminSeriesController, 'product');
    const plans = jest.spyOn(AdminSeriesController, 'plans');
    summary.mockClear();
    product.mockClear();
    plans.mockClear();

    for (const path of ['summary?period=14', 'summary?period=', 'product?period=seven', 'plans?period=7&period=30', 'plans?period=-30']) {
      const response = await request(app.getHttpServer() as Server)
        .get(`/${PREFIX}/admin/${path}`)
        .expect(422);

      expect((response.body as { code: string }).code).toBe('INVALID_INPUT');
    }

    expect(summary).not.toHaveBeenCalled();
    expect(product).not.toHaveBeenCalled();
    expect(plans).not.toHaveBeenCalled();
  });

  /* 0066: this month's picture spend, read against the cap drawing stops at — and, since 0068, its days. */
  it('gives the owner the month’s picture spend against the configured cap, over 30 days unless asked', async () => {
    role = 'admin';
    const month = { capUsd: 10, drawing: 1, enabled: true, failed: 2, ready: 30, released: 0, since: '2026-09-01T00:00:00.000Z', spentUsd: 1.25 };
    const pictures = jest
      .spyOn(AdminUsageController, 'pictures')
      .mockResolvedValue({ ...month, period: 30, spendPerDay: { days: [], values: [] } } as unknown as AdminPicturesPeriodView);

    const response = await request(app.getHttpServer() as Server)
      .get(`/${PREFIX}/admin/pictures`)
      .expect(200);

    expect(response.body).toMatchObject({ capUsd: 10, ready: 30, spendPerDay: { days: [], values: [] }, spentUsd: 1.25 });
    expect(pictures).toHaveBeenCalledWith(30, 10);

    await request(app.getHttpServer() as Server)
      .get(`/${PREFIX}/admin/pictures?period=90`)
      .expect(200);
    expect(pictures).toHaveBeenLastCalledWith(90, 10);
  });

  it('reads the AI usage over a period, and refuses any other period', async () => {
    role = 'admin';
    const ai = jest.spyOn(AdminUsageController, 'ai').mockResolvedValue({ period: 7 } as unknown as AdminAiView);

    const response = await request(app.getHttpServer() as Server)
      .get(`/${PREFIX}/admin/ai?period=7`)
      .expect(200);

    expect(response.body).toEqual({ period: 7 });
    expect(ai).toHaveBeenCalledWith(7, expect.any(Date), undefined);

    ai.mockClear();

    for (const path of ['ai?period=14', 'pictures?period=1']) {
      const refused = await request(app.getHttpServer() as Server)
        .get(`/${PREFIX}/admin/${path}`)
        .expect(422);

      expect((refused.body as { code: string }).code).toBe('INVALID_INPUT');
    }

    expect(ai).not.toHaveBeenCalled();
  });

  it('is 404 for an ordinary account on the AI and picture periods, and reads nothing', async () => {
    role = 'user';
    const ai = jest.spyOn(AdminUsageController, 'ai');
    const pictures = jest.spyOn(AdminUsageController, 'pictures');

    ai.mockClear();
    pictures.mockClear();

    for (const path of ['ai', 'ai?period=7', 'pictures?period=90', 'ai?period=bad']) {
      await request(app.getHttpServer() as Server)
        .get(`/${PREFIX}/admin/${path}`)
        .expect(404);
    }

    expect(ai).not.toHaveBeenCalled();
    expect(pictures).not.toHaveBeenCalled();
  });
});
