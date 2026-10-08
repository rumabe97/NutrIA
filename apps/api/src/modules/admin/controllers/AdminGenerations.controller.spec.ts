import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { AdminLogController } from 'core/controllers/Admin';

import { AdminGenerationsController } from './AdminGenerations.controller.js';
import { AdminGuard } from '../../../shared/guards/index.js';
import { AdminService } from '../services/index.js';
import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { ENV } from '../../../config/index.js';

import type { AdminGenerationStatsView, AdminGenerationView } from 'core/controllers/Admin';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

const PREFIX = 'api/v1';

const GENERATION: AdminGenerationView = {
  id: 'job-1',
  account: { email: 'a@b.invalid', name: 'A' },
  attempts: 1,
  calls: [
    {
      answeredModel: 'muse-spark-1.2-contributor-free',
      cache: 'MISS',
      cachedInputTokens: null,
      comboTrace: 'combo-1',
      correlationId: 'corr-1',
      costUsd: 0,
      dishes: 7,
      error: null,
      gatewayMs: 61_000,
      inputTokens: 13_412,
      kept: 5,
      model: 'NutrIA-Fallback',
      ms: 61_600,
      outputTokens: 15_695,
      provider: 'opencode-zen',
      reasoningTokens: 11_889,
      rejected: { over_time: 2 },
      requestId: 'req-1',
      round: 1,
      session: 'ext:job-1',
      slot: 'lunch',
      strategy: 'priority'
    }
  ],
  code: null,
  detail: null,
  finishedAt: '2026-09-12T04:21:11.000Z',
  plan: { backfilled: 1, fallback: 'wider_rotation', model: 'NutrIA-Fallback', promptVersion: '3.2.1', rejected: 2, reused: 29, version: 2 },
  seconds: 99,
  startedAt: '2026-09-12T04:19:32.000Z',
  status: 'succeeded',
  step: 'done'
};

/**
 * The generation log names who asked for each plan, so its guard is the whole
 * point: anyone but the owner gets the same 404 as every other denial.
 */
describe('AdminGenerationsController', () => {
  let app: INestApplication;
  let role = 'user';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminGenerationsController],
      providers: [
        AdminService,
        { provide: ENV, useValue: { APP_URL: 'https://nutria.example', BETTER_AUTH_SECRET: 'a'.repeat(48) } },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
              context.switchToHttp().getRequest().user = {
                id: 'usr-1',
                activated: true,
                email: 'a@b.invalid',
                emailVerified: true,
                name: 'A',
                role,
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
    jest.restoreAllMocks();
  });

  function get(path: string) {
    return request(app.getHttpServer() as Server).get(`/${PREFIX}/admin/${path}`);
  }

  it('is 404 for an ordinary account on the log, its pages and its charts, and reads nothing', async () => {
    role = 'user';
    const page = jest.spyOn(AdminLogController, 'page');
    const stats = jest.spyOn(AdminLogController, 'stats');

    for (const path of ['generations', 'generations?q=ana&status=failed', 'generations?size=0', 'generations/stats', 'generations/stats?period=7']) {
      await get(path).expect(404);
    }

    expect(page).not.toHaveBeenCalled();
    expect(stats).not.toHaveBeenCalled();
  });

  it('answers the owner one page, every row as the log always showed it, with the total', async () => {
    role = 'admin';
    const page = jest.spyOn(AdminLogController, 'page').mockResolvedValue({ offset: 0, rows: [GENERATION], size: 25, total: 41 });

    const response = await get('generations?status=failed&code=GENERATION_AI_UNAVAILABLE&q=%20a%40b&since=24h&from=2026-09-01&to=2026-09-28').expect(
      200
    );
    const body = response.body as { rows: AdminGenerationView[]; total: number };

    expect(body.total).toBe(41);
    expect(body.rows[0]?.account.email).toBe('a@b.invalid');
    expect(body.rows[0]?.calls[0]).toMatchObject({
      answeredModel: 'muse-spark-1.2-contributor-free',
      provider: 'opencode-zen',
      session: 'ext:job-1'
    });
    expect(page).toHaveBeenCalledWith({
      code: 'GENERATION_AI_UNAVAILABLE',
      from: '2026-09-01',
      offset: 0,
      q: 'a@b',
      since: '24h',
      size: 25,
      status: 'failed',
      to: '2026-09-28'
    });
  });

  it('refuses a filter outside its grammar with INVALID_INPUT, and reads nothing', async () => {
    role = 'admin';
    const page = jest.spyOn(AdminLogController, 'page');

    page.mockClear();

    for (const path of [
      'generations?status=done',
      'generations?code=lower_case',
      'generations?since=1h',
      'generations?from=2026-09-28&to=2026-09-01',
      'generations?from=yesterday',
      'generations?size=101',
      'generations?offset=-1',
      'generations?q=a%00b',
      'generations?status=failed&status=succeeded',
      'generations/stats?period=14'
    ]) {
      const response = await get(path).expect(422);

      expect((response.body as { code: string }).code).toBe('INVALID_INPUT');
    }

    expect(page).not.toHaveBeenCalled();
  });

  it('reads the charts over 30 days unless asked, and the period as a number', async () => {
    role = 'admin';
    const stats = jest.spyOn(AdminLogController, 'stats').mockResolvedValue({ period: 30 } as AdminGenerationStatsView);

    await get('generations/stats').expect(200);
    expect(stats).toHaveBeenLastCalledWith(30);
    await get('generations/stats?period=90').expect(200);
    expect(stats).toHaveBeenLastCalledWith(90);
  });
});
