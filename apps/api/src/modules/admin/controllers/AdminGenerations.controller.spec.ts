import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { AdminController as CoreAdmin } from 'core/controllers/Admin';

import { AdminGenerationsController } from './AdminGenerations.controller.js';
import { AdminGuard } from '../../../shared/guards/index.js';
import { AdminService } from '../services/index.js';
import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { ENV } from '../../../config/index.js';

import type { AdminGenerationView } from 'core/controllers/Admin';
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

  it('is 404 for an ordinary account, and reads nothing', async () => {
    role = 'user';
    const generations = jest.spyOn(CoreAdmin, 'generations');

    await request(app.getHttpServer() as Server)
      .get(`/${PREFIX}/admin/generations`)
      .expect(404);
    expect(generations).not.toHaveBeenCalled();
  });

  it('answers the owner with each generation, its account and its calls', async () => {
    role = 'admin';
    jest.spyOn(CoreAdmin, 'generations').mockResolvedValue([GENERATION]);

    const response = await request(app.getHttpServer() as Server)
      .get(`/${PREFIX}/admin/generations`)
      .expect(200);
    const [first] = response.body as AdminGenerationView[];

    expect(first?.account.email).toBe('a@b.invalid');
    expect(first?.calls[0]).toMatchObject({ answeredModel: 'muse-spark-1.2-contributor-free', provider: 'opencode-zen', session: 'ext:job-1' });
  });
});
