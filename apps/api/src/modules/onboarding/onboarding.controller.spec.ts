import { afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { OnboardingController as OnboardingService } from 'core/controllers/Onboarding';

import { AllExceptionsFilter } from '../../shared/filters/index.js';
import { OnboardingRestController } from './onboarding.controller.js';

import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';
import type { Server } from 'node:http';

const STATE = { completedAt: null, completedSteps: [], currentStep: 2, isComplete: false, missingSteps: [], resumeStep: 2, totalSteps: 10 };

/**
 * Guards against a class of bug that unit-testing the controller method directly
 * cannot see: a **handler-level** `@UsePipes` runs the pipe over *every* route
 * parameter, `@CurrentUser()` included — so a body schema ends up validating the
 * session user, and a perfectly valid request is rejected.
 *
 * That shipped, and the first onboarding step failed with "Invalid discriminator
 * value" because the pipe was handed a `SessionUser` with no `step` field. Going
 * through the real HTTP pipeline is the only way to catch it.
 */
describe('POST /onboarding (through the real pipeline)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [OnboardingRestController] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    // Stands in for SessionGuard, which is global in AppModule.
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

  it('accepts a valid first step instead of validating the session user against the body schema', async () => {
    const saveStep = jest.spyOn(OnboardingService, 'saveStep').mockResolvedValue(STATE as never);

    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/onboarding')
      .send({ data: { birthDate: '1994-03-11', country: 'ES', displayName: 'Ada', sex: 'female' }, step: 'about-you' });

    expect(response.status).toBe(200);
    expect(saveStep).toHaveBeenCalledWith('usr-1', expect.objectContaining({ step: 'about-you' }));
  });

  it('still rejects a body whose step is not a known one', async () => {
    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/onboarding')
      .send({ data: {}, step: 'not-a-step' });

    expect(response.status).toBe(422);
    expect((response.body as { code: string }).code).toBe('INVALID_INPUT');
  });

  it('still strips unknown keys from the body', async () => {
    const saveStep = jest.spyOn(OnboardingService, 'saveStep').mockResolvedValue(STATE as never);

    await request(app.getHttpServer() as Server)
      .patch('/onboarding')
      .send({ data: { displayName: 'Ada', userId: 'usr-somebody-else' }, step: 'about-you' });

    expect(saveStep.mock.calls[0]?.[1]).toEqual({ data: { displayName: 'Ada' }, step: 'about-you' });
  });
});
