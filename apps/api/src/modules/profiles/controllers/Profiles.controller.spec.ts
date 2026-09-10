import { afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { ProfileController } from 'core/controllers/Profile';
import { SafetyController } from 'core/controllers/Safety';

import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { ProfilesController } from './Profiles.controller.js';
import { ProfilesService } from '../services/index.js';
import { SafetyController as SafetyRoutes } from '../../safety/controllers/index.js';
import { SafetyService } from '../../safety/services/index.js';

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
    const moduleRef = await Test.createTestingModule({
      controllers: [ProfilesController, SafetyRoutes],
      providers: [ProfilesService, SafetyService]
    }).compile();

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

  /**
   * The language switch sends exactly this and nothing else.
   *
   * The UI language comes from a cookie and the *data* language from
   * `profiles.locale`, so a `locale` that is validated away leaves a user reading
   * an English interface full of Spanish ingredient names — which is what was
   * reported, and what this asserts cannot happen silently.
   */
  it('carries a lone locale through to the controller', async () => {
    const update = jest.spyOn(ProfileController, 'updateProfile').mockResolvedValue({} as never);

    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile')
      .send({ locale: 'en-GB' });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith('usr-1', { locale: 'en-GB' });
  });

  it('refuses a locale it does not ship rather than storing it', async () => {
    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile')
      .send({ locale: 'x' });

    expect(response.status).toBe(422);
  });

  it('accepts a valid profile update', async () => {
    const update = jest.spyOn(ProfileController, 'updateProfile').mockResolvedValue({} as never);

    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile')
      .send({ displayName: 'Ada', heightCm: 168 });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith('usr-1', { displayName: 'Ada', heightCm: 168 });
  });

  it('accepts a valid goal update', async () => {
    const update = jest.spyOn(ProfileController, 'updateGoal').mockResolvedValue({} as never);

    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile/goal')
      .send({ startingWeightKg: 72, type: 'maintenance' });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith('usr-1', { startingWeightKg: 72, type: 'maintenance' });
  });

  it('accepts a valid preferences update', async () => {
    const update = jest.spyOn(ProfileController, 'updatePreferences').mockResolvedValue({} as never);

    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile/preferences')
      .send({ cookingTimeMinutes: 30 });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith('usr-1', { cookingTimeMinutes: 30 });
  });

  it('accepts a targets override and passes only the fields that were sent', async () => {
    const update = jest.spyOn(ProfileController, 'updateTargets').mockResolvedValue({} as never);

    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile/targets')
      .send({ kcal: 2400 });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith('usr-1', { kcal: 2400 });
  });

  it('accepts nulls, which are how a user clears an override rather than changing it', async () => {
    const update = jest.spyOn(ProfileController, 'updateTargets').mockResolvedValue({} as never);

    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile/targets')
      .send({ carbsG: null, fatG: null, kcal: null, proteinG: null });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith('usr-1', { carbsG: null, fatG: null, kcal: null, proteinG: null });
  });

  it('rejects a non-numeric target without reaching the controller', async () => {
    const update = jest.spyOn(ProfileController, 'updateTargets').mockResolvedValue({} as never);

    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile/targets')
      .send({ kcal: 'muchas' });

    expect(response.status).toBe(422);
    expect(update).not.toHaveBeenCalled();
  });

  it('accepts a valid restrictions replacement', async () => {
    const set = jest.spyOn(SafetyController, 'setRestrictions').mockResolvedValue(undefined);

    const response: Response = await request(app.getHttpServer() as Server)
      .put('/safety/restrictions')
      .send({ allergies: [], intolerances: [] });

    expect(response.status).toBe(204);
    // `customAllergens` defaults to an empty list rather than arriving undefined:
    // the replace-all semantics depend on the field always being present, or an
    // older client omitting it would leave stale free-text entries in place.
    expect(set).toHaveBeenCalledWith('usr-1', { allergies: [], customAllergens: [], intolerances: [] });
  });

  it('still rejects an out-of-range height', async () => {
    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile')
      .send({ heightCm: 3 });

    expect(response.status).toBe(422);
    expect((response.body as { fieldErrors: Record<string, string[]> }).fieldErrors).toHaveProperty('heightCm');
  });

  it('still strips a userId smuggled into the body', async () => {
    const update = jest.spyOn(ProfileController, 'updateProfile').mockResolvedValue({} as never);

    await request(app.getHttpServer() as Server)
      .patch('/profile')
      .send({ displayName: 'Ada', userId: 'usr-somebody-else' });

    expect(update).toHaveBeenCalledWith('usr-1', { displayName: 'Ada' });
  });
});
