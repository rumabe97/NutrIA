import { afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { ProfileController } from 'core/controllers/Profile';
import { SafetyController } from 'core/controllers/Safety';

import { AllExceptionsFilter } from '../../shared/filters/index.js';
import { ProfilesController } from './profiles.controller.js';
import { SafetyRestController } from '../safety/safety.controller.js';

import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';
import type { Server } from 'node:http';

/**
 * The same pipeline-level cover as the onboarding controller, for the same reason:
 * these routes carried the identical handler-level `@UsePipes` defect, where the
 * body schema was also applied to `@CurrentUser()` and rejected every valid
 * request. Only a request through the real pipeline sees it.
 */
describe('body validation is scoped to the body', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProfilesController, SafetyRestController] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.use((req: express.Request & { user?: unknown }, _res: express.Response, next: express.NextFunction) => {
      req.user = { id: 'usr-1', email: 'a@b.co', emailVerified: true, name: 'A', role: 'user' };
      next();
    });
    app.use(express.json());
    await app.init();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts a valid profile update', async () => {
    const update = jest.spyOn(ProfileController, 'updateProfile').mockResolvedValue({} as never);

    const response: Response = await request(app.getHttpServer() as Server).patch('/profile').send({ displayName: 'Ada', heightCm: 168 });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith('usr-1', { displayName: 'Ada', heightCm: 168 });
  });

  it('accepts a valid goal update', async () => {
    const update = jest.spyOn(ProfileController, 'updateGoal').mockResolvedValue({} as never);

    const response: Response = await request(app.getHttpServer() as Server).patch('/profile/goal').send({ startingWeightKg: 72, type: 'maintenance' });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith('usr-1', { startingWeightKg: 72, type: 'maintenance' });
  });

  it('accepts a valid preferences update', async () => {
    const update = jest.spyOn(ProfileController, 'updatePreferences').mockResolvedValue({} as never);

    const response: Response = await request(app.getHttpServer() as Server).patch('/profile/preferences').send({ mealsPerDay: 4 });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith('usr-1', { mealsPerDay: 4 });
  });

  it('accepts a valid restrictions replacement', async () => {
    const set = jest.spyOn(SafetyController, 'setRestrictions').mockResolvedValue(undefined);

    const response: Response = await request(app.getHttpServer() as Server).put('/safety/restrictions').send({ allergies: [], intolerances: [] });

    expect(response.status).toBe(204);
    expect(set).toHaveBeenCalledWith('usr-1', { allergies: [], intolerances: [] });
  });

  it('still rejects an out-of-range height', async () => {
    const response: Response = await request(app.getHttpServer() as Server).patch('/profile').send({ heightCm: 3 });

    expect(response.status).toBe(422);
    expect((response.body as { fieldErrors: Record<string, string[]> }).fieldErrors).toHaveProperty('heightCm');
  });

  it('still strips a userId smuggled into the body', async () => {
    const update = jest.spyOn(ProfileController, 'updateProfile').mockResolvedValue({} as never);

    await request(app.getHttpServer() as Server).patch('/profile').send({ displayName: 'Ada', userId: 'usr-somebody-else' });

    expect(update).toHaveBeenCalledWith('usr-1', { displayName: 'Ada' });
  });
});
